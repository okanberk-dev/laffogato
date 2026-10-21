"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  actionError,
  actionOk,
  fieldErrorsFromIssues,
  type ActionResult,
} from "@/lib/admin/action-result";
import { logAudit } from "@/lib/admin/audit";
import { requireRole } from "@/lib/admin/auth";
import { deletedAnswer } from "@/lib/admin/delete-answer";
import { wantsAnother } from "@/lib/admin/save-and-new";
import { moveAnswer, readMoveForm } from "@/lib/admin/list-order";
import { bulkMenuSchema } from "@/lib/admin/bulk-schema";
import { setAdminFlash } from "@/lib/admin/flash";
import { MAX_STORED_IMAGE_LENGTH } from "@/lib/admin/image-encode";
import {
  readMenuAllergens,
  tagsWithAllergens,
} from "@/lib/admin/menu-allergens-schema";
import {
  menuItemFieldsSchema,
  menuTagsFromForm,
} from "@/lib/admin/menu-item-schema";
import {
  bulkUpdateMenuItems,
  createMenuItem,
  deleteMenuItem,
  getMenuItem,
  listMenuItemLabels,
  MENU_CATEGORY_KEYS,
  moveMenuItem,
  updateMenuItem,
  type AdminMenuItem,
  type BulkMenuOp,
  type MenuCategoryKey,
} from "@/lib/admin/store";
import type { MenuAllergen } from "@/lib/menu/allergens";
import { sceneColumns } from "@/lib/backdrop/scene";
import {
  BACKDROP_FIELD,
  parseBackdropChoice,
  parseVesselChoice,
  VESSEL_FIELD,
} from "@/lib/backdrop/scene-core";

const HUE_VALUES = [
  "cream",
  "warm",
  "stone",
  "caramel",
  "espresso",
  "matcha",
  "pistachio",
  "rose",
  "bougainvillea",
  "dawn",
  "gold",
  "sky",
  "dark",
  "strawberry",
];

type ParsedMenuInput = Omit<ReturnType<typeof parseInput>, "tags"> & {
  /** The ticked four, plus `nuts` when the allergens name tree nuts. */
  tags: string[];
  name: string;
  priceMinor: number;
  priceMinorL: number;
  taxRatePct: number | null;
  /** Absent: the form had no allergen boxes, the stored value stays. */
  allergens?: MenuAllergen[] | null;
};

/**
 * The form, validated: name and both prices through menuItemFieldsSchema
 * (parseMoneyInput, CLAUDE.md rule 24), or the refusal with an error under
 * each field.
 */
function readMenuForm(
  formData: FormData,
): { ok: true; input: ParsedMenuInput } | { ok: false; result: ActionResult } {
  const fields = menuItemFieldsSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    price: String(formData.get("price") ?? ""),
    priceL: String(formData.get("priceL") ?? ""),
    taxRatePct: String(formData.get("taxRatePct") ?? ""),
  });
  // The fourteen allergen groups (TGK m.15/5): their own schema, so a
  // refused box answers under the group with the other fields' errors.
  const allergens = readMenuAllergens(formData);
  if (!fields.success || !allergens.ok) {
    return {
      ok: false,
      result: actionError(
        "Formdaki uyarıları gider.",
        fieldErrorsFromIssues([
          ...(fields.success ? [] : fields.error.issues),
          ...(allergens.ok ? [] : allergens.issues),
        ]),
      ),
    };
  }
  const base = parseInput(formData);
  const tags = tagsWithAllergens(base.tags, allergens.allergens);
  if (!tags.ok) {
    return {
      ok: false,
      result: actionError("Formdaki uyarıları gider.", {
        allergens: tags.error,
      }),
    };
  }
  return {
    ok: true,
    input: {
      ...base,
      tags: tags.tags,
      name: fields.data.name,
      priceMinor: fields.data.price,
      priceMinorL: fields.data.priceL,
      taxRatePct: fields.data.taxRatePct ?? null,
      // Never `allergens: undefined`: the store would write that as NULL.
      ...(allergens.allergens === undefined
        ? {}
        : { allergens: allergens.allergens }),
    },
  };
}

