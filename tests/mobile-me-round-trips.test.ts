import { beforeEach, describe, expect, it, vi } from "vitest";

import { createDb, type Executor } from "@/lib/db/client";

/**
 * WP1: `GET /me` is read on every app foreground, and every query it makes
 * waits its turn on a pool of ONE connection (`src/lib/db/index.ts`), so the
 * round-trip count is the latency. The settings row used to be read twice -
 * once by `buildMe` for the tier perks and once inside `getLoyalty` for the
 * card size - for the same request.
 *
 * Driven through the real query builder; the executor answers every statement
 * with an empty result (no seeding: counts report one row).
 */

const seen: string[] = [];
const exec: Executor = async ({ text }) => {
  seen.push(text);
  if (/count\(\*\)/i.test(text)) return { rows: [{ count: 1 }], rowCount: 1 };
  return { rows: [], rowCount: 0 };
};

vi.mock("@/lib/db", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/db")>();
  const db = createDb(exec);
  return { ...real, getDb: () => db };
});

const { buildMe } = await import("@/lib/mobile/me");

const customer = {
  id: "cus-0001",
  email: "ayse@example.com",
  name: "Ayşe Yılmaz",
  phone: "",
  birthday: "",
  inviteCode: "AYSE42",
  isActive: true,
  emailVerified: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  notificationPrefs: {
    orderUpdates: true,
    marketing: false,
    newsletter: false,
  },
  addresses: [],
  wishlist: [],
  usual: null,
} as unknown as Parameters<typeof buildMe>[0];

beforeEach(() => {
  seen.length = 0;
});

describe("GET /me round trips", () => {
  it("reads the settings row once", async () => {
    await buildMe(customer);
    const settingsReads = seen.filter(
      (t) => /FROM "settings"/.test(t) && !/count\(\*\)/i.test(t),
    );
    expect(settingsReads).toHaveLength(1);
  });

  it("stays within its budget of reads after the first call", async () => {
    await buildMe(customer); // warm the once-per-instance seed checks
    seen.length = 0;
    await buildMe(customer);
    // settings, stamps, loyalty orders, invites, milestone grants, staff
    // flag. The invite names lookup only runs when there are invites.
    expect(seen).toHaveLength(6);
  });
});
