"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  actionError,
  fieldErrorsFromIssues,
  type ActionResult,
} from "@/lib/admin/action-result";
import { logAudit } from "@/lib/admin/audit";
import { requireRole } from "@/lib/admin/auth";
import { deletedAnswer } from "@/lib/admin/delete-answer";
import {
  categoryDeleteBlocker,
  categoryFormSchema,
  categorySlugChangeBlocker,
  categorySlugTaken,
} from "@/lib/admin/category-schema";
import { setAdminFlash } from "@/lib/admin/flash";
import {
  createCategory,
  deleteCategory,
  getCategory,
  listCategories,
  listProducts,
  restoreCategory,
  updateCategory,
  type CategoryInput,
} from "@/lib/admin/store";

function parseInput(
  formData: FormData,
): { ok: true; input: CategoryInput } | { ok: false; result: ActionResult } {
  const parsed = categoryFormSchema.safeParse({
    slug: String(formData.get("slug") ?? ""),
    label: String(formData.get("label") ?? ""),
    icon: String(formData.get("icon") ?? ""),
    sortOrder: String(formData.get("sortOrder") ?? ""),
  });
  if (!parsed.success) {
    return {
      ok: false,
      result: actionError(
        "Formdaki uyarıları gider.",
        fieldErrorsFromIssues(parsed.error.issues),
      ),
    };
  }
  return { ok: true, input: parsed.data };
}

function revalidateCategories() {
  revalidatePath("/admin/kategoriler");
  revalidatePath("/admin/urunler");
}

export async function createCategoryAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireRole("categories");
  const form = parseInput(formData);
  if (!form.ok) return form.result;
  const taken = categorySlugTaken(form.input.slug, await listCategories());
  if (taken) return actionError("Formdaki uyarıları gider.", { slug: taken });
  const created = await createCategory(form.input);
  await logAudit({
    action: "create",
    entity: "category",
    entityId: created.id,
    payload: { slug: created.slug, label: created.label },
  });
  revalidateCategories();
  await setAdminFlash(`"${created.label}" kategorisi eklendi.`);
  redirect("/admin/kategoriler");
}

export async function updateCategoryAction(
  id: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireRole("categories");
  const form = parseInput(formData);
  if (!form.ok) return form.result;
  const existing = await getCategory(id);
  if (!existing) return actionError("Bu kategori silinmiş; listeye dön.");
  if (form.input.slug !== existing.slug) {
    // Products point at the slug: moving the only row that carries it
    // strands them, exactly as a delete would.
    const [categories, products] = await Promise.all([
      listCategories(),
      listProducts(),
    ]);
    const blocker =
      categorySlugTaken(form.input.slug, categories, id) ??
      categorySlugChangeBlocker(
        existing,
        form.input.slug,
        categories,
        products,
      );
    if (blocker) {
      return actionError("Formdaki uyarıları gider.", { slug: blocker });
    }
  }
  const updated = await updateCategory(id, form.input);
  if (!updated) return actionError("Bu kategori silinmiş; listeye dön.");
  await logAudit({
    action: "update",
    entity: "category",
    entityId: id,
    payload: { slug: form.input.slug, label: form.input.label },
  });
  revalidateCategories();
  await setAdminFlash(`"${updated.label}" kaydedildi.`);
  redirect("/admin/kategoriler");
}

/**
 * "Sil", behind a confirm. Refused while products still sit in the
 * category (categoryDeleteBlocker): they would be left in a filter that no
 * longer exists.
 */
export async function deleteCategoryAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireRole("categories");
  const id = String(formData.get("id") ?? "");
  if (!id) return actionError("Kategori seçilmedi.");
  const category = await getCategory(id);
  if (!category) {
    revalidateCategories();
    return actionError("Kategori zaten silinmiş.");
  }
  const [categories, products] = await Promise.all([
    listCategories(),
    listProducts(),
  ]);
  const blocker = categoryDeleteBlocker(category, categories, products);
  if (blocker) return actionError(blocker);
  const removed = await deleteCategory(id);
  revalidateCategories();
  if (!removed) return actionError("Kategori zaten silinmiş.");
  // The check above and the delete are two statements: a twin deleted by
  // someone else in the same moment, or products moved in meanwhile, would
  // leave products with no category. Look again, and put this one back if so.
  const [after, productsAfter] = await Promise.all([
    listCategories(),
    listProducts(),
  ]);
  const stranded = categoryDeleteBlocker(category, after, productsAfter);
  if (stranded) {
    await restoreCategory(category);
    revalidateCategories();
    return actionError(stranded);
  }
  await logAudit({
    action: "delete",
    entity: "category",
    entityId: id,
    payload: { slug: category.slug, label: category.label },
  });
  return deletedAnswer(
    formData,
    `"${category.label}" silindi.`,
    "/admin/kategoriler",
  );
}
