import { isDegradedRequest } from "@/lib/db/health";

/**
 * Shown on the member sign-in / sign-up pages while the database is
 * unreachable. Without it the form looks usable, and submitting it fails on the
 * server - a dead end. Rendering nothing when the database is healthy keeps the
 * pages unchanged in normal operation.
 */
export function DegradedAuthNotice() {
  if (!isDegradedRequest()) return null;
  return (
    <p
      role="status"
      /* Neutral, deliberately. This is a service outage, not something the
         visitor did wrong and not a brand moment. The previous ground was the
         retired terracotta hardcoded in decimal rgba, which is why the
         retired-hex ban never caught it; painting it in the NEW brand tint
         instead would only trade one mistake for another and make "we are
         down" look like an offer. */
      style={{
        background: "var(--bg-stone, #f1eee8)",
        border: "1px solid var(--ink-line-strong, #e1dcd1)",
        borderRadius: "var(--r-sm, 10px)",
        padding: "12px 14px",
        fontSize: 13,
        lineHeight: 1.55,
        color: "var(--ink, #201c17)",
        marginBottom: 18,
      }}
    >
      Hesap servisimize şu an ulaşamıyoruz - giriş ve kayıt geçici olarak
      çalışmıyor. Kısa süre içinde döneceğiz.
    </p>
  );
}
