import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { CONTENT_FIELDS } from "@/lib/admin/content-fields";

/**
 * Every control the admin panel offers must actually change something.
 *
 * The Köşk redesign rewrote the home hero and, in doing so, orphaned
 * `home.hero.eyebrow` and `home.hero.lede`: the panel kept offering both
 * fields, an operator could edit and save them, and nothing on the site or in
 * the mobile API read them again. The "Hero görsel URL" setting went the same
 * way - its only consumer was deleted while the plumbing that carries it from
 * settings down to the page survived.
 *
 * That failure is silent by construction. Nothing throws, no type breaks, no
 * lint rule fires, and the panel looks like it works. This is the guard.
 */

const SRC = join(process.cwd(), "src");

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) sourceFiles(p, out);
    else if (/\.tsx?$/.test(p)) out.push(p);
  }
  return out;
}

const FILES = sourceFiles(SRC);

/** Files that only DEFINE or persist a key, rather than consuming it. */
const REGISTRY = [
  join("lib", "admin", "content-fields.ts"),
  join("lib", "admin", "site-content.ts"),
  join("app", "admin"),
  join("components", "admin"),
];

const CONSUMERS = FILES.filter((f) => !REGISTRY.some((r) => f.includes(r))).map(
  (f) => readFileSync(f, "utf8"),
);

describe("admin content fields are read somewhere", () => {
  it.each(CONTENT_FIELDS.map((f) => [f.key, f.label] as const))(
    "%s (%s) has a consumer outside the admin panel",
    (key) => {
      const used = CONSUMERS.some((src) => src.includes(key));
      expect(
        used,
        `CONTENT_FIELDS key "${key}" is offered in the admin panel but nothing outside /admin reads it. ` +
          `Either wire it into the page (or the mobile API) or remove it from CONTENT_FIELDS - ` +
          `a control that silently does nothing is worse than no control.`,
      ).toBe(true);
    },
  );
});

describe("the hero image setting reaches a component", () => {
  // Its only consumer was deleted once already; the settings form, the loader
  // and the prop chain all survived, so an operator kept writing a dead field.
  it("is used by a component, not just declared and threaded through", () => {
    const uses = FILES.filter(
      (f) => !REGISTRY.some((r) => f.includes(r)) && f.endsWith(".tsx"),
    )
      .map((f) => [f, readFileSync(f, "utf8")] as const)
      .filter(([, src]) => src.includes("heroImageUrl"))
      // A file that only DECLARES the prop (in a type or a destructure) and
      // never mentions it again is plumbing, not a consumer. A real consumer
      // references it in an expression as well.
      .filter(([, src]) => {
        const mentions = src.split("heroImageUrl").length - 1;
        return mentions >= 2;
      });

    expect(
      uses.length,
      "settings.heroImageUrl is loaded and passed down, but no component actually " +
        "uses it - the panel's 'Hero görsel URL' field would be writing to nothing.",
    ).toBeGreaterThan(0);
  });
});
