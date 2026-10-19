import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The member keys minted for a card storage that never went live are
 * cleared once (DF-CARD-1, 18 Ekim 2026). The app order and the member's
 * karaoke payment wrote a random PayNkolay key into `customers."cardUserKey"`
 * for every member who paid there; no card sits under any of them, and since
 * the legal texts stopped describing saved cards no notice names the key.
 */

const FILE = "20261018200000_clear_unused_card_user_keys.sql";
const DIR = join(process.cwd(), "db", "migrations");
const sql = readFileSync(join(DIR, FILE), "utf8");
const bundle = readFileSync(join(process.cwd(), "db", "schema.sql"), "utf8");

/** The file with its `--` comments removed - the part Postgres runs. */
const statements = sql
  .split("\n")
  .filter((line) => !line.trimStart().startsWith("--"))
  .join("\n")
  .trim();

describe(FILE, () => {
  it("runs once: guarded by its own _migrations row", () => {
    // The bundle replays every migration when a deploy adds one; a key
    // minted later, with card storage and its texts on, must survive that.
    expect(statements).toMatch(
      new RegExp(
        `not exists \\(\\s*select 1\\s+from public\\._migrations as applied\\s+where applied\\.name = '${FILE.replace(/\./g, "\\.")}'\\s*\\)`,
      ),
    );
    expect(statements).not.toContain("insert into public._migrations");
  });

  it("empties only the key, on rows that have one, and leaves updatedAt", () => {
    expect(statements).toMatch(
      /^update public\.customers\s+set "cardUserKey" = ''\s+where "cardUserKey" <> ''/,
    );
    // One statement, one column.
    expect(statements.split(";").filter((s) => s.trim())).toHaveLength(1);
    expect(statements).not.toMatch(/updatedAt/);
    expect(statements).not.toMatch(/\b(delete|drop|alter|truncate)\b/i);
  });

  it("is in the bundle, after every earlier migration", () => {
    expect(bundle).toContain(`-- ${FILE}`);
    const names = readdirSync(DIR)
      .filter((n) => n.endsWith(".sql"))
      .sort();
    expect(names).toContain(FILE);
    expect(names.indexOf(FILE)).toBeGreaterThan(
      names.indexOf("20261018130000_karaoke_cancel_policy.sql"),
    );
  });

  it("matches a gate that mints no key while card storage is off", () => {
    // Clearing alone would refill on the next app payment.
    for (const file of [
      "src/lib/mobile/orders.ts",
      "src/lib/mobile/karaoke-payment.ts",
    ]) {
      const code = readFileSync(join(process.cwd(), file), "utf8");
      const at = code.indexOf("ensureCardUserKey(");
      expect(code.slice(Math.max(0, at - 160), at), file).toContain(
        "provider.cardStorageEnabled",
      );
    }
  });
});

describe("20261019120000_clear_card_user_keys_again.sql", () => {
  // The 18-19 Ekim incident: an older deployment served production for a
  // night and minted keys again after the first clear had run.
  const AGAIN = "20261019120000_clear_card_user_keys_again.sql";
  const again = readFileSync(join(DIR, AGAIN), "utf8")
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n")
    .trim();

  it("runs once, empties only the key, and is bundled after the first clear", () => {
    expect(again).toMatch(
      new RegExp(
        `not exists \\(\\s*select 1\\s+from public\\._migrations as applied\\s+where applied\\.name = '${AGAIN.replace(/\./g, "\\.")}'\\s*\\)`,
      ),
    );
    expect(again).toMatch(
      /^update public\.customers\s+set "cardUserKey" = ''\s+where "cardUserKey" <> ''/,
    );
    expect(again.split(";").filter((s) => s.trim())).toHaveLength(1);
    expect(again).not.toMatch(/updatedAt|insert into public\._migrations/);
    expect(again).not.toMatch(/\b(delete|drop|alter|truncate)\b/i);
    expect(bundle).toContain(`-- ${AGAIN}`);
    const names = readdirSync(DIR)
      .filter((n) => n.endsWith(".sql"))
      .sort();
    expect(names.indexOf(AGAIN)).toBeGreaterThan(names.indexOf(FILE));
  });
});
