import { describe, expect, it, vi } from "vitest";

import type { CompiledQuery } from "@/lib/db/sql";

/**
 * S8-02: the store keeps the app's neighbourhood in its own key on the
 * address record (JSONB, no migration), and a site edit - which has no such
 * field - drops a stale one so the next read splits the line just typed.
 */
const seen = vi.hoisted(() => ({ writes: [] as CompiledQuery[] }));
const row = vi.hoisted(() => ({
  current: {
    id: "cst-1",
    email: "eda@example.com",
    name: "Eda",
    addresses: [] as unknown[],
  },
}));

vi.mock("@/lib/db", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/db")>();
  const { createDb } = await import("@/lib/db/client");
  const db = createDb(async (q) => {
    if (/^\s*UPDATE/i.test(q.text)) {
      seen.writes.push(q);
      const addresses = q.params.find(
        (p) => typeof p === "string" && p.startsWith("["),
      ) as string;
      row.current = { ...row.current, addresses: JSON.parse(addresses) };
      return { rows: [], rowCount: 1 };
    }
    return { rows: [row.current], rowCount: 1 };
  });
  return { ...real, getDb: () => db };
});

const { addCustomerAddress, updateCustomerAddress } =
  await import("@/lib/customer/store");
const { fromMeAddress, toMeAddress } = await import("@/lib/mobile/me-mapper");

const appAddress = {
  title: "Ev",
  fullName: "Eda Mancuso",
  phone: "+905320000000",
  city: "İstanbul",
  district: "Tuzla",
  neighbourhood: "Postane",
  line: "Atatürk Cad. No: 28",
  note: "",
};

type Stored = Parameters<typeof toMeAddress>[0];

describe("address neighbourhood key (S8-02)", () => {
  it("stores the app's neighbourhood and reads it back as typed", async () => {
    const res = await addCustomerAddress(
      "eda@example.com",
      fromMeAddress(appAddress),
    );
    expect(res.ok).toBe(true);
    const [saved] = row.current.addresses as Stored[];
    expect(saved.neighbourhood).toBe("Postane");
    expect(saved.line1).toBe("Postane, Atatürk Cad. No: 28");
    expect(toMeAddress(saved)).toMatchObject({
      neighbourhood: "Postane",
      line: "Atatürk Cad. No: 28",
    });
  });

  it("drops the key on a site edit, which sends no neighbourhood", async () => {
    const [saved] = row.current.addresses as Stored[];
    const res = await updateCustomerAddress("eda@example.com", saved.id, {
      label: "Ev",
      recipientName: "Eda Mancuso",
      phone: "+905320000000",
      line1: "Aydıntepe Mah., Sahil Yolu 5",
      line2: "",
      district: "Tuzla",
      city: "İstanbul",
      zip: "",
      isDefault: true,
    });
    expect(res.ok).toBe(true);
    const [edited] = row.current.addresses as Stored[];
    expect("neighbourhood" in edited).toBe(false);
    expect(toMeAddress(edited)).toMatchObject({
      neighbourhood: "Aydıntepe Mah.",
      line: "Sahil Yolu 5",
    });
  });
});
