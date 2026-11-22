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
    <main className="w-full px-4 pt-5 pb-10 sm:px-5 lg:px-6 lg:pt-6 [&>:not(header)]:max-w-3xl">
      <BackLink href="/admin/mobil/gonderiler" label="Gönderiler" />
      <PageHeader
        title="Gönderiyi düzenle"
        description={row.title}
        menuLabel="Gönderi işlemleri"
        menu={
          // `then: list`: after the delete this page has nothing to show,
          // so the action answers with the list and its toast.
          <ConfirmButton
            action={deletePostAction}
            hidden={{ id: row.id, then: "list" }}
            label="Sil"
            ariaLabel={`Sil: ${row.title}`}
            title={`"${row.title}" silinsin mi?`}
            description={DELETE_TEXT.post}
            variant="menuDanger"
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
