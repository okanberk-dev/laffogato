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
import { LEGAL_ENTITY } from "@/lib/legal/entity";

/**
 * The twenty-two designed messages, and the three things that must never reach
 * an inbox: an unfilled `[FIELD]`, an unsubscribe link on transactional mail
 * (or its absence on commercial mail), and a button pointing at nothing.
 *
 * Source of the design: the Starbucks Rewards mail-language spec (8 Eyl 2026),
 * drawn on the palette in `src/app/globals.css` — see
 * `src/lib/email/templates/README.md`.
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

/**
 * A plausible, field-specific value. URLs get a path of their own so a test
 * can tell the hero image's src from the button's href.
 */
function sampleValue(field: string): string {
  return field.endsWith("URL")
    ? `https://laffogato.net/ornek/${field.toLowerCase()}`
    : `«${field}»`;
}

/** A value per field, so a render exercises the real markup. */
function sampleVars(name: EmailTemplateName): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const f of fieldsOf(name)) vars[f] = sampleValue(f);
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

describe("the twenty-two templates render", () => {
  it("ships exactly the twenty-two designed messages", () => {
    expect(NAMES).toHaveLength(22);
    // The order notices the legal texts promise: the tracking number at
    // hand-over, the seller's cancellation, the refund.
    expect(NAMES).toContain("siparis-kargoda");
    expect(NAMES).toContain("siparis-iptal");
    expect(NAMES).toContain("siparis-iade");
    // The double opt-in request (6563): the footer form no longer subscribes
    // an address until its owner confirms from this mail.
    expect(NAMES).toContain("bulten-onay");
    expect(NAMES).toContain("eposta-dogrulama");
    expect(NAMES).toContain("dogum-gunu");
    expect(NAMES).toContain("kampanya-duyuru");
    // The cancellation half of the karaoke pair. Staff could cancel an
    // evening and the member only found out at the door.
    expect(NAMES).toContain("karaoke-iptal");
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

  it.each(NAMES)(
    "%s: the text twin opens no conditional the HTML does not have",
    (name) => {
      // Same fields, same IF markers: a greeting-by-name in the text half of
      // a message whose HTML half dropped it is two messages in one.
      const markers = (source: string) =>
        new Set(
          [...source.matchAll(/<!--IF:([A-Z0-9_]+)-->/g)]
            .map((m) => m[1])
            .filter((flag) => flag !== "APP_LINKS"),
        );
      const html = markers(EMAIL_TEMPLATES[name].html);
      for (const flag of markers(EMAIL_TEXT[name])) {
        expect(html.has(flag), `${name}: <!--IF:${flag}--> only in text`).toBe(
          true,
        );
      }
    },
  );

  it.each(["karaoke-rezervasyon", "karaoke-iptal"] as const)(
    "%s greets without the name in both halves",
    (name) => {
      expect(EMAIL_TEMPLATES[name].html).not.toContain("[AD]");
      expect(EMAIL_TEXT[name]).not.toContain("[AD]");
      expect(EMAIL_TEXT[name].startsWith("Merhaba,")).toBe(true);
    },
  );

  /**
   * Confirmation and cancellation are one pair: whatever the staff do to a
   * booking, the member is told the same four facts about the same evening.
   * A field in one and not the other is how a cancellation ends up unable to
   * name which evening it cancelled.
   */
  it("karaoke's two messages ask for the same reservation fields", () => {
    const of = (name: EmailTemplateName) =>
      fieldsOf(name)
        .filter((f) => f.startsWith("KARAOKE_"))
        .sort();
    expect(of("karaoke-iptal")).toEqual(of("karaoke-rezervasyon"));
    expect(of("karaoke-iptal")).toEqual([
      "KARAOKE_KISI",
      "KARAOKE_KOD",
      "KARAOKE_SAAT",
      "KARAOKE_TARIH",
    ]);
  });

  /**
   * The birthday message promises a validity the coupon has to have. It used
   * to say "doğum gününüzde aktifleşir · 7 gün geçerli" while the only
   * grantor expired the coupon at the end of the MONTH — three days for a
   * member born on the 28th, twenty-nine for one born on the 2nd. The cron
   * now grants seven days from the day itself (`BIRTHDAY.ttlDays`), and
   * "aktifleşir" is gone: a coupon is active the moment it is written.
   */
  it("dogum-gunu promises seven days and no activation step", () => {
    for (const half of [
      EMAIL_TEMPLATES["dogum-gunu"].html,
      EMAIL_TEXT["dogum-gunu"],
    ]) {
      expect(half).toContain("7 gün geçerli");
      expect(half).not.toContain("aktifleş");
    }
  });
});

describe("6563 — commercial and transactional are not interchangeable", () => {
  const commercial = NAMES.filter((n) => EMAIL_TEMPLATES[n].commercial);
  const transactional = NAMES.filter((n) => !EMAIL_TEMPLATES[n].commercial);

  it("marks exactly the ten commercial messages", () => {
    expect(commercial.sort()).toEqual([
      "bulten-kampanya",
      "dogum-gunu",
      "kampanya-bonus-damga",
      "kampanya-duyuru",
      "kampanya-etkinlik",
      "kampanya-happy-hour",
      "kampanya-ikram",
      "kampanya-indirim",
      "kampanya-yeni-urun",
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

  /**
   * Ticari İletişim Yönetmeliği m.8/1: the content of a tacir's commercial
   * electronic message carries the ticaret unvanı and the MERSİS number. One
   * quiet line under the address, both halves, from LEGAL_ENTITY — never
   * typed into a template.
   */
  it.each(commercial)(
    "%s names the sender's title and MERSİS in both halves",
    (name) => {
      const vars = sampleVars(name);
      delete vars.UNVAN;
      delete vars.MERSIS;
      const r = renderWith(name, { vars });
      for (const half of [r.html, r.text]) {
        expect(half).toContain(LEGAL_ENTITY.legalName);
        expect(half).toContain(`MERSİS: ${LEGAL_ENTITY.mersisNo}`);
      }
      // From the single source, not the template.
      expect(EMAIL_TEMPLATES[name].html).toContain(
        "[UNVAN] · MERSİS: [MERSIS]",
      );
      expect(EMAIL_TEMPLATES[name].html).not.toContain(LEGAL_ENTITY.mersisNo);
      expect(EMAIL_TEXT[name]).toContain("[UNVAN] · MERSİS: [MERSIS]");
      // One line, once.
      expect(r.html.split(LEGAL_ENTITY.mersisNo)).toHaveLength(2);
    },
  );

  it.each(transactional)(
    "%s keeps the short foot — the identity line is the commercial rule's",
    (name) => {
      expect(EMAIL_TEMPLATES[name].html).not.toContain("[MERSIS]");
      expect(EMAIL_TEXT[name]).not.toContain("[MERSIS]");
    },
  );
});

describe("campaign blocks follow their fields", () => {
  /**
   * The kampanya-* family is one form with optional parts. Each optional
   * block is wrapped in an IF flag that `render.ts` derives from its first
   * field, so leaving the field empty in the admin form removes the block —
   * and the other fields inside it — rather than sending a hole.
   */
  const CAMPAIGN = NAMES.filter((n) => n.startsWith("kampanya-"));

  /** Flag → the fields its block owns; the first one is what switches it. */
  const BLOCKS: Array<[string, string[]]> = [
    ["GORSEL", ["KAMPANYA_GORSEL_URL", "KAMPANYA_GORSEL_ALT"]],
    ["KOD", ["KUPON_KODU", "SON_KULLANIM"]],
    ["TARIH", ["KAMPANYA_TARIH"]],
    ["DIPNOT", ["KAMPANYA_DIPNOT"]],
    ["VURGU", ["KAMPANYA_VURGU"]],
  ];
  const OPTIONAL = BLOCKS.flatMap(([, fields]) => fields);

  function varsWithout(name: EmailTemplateName, fields: string[]) {
    const vars = sampleVars(name);
    for (const f of fields) delete vars[f];
    return vars;
  }

  it("ships the seven campaign layouts, subject = title, preview = subtitle", () => {
    expect(CAMPAIGN).toHaveLength(7);
    for (const name of CAMPAIGN) {
      expect(EMAIL_TEMPLATES[name].commercial, name).toBe(true);
      expect(EMAIL_TEMPLATES[name].subject, name).toBe("[KAMPANYA_BASLIK]");
      expect(EMAIL_TEMPLATES[name].preheader, name).toBe("[KAMPANYA_ALT]");
    }
  });

  it.each(BLOCKS)(
    "drops the %s block of kampanya-duyuru when its field is absent",
    (flag, fields) => {
      const r = renderWith("kampanya-duyuru", {
        vars: varsWithout("kampanya-duyuru", fields),
      });
      for (const f of fields) {
        expect(r.html, `${f} in html`).not.toContain(sampleValue(f));
        expect(r.text, `${f} in text`).not.toContain(sampleValue(f));
      }
      expect(r.html).not.toContain(`<!--IF:${flag}-->`);
      expect(r.html).not.toMatch(FIELD);
      expect(r.text).not.toMatch(FIELD);
    },
  );

  it("keeps every block of kampanya-duyuru when the fields are present", () => {
    const r = renderWith("kampanya-duyuru");
    for (const f of OPTIONAL) {
      expect(r.html, `${f} in html`).toContain(sampleValue(f));
    }
    expect(r.html).toContain(
      `<img src="${sampleValue("KAMPANYA_GORSEL_URL")}"`,
    );
    expect(r.text).toContain(sampleValue("KUPON_KODU"));
  });

  it.each(CAMPAIGN)("%s renders with nothing optional at all", (name) => {
    const r = renderWith(name, { vars: varsWithout(name, OPTIONAL) });
    expect(r.html).not.toMatch(FIELD);
    expect(r.text).not.toMatch(FIELD);
    expect(r.html).not.toContain("<!--IF:");
    // The fixed lines survive: the title, the button and the way out.
    expect(r.subject).toBe(sampleValue("KAMPANYA_BASLIK"));
    expect(r.html).toContain(sampleValue("KAMPANYA_BUTON"));
    expect(r.html).toContain("/bulten/cikis");
    expect(r.text).toContain("/bulten/cikis");
  });

  it.each(CAMPAIGN)("%s never lets [KAMPANYA_GORSEL_URL] survive", (name) => {
    const withImage = renderWith(name);
    const without = renderWith(name, {
      vars: varsWithout(name, ["KAMPANYA_GORSEL_URL", "KAMPANYA_GORSEL_ALT"]),
    });
    for (const r of [withImage, without]) {
      expect(r.html).not.toContain("[KAMPANYA_GORSEL_URL]");
      expect(r.text).not.toContain("[KAMPANYA_GORSEL_URL]");
      expect(r.html).not.toContain('src=""');
    }
    const hero = `<img src="${sampleValue("KAMPANYA_GORSEL_URL")}"`;
    expect(withImage.html).toContain(hero);
    expect(without.html).not.toContain(hero);
  });

  it("still fails loudly when an open block is half filled", () => {
    // A code without an expiry: the KOD block is open, so [SON_KULLANIM] is
    // asked for, and a message with a gap in it must not be sent.
    expect(() =>
      renderWith("kampanya-duyuru", {
        vars: varsWithout("kampanya-duyuru", ["SON_KULLANIM"]),
      }),
    ).toThrow(/\[SON_KULLANIM\]/);
  });
});

describe("the karaoke confirmation says the party size once", () => {
  it("does not write \"kişi\" after a value that already carries it", () => {
    // send.ts fills KARAOKE_KISI as "4 kişi"; the preheader used to append
    // its own " kişi", so the inbox preview read "4 kişi kişi".
    expect(EMAIL_TEMPLATES["karaoke-rezervasyon"].preheader).not.toMatch(/\[KARAOKE_KISI\] kişi/);
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

describe("the order notices say what happened, and nothing else", () => {
  const NOTICES = ["siparis-kargoda", "siparis-iptal", "siparis-iade"] as const;

  it.each(NOTICES)("%s is transactional and carries nothing promotional", (name) => {
    const t = EMAIL_TEMPLATES[name];
    expect(t.commercial).toBe(false);
    // No app strip and no social line: a notice about somebody's parcel or
    // money is not the place to advertise, and doing so would make it a
    // commercial message under 6563.
    expect(t.html).not.toContain("APP_LINKS");
    expect(t.html).not.toContain("instagram.com");
    expect(EMAIL_TEXT[name]).not.toContain("App Store");
  });

  const orderVars = {
    AD: "Eda",
    SIPARIS_NO: "1042",
    SIPARIS_URL: "https://laffogato.net/uye/hesap/siparislerim/1042",
  };

  it("gives the tracking number in both halves, and the carrier's page only when there is one", () => {
    const base = { ...orderVars, TAKIP_NO: "YK123456789TR", KARGO_FIRMASI: "Yurtiçi Kargo" };
    const without = renderEmail("siparis-kargoda", {
      vars: { ...base, TAKIP_URL: "" },
      text: EMAIL_TEXT["siparis-kargoda"],
    });
    for (const half of [without.html, without.text]) {
      expect(half).toContain("YK123456789TR");
      expect(half).toContain("Yurtiçi Kargo");
      expect(half).not.toContain("kargo takip sayfası");
      expect(half).toContain("/hukuk/teslimat-ve-kargo");
    }
    expect(without.subject).toBe(
      "L'Affogato - Siparişiniz kargoya verildi (#1042)",
    );

    const withPage = renderEmail("siparis-kargoda", {
      vars: { ...base, TAKIP_URL: "https://kargo.example/t/YK123456789TR" },
      text: EMAIL_TEXT["siparis-kargoda"],
    });
    expect(withPage.html).toContain('href="https://kargo.example/t/YK123456789TR"');
    expect(withPage.text).toContain("https://kargo.example/t/YK123456789TR");
  });

  it("leaves the carrier line out rather than printing an empty one", () => {
    const r = renderEmail("siparis-kargoda", {
      vars: { ...orderVars, TAKIP_NO: "1", KARGO_FIRMASI: "", TAKIP_URL: "" },
      text: EMAIL_TEXT["siparis-kargoda"],
    });
    expect(r.html).not.toContain("Taşıyıcı:");
    expect(r.text).not.toContain("Taşıyıcı:");
  });

  const cancelVars = {
    ...orderVars,
    TOPLAM: "260,00 ₺",
    ARA_TOPLAM: "260,00 ₺",
    KARGO: "Ücretsiz",
    KALEMLER: "  • Affogato Classico × 2 - 260,00 ₺",
    BELGELER: "",
  };
  const cancel = (flags: Record<string, boolean>) =>
    renderEmail("siparis-iptal", {
      vars: cancelVars,
      loops: { ITEMS: [{ URUN_AD: "Affogato Classico", URUN_ADET: "2", URUN_TUTAR: "260,00 ₺" }] },
      text: EMAIL_TEXT["siparis-iptal"],
      flags,
    });

  it("promises the refund on a paid cancellation, and only there", () => {
    const paid = cancel({ ODEME_ALINDI: true, ODEME_YOK: false });
    for (const half of [paid.html, paid.text]) {
      expect(half).toContain("ödemeniz alınmıştı");
      expect(half).not.toContain("görünmüyor");
    }
    const unpaid = cancel({ ODEME_ALINDI: false, ODEME_YOK: true });
    for (const half of [unpaid.html, unpaid.text]) {
      expect(half).toContain("görünmüyor");
      expect(half).not.toContain("ödemeniz alınmıştı");
    }
    // The lookup failed: the mail does not guess about the card either way.
    const unknown = cancel({});
    for (const half of [unknown.html, unknown.text]) {
      expect(half).not.toContain("ödemeniz alınmıştı");
      expect(half).not.toContain("görünmüyor");
    }
    expect(paid.subject).toBe("L'Affogato - Siparişiniz iptal edildi (#1042)");
  });

  it("says the refund went to the card only when the POS sent it there", () => {
    const vars = {
      ...orderVars,
      IADE_TUTARI: "100,00 ₺",
      TOPLAM_IADE: "100,00 ₺",
      TOPLAM: "260,00 ₺",
    };
    const card = renderEmail("siparis-iade", {
      vars,
      text: EMAIL_TEXT["siparis-iade"],
      flags: { KARTA_IADE: true },
    });
    const byHand = renderEmail("siparis-iade", {
      vars,
      text: EMAIL_TEXT["siparis-iade"],
      flags: { KARTA_IADE: false },
    });
    for (const half of [card.html, card.text]) {
      expect(half).toContain("100,00 ₺");
      expect(half).toContain("karta yapıldı");
    }
    for (const half of [byHand.html, byHand.text]) {
      expect(half).toContain("100,00 ₺");
      expect(half).not.toContain("karta");
    }
    expect(card.subject).toBe("L'Affogato - İadeniz yapıldı (#1042)");
  });

  it("never lets a caller's flag open a block whose field is empty", () => {
    const r = renderEmail("siparis-kargoda", {
      vars: { ...orderVars, TAKIP_NO: "1", KARGO_FIRMASI: "", TAKIP_URL: "" },
      text: EMAIL_TEXT["siparis-kargoda"],
      flags: { TAKIP_LINKI: true, FIRMA: true },
    });
    expect(r.html).not.toContain('href=""');
    expect(r.text).not.toContain("Taşıyıcı:");
  });
});

describe("one dash only", () => {
  /**
   * The operator's rule (22 Sep 2026): the hyphen is the only dash anything
   * we write may carry. The mail was the largest holdout: 77 visible long
   * dashes across the designed templates, the text twins and the three
   * Supabase auth mails pasted into the dashboard by hand.
   */
  const LONG_DASH = /[–—]/;
  const SUPABASE_DIR = join(process.cwd(), "docs", "email");

  it.each(NAMES)("%s writes no long dash in either half", (name) => {
    const t = EMAIL_TEMPLATES[name];
    expect(t.html, `${name} html`).not.toMatch(LONG_DASH);
    expect(t.subject, `${name} subject`).not.toMatch(LONG_DASH);
    expect(EMAIL_TEXT[name], `${name} text`).not.toMatch(LONG_DASH);
  });

  it("keeps the Supabase auth templates on the hyphen too", () => {
    const files = readdirSync(SUPABASE_DIR).filter((f) => f.endsWith(".html"));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const source = readFileSync(join(SUPABASE_DIR, file), "utf8");
      expect(source, file).not.toMatch(LONG_DASH);
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
