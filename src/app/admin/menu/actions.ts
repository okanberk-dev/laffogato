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
  NEW_DATA_IMAGE_REFUSAL,
  refusesNewDataImages,
} from "@/lib/images/store";
import {
  readMenuAllergens,
  tagsWithAllergens,
} from "@/lib/admin/menu-allergens-schema";
import {
  menuItemFieldsSchema,
  menuTagsFromForm,
} from "@/lib/admin/menu-item-schema";
import {
  MENU_ITEM_CHANGED_MEANWHILE,
  readLoadedSale,
  touchedSaleFields,
} from "@/lib/admin/menu-sale-guard";
import {
  bulkUpdateMenuItems,
  createMenuItem,
  deleteMenuItem,
  getMenuItem,
  markMenuPricesChanged,
  listMenuItemLabels,
  MENU_CATEGORY_KEYS,
  moveMenuItem,
  updateMenuItem,
  type AdminMenuItem,
  type BulkMenuOp,
  type MenuCategoryKey,
} from "@/lib/admin/store";
import { sameMenuAllergens, type MenuAllergen } from "@/lib/menu/allergens";
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
  const image = parseMenuImage(String(formData.get("image") ?? ""));
  if (!fields.success || !allergens.ok || !image.ok) {
    return {
      ok: false,
      result: actionError("Formdaki uyarıları gider.", {
        ...fieldErrorsFromIssues([
          ...(fields.success ? [] : fields.error.issues),
          ...(allergens.ok ? [] : allergens.issues),
        ]),
        ...(image.ok ? {} : { image: image.error }),
      }),
    };
  }
  const base = parseInput(formData, image.value);
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

function parseInput(formData: FormData, image: string) {
  const categoryRaw = String(
    formData.get("categoryKey") ?? "matcha",
  ) as MenuCategoryKey;
  const categoryKey: MenuCategoryKey = MENU_CATEGORY_KEYS.includes(categoryRaw)
    ? categoryRaw
    : "matcha";
  const desc = String(formData.get("desc") ?? "").trim();
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

/** The photo field's answer to a value that is no photo, link or path. */
const UNREADABLE_IMAGE =
  "Fotoğraf yükle ya da https:// ile başlayan bir görsel adresi gir.";

/**
 * The photo for one menu item, or the reason it cannot be stored.
 *
 * The uploader submits a JSON array (`["data:image/jpeg;base64,..."]`) because
 * it is the same component the product wizard uses. A bare string is still
 * accepted so the site-relative paths already in the database survive an edit
 * - those used to be the ONLY accepted form, which meant the panel could not
 * add a photo at all on a deployment with no writable `public/`, and an https
 * URL typed into the field was discarded without a word.
 *
 * A value it cannot store is refused under the photo, never saved as "no
 * photo": the shared uploader takes an http:// link (products accept one),
 * and that used to save the item without its photo behind a success toast.
 */
function parseMenuImage(
  raw: string,
): { ok: true; value: string } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, value: "" };
  let value = trimmed;
  if (trimmed.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (!Array.isArray(parsed)) return { ok: false, error: UNREADABLE_IMAGE };
      if (parsed.length === 0) return { ok: true, value: "" };
      if (typeof parsed[0] !== "string") {
        return { ok: false, error: UNREADABLE_IMAGE };
      }
      value = parsed[0].trim();
    } catch {
      return { ok: false, error: UNREADABLE_IMAGE };
    }
  }
  if (!value) return { ok: true, value: "" };
  if (value.startsWith("data:image/")) {
    return value.length <= MAX_MENU_IMAGE_BYTES
      ? { ok: true, value }
      : {
          ok: false,
          error:
            "Fotoğraf saklanamayacak kadar büyük; daha küçük bir fotoğraf seç.",
        };
  }
  if (/^https:\/\//i.test(value)) {
    return value.length <= 500
      ? { ok: true, value }
      : { ok: false, error: "Görsel adresi en çok 500 karakter olabilir." };
  }
  if (/^http:\/\//i.test(value)) {
    return {
      ok: false,
      error: "Görsel adresi https:// ile başlamalı (http:// saklanmaz).",
    };
  }
  // A site-relative asset path, e.g. /menu/matcha-latte.webp
  if (value.startsWith("/") && !value.startsWith("//") && value.length <= 300) {
    return { ok: true, value };
  }
  return { ok: false, error: UNREADABLE_IMAGE };
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
  if (refusesNewDataImages([input.image], [])) {
    return actionError(NEW_DATA_IMAGE_REFUSAL, {
      image: NEW_DATA_IMAGE_REFUSAL,
    });
  }
  const scene = await menuScene(input, formData, null);
  const created = await createMenuItem({ ...input, ...scene });
  // A price on the menu that was not there before: the list changed.
  if (created.isActive) await markMenuPricesChanged(new Date());
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
  // A hidden item (a copy starts so) is saved, not on the menu yet.
  const saved = created.isActive
    ? `"${created.name}" menüye eklendi.`
    : `"${created.name}" kaydedildi; “Menüde göster” işaretlenene kadar menüde görünmez.`;
  // "Kaydet ve yenisini ekle": the next item's form, in the same category.
  if (wantsAnother(formData)) {
    await setAdminFlash(`${saved} Sıradakini gir.`);
    redirect(`/admin/menu/yeni?cat=${encodeURIComponent(created.categoryKey)}`);
  }
  await setAdminFlash(saved);
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
  if (refusesNewDataImages([input.image], [previous.image])) {
    return actionError(NEW_DATA_IMAGE_REFUSAL, {
      image: NEW_DATA_IMAGE_REFUSAL,
    });
  }
  const scene = await menuScene(input, formData, previous);
  // The prices and "Menüde göster" as the form loaded them: an untouched one
  // is not written back over the panel's or another tab's change, a touched
  // one only if nobody moved it meanwhile (menu-sale-guard.ts).
  const loaded = readLoadedSale(formData);
  const saved = await updateMenuItem(id, { ...input, ...scene }, loaded);
  if (saved === "stale") return actionError(MENU_ITEM_CHANGED_MEANWHILE);
  if (saved === null) return actionError("Bu kalem silinmiş; listeye dön.");
  // A price this save wrote, different from the stored one: the price
  // list's day may be stale (the rule the panel's write follows too).
  const written = touchedSaleFields(loaded, input);
  const priceMoved =
    written.includes("priceMinor") && previous.priceMinor !== input.priceMinor;
  const largeMoved =
    written.includes("priceMinorL") &&
    (previous.priceMinorL || 0) !== (input.priceMinorL || 0);
  if (priceMoved || largeMoved) await markMenuPricesChanged(new Date());
  await logAudit({
    action: "update",
    entity: "menu_item",
    entityId: id,
    payload: {
      name: input.name,
      categoryKey: input.categoryKey,
      taxRatePct: input.taxRatePct,
      // A price move is the change the köşk's panel and the price list
      // care about: in the trail with its new amount, only a price this
      // save wrote (an untouched one may be the panel's newer value).
      ...(priceMoved ? { priceMinor: input.priceMinor } : {}),
      ...(largeMoved ? { priceMinorL: input.priceMinorL } : {}),
      // What the menu says an item contains is worth a trail, when it
      // changed: the form posts it on every save.
      ...(input.allergens === undefined ||
      sameMenuAllergens(previous.allergens, input.allergens)
        ? {}
        : { allergens: input.allergens }),
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
