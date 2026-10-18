import {
  deletionDayLabel,
  deletionDeadline,
  deletionRefundLabel,
  isDeletionOverdue,
  type DeletionKaraokeItem,
  type DeletionRequest,
} from "@/lib/customer/deletion-request-core";

import { CloseAccountButton } from "./customer-actions";
import { Card } from "./forms";
import { Badge } from "./ui/badge";
import { NUMERIC_STYLE } from "./ui/styles";

/**
 * A member's open web deletion request on their page (/uye/hesap/sil,
 * operator 18 Eki 2026): when it came, the last of the thirty days KVKK
 * m.13/2 allows, the member's reason if they wrote one, and "Hesabı sil"
 * as the page's primary action. Closing the account clears the request and
 * mails the member (`closeCustomerAccountAction`).
 *
 * A paid karaoke booking is listed with its start and what the closure
 * refunds (`paidKaraokeAtRequest`, the booking's rule at the request):
 * closed before the start, the refund needs nobody's judgement; one whose
 * start came since the request is refunded unless the dialog records the
 * room as used (ASK-Y3-4 (d)).
 */
export function CustomerDeletionRequest({
  email,
  request,
  karaoke = [],
  now = new Date(),
}: {
  email: string;
  request: DeletionRequest;
  karaoke?: readonly DeletionKaraokeItem[];
  now?: Date;
}) {
  const deadline = deletionDayLabel(deletionDeadline(request.requestedAt));
  const overdue = isDeletionOverdue(request.requestedAt, now);
  const passed = karaoke.filter((k) => k.startedSinceRequest);
  const upcoming = karaoke.length > passed.length;
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
        {karaoke.length > 0 && (
          <div className="grid gap-1.5 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-2)] px-3 py-2">
            <p className="text-sm font-medium text-[var(--admin-text)]">
              Ödenmiş karaoke rezervasyonu
            </p>
            <ul className="grid gap-1 text-sm text-[var(--admin-text)]">
              {karaoke.map((k) => (
                <li
                  key={k.id}
                  className="flex flex-wrap items-center gap-x-2 gap-y-1"
                >
                  <span style={NUMERIC_STYLE}>{k.label}</span>
                  <Badge tone="neutral">
                    {deletionRefundLabel(k.refundPercent)}
                  </Badge>
                  {k.startedSinceRequest && (
                    <Badge tone="warning">Saati talepten sonra geçti</Badge>
                  )}
                </li>
              ))}
            </ul>
            {upcoming && (
              <p className="text-xs text-[var(--admin-text-soft)]">
                Hesabı rezervasyonun başlangıç saatinden önce kapat. İade,
                rezervasyonun kuralına göre talep anındaki hâliyle yapılır.
              </p>
            )}
            {passed.length > 0 && (
              <p className="text-xs text-[var(--admin-text-soft)]">
                Üye silmeyi istediğinde bu rezervasyonun iptali iade alıyordu,
                saati talepten sonra geçti. Oda kullanıldıysa hesabı kapatırken
                işaretle; işaretlemezsen iade yapılır.
              </p>
            )}
          </div>
        )}
      </div>
      <div className="grid gap-2">
        <CloseAccountButton
          email={email}
          variant="primary"
          requestedAt={request.requestedAt}
          passedKaraoke={passed}
        />
      </div>
    </Card>
  );
}
