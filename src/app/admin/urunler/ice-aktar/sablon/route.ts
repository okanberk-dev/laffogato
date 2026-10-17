import { getAdminSession } from "@/lib/admin/auth";
import { productImportTemplate } from "@/lib/admin/product-import-core";
import { canAccess } from "@/lib/admin/roles";
import { listCategories } from "@/lib/admin/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * `GET /admin/urunler/ice-aktar/sablon` - the product import template: the
 * header row and one example row, UTF-8 with a byte order mark so Excel
 * opens the Turkish letters right. The example's category is the panel's
 * first one, so the file imports as it is.
 *
 * A route handler is not behind `requireRole` (that redirects pages) and
 * `proxy.ts` only redirects page views: the session and the role are
 * checked here.
 */
export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return new Response("Giriş gerekli.", {
      status: 401,
      headers: { "Cache-Control": "no-store" },
    });
  }
  if (!canAccess("products", session.role)) {
    return new Response("Bu sayfaya erişimin yok.", {
      status: 403,
      headers: { "Cache-Control": "no-store" },
    });
  }
  const categories = await listCategories();
  const csv = productImportTemplate(categories[0]?.label ?? "Kahve çekirdeği");
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="urun-sablonu.csv"',
      "Cache-Control": "private, no-store",
    },
  });
}
