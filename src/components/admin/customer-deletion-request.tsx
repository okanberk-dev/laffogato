import {
  deletionDayLabel,
  deletionDeadline,
  isDeletionOverdue,
  type DeletionRequest,
} from "@/lib/customer/deletion-request-core";

import { CloseAccountButton } from "./customer-actions";
import { Card } from "./forms";
import { Badge } from "./ui/badge";

/**
 * A member's open web deletion request on their page (/uye/hesap/sil,
 * operator 18 Eki 2026): when it came, the last of the thirty days KVKK
 * m.13/2 allows, the member's reason if they wrote one, and "Hesabı sil"
 * as the page's primary action. Closing the account clears the request and
 * mails the member (`closeCustomerAccountAction`).
 */
export function CustomerDeletionRequest({
  email,
  request,
  now = new Date(),
}: {
  email: string;
  request: DeletionRequest;
  now?: Date;
}) {
  const deadline = deletionDayLabel(deletionDeadline(request.requestedAt));
  const overdue = isDeletionOverdue(request.requestedAt, now);
  return (
    <Card
      className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,220px)] sm:items-start"
      // The card's own border class would win over a second one; the
      // request's colour goes inline.
      style={{ borderColor: "var(--admin-danger)" }}
    >
      <div className="grid min-w-0 gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="danger">
            Silme talebi · {deletionDayLabel(request.requestedAt)}
          </Badge>
          {overdue && <Badge tone="danger">Süre doldu</Badge>}
        </div>
        <p className="text-sm text-[var(--admin-text)]">
          Üye hesabının silinmesini istedi. En geç <strong>{deadline}</strong>{" "}
          tarihine kadar kapat; üyeye bilgi e-postası kendiliğinden gider. Devam
          eden siparişi varsa sipariş bitince kapat.
        </p>
        {request.reason ? (
          <blockquote className="rounded-lg border-l-4 border-[var(--admin-border-strong)] bg-[var(--admin-surface-2)] px-3 py-2 text-sm [overflow-wrap:anywhere] text-[var(--admin-text-soft)]">
            {request.reason}
          </blockquote>
        ) : (
          <p className="text-xs text-[var(--admin-text-mute)]">
            Gerekçe yazmadı.
          </p>
        )}
      </div>
      <div className="grid gap-2">
        <CloseAccountButton email={email} variant="primary" />
      </div>
    </Card>
  );
}
