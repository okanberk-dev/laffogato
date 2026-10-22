import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/admin/forms";
import { Badge, BUTTON, EmptyState } from "@/components/admin/ui";
import { requireRole } from "@/lib/admin/auth";
import { findLegalDoc } from "@/lib/legal/documents";
import { LegalMarkdown } from "@/lib/legal/markdown";
import {
  getLegalDocOverride,
  getLegalOverrideArchive,
  type LegalDocOverride,
} from "@/lib/legal/store";

export const metadata = { title: "Admin · Yasal belge önizleme" };
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ arsiv?: string | string[] }>;
}

/**
 * The saved text of a legal override as /hukuk/<slug> would show it: the
 * draft, the published one, or (`?arsiv=<id>`) an archived one. Owner-only,
 * like the editor. The public page reads only a published override, so
 * "Önizle" on a draft used to open the coded default instead (CON-10).
 */
export default async function LegalPreviewPage({
  params,
  searchParams,
}: PageProps) {
  await requireRole("legal");
  const { slug } = await params;
  const doc = findLegalDoc(slug);
  if (!doc) notFound();

  const { arsiv } = await searchParams;
  const archiveId = typeof arsiv === "string" ? arsiv : "";
  let text: LegalDocOverride | null;
  let state: { label: string; tone: "success" | "warning" | "neutral" };
  if (archiveId) {
    const row = await getLegalOverrideArchive(archiveId);
    text = row && row.slug === slug ? row : null;
    state = { label: "Arşivdeki metin", tone: "neutral" };
  } else {
    text = await getLegalDocOverride(slug);
    state = text?.isPublished
      ? { label: "Yayındaki özel metin", tone: "success" }
      : { label: "Taslak: sitede görünmüyor", tone: "warning" };
  }

  const back = (
    <div className="flex flex-wrap gap-2">
      <Link href={`/admin/hukuk/${slug}`} className={BUTTON.ghost}>
        Düzenlemeye dön
      </Link>
      <Link href="/admin/hukuk" className={BUTTON.ghost}>
        Yasal belgeler
      </Link>
    </div>
  );

  if (!text) {
    return (
      <main className="w-full px-4 pt-5 pb-10 sm:px-5 [&>:not(header)]:max-w-3xl">
        <PageHeader
          eyebrow={`Önizleme · /hukuk/${slug}`}
          title={doc.title}
          action={back}
        />
        <EmptyState
          title={archiveId ? "Bu arşiv kaydı yok" : "Kayıtlı özel metin yok"}
          description="Sitede bu belgenin hazır metni görünüyor."
        />
      </main>
    );
  }

  return (
    <main className="w-full px-4 pt-5 pb-10 sm:px-5 [&>:not(header)]:max-w-3xl">
      <PageHeader
        eyebrow={`Önizleme · /hukuk/${slug}`}
        title={doc.title}
        description="Bu sayfa yalnız panelde açılır. Müşteri /hukuk sayfasında yalnız yayındaki metni görür."
        action={back}
      />
      <div className="mb-4">
        <Badge tone={state.tone}>{state.label}</Badge>
      </div>
      <div>
        <header className="legal-head">
          <div className="eyebrow" style={{ marginBottom: 12 }}>
            {doc.category}
          </div>
          <h2 className="h1" style={{ marginBottom: 18 }}>
            {text.title || doc.title}
          </h2>
          <p className="lede">{text.summary || doc.summary}</p>
          <div className="legal-meta">
            <span className="eyebrow">Son güncelleme</span>
            <span>
              {text.effectiveDate ||
                (text.isPublished ? doc.updatedAt : "Yayınlandığı gün")}
            </span>
          </div>
        </header>
        {text.bodyMarkdown.trim() ? (
          <LegalMarkdown body={text.bodyMarkdown} />
        ) : (
          <EmptyState
            title="İçerik boş"
            description="Boş bir metin yayınlanamaz; yayında hazır metin görünür."
          />
        )}
      </div>
    </main>
  );
}
