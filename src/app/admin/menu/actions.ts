"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { logAudit } from "@/lib/admin/audit";
import { requireRole } from "@/lib/admin/auth";
import { bulkMenuSchema } from "@/lib/admin/bulk-schema";
import {
  bulkUpdateMenuItems,
  createMenuItem,
  deleteMenuItem,
  MENU_CATEGORY_KEYS,
  updateMenuItem,
  type BulkMenuOp,
  type MenuCategoryKey,
} from "@/lib/admin/store";

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

function parseInput(formData: FormData) {
  const categoryRaw = String(
    formData.get("categoryKey") ?? "matcha",
  ) as MenuCategoryKey;
  const categoryKey: MenuCategoryKey = MENU_CATEGORY_KEYS.includes(categoryRaw)
    ? categoryRaw
    : "matcha";
  const name = String(formData.get("name") ?? "").trim();
  const desc = String(formData.get("desc") ?? "").trim();
  const priceText = String(formData.get("price") ?? "0").replace(",", ".");
  const priceMajor = parseFloat(priceText);
  const priceMinor = Number.isFinite(priceMajor)
    ? Math.round(priceMajor * 100)
    : 0;
  const priceLText = String(formData.get("priceL") ?? "")
    .trim()
    .replace(",", ".");
  const priceLMajor = parseFloat(priceLText);
  const priceMinorL =
    priceLText !== "" && Number.isFinite(priceLMajor) && priceLMajor > 0
      ? Math.round(priceLMajor * 100)
      : 0;
  const image = parseMenuImage(String(formData.get("image") ?? ""));
  const hueRaw = String(formData.get("hue") ?? "cream");
  const hue = HUE_VALUES.includes(hueRaw) ? hueRaw : "cream";
  const tagsRaw = String(formData.get("tags") ?? "");
  const tags = tagsRaw
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  const sortOrder = parseInt(String(formData.get("sortOrder") ?? "0"), 10) || 0;
  const isActive = formData.get("isActive") === "on";

  return {
    categoryKey,
    name,
    desc,
    priceMinor,
    priceMinorL,
    hue,
    image,
    tags,
    sortOrder,
    isActive,
  };
}

/** Uploaded JPEG, resized to 1600 px by the client, is about this big. */
const MAX_MENU_IMAGE_BYTES = 2 * 1024 * 1024;

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

function revalidateMenu() {
  revalidatePath("/admin/menu");
  revalidatePath("/admin");
  revalidatePath("/");
}

export async function createMenuItemAction(formData: FormData) {
  await requireRole("menu");
  const input = parseInput(formData);
  if (!input.name) return;
  const created = await createMenuItem(input);
  await logAudit({
    action: "create",
    entity: "menu_item",
    entityId: created.id,
    payload: { name: created.name, categoryKey: created.categoryKey },
  });
  revalidateMenu();
  redirect("/admin/menu");
}

export async function updateMenuItemAction(id: string, formData: FormData) {
  await requireRole("menu");
  const input = parseInput(formData);
  await updateMenuItem(id, input);
  await logAudit({
    action: "update",
    entity: "menu_item",
    entityId: id,
    payload: { name: input.name, categoryKey: input.categoryKey },
  });
  revalidateMenu();
  revalidatePath(`/admin/menu/${id}/duzenle`);
  redirect("/admin/menu");
}

export async function deleteMenuItemAction(formData: FormData) {
  await requireRole("menu");
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await deleteMenuItem(id);
  await logAudit({ action: "delete", entity: "menu_item", entityId: id });
  revalidateMenu();
}

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
    payload: { op, value, updated, idCount: ids.length },
  });
  revalidateMenu();
  return { ok: { op, updated } };
}
