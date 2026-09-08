import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { assertFilled, escapeHtml, fill, fillText } from "@/lib/email/fill";
import { renderEmail } from "@/lib/email/render";
import {
  EMAIL_TEMPLATES,
  type EmailTemplateName,
} from "@/lib/email/templates.generated";
import { EMAIL_TEXT } from "@/lib/email/text";

/**
 * The ten designed messages, and the three things that must never reach an
 * inbox: an unfilled `[FIELD]`, an unsubscribe link on transactional mail (or
 * its absence on commercial mail), and a button pointing at nothing.
 *
 * Source of the design: the Claude Design handoff, migrated onto the palette
 * in `src/app/globals.css` — see `src/lib/email/templates/README.md`.
 */

const DIR = join(process.cwd(), "src", "lib", "email", "templates");
const NAMES = Object.keys(EMAIL_TEMPLATES) as EmailTemplateName[];
const FIELD = /\[([A-Z0-9_]+)\]/g;

/** Every `[FIELD]` a template can ask for, HTML + subject + text together. */
function fieldsOf(name: EmailTemplateName): string[] {
  const t = EMAIL_TEMPLATES[name];
  const source = `${t.html} ${t.subject} ${EMAIL_TEXT[name]}`;
  return [...new Set([...source.matchAll(FIELD)].map((m) => m[1]))];
}

/** A plausible value per field, so a render exercises the real markup. */
function sampleVars(name: EmailTemplateName): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const f of fieldsOf(name)) {
    vars[f] =
      f.endsWith("_URL") || f.endsWith("URL")
        ? "https://laffogato.net/ornek"
        : `«${f}»`;
  }
  return vars;
}

function renderWith(
  name: EmailTemplateName,
  extra: Record<string, unknown> = {},
) {
  return renderEmail(name, {
    vars: sampleVars(name),
    loops: {
      ITEMS: [
        {
          URUN_AD: "Affogato Classico",
          URUN_ADET: "2",
          URUN_TUTAR: "260,00 ₺",
        },
      ],
    },
    text: EMAIL_TEXT[name],
    ...(EMAIL_TEMPLATES[name].commercial
      ? { unsubscribeUrl: "https://laffogato.net/bulten/cikis?token=abc" }
      : {}),
    ...extra,
  });
}

describe("the ten templates render", () => {
  it("ships exactly the ten designed messages", () => {
    expect(NAMES).toHaveLength(10);
    expect(NAMES).toContain("eposta-dogrulama");
    expect(NAMES).toContain("dogum-gunu");
  });

  it.each(NAMES)("%s leaves no [FIELD] behind", (name) => {
    const r = renderWith(name);
    expect(r.html).not.toMatch(FIELD);
    expect(r.subject).not.toMatch(FIELD);
    expect(r.text).not.toMatch(FIELD);
  });

  it.each(NAMES)("%s resolves every conditional and loop marker", (name) => {
    const r = renderWith(name);
    expect(r.html).not.toContain("<!--IF:");
    expect(r.html).not.toContain("<!--EACH:");
    expect(r.text).not.toContain("<!--IF:");
  });

  it.each(NAMES)("%s stays under Gmail's 100 KB clip", (name) => {
    // Gmail truncates past ~102 KB and hides the unsubscribe link with it.
    expect(Buffer.byteLength(renderWith(name).html, "utf8")).toBeLessThan(
      100_000,
    );
  });

  it.each(NAMES)("%s carries a plain-text alternative", (name) => {
    expect(EMAIL_TEXT[name].length).toBeGreaterThan(120);
  });
});

describe("6563 — commercial and transactional are not interchangeable", () => {
  const commercial = NAMES.filter((n) => EMAIL_TEMPLATES[n].commercial);
  const transactional = NAMES.filter((n) => !EMAIL_TEMPLATES[n].commercial);

  it("marks exactly the three commercial messages", () => {
    expect(commercial.sort()).toEqual([
      "bulten-kampanya",
      "dogum-gunu",
      "mobil-uygulama",
    ]);
  });

  it.each(commercial)("%s refuses to render without a way out", (name) => {
    expect(() =>
      renderEmail(name, { vars: sampleVars(name), text: EMAIL_TEXT[name] }),
    ).toThrow(/6563/);
  });

  it.each(commercial)("%s puts the unsubscribe link in both halves", (name) => {
    const r = renderWith(name);
    expect(r.unsubscribeUrl).toBeTruthy();
    expect(r.html).toContain("/bulten/cikis");
    expect(r.text).toContain("/bulten/cikis");
  });

  it.each(transactional)("%s refuses an unsubscribe link", (name) => {
    expect(() =>
      renderEmail(name, {
        vars: sampleVars(name),
        text: EMAIL_TEXT[name],
        loops: { ITEMS: [] },
        unsubscribeUrl: "https://laffogato.net/bulten/cikis?token=abc",
      }),
    ).toThrow(/işlemsel/);
  });
});

