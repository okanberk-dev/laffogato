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

  it("rejects a too-short name", () => {
    const r = customerEditSchema.safeParse({ name: "A" });
    expect(r.success).toBe(false);
  });
});
