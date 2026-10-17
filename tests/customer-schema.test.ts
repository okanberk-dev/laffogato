import { describe, it, expect } from "vitest";

import { customerEditSchema } from "@/lib/admin/customer-schema";

describe("customerEditSchema", () => {
  it("maps notification checkboxes ('on' / absent) to booleans", () => {
    const r = customerEditSchema.safeParse({
      name: "Ada Lovelace",
      phone: "+90 555 111 22 33",
      birthday: "1990-12-10",
      notifyOrderUpdates: "on",
      notifyNewsletter: "on",
      // notifyMarketing absent
    });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.name).toBe("Ada Lovelace");
    expect(r.data.notificationPrefs).toEqual({
      orderUpdates: true,
      marketing: false,
      newsletter: true,
    });
  });

  it("defaults optional fields to empty strings", () => {
    const r = customerEditSchema.safeParse({ name: "Bob" });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.phone).toBe("");
    expect(r.data.birthday).toBe("");
    expect(r.data.notificationPrefs).toEqual({
      orderUpdates: false,
      marketing: false,
      newsletter: false,
    });
  });

  it("reads how the form drew the commercial switches", () => {
    const r = customerEditSchema.safeParse({
      name: "Ada Lovelace",
      shownMarketing: "off",
      shownNewsletter: "on",
      notifyNewsletter: "on",
    });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.shownPrefs).toEqual({ marketing: false, newsletter: true });
    // Not sent (a hand-made post): nothing is assumed.
    const bare = customerEditSchema.safeParse({ name: "Bob" });
    expect(bare.success && bare.data.shownPrefs).toEqual({
      marketing: undefined,
      newsletter: undefined,
    });
  });

  it("rejects a too-short name", () => {
    const r = customerEditSchema.safeParse({ name: "A" });
    expect(r.success).toBe(false);
  });
});
