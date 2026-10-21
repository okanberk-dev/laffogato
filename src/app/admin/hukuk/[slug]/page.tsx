import Link from "next/link";
import { notFound } from "next/navigation";

import { LegalDocForm } from "@/components/admin/legal-doc-form";
import { PageHeader } from "@/components/admin/forms";
import { BUTTON, TONE_SOFT } from "@/components/admin/ui";
import { requireRole } from "@/lib/admin/auth";
import { recordedConsentVersion } from "@/lib/admin/legal-schema";
import { findLegalDoc } from "@/lib/legal/documents";
import { sectionsToMarkdown } from "@/lib/legal/markdown";
import { KARAOKE_CONSENT_DOCS } from "@/lib/legal/meta";
import {
  listLegalDocOverrides,
  listLegalOverrideArchive,
} from "@/lib/legal/store";

import { updateLegalDocAction } from "../actions";
import { LegalArchiveList } from "../archive-list";

export const metadata = { title: "Admin · Yasal belge düzenle" };
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function EditLegalDocPage({ params }: PageProps) {
  await requireRole("legal");
  const { slug } = await params;
  const doc = findLegalDoc(slug);
  if (!doc) notFound();

  const [overrides, archive] = await Promise.all([
    listLegalDocOverrides(),
    listLegalOverrideArchive({ slug, limit: 20 }),
  ]);
  const override = overrides[slug] ?? null;
  const recorded = recordedConsentVersion(slug, overrides);
  const karaoke = (KARAOKE_CONSENT_DOCS as readonly string[]).includes(slug);

  const initial = {
    slug,
    title: override?.title || doc.title,
    summary: override?.summary || doc.summary,
    // A new override starts with no date, never the coded one: left as it
    // was, a rewritten checkout text was published under the coded
    // revision's label and orders could not tell the two apart (CON-M01).
    // Blank means "the day it goes live" (resolveEffectiveDate).
    effectiveDate: override?.effectiveDate ?? "",
    // Prefill with the override body, or the coded default serialized to Markdown.
    bodyMarkdown: override?.bodyMarkdown || sectionsToMarkdown(doc),
    isPublished: override?.isPublished ?? false,
  };

  // Next 16: bind the slug into the action (NOT a plain arrow closure).
  const boundUpdate = updateLegalDocAction.bind(null, slug);

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow={`Yasal belge · /hukuk/${slug}`}
        title={doc.title}
        description="İçerik Markdown olarak düzenlenir. Yayınladığında bu metin /hukuk sayfasında ve uygulamada sitedeki hazır metnin yerine geçer; yayından kaldırınca hazır metin döner. Her kayıtta önceki metin arşive alınır."
        action={
          <div className="flex flex-wrap gap-2">
            {override && (
              <Link
                href={`/admin/hukuk/${slug}/onizle`}
                className={BUTTON.ghost}
              >
                {override.isPublished
                  ? "Kayıtlı metni önizle"
                  : "Taslağı önizle"}
              </Link>
            )}
            <a
              href={`/hukuk/${slug}`}
              target="_blank"
              rel="noopener"
              className={BUTTON.ghost}
              aria-label="Yayındakini aç (yeni sekme)"
            >
              Yayındakini aç ↗
            </a>
          </div>
        }
      />
      {recorded && (
        <p
          className={`mb-5 rounded-2xl px-4 py-3 text-sm ${TONE_SOFT.info}`}
          role="note"
        >
          {karaoke
            ? "Bu belge karaoke rezervasyonunun onayında kaydedilir. "
            : "Bu belge sipariş onayında kaydedilir. "}
          Onaylar şu an <strong>{recorded}</strong> sürümünü kaydediyor. Metni
          değiştirip yayınlarsan yürürlük tarihi bundan sonra olmalı.
        </p>
      )}
      <LegalDocForm initial={initial} action={boundUpdate} />
      <LegalArchiveList
        rows={archive}
        showDoc={false}
        description="Bu belgenin varsayılana döndürülen ya da üzerine kaydedilen son 20 metni. Geri yükleyince şu anki metin de arşive alınır."
      />
    </main>
  );
}