function parseInput(formData: FormData) {
  const categoryRaw = String(
    formData.get("categoryKey") ?? "matcha",
  ) as MenuCategoryKey;
  const categoryKey: MenuCategoryKey = MENU_CATEGORY_KEYS.includes(categoryRaw)
    ? categoryRaw
    : "matcha";
  const desc = String(formData.get("desc") ?? "").trim();
  const image = parseMenuImage(String(formData.get("image") ?? ""));
  const hueRaw = String(formData.get("hue") ?? "cream");
  const hue = HUE_VALUES.includes(hueRaw) ? hueRaw : "cream";
  const tags = menuTagsFromForm(formData.getAll("tags"));
  const sortOrder = parseInt(String(formData.get("sortOrder") ?? "0"), 10) || 0;
  const isActive = formData.get("isActive") === "on";

  return {
    categoryKey,
    desc,
    hue,
    image,
    tags,
    sortOrder,
    isActive,
  };
}

/**
 * The stored photo's length cap: the uploader downscales until a photo fits
 * under this same number (`image-encode.ts`) or tells the operator it cannot.
 */
const MAX_MENU_IMAGE_BYTES = MAX_STORED_IMAGE_LENGTH;

/**
 * The photo for one menu item.
 *
 * The uploader submits a JSON array (`["data:image/jpeg;base64,..."]`) because
 * it is the same component the product wizard uses. A bare string is still
 * accepted so the site-relative paths already in the database survive an edit
 * - those used to be the ONLY accepted form, which meant the panel could not
 * add a photo at all on a deployment with no writable `public/`, and an https
 * URL typed into the field was discarded without a word.
 */
function parseMenuImage(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  let value = trimmed;
  if (trimmed.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      value =
        Array.isArray(parsed) && typeof parsed[0] === "string"
          ? parsed[0].trim()
          : "";
    } catch {
      return "";
    }
  }
  if (!value) return "";
  if (value.startsWith("data:image/")) {
    return value.length <= MAX_MENU_IMAGE_BYTES ? value : "";
  }
  if (/^https:\/\//i.test(value)) return value.length <= 500 ? value : "";
  // A site-relative asset path, e.g. /menu/matcha-latte.webp
  if (value.startsWith("/") && !value.startsWith("//") && value.length <= 300) {
    return value;
  }
  return "";
}

/**
 * The scene columns for this save (glass round): the photo's pick and cutout
 * flag, or the operator's "Sahne" and "Kap biçimi" choices. `previous` is the
 * stored row on an edit, null on a new item.
 */
function menuScene(
  input: ParsedMenuInput,
  formData: FormData,
  previous: AdminMenuItem | null,
) {
  return sceneColumns(
    {
      photo: input.image,
      hue: input.hue,
      category: input.categoryKey,
      backdrop: parseBackdropChoice(formData.get(BACKDROP_FIELD)),
      vessel: parseVesselChoice(formData.get(VESSEL_FIELD)),
    },
    previous ? { ...previous, photo: previous.image } : null,
  );
}

function revalidateMenu() {
  revalidatePath("/admin/menu");
  revalidatePath("/admin");
  revalidatePath("/");
}

export async function createMenuItemAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireRole("menu");
  const form = readMenuForm(formData);
  if (!form.ok) return form.result;
  const { input } = form;
  const scene = await menuScene(input, formData, null);
  const created = await createMenuItem({ ...input, ...scene });
  await logAudit({
    action: "create",
    entity: "menu_item",
    entityId: created.id,
    payload: {
      name: created.name,
      categoryKey: created.categoryKey,
      ...(input.allergens === undefined ? {} : { allergens: input.allergens }),
    },
  });
  revalidateMenu();
  // "Kaydet ve yenisini ekle": the next item's form, in the same category.
  if (wantsAnother(formData)) {
    await setAdminFlash(`"${created.name}" menüye eklendi. Sıradakini gir.`);
    redirect(`/admin/menu/yeni?cat=${encodeURIComponent(created.categoryKey)}`);
  }
  await setAdminFlash(`"${created.name}" menüye eklendi.`);
  redirect("/admin/menu");
}

export async function updateMenuItemAction(
  id: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireRole("menu");
  const form = readMenuForm(formData);
  if (!form.ok) return form.result;
  const { input } = form;
  const previous = await getMenuItem(id);
  if (!previous) return actionError("Bu kalem silinmiş; listeye dön.");
  const scene = await menuScene(input, formData, previous);
  await updateMenuItem(id, { ...input, ...scene });
  await logAudit({
    action: "update",
    entity: "menu_item",
    entityId: id,
    payload: {
      name: input.name,
      categoryKey: input.categoryKey,
      taxRatePct: input.taxRatePct,
      // What the menu says an item contains is worth a trail.
      ...(input.allergens === undefined ? {} : { allergens: input.allergens }),
    },
  });
  revalidateMenu();
  revalidatePath(`/admin/menu/${id}/duzenle`);
  await setAdminFlash(`"${input.name}" kaydedildi.`);
  redirect("/admin/menu");
}

