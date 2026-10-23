import { PageHeader } from "@/components/admin/forms";
import { requireRole } from "@/lib/admin/auth";
import { campaignAudienceCount } from "@/lib/admin/campaign-mail";
import { canAccess } from "@/lib/admin/roles";

import { BackLink } from "../../app-content-list";
import { createPostAction } from "../actions";
import { AppPostForm } from "../post-form";
import { POST_MAIL_AUDIENCE, POST_MAIL_TEMPLATE } from "../post-mail-confirm";

export const metadata = { title: "Admin · Yeni gönderi" };
export const dynamic = "force-dynamic";
// The save action may hand a campaign e-mail to `after()` (post hook); the
// runner keeps sending inside the route's max duration, stopping at 240 s.
export const maxDuration = 300;

export default async function NewAppPostPage() {
  const session = await requireRole("mobileApp");
  const canEmail = canAccess("newsletter", session.role);
  // The mail dialog quotes it: the same count the enqueue reads, or null
  // when the database could not be asked.
  const recipientCount = canEmail
    ? await campaignAudienceCount(POST_MAIL_AUDIENCE, POST_MAIL_TEMPLATE)
    : null;
  return (
    <main className="w-full px-4 pt-5 pb-10 sm:px-5 [&>:not(header)]:max-w-3xl">
      <BackLink href="/admin/mobil/gonderiler" label="Gönderiler" />
      <PageHeader
        title="Yeni gönderi"
        description="Kampanya, iş birliği ya da etkinlik kartı."
      />
      <AppPostForm
        action={createPostAction}
        mode="create"
        submitLabel="Gönderiyi oluştur"
        canEmail={canEmail}
        recipientCount={recipientCount}
      />
    </main>
  );
}
