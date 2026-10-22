import { cx } from "@/components/laffogato/cx";
import {
  KEEPALIVE_STALE_DAYS,
  type KeepaliveView,
} from "@/lib/admin/supabase-keepalive-core";

import { formatDateTime } from "../forms";
import { TONE_RULE, TONE_SOFT } from "../ui/tone";

/** "son deneme atlandı (…): …" / "son deneme başarısız (…)", or nothing. */
function attemptNote(view: KeepaliveView): string {
  const attempt = view.lastAttempt;
  if (!attempt || attempt.status === "ok") return "";
  const at = formatDateTime(attempt.at);
  return attempt.status === "failed"
    ? `son deneme başarısız (${at})`
    : `son deneme atlandı (${at}): servis anahtarı tanımlı değil`;
}

/** What the record says, after "Supabase uyanık tutma:". */
export function keepaliveSentence(view: KeepaliveView): string {
  if (view.state === "none") {
    return "henüz kayıt yok; ilk kayıt günlük görevin bir sonraki sabah çalışmasıyla düşer.";
  }
  if (view.state === "silent") {
    return `henüz kayıt yok, oysa ${formatDateTime(view.since ?? "")} tarihinden beri kayıt bekleniyor: günlük görev çalışmıyor olabilir.`;
  }
  if (view.state === "unreadable") return "kayıt okunamadı.";
  const success = view.lastSuccessAt
    ? `son başarılı ping ${formatDateTime(view.lastSuccessAt)}`
    : "henüz başarılı ping yok";
  const age =
    view.state === "stale" && view.lastSuccessAt
      ? `, ${KEEPALIVE_STALE_DAYS} günden eski`
      : "";
  const note = attemptNote(view);
  return `${success}${age}${note ? `; ${note}` : ""}.`;
}

/** What a warning adds: what a silent week costs, and who fixes it. */
export const KEEPALIVE_WARNING_ADVICE =
  "Ücretsiz plandaki proje 7 gün sessiz kalırsa duraklar ve uygulamada da sitede de her girişi reddeder. Geliştiriciye ilet.";

/**
 * The owner's band about the daily Supabase ping
 * (src/lib/admin/supabase-keepalive-core.ts): when it last got through, in
 * the warning tone when that was more than three Istanbul days ago or the
 * latest attempt failed. The dashboard draws it for a warning only; Ayarlar
 * → Sistem durumu always says the same sentence. Rendered only for a role
 * `readKeepaliveFor` let through; it is handed a view, never the record's
 * source. Server-safe.
 */
export function KeepaliveStatusLine({ view }: { view: KeepaliveView }) {
  const warn = view.tone === "warning";
  return (
    <p
      data-testid="supabase-keepalive-status"
      data-state={view.state}
      className={cx(
        "mb-4 rounded-lg border-l-4 px-3.5 py-2.5 text-sm",
        TONE_SOFT[view.tone],
        TONE_RULE[view.tone],
      )}
    >
      <strong>Supabase uyanık tutma:</strong> {keepaliveSentence(view)}
      {warn ? <> {KEEPALIVE_WARNING_ADVICE}</> : null}
    </p>
  );
}
