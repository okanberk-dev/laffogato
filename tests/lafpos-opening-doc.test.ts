import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { signedCallerKeys } from "@/lib/panel/signed-callers";

/**
 * The site's part of the opening order (docs/LAFPOS.md "Varsayılan
 * kapalı"). The owner opens LafPOS from one list kept in lafmaliyet and
 * lafpos; that list's keys step once set only lafmaliyet's key, so the
 * site's key and LafPOS's LAFFOGATO_* values were never set, every signed
 * call from the café stayed refused and the trial push did not catch it.
 * What is pinned: the section spells out the site's step itself (generate,
 * Vercel Production, LafPOS's .env, check with "Elle denemek"), and the
 * name and refusals it gives are the ones the code uses.
 */

const DOC = readFileSync("docs/LAFPOS.md", "utf8");

/** The text from `heading` up to the next level-two heading. */
function section(heading: string): string {
  const start = DOC.indexOf(`\n${heading}\n`);
  expect(start, heading).toBeGreaterThan(-1);
  const end = DOC.indexOf("\n## ", start + heading.length + 1);
  return DOC.slice(start, end === -1 ? undefined : end);
}

const OFF = section("## Varsayılan kapalı");
const PANEL = "panel-secret-0123456789-abcdefghijklmnop";
const GENERATED = "x".repeat(64); // openssl rand -base64 48: 64 characters

describe("docs/LAFPOS.md: the site's keys step", () => {
  it("is written out here, not only pointed at lafmaliyet's list", () => {
    expect(OFF).toContain("`openssl rand -base64 48`");
    expect(OFF).toMatch(/Vercel projesinde Production'a `LAFPOS_SYNC_SECRET`/);
    expect(OFF).toContain('"Sensitive"');
    expect(OFF).toMatch(/yeniden yayımlayın/);
    expect(OFF).toContain("`LAFFOGATO_URL=https://laffogato.net`");
    expect(OFF).toContain("`LAFFOGATO_SYNC_SECRET`");
    // Different from both other keys: the panel's and lafmaliyet's.
    expect(OFF).toMatch(/`KARAOKE_SYNC_SECRET`'ından da lafmaliyet'in/);
    // The trial push does not test the site; the check here does.
    expect(OFF).toMatch(/deneme gönderimi yalnız lafmaliyet'e gidişi sınar/);
    expect(OFF).toContain('"Elle denemek"');
    expect(DOC).toContain("\n## Elle denemek\n");
    expect(OFF).toContain('`{"version":"…","karaoke":"…"}`');
  });

  it("names the variable the site reads, and the 503 causes are real", () => {
    // The name the step sets turns LafPOS's key on...
    expect(
      signedCallerKeys(
        { LAFPOS_SYNC_SECRET: GENERATED, KARAOKE_SYNC_SECRET: PANEL },
        ["lafpos"],
      ),
    ).toEqual({ lafpos: GENERATED });
    // ...and each cause the check lists for 503 leaves it off.
    expect(OFF).toMatch(/32 karakterden kısa, panelinkiyle aynı/);
    expect(signedCallerKeys({}, ["lafpos"])).toBeNull();
    expect(
      signedCallerKeys({ LAFPOS_SYNC_SECRET: "x".repeat(31) }, ["lafpos"]),
    ).toBeNull();
    expect(
      signedCallerKeys(
        { LAFPOS_SYNC_SECRET: PANEL, KARAOKE_SYNC_SECRET: PANEL },
        ["lafpos"],
      ),
    ).toBeNull();
  });
});
