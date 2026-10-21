import { createHmac } from "node:crypto";

/**
 * The key the panel's session and pending-2FA cookies are signed with:
 * derived from ADMIN_SESSION_SECRET for this one purpose, never the secret
 * itself. The member cookie is signed with that same secret when
 * CUSTOMER_SESSION_SECRET is unset (customer/auth.ts), and an address holding
 * a "|" lined its `email|exp|fp` up with the panel's `email|role|exp|fp`: a
 * member's cookie passed the panel's signature check and failed only at the
 * fingerprint. With a key of its own, no other token the secret signs can
 * pass for a panel one. Pure, so the tests sign their cookies with it too.
 */
export function adminSessionKey(secret: string): Buffer {
  return createHmac("sha256", secret)
    .update("laffogato|admin-session|v2")
    .digest();
}