/** A row's "Sil", behind ConfirmButton; the answer comes back as a toast. */
export async function deleteMenuItemAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireRole("menu");
  const id = String(formData.get("id") ?? "");
  if (!id) return actionError("Kalem seçilmedi.");
  const item = await getMenuItem(id);
  const removed = await deleteMenuItem(id);
  revalidateMenu();
  if (!removed) return actionError("Kalem zaten silinmiş.");
  await logAudit({
    action: "delete",
    entity: "menu_item",
    entityId: id,
    payload: item ? { name: item.name } : {},
  });
  return deletedAnswer(
    formData,
    `"${item?.name ?? id}" silindi.`,
    "/admin/menu",
  );
}

/**
 * The row's one-click "Tükendi" (hide from the menu) and "Satışa aç". It used
 * to take a tick and the bulk bar for the most common thing the counter does
 * all day. `isActive` is the state asked for, not a flip, so a double click
 * cannot undo itself.
 */
export async function setMenuItemActiveAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireRole("menu");
  const id = String(formData.get("id") ?? "");
  const raw = String(formData.get("isActive") ?? "");
  if (!id || (raw !== "true" && raw !== "false")) {
    return actionError("Geçersiz istek.");
  }
  const isActive = raw === "true";
  const item = await getMenuItem(id);
  if (!item) return actionError("Kalem bulunamadı; sayfayı yenile.");
  const { updated } = await bulkUpdateMenuItems([id], {
    kind: isActive ? "activate" : "deactivate",
  });
  revalidateMenu();
  if (updated > 0) {
    await logAudit({
      action: "update",
      entity: "menu_item",
      entityId: id,
      payload: { name: item.name, isActive },
    });
  }
  return actionOk(
    isActive
      ? `"${item.name}" yeniden menüde.`
      : `"${item.name}" menüden gizlendi (tükendi).`,
  );
}

/** How many item names one bulk audit row carries; the ids are all there. */
const BULK_AUDIT_NAMES = 100;

export interface BulkMenuActionState {
  error?: string;
  ok?: { op: string; updated: number };
}

export async function bulkMenuAction(
  _prev: BulkMenuActionState,
  formData: FormData,
): Promise<BulkMenuActionState> {
  await requireRole("menu");
  const parsed = bulkMenuSchema.safeParse({
    ids: String(formData.get("ids") ?? ""),
    op: String(formData.get("op") ?? ""),
    value: formData.get("value") ? String(formData.get("value")) : undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Geçersiz istek." };
  }
  const { ids, op, value } = parsed.data;
  // Read before the write: after a bulk delete the names are gone, and the
  // audit row is the only record of what was removed (admin audit CAT-20).
  const labels = await listMenuItemLabels(ids);
  let storeOp: BulkMenuOp;
  if (op === "set_category") {
    storeOp = { kind: "set_category", categoryKey: value as MenuCategoryKey };
  } else {
    storeOp = { kind: op };
  }
  const { updated } = await bulkUpdateMenuItems(ids, storeOp);
  await logAudit({
    action: op === "delete" ? "bulk_delete" : "bulk_update",
    entity: "menu_item",
    payload: {
      op,
      value,
      updated,
      idCount: ids.length,
      ids,
      names: labels.slice(0, BULK_AUDIT_NAMES).map((m) => m.name),
    },
  });
  revalidateMenu();
  return { ok: { op, updated } };
}

/**
 * The menu list's ↑ / ↓, within the item's category (the list unfiltered).
 * It used to be the "Sıralama" number on each item's form (admin audit
 * CAT-30, the order half).
 */
export async function moveMenuItemAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireRole("menu");
  const form = readMoveForm(formData);
  if (!form.ok) return actionError(form.error);
  const outcome = await moveMenuItem(form.id, form.direction);
  if (outcome === "moved") {
    await logAudit({
      action: "update",
      entity: "menu_item",
      entityId: form.id,
      payload: { move: form.direction },
    });
    revalidateMenu();
  }
  return moveAnswer(
    outcome,
    form.direction,
    "Kalem",
    "Bu kalem silinmiş; listeyi yenile.",
  );
}
