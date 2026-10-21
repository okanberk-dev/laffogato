import { describe, expect, it } from "vitest";

import { registerCustomer } from "@/lib/customer/store";

/**
 * A member address with a "|" or a control character is refused at sign-up,
 * before anything is read or written. The session cookie is
 * `email|exp|fp|sig`: such an address split into one field more than the
 * cookie has (its owner could never stay signed in), and its fields lined up
 * with the panel cookie's (tests/admin-session-key.test.ts).
 */

const input = (email: string) => ({
  email,
  name: "Ayşe",
  phone: "",
  password: "uzun-bir-parola-2026",
  acceptedTerms: true,
  marketing: false,
  newsletter: false,
});

describe("the sign-up address", () => {
  it.each([
    "owner@laffogato.net|owner",
    "a|b@ornek.com",
    "ayse@ornek.com\u0000",
    "ay\u0007se@ornek.com",
  ])("refuses %j", async (email) => {
    await expect(registerCustomer(input(email))).resolves.toEqual({
      ok: false,
      error: "Geçerli bir e-posta gir.",
    });
  });
});
