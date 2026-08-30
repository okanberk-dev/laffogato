import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  ORDER_CHANNEL_LABELS,
  ORDER_FULFILLMENT_LABELS,
  orderChannel,
  orderFulfillment,
  orderKind,
} from "@/lib/admin/order-channel";
import { TABLES } from "@/lib/db";
import { MIGRATION_NAMES } from "@/lib/db/schema-sql";

const MIGRATION = "20260902100000_mobile_orders_loyalty_venue.sql";

function migrationSql(): string {
  return readFileSync(
    join(process.cwd(), "db", "migrations", MIGRATION),
    "utf8",
  );
}

/** Strips `-- …` comments so prose never satisfies (or trips) an assertion. */
function withoutComments(sql: string): string {
  return sql
    .split("\n")
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n");
}

describe("mobile v2 migration", () => {
  const sql = migrationSql();
  const code = withoutComments(sql);

  it("does not record itself in _migrations (the runner does, without on conflict)", () => {
    // scripts/db-migrate.mjs inserts the row itself inside the same
    // transaction; a duplicate here would raise 23505 and roll everything back.
    expect(code).not.toMatch(/insert\s+into\s+public\._migrations/i);
    expect(code).not.toMatch(/_migrations/);
  });

  it("is in the bundle the app bootstraps from", () => {
    expect(MIGRATION_NAMES).toContain(MIGRATION);
  });

  it("adds every orders / settings / customers column the contract lists", () => {
    // docs/API-MOBILE.md §11 — exact names, exact casing.
    for (const col of [
      "channel",
      "kind",
      "fulfillment",
      '"scheduledFor"',
      '"deliveryNote"',
      '"paidAt"',
    ]) {
      expect(code).toMatch(
        new RegExp(
          `alter table public\\.orders\\s+add column if not exists ${col}\\s`,
        ),
      );
    }
    for (const col of [
      '"courierFeeMinor"',
      '"karaokeHourlyMinor"',
      '"karaokeCapacity"',
    ]) {
      expect(code).toMatch(
        new RegExp(
          `alter table public\\.settings\\s+add column if not exists ${col}\\s+integer`,
        ),
      );
    }
    for (const col of [
      '"supabaseUserId"',
      '"supabaseLinkAttemptedAt"',
      '"inviteCode"',
      '"invitedBy"',
      "usual",
    ]) {
      expect(code).toMatch(
        new RegExp(
          `alter table public\\.customers\\s+add column if not exists ${col}\\s`,
        ),
      );
    }
  });

  it("uses the contract defaults for money and channel columns", () => {
    expect(code).toMatch(/channel\s+text not null default 'web'/);
    expect(code).toMatch(/kind\s+text not null default 'shop'/);
    expect(code).toMatch(/fulfillment\s+text not null default 'shipping'/);
    expect(code).toMatch(/"courierFeeMinor"\s+integer not null default 5500/);
    expect(code).toMatch(
      /"karaokeHourlyMinor"\s+integer not null default 90000/,
    );
    expect(code).toMatch(/"karaokeCapacity"\s+integer not null default 8/);
    expect(code).toMatch(/usual\s+jsonb not null default 'null'::jsonb/);
  });

  it("creates the four new tables with RLS enabled", () => {
    for (const table of [
      "loyalty_stamps",
      "invites",
      "venue_status",
      "karaoke_reservations",
    ]) {
      expect(code).toContain(`create table if not exists public.${table} (`);
      expect(code).toContain(
        `alter table public.${table} enable row level security;`,
      );
    }
  });

  it("keeps the idempotency indexes the loyalty and invite flows rely on", () => {
    // One 'earn' row per paid order — the webhook may fire twice.
    expect(code).toMatch(
      /create unique index if not exists loyalty_stamps_order_key\s+on public\.loyalty_stamps \("orderId"\) where "orderId" <> '' and kind = 'earn'/,
    );
    // An address can be invited once.
    expect(code).toMatch(
      /create unique index if not exists invites_invitee_key\s+on public\.invites \(lower\("inviteeEmail"\)\)/,
    );
    // Invite codes are unique when set; the empty default is exempt.
    expect(code).toMatch(
      /create unique index if not exists customers_invite_code_key\s+on public\.customers \("inviteCode"\) where "inviteCode" <> ''/,
    );
  });

  it("follows the house style: quoted camelCase, text ids, ISO text dates, kuruş integers", () => {
    // Every quoted identifier is camelCase (no snake_case inside quotes).
    for (const m of code.matchAll(/"([^"]+)"/g)) {
      expect(m[1]).toMatch(/^[a-z][A-Za-z0-9]*$/);
    }
    // Every multi-word column that is NOT quoted would be folded to lower
    // case by Postgres and silently diverge from the TypeScript key. Any
    // bare identifier with an upper-case letter is therefore a bug.
    for (const line of code.split("\n")) {
      const bare = line.replace(/"[^"]*"/g, "").replace(/'[^']*'/g, "");
      expect(bare, line).not.toMatch(/\b[a-z]+[A-Z][A-Za-z]*\b/);
    }
    // No timestamps, no uuids, no numeric money.
    expect(code).not.toMatch(/timestamptz|timestamp\b/);
    expect(code).not.toMatch(/uuid/);
    expect(code).not.toMatch(/numeric|decimal|float|real\b/);
    // Every new table keys on text.
    for (const m of code.matchAll(
      /create table if not exists public\.\w+ \(\s*id\s+(\w+)/g,
    )) {
      expect(m[1]).toBe("text");
    }
    // Every statement is idempotent.
    expect(code).not.toMatch(/create table (?!if not exists)/);
    expect(code).not.toMatch(/create (unique )?index (?!if not exists)/);
    expect(code).not.toMatch(/add column (?!if not exists)/);
  });
});

describe("TABLES map", () => {
  it("names the four new tables exactly as the migration creates them", () => {
    expect(TABLES.loyaltyStamps).toBe("loyalty_stamps");
    expect(TABLES.invites).toBe("invites");
    expect(TABLES.venueStatus).toBe("venue_status");
    expect(TABLES.karaokeReservations).toBe("karaoke_reservations");
    const code = withoutComments(migrationSql());
    for (const table of [
      TABLES.loyaltyStamps,
      TABLES.invites,
      TABLES.venueStatus,
      TABLES.karaokeReservations,
    ]) {
      expect(code).toContain(`create table if not exists public.${table} (`);
    }
  });
});

describe("order channel defaults", () => {
  it("reads rows written before the columns existed as a web shop parcel", () => {
    expect(orderChannel({})).toBe("web");
    expect(orderKind({})).toBe("shop");
    expect(orderFulfillment({})).toBe("shipping");
  });

  it("passes the app values through and rejects anything else", () => {
    expect(orderChannel({ channel: "app" })).toBe("app");
    expect(orderKind({ kind: "cafe" })).toBe("cafe");
    expect(orderFulfillment({ fulfillment: "pickup" })).toBe("pickup");
    expect(orderFulfillment({ fulfillment: "delivery" })).toBe("delivery");
    expect(orderChannel({ channel: "kiosk" })).toBe("web");
    expect(orderFulfillment({ fulfillment: "drone" })).toBe("shipping");
  });

  it("labels every value in Turkish", () => {
    expect(ORDER_CHANNEL_LABELS).toEqual({ web: "Web", app: "Uygulama" });
    expect(ORDER_FULFILLMENT_LABELS).toEqual({
      shipping: "Kargo",
      pickup: "Gel-al",
      delivery: "Kurye",
    });
  });
});
