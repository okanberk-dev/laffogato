import { isDegradedRequest } from "@/lib/db/health";

/**
 * Shown on the member sign-in / sign-up pages while the database is
 * unreachable. Without it the form looks usable, and submitting it fails on the
 * server — a dead end. Rendering nothing when the database is healthy keeps the
 * pages unchanged in normal operation.
 */
export function DegradedAuthNotice() {
  if (!isDegradedRequest()) return null;
  return (
    <p
      role="status"
      style={{
        background: "rgba(192,100,58,0.08)",
        border: "1px solid rgba(192,100,58,0.28)",
        borderRadius: "var(--r-sm, 10px)",
        padding: "12px 14px",
        fontSize: 13,
        lineHeight: 1.55,
        color: "var(--ink, #14100b)",
        marginBottom: 18,
      }}
    >
      Hesap servisimize şu an ulaşamıyoruz — giriş ve kayıt geçici olarak
      çalışmıyor. Kısa süre içinde döneceğiz.
    </p>
  );
}
