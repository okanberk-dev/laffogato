import { Card, PageHeader } from "@/components/admin/forms";
import {
  ActionMenu,
  ActionMenuLink,
  Badge,
  ConfirmButton,
  PageShell,
} from "@/components/admin/ui";
import { AdminIcon } from "@/components/admin/ui/icons";
import { ROW_CONTROL } from "@/components/admin/ui/styles";
import Link from "@/components/link";
import { requireRole } from "@/lib/admin/auth";
import type { AdminTone } from "@/lib/admin/tone";
import { LEGAL_DOCS } from "@/lib/legal/documents";
import {
  listLegalDocOverrides,
  listLegalOverrideArchive,
  type LegalDocOverride,
} from "@/lib/legal/store";

import { resetLegalDocAction } from "./actions";
import { LegalArchiveList } from "./archive-list";

export const metadata = { title: "Admin · Yasal belgeler" };
export const dynamic = "force-dynamic";

function statusOf(ov: LegalDocOverride | undefined): {
  label: string;
  tone: AdminTone;
} {
  if (!ov) return { label: "Hazır metin", tone: "neutral" };
  return ov.isPublished
    ? { label: "Özel metin yayında", tone: "success" }
    : { label: "Taslak", tone: "warning" };
}

export default async function LegalDocsPage() {
  await requireRole("legal");
  const [overrides, archive] = await Promise.all([
    listLegalDocOverrides(),
    listLegalOverrideArchive({ limit: 10 }),
  ]);

  return (
    <PageShell width="detail">
      <PageHeader
        title="Yasal belgeler"
        description="KVKK, gizlilik, mesafeli satış, iade ve diğer belgelerin metinleri."
        help={
          <p>
            Bir belgeyi düzenleyip yayınladığında /hukuk sayfasında ve
            uygulamada sitedeki hazır metnin yerine senin metnin görünür;
            yayından kaldırınca ya da varsayılana döndürünce hazır metin geri
            gelir. Değiştirilen ve kaldırılan metinler arşivde kalır.
          </p>
        }
      />

      <Card>
        <ul className="grid gap-2">
          {LEGAL_DOCS.map((doc) => {
            const ov = overrides[doc.slug];
            const status = statusOf(ov);
            return (
              <li
                key={doc.slug}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--admin-border)] p-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/admin/hukuk/${doc.slug}`}
                      className="font-medium break-words text-[var(--admin-text)] underline-offset-4 hover:text-[var(--admin-primary)] hover:underline"
                    >
                      {doc.title}
                    </Link>
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </div>
                  <div className="mt-1 text-xs break-all text-[var(--admin-text-soft)]">
                    {doc.category} · /hukuk/{doc.slug}
                  </div>
                </div>
                {/* One text action (Düzenle); the published page is an icon
                    link, and the draft preview and the reset sit in ⋯. */}
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={`/hukuk/${doc.slug}`}
                    target="_blank"
                    rel="noopener"
                    className={ROW_CONTROL.icon}
                    aria-label={`Yayındakini aç: ${doc.title} (yeni sekme)`}
                    title="Yayındakini aç"
                  >
                    <AdminIcon name="external" />
                  </a>
                  <Link
                    href={`/admin/hukuk/${doc.slug}`}
                    className={ROW_CONTROL.text}
                    aria-label={`Düzenle: ${doc.title}`}
                  >
                    Düzenle
                  </Link>
                  {ov ? (
                    <ActionMenu label={`${doc.title} işlemleri`}>
                      {!ov.isPublished ? (
                        <ActionMenuLink
                          href={`/admin/hukuk/${doc.slug}/onizle`}
                        >
                          Taslağı önizle
                        </ActionMenuLink>
                      ) : null}
                      <ConfirmButton
                        action={resetLegalDocAction}
                        hidden={{ slug: doc.slug }}
                        label="Varsayılana döndür"
                        variant="menuDanger"
                        ariaLabel={`Varsayılana döndür: ${doc.title}`}
                        title={`${doc.title} varsayılana dönsün mü?`}
                        description={
                          ov.isPublished
                            ? "Yayındaki özel metin kalkar; /hukuk sayfası ve uygulama sitedeki hazır metni gösterir. Özel metin arşive alınır, aşağıdan geri yükleyebilirsin."
                            : "Taslak kalkar; sitede zaten hazır metin görünüyor. Taslak arşive alınır, aşağıdan geri yükleyebilirsin."
                        }
                      />
                    </ActionMenu>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      <LegalArchiveList
        rows={archive}
        showDoc
        description="Varsayılana döndürülen ya da üzerine kaydedilen son 10 metin. Geri yükleyince şu anki metin de arşive alınır; bir belgenin bütün arşivi düzenleme sayfasında."
      />
    </PageShell>
  );
}