describe("values are data, not markup", () => {
  it("escapes a name that carries a tag", () => {
    const html = fill("Merhaba [AD]", {
      vars: { AD: '<img src=x onerror="alert(1)">' },
    });
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });

  it("escapes the ampersand a query string brings into an href", () => {
    expect(escapeHtml("?a=1&b=2")).toBe("?a=1&amp;b=2");
  });

  it("leaves the subject line alone — &amp; there is a visible bug", () => {
    expect(fillText("[BASLIK]", { BASLIK: "Kahve & Gelato" })).toBe(
      "Kahve & Gelato",
    );
  });

  it("names what is missing rather than sending a gap", () => {
    expect(() => assertFilled("Merhaba [AD]", "test")).toThrow(/\[AD\]/);
  });
});

describe("the app strip is dropped until the app exists", () => {
  it("removes the store buttons when no listing is configured", () => {
    // No NEXT_PUBLIC_*_STORE_URL in the test env — the default state today.
    const r = renderWith("eposta-dogrulama");
    expect(r.html).not.toContain("App Store");
    expect(r.html).not.toContain("Google Play");
  });

  it("keeps them once both listings are set", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_STORE_URL", "https://apps.apple.com/app/id1");
    vi.stubEnv("NEXT_PUBLIC_PLAY_STORE_URL", "https://play.google.com/store/x");
    vi.resetModules();
    const { renderEmail: render } = await import("@/lib/email/render");
    const html = render("eposta-dogrulama", {
      vars: sampleVars("eposta-dogrulama"),
      text: EMAIL_TEXT["eposta-dogrulama"],
    }).html;
    expect(html).toContain("App Store");
    expect(html).toContain("Google Play");
    vi.unstubAllEnvs();
    vi.resetModules();
  });
});

describe("the committed build matches its sources", () => {
  it("has one .html per generated entry, byte for byte", () => {
    const files = readdirSync(DIR).filter((f) => f.endsWith(".html"));
    expect(files).toHaveLength(NAMES.length);
    for (const name of NAMES) {
      const onDisk = readFileSync(join(DIR, `${name}.html`), "utf8");
      expect(EMAIL_TEMPLATES[name].html, `${name}: npm run email:build`).toBe(
        onDisk,
      );
    }
  });

  it("takes its subject from the template, matching the <title>", () => {
    for (const name of NAMES) {
      const html = EMAIL_TEMPLATES[name].html;
      const title = html.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "";
      expect(title, name).toBe(EMAIL_TEMPLATES[name].subject);
    }
  });
});

describe("the palette is the site's, not the handoff's", () => {
  /**
   * The design was drawn against globals.css as it stood on 8 Sep 2026 and
   * migrated onto the Köşk/tricolore palette on the way in. These are the
   * retired values; a template re-exported from the design tool would bring
   * them back, and the mail would quietly stop looking like the site.
   */
  const RETIRED = [
    "#1b4034",
    "#2f6b58",
    "#f6f9f7",
    "#eef3f0",
    "#dfeae4",
    "#e8c877",
    "#7d5f27",
    "#1b2f28",
  ];

  it.each(NAMES)("%s carries no retired hex", (name) => {
    const html = EMAIL_TEMPLATES[name].html.toLowerCase();
    for (const hex of RETIRED)
      expect(html, `${hex} in ${name}`).not.toContain(hex);
  });

  it.each(NAMES)("%s paints the house green and the brand ink", (name) => {
    const html = EMAIL_TEMPLATES[name].html;
    expect(html).toContain("#143d2b");
    expect(html).toContain("#201c17");
    expect(html).toContain("Montserrat");
  });
});
