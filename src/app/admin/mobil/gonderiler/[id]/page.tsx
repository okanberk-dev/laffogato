import { notFound } from "next/navigation";

import { PageHeader } from "@/components/admin/forms";
import { ConfirmButton } from "@/components/admin/ui";
import { requireRole } from "@/lib/admin/auth";
import { campaignAudienceCount } from "@/lib/admin/campaign-mail";
import { canAccess } from "@/lib/admin/roles";
import { getAppPost } from "@/lib/admin/store";

import { BackLink, DELETE_TEXT } from "../../app-content-list";
import { deletePostAction, updatePostAction } from "../actions";
import { AppPostForm } from "../post-form";
import { POST_MAIL_AUDIENCE, POST_MAIL_TEMPLATE } from "../post-mail-confirm";

export const metadata = { title: "Admin · Gönderiyi düzenle" };
export const dynamic = "force-dynamic";
// The save action may hand a campaign e-mail to `after()` (post hook); the
// runner keeps sending inside the route's max duration, stopping at 240 s.
export const maxDuration = 300;

export default async function EditAppPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireRole("mobileApp");
  const { id } = await params;
  const row = await getAppPost(id);
  if (!row) notFound();
  const canEmail = canAccess("newsletter", session.role);
  // For the mail dialog; a post that had its mail has no box to tick.
  const recipientCount =
    canEmail && !row.emailCampaignId
      ? await campaignAudienceCount(POST_MAIL_AUDIENCE, POST_MAIL_TEMPLATE)
      : null;

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      <BackLink href="/admin/mobil/gonderiler" label="Gönderiler" />
      <PageHeader
        eyebrow="Mobil uygulama · Ana sayfa"
        title="Gönderiyi düzenle"
        description={row.title}
        action={
          // `then: list`: after the delete this page has nothing to show,
          // so the action answers with the list and its toast.
          <ConfirmButton
            action={deletePostAction}
            hidden={{ id: row.id, then: "list" }}
            label="Sil"
            ariaLabel={`Sil: ${row.title}`}
            title={`"${row.title}" silinsin mi?`}
            description={DELETE_TEXT.post}
            className="w-full sm:w-auto"
          />
        }
      />
      <AppPostForm
        action={updatePostAction.bind(null, row.id)}
        defaults={row}
        mode="edit"
        submitLabel="Değişiklikleri kaydet"
        canEmail={canEmail}
        recipientCount={recipientCount}
      />
    </main>
  );
}
