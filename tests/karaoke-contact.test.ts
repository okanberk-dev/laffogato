import { describe, expect, it } from "vitest";

import {
  normalizeTrPhone,
  validateReservationContact,
} from "@/lib/mobile/karaoke-core";

describe("normalizeTrPhone", () => {
  it("reads the ways a Turkish mobile is written", () => {
    for (const raw of [
      "0532 123 45 67",
      "+90 532 123 45 67",
      "5321234567",
      "90(532)1234567",
    ]) {
      expect(normalizeTrPhone(raw)).toBe("+905321234567");
    }
  });
  it("rejects a landline or a short number", () => {
    expect(normalizeTrPhone("0216 459 30 60")).toBe("");
    expect(normalizeTrPhone("0532 123")).toBe("");
  });
});

describe("validateReservationContact", () => {
  const ok = {
    name: "Eda Mancuso",
    email: "Eda@Ornek.com",
    phone: "0532 123 45 67",
    consent: true,
  };
  it("accepts a full contact and normalises it", () => {
    expect(validateReservationContact(ok)).toEqual({
      ok: true,
      value: {
        name: "Eda Mancuso",
        email: "eda@ornek.com",
        phone: "+905321234567",
      },
    });
  });
  it("asks for a surname, a real e-mail, a mobile and the permission", () => {
    expect(validateReservationContact({ ...ok, name: "Eda" }).ok).toBe(false);
    expect(validateReservationContact({ ...ok, email: "eda" }).ok).toBe(false);
    expect(validateReservationContact({ ...ok, phone: "123" }).ok).toBe(false);
    expect(validateReservationContact({ ...ok, consent: false }).ok).toBe(
      false,
    );
  });
});
