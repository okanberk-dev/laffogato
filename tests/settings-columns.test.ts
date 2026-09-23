import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * Every settings key the code writes must exist as a column.
 *
 * `updateSettings()` upserts the object it is handed, and src/lib/db/sql.ts
 * compiles that into an INSERT naming each key. A key with no column is not a
 * value that fails to save - it is a 42703 that throws, and because
 * `ensureSeed()` upserts the whole of `defaultSettings()` on an empty
 * database, a missing column takes down the first request that touches the
 * store, not just the Ayarlar form.
 *
 * That is exactly how `emailFromName` / `emailFromAddress` / `emailReplyTo`
 * shipped: added to the type, to the defaults and to the panel, with no
 * migration. Nothing caught it, because every test that exercises settings
 * mocks the store. This one reads the two files against each other instead.
 */

const BUNDLE = readFileSync("db/schema.sql", "utf8");
const STORE = readFileSync("src/lib/admin/store.ts", "utf8");

/** The keys `defaultSettings()` returns, read out of its source. */
function defaultSettingsKeys(): string[] {
  const start = STORE.indexOf("function defaultSettings(): AdminSettings {");
  expect(start).toBeGreaterThan(-1);
  const body = STORE.slice(start, STORE.indexOf("\n}", start));
  const keys = new Set<string>();
  // Top-level `key:` at exactly one indent level inside the returned object.
  for (const m of body.matchAll(/^ {4}([A-Za-z][A-Za-z0-9]*):/gm)) keys.add(m[1]);
  return [...keys];
}

/** Column names the bundle gives `public.settings`, created or added later. */
function settingsColumns(): Set<string> {
  const cols = new Set<string>(["id"]);
  const created = BUNDLE.match(
    /create table if not exists public\.settings \(([\s\S]*?)\n\);/,
  );
  if (created) {
    // Both spellings appear in the same table: the original columns are bare
    // lowercase identifiers (`name`, `tagline`), the camelCase ones are quoted.
    const NOT_A_COLUMN = new Set([
      "constraint",
      "primary",
      "unique",
      "check",
      "foreign",
      "exclude",
    ]);
    for (const m of created[1].matchAll(
      /^\s*("?)([A-Za-z][A-Za-z0-9_]*)\1\s+[a-z]/gm,
    )) {
      if (!NOT_A_COLUMN.has(m[2].toLowerCase())) cols.add(m[2]);
    }
  }
  for (const m of BUNDLE.matchAll(
    /alter table public\.settings add column if not exists "([A-Za-z0-9]+)"/g,
  )) {
    cols.add(m[1]);
  }
  return cols;
}

describe("public.settings", () => {
  it("has a column for every key defaultSettings() writes", () => {
    const columns = settingsColumns();
    const missing = defaultSettingsKeys().filter((k) => !columns.has(k));
    expect(missing).toEqual([]);
  });

  it("carries the e-mail sender columns the Ayarlar panel saves", () => {
    // Named explicitly as well: the sweep above would also pass if
    // defaultSettings() stopped returning them, and the panel would still be
    // writing them from saveEmailSenderAction.
    const columns = settingsColumns();
    for (const key of ["emailFromName", "emailFromAddress", "emailReplyTo"]) {
      expect(columns.has(key)).toBe(true);
    }
  });

  it("found a believable set of columns at all, so a silent regex miss cannot pass it", () => {
    const columns = settingsColumns();
    expect(columns.size).toBeGreaterThan(10);
    expect(columns.has("notificationEmail")).toBe(true);
    expect(defaultSettingsKeys().length).toBeGreaterThan(10);
  });
});
