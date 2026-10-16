import { getAdminSession } from "@/lib/admin/auth";
import { tableQrSvg } from "@/lib/admin/cafe-table-qr";
import { cafeTableIdSchema } from "@/lib/admin/cafe-table-schema";
import { getCafeTable } from "@/lib/admin/cafe-tables";
import { canAccess } from "@/lib/admin/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * `GET /admin/masalar/{id}/qr` - one table's QR as an SVG download, for a
 * print shop or a design tool.
 *
 * A route handler is not behind `requireRole` (that redirects pages), and
 * `proxy.ts` only redirects page views, so the session and the role are
 * checked here, on every request.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAdminSession();
  if (!session) {
    return new Response("Giriş gerekli.", {
      status: 401,
      headers: { "Cache-Control": "no-store" },
    });
  }
  if (!canAccess("tables", session.role)) {
    return new Response("Bu sayfaya erişimin yok.", {
      status: 403,
      headers: { "Cache-Control": "no-store" },
    });
  }
  const { id } = await params;
  const parsed = cafeTableIdSchema.safeParse(id);
  const table = parsed.success ? await getCafeTable(parsed.data) : null;
  if (!table) {
    return new Response("Masa bulunamadı.", {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }
  const svg = await tableQrSvg(table.code);
  // The table name is staff-typed; the file name keeps only safe characters.
  const slug =
    table.name
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .toLowerCase()
      .slice(0, 40) || table.id;
  return new Response(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="masa-${slug}-qr.svg"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
