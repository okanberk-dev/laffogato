import { notFound } from "next/navigation";

import { LegalDocForm } from "@/components/admin/legal-doc-form";
import { PageHeader } from "@/components/admin/forms";
import { requireRole } from "@/lib/admin/auth";
import { findLegalDoc } from "@/lib/legal/documents";
import { sectionsToMarkdown } from "@/lib/legal/markdown";
import { getLegalDocOverride } from "@/lib/legal/store";

import { updateLegalDocAction } from "../actions";

export const metadata = { title: "Admin · Yasal Belge Düzenle" };
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function EditLegalDocPage({ params }: PageProps) {
  await requireRole("legal");
  const { slug } = await params;
  const doc = findLegalDoc(slug);
  if (!doc) notFound();

  const override = await getLegalDocOverride(slug);

  const initial = {
    slug,
    title: override?.title || doc.title,
    summary: override?.summary || doc.summary,
    effectiveDate: override?.effectiveDate || doc.updatedAt,
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
        description="İçerik Markdown olarak düzenlenir. Yayınladığında bu metin kodlu varsayılanın yerine geçer; yayından kaldırınca varsayılana döner."
      />
      <LegalDocForm initial={initial} action={boundUpdate} />
    </main>
  );
}
