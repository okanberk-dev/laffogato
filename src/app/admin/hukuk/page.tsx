import Link from "next/link";

import { Card, GhostButton, PageHeader } from "@/components/admin/forms";
import { requireRole } from "@/lib/admin/auth";
import { LEGAL_DOCS } from "@/lib/legal/documents";
import { listLegalDocOverrides } from "@/lib/legal/store";

import { resetLegalDocAction } from "./actions";

export const metadata = { title: "Admin · Yasal Belgeler" };
export const dynamic = "force-dynamic";

export default async function LegalDocsPage() {
  await requireRole("legal");
  const overrides = await listLegalDocOverrides();

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Sistem · Hukuk"
        title="Yasal Belgeler"
        description="KVKK, gizlilik, mesafeli satış, iade ve diğer belgeler. Bir belgeyi düzenleyip yayınladığında /hukuk sayfasında kodlu varsayılan yerine senin metnin gösterilir; yayından kaldırınca varsayılana döner."
      />

      <Card>
        <div className="grid gap-2">
          {LEGAL_DOCS.map((doc) => {
            const ov = overrides[doc.slug];
            const status = !ov
              ? { label: "Varsayılan", tone: "bg-neutral-100 text-neutral-500" }
              : ov.isPublished
                ? {
                    label: "Yayında (özel)",
                    tone: "bg-green-50 text-green-700",
                  }
                : { label: "Taslak", tone: "bg-amber-50 text-amber-700" };
            return (
              <div
                key={doc.slug}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--admin-border)] p-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-neutral-900">
                      {doc.title}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] tracking-[0.16em] uppercase ${status.tone}`}
                    >
                      {status.label}
                    </span>
                  </div>
                  <div
                    className="text-[10px] tracking-[0.18em] text-neutral-500 uppercase"
                    style={{ fontFamily: "var(--mono), monospace" }}
                  >
                    {doc.category} · /hukuk/{doc.slug}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/hukuk/${doc.slug}`}
                    target="_blank"
                    className="inline-flex items-center justify-center rounded-full border border-[var(--admin-border)] px-3 py-1.5 text-xs text-neutral-600 hover:border-[var(--admin-primary)] hover:text-[var(--admin-primary)]"
                  >
                    Önizle ↗
                  </Link>
                  {ov && (
                    <form action={resetLegalDocAction}>
                      <input type="hidden" name="slug" value={doc.slug} />
                      <GhostButton type="submit" className="text-xs">
                        Varsayılana döndür
                      </GhostButton>
                    </form>
                  )}
                  <Link
                    href={`/admin/hukuk/${doc.slug}`}
                    className="inline-flex items-center justify-center rounded-xl bg-[var(--admin-primary)] px-4 py-1.5 text-xs font-medium text-white hover:bg-[var(--admin-primary-hover)]"
                  >
                    Düzenle
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </main>
  );
}
