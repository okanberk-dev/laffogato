import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Karaoke alerts leave the consumer Gmail inbox (OP-KARAOKE-MAILBOX,
 * 19 Ekim 2026). Every alert carries the guest's name, e-mail, phone and
 * note; a personal Gmail inbox kept them on Google's servers abroad with no
 * KVKK m.9/4 safeguard. The address is cleared once, the seed stops
 * defaulting to it, and the 26 Eyl migration that wrote it no longer writes
 * it back when the bundle replays.
 */

const FILE = "20261019090000_karaoke_notify_company_mailbox.sql";
const OLD = "20260926090000_karaoke_price_and_notify.sql";
const GMAIL = "bizimfutbol9@gmail.com";
const DIR = join(process.cwd(), "db", "migrations");
const bundle = readFileSync(join(process.cwd(), "db", "schema.sql"), "utf8");

/** A migration with its `--` comments removed - the part Postgres runs. */
function statements(file: string): string {
  return readFileSync(join(DIR, file), "utf8")
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n")
    .trim();
}

const guard = (file: string) =>
  new RegExp(
    `not exists \\(\\s*select 1\\s+from public\\._migrations as applied\\s+where applied\\.name = '${file.replace(/\./g, "\\.")}'\\s*\\)`,
  );

describe(FILE, () => {
  const sql = statements(FILE);

  it("clears only the Gmail address, whatever its case or spaces", () => {
    expect(sql).toMatch(
      /^update public\.settings\s+set "karaokeNotifyEmail" = ''\s+where lower\(trim\("karaokeNotifyEmail"\)\) = 'bizimfutbol9@gmail\.com'/,
    );
    // One statement, one column; an address typed later stays.
    expect(sql.split(";").filter((s) => s.trim())).toHaveLength(1);
    expect(sql).not.toMatch(/\b(delete|drop|alter|truncate|insert)\b/i);
  });

  it("runs once: guarded by its own _migrations row", () => {
    expect(sql).toMatch(guard(FILE));
  });

  it("is in the bundle, after the migration that wrote the address", () => {
    expect(bundle).toContain(`-- ${FILE}`);
    const names = readdirSync(DIR)
      .filter((n) => n.endsWith(".sql"))
      .sort();
    expect(names.indexOf(OLD)).toBeGreaterThan(-1);
    expect(names.indexOf(FILE)).toBeGreaterThan(names.indexOf(OLD));
  });
});

describe("nothing writes the Gmail address back", () => {
  it("the 26 Eyl update runs once, so a bundle replay leaves the panel's values", () => {
    // src/lib/db/bootstrap.ts applies the WHOLE bundle when a deploy adds a
    // migration; unguarded, this update reset the address (and the price)
    // every time.
    const sql = statements(OLD);
    expect(sql).toMatch(
      /update public\.settings\s+set "karaokeHourlyMinor" = 100000,\s+"karaokeNotifyEmail" = 'bizimfutbol9@gmail\.com'\s+where not exists/,
    );
    expect(sql).toMatch(guard(OLD));
  });

  it("the seed starts empty, so a fresh database falls back to the contact address", () => {
    const store = readFileSync("src/lib/admin/store.ts", "utf8");
    const seed = store.slice(store.indexOf("function defaultSettings(): AdminSettings {"));
    expect(seed.slice(0, seed.indexOf("\n}\n"))).toMatch(/karaokeNotifyEmail: "",/);
    expect(store).not.toContain(GMAIL);
  });

  it("no source, doc or legal text names it", () => {
    for (const file of [
      "src/lib/legal/content.ts",
      "src/lib/email/send.ts",
      "src/app/admin/ayarlar/karaoke-tab.tsx",
      "docs/EMAIL-RESEND.md",
    ]) {
      expect(readFileSync(file, "utf8"), file).not.toContain(GMAIL);
    }
  });
});
