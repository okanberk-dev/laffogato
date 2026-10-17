import { readFileSync } from "node:fs";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/**
 * The karaoke band on the home page and the 4th hero slide (operator, 17
 * Eki 2026: "sitede anasayfada da karaokeyi vurgula"): today's free hours
 * read after hydration, facts from the panel, `?saat=` on the booking page,
 * and motion that stays still under reduced motion.
 */

vi.mock("@/app/karaoke/actions", () => ({ bookKaraokeAction: vi.fn() }));

const today = await import("@/components/laffogato/karaoke-today");
const { HomeKaraoke } = await import("@/components/laffogato/home-karaoke");
const { KaraokeBooking } =
  await import("@/components/laffogato/karaoke-booking");
const { HOME_SLIDES, slideText } = await import("@/components/laffogato/data");
const { splitLead } = await import("@/components/laffogato/split-lead");

const read = (p: string) => readFileSync(p, "utf8");
const CSS = read("src/app/globals.css");
const HOME = read("src/components/laffogato/home-page.tsx");

const FACTS = {
  capacity: 8,
  hourlyMinor: 90_000,
  closeHour: 24,
  rubyDiscountPct: 15,
  rubyLabel: "RUBY",
  prepay: true,
};

const DAY = {
  date: "2026-10-17",
  slots: [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23].map((h) => ({
    startHour: h,
    // 19:00 is booked; the rest of the evening is free.
    available: h !== 19,
  })),
};

const band = (t: Parameters<typeof HomeKaraoke>[0]["today"], f = FACTS) =>
  renderToStaticMarkup(createElement(HomeKaraoke, { facts: f, today: t }));

describe("today's free hours", () => {
  it("drops the hours that have started and offers at most three", () => {
    // 18:30 in Tuzla: 12-18 are gone, 19 is booked.
    const r = today.readKaraokeDay(DAY, 18 * 60 + 30);
    expect(r.kind).toBe("open");
    if (r.kind !== "open") return;
    expect(r.chips.map((c) => c.label)).toEqual(["20:00", "21:00", "22:00"]);
    expect(r.chips[0].href).toBe("/karaoke?tarih=2026-10-17&saat=20");
    // The door counts every free hour left (20-23), not just the chips.
    expect(r.free).toBe(4);
  });

  it("an hour that starts right now is no longer offered", () => {
    const r = today.readKaraokeDay(DAY, 22 * 60);
    expect(r.kind === "open" && r.chips.map((c) => c.hour)).toEqual([23]);
  });

  it("says full when hours remain but every one is booked", () => {
    const booked = {
      date: "2026-10-17",
      slots: DAY.slots.map((s) => ({ ...s, available: false })),
    };
    expect(today.readKaraokeDay(booked, 15 * 60)).toEqual({
      kind: "full",
      date: "2026-10-17",
      tomorrowHref: "/karaoke?tarih=2026-10-18",
    });
  });

  it("says closed once the last hour has started, and points at tomorrow", () => {
    expect(today.readKaraokeDay(DAY, 23 * 60 + 10)).toEqual({
      kind: "closed",
      date: "2026-10-17",
      tomorrowHref: "/karaoke?tarih=2026-10-18",
    });
    // Across a month end.
    expect(today.nextCalendarDay("2026-10-31")).toBe("2026-11-01");
  });

  it("reads the köşk's clock, not the server's zone", () => {
    // 15:30 UTC is 18:30 in Tuzla (fixed UTC+3).
    expect(today.istanbulMinutes(new Date("2026-10-17T15:30:00Z"))).toBe(
      18 * 60 + 30,
    );
    expect(today.istanbulMinutes(new Date("2026-10-17T21:05:00Z"))).toBe(5);
  });
});

describe("asking the calendar (after hydration)", () => {
  const at = () => new Date("2026-10-17T15:30:00Z"); // 18:30 Tuzla
  const answer = (status: number, body: unknown) =>
    vi.fn(async () => new Response(JSON.stringify(body), { status }));

  it("turns a good answer into chips", async () => {
    const fetchImpl = answer(200, DAY);
    const r = await today.loadKaraokeToday(fetchImpl, at);
    expect(r.kind === "open" && r.chips.length).toBe(3);
    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/mobile/v1/karaoke/availability",
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("shows nothing on a 503, a 500, a broken body or a dropped line", async () => {
    const down = answer(503, {
      error: "unavailable",
      message: "Rezervasyon takvimine şu an ulaşılamıyor.",
    });
    expect(await today.loadKaraokeToday(down, at)).toEqual({ kind: "error" });
    expect(await today.loadKaraokeToday(answer(500, {}), at)).toEqual({
      kind: "error",
    });
    expect(
      await today.loadKaraokeToday(answer(200, { date: "x", slots: 3 }), at),
    ).toEqual({ kind: "error" });
    const offline = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    expect(await today.loadKaraokeToday(offline, at)).toEqual({
      kind: "error",
    });
  });

  it("asks once per page view, and only where the band is", () => {
    // One call site: the home page hands the answer to the band and the door.
    const calls = (src: string) =>
      [...src.matchAll(/useKaraokeToday\(/g)].length;
    expect(calls(HOME)).toBe(1);
    expect(HOME).toContain("useKaraokeToday(!!karaoke)");
    expect(calls(read("src/components/laffogato/home-karaoke.tsx"))).toBe(0);
    const hook = read("src/components/laffogato/use-karaoke-today.ts");
    expect(hook).toMatch(/if \(!enabled\) return;/);
  });

  it("never asks during the server render", () => {
    const hook = read("src/components/laffogato/use-karaoke-today.ts");
    expect(hook).toMatch(/useEffect\(\(\) => \{[\s\S]*loadKaraokeToday\(/);
    expect(hook).toMatch(/useState<KaraokeToday>\(\{ kind: "loading" \}\)/);
    // The force-dynamic home keeps its TTFB: no calendar read on the server.
    expect(read("src/app/page.tsx")).not.toMatch(/getAvailability/);
  });
});

describe("the band", () => {
  it("renders the copy, the panel's facts and three chips", () => {
    const html = band(today.readKaraokeDay(DAY, 18 * 60 + 30));
    expect(html).toContain("Karaoke · köşkün üst katı");
    expect(html).toMatch(/<h2[^>]*>Sahne bu akşam senin<\/h2>/);
    expect(html).toContain(
      "200 yıllık köşkün üst katında sana ve arkadaşlarına ait bir oda. Saatini seç, kartınla öde, rezervasyonun hemen kesinleşsin.",
    );
    for (const fact of [
      "8 kişiye kadar",
      "Gece 24:00’e kadar",
      "Saati 900₺",
      "RUBY üyelere %15 indirim",
    ]) {
      expect(html).toContain(`<li>${fact}</li>`);
    }
    expect(html).toContain("Bugün boş saatler");
    const chips = [
      ...html.matchAll(
        /class="home-karaoke-chip" href="([^"]+)"><span class="sr-only">Bugün <\/span>([^<]+)</g,
      ),
    ].map((m) => [m[1], m[2]]);
    expect(chips).toEqual([
      ["/karaoke?tarih=2026-10-17&amp;saat=20", "20:00"],
      ["/karaoke?tarih=2026-10-17&amp;saat=21", "21:00"],
      ["/karaoke?tarih=2026-10-17&amp;saat=22", "22:00"],
    ]);
    expect(html).toMatch(/href="\/karaoke"[^>]*>Saatini seç/);
    expect(html).toContain("Doğum günü mü var? Rezervasyonda notunu yaz");
  });

  it("without the calendar it shows no chips, and everything else", () => {
    const html = band({ kind: "error" });
    expect(html).not.toContain("Bugün boş saatler");
    expect(html).not.toContain("home-karaoke-chip");
    // The line stays, empty, at the height it held while asked.
    expect(html).toContain(
      '<div class="home-karaoke-live" aria-hidden="true"></div>',
    );
    expect(html).toContain("Saati 900₺");
    expect(html).toMatch(/href="\/karaoke"[^>]*>Saatini seç/);
  });

  it("holds the line's place, empty, while the calendar is asked", () => {
    const html = band({ kind: "loading" });
    expect(html).toContain(
      '<div class="home-karaoke-live is-pending" aria-hidden="true"></div>',
    );
    expect(html).not.toContain("Bugün boş saatler");
  });

  it("keeps one height for the line whatever the calendar answers", () => {
    // On the line itself, not only while pending: a full or finished day
    // (one link) and no answer (empty) would otherwise pull the button up.
    expect(CSS).toMatch(
      /\n\.home-karaoke-live \{[^}]*min-height: calc\(13\.5px \* 1\.6 \+ 10px \+ 44px\);/,
    );
    expect(CSS).not.toMatch(/\.home-karaoke-live\.is-pending \{/);
  });

  it("points at tomorrow when today is full or over", () => {
    expect(band(today.readKaraokeDay({ ...DAY, slots: [] }, 0))).toContain(
      'href="/karaoke?tarih=2026-10-18">Yarın için saatini seç</a>',
    );
    const full = {
      ...DAY,
      slots: DAY.slots.map((s) => ({ ...s, available: false })),
    };
    expect(band(today.readKaraokeDay(full, 600))).toContain(
      'href="/karaoke?tarih=2026-10-18">Bugün oda dolu, yarına bak</a>',
    );
  });

  it("says what the panel says, and nothing it does not", () => {
    const html = band(
      { kind: "error" },
      {
        capacity: 6,
        hourlyMinor: 120_000,
        closeHour: 22,
        rubyDiscountPct: 0,
        rubyLabel: "RUBY",
        prepay: false,
      },
    );
    expect(html).toContain("<li>6 kişiye kadar</li>");
    expect(html).toContain("<li>Gece 22:00’ye kadar</li>");
    expect(html).toContain("<li>Saati 1.200₺</li>");
    expect(html).not.toContain("RUBY");
    // Request flow: nothing is paid on the site.
    expect(html).toContain("Saatini seç, isteğini gönder.");
    expect(html).not.toContain("kartınla öde");
    // No fact is typed into the band itself.
    const src = read("src/components/laffogato/home-karaoke.tsx");
    expect(src).not.toMatch(/8 kişi|900|24:00|%15/);
  });

  it("keeps the drawing out of the accessibility tree", () => {
    const html = band({ kind: "error" });
    expect(html).toMatch(
      /<div class="home-karaoke-stage" aria-hidden="true"><img alt="" aria-hidden="true"[^>]*src="\/_next\/image\?url=%2Fillustrations%2Fkaraoke-room\.webp/,
    );
  });

  it("sits right after the hero's statement, before Köşkte bu ay", () => {
    const intro = HOME.indexOf('className="home-intro"');
    const karaoke = HOME.indexOf(
      "<HomeKaraoke facts={karaoke} today={karaokeToday} />",
    );
    const promo = HOME.indexOf('className="promo-banner promo-banner--art');
    expect(intro).toBeGreaterThan(-1);
    expect(karaoke).toBeGreaterThan(intro);
    expect(promo).toBeGreaterThan(karaoke);
  });

  it("lets the karaoke door say how many hours are free today", () => {
    // "Bugün N boş saat" from the same reading as the chips; the room's
    // facts while it is asked, when it fails, and when nothing is free.
    const open = today.readKaraokeDay(DAY, 18 * 60 + 30);
    expect(today.karaokeDoorLine(open, FACTS)).toBe("Bugün 4 boş saat");
    const facts = "8 kişiye kadar · 24:00’e";
    expect(today.karaokeDoorLine({ kind: "loading" }, FACTS)).toBe(facts);
    expect(today.karaokeDoorLine({ kind: "error" }, FACTS)).toBe(facts);
    expect(
      today.karaokeDoorLine(today.readKaraokeDay(DAY, 23 * 60 + 10), FACTS),
    ).toBe(facts);
    // Without the panel's facts: no number typed in as a stand-in.
    expect(today.karaokeDoorLine({ kind: "loading" }, undefined)).toBe(
      "Saatini seç",
    );
    expect(HOME).toContain("sub: karaokeDoorLine(karaokeToday, karaoke),");
    expect(HOME).not.toMatch(/8 kişiye kadar|24:00’e/);
  });

  it("names a closing hour the way it is read aloud", () => {
    expect(today.hourToLabel(24)).toBe("24:00’e");
    expect(today.hourToLabel(23)).toBe("23:00’e");
    expect(today.hourToLabel(22)).toBe("22:00’ye");
    expect(today.hourToLabel(20)).toBe("20:00’ye");
    expect(today.hourToLabel(16)).toBe("16:00’ya");
    expect(today.hourToLabel(19)).toBe("19:00’a");
    expect(today.hourToLabel(10)).toBe("10:00’a");
    expect(today.hourToLabel(0)).toBe("00:00’a");
  });
});

describe("?saat= on the booking page", () => {
  const props = {
    days: ["2026-10-17", "2026-10-18"],
    date: "2026-10-17",
    availability: {
      date: "2026-10-17",
      slots: [
        { startHour: 20, available: true },
        { startHour: 21, available: true },
        { startHour: 22, available: false },
      ],
      hourlyMinor: 90_000,
      capacity: 8,
      oroDiscountPct: 15,
      firstHour: 12,
      closeHour: 24,
      maxHours: 4,
      bookingWindowDays: 60,
      paymentRequired: true,
      freeCancelHours: 2,
      consentDocs: ["karaoke-odasi-rezervasyon"],
      privacyDoc: "kvkk-aydinlatma-metni",
      cancellationRules: [],
    },
    unavailable: false,
    capacity: 8,
    hourlyMinor: 90_000,
    tier: null,
    tierLabel: null,
    isAuthenticated: false,
    emailVerified: false,
    phone: "+90 536 429 09 19",
    address: "Postane Mah. Atatürk Cad. No: 28, Tuzla",
    prepay: true,
  };
  const pressed = (over: Record<string, unknown>) => {
    const html = renderToStaticMarkup(
      createElement(KaraokeBooking, { ...props, ...over }),
    );
    return [
      ...html.matchAll(
        /aria-pressed="true"[^>]*><span class="karaoke-hour-t">(\d\d:00)/g,
      ),
    ].map((m) => m[1]);
  };

  it("preselects the asked hour when it is free", () => {
    expect(pressed({ initialHour: 21 })).toEqual(["21:00"]);
  });

  it("falls back to the first free hour when the asked one is taken or absent", () => {
    expect(pressed({ initialHour: 22 })).toEqual(["20:00"]);
    expect(pressed({ initialHour: 9 })).toEqual(["20:00"]);
    expect(pressed({})).toEqual(["20:00"]);
  });

  it("keeps the picked hour across signing in", () => {
    const html = renderToStaticMarkup(
      createElement(KaraokeBooking, {
        ...props,
        prepay: false,
        initialHour: 21,
      }),
    );
    expect(html).toContain(
      `href="/uye/giris?next=${encodeURIComponent("/karaoke?tarih=2026-10-17&saat=21")}"`,
    );
  });

  it("reads 21 and 21:00, and nothing else", () => {
    expect(today.parseSaatParam("21")).toBe(21);
    expect(today.parseSaatParam("21:00")).toBe(21);
    expect(today.parseSaatParam(" 9 ")).toBe(9);
    for (const bad of ["24", "21:30", "-1", "abc", "", undefined]) {
      expect(today.parseSaatParam(bad), String(bad)).toBeNull();
    }
    expect(today.parseSaatParam(["20", "21"])).toBeNull();
    const page = read("src/app/karaoke/page.tsx");
    expect(page).toContain(
      "searchParams: Promise<{ tarih?: string; saat?: string }>",
    );
    expect(page).toContain("initialHour={parseSaatParam(saat)}");
  });
});

describe("the hero's karaoke slide", () => {
  const slide = HOME_SLIDES[3];

  it("is the fourth slide, on the berry light, opening the booking page", () => {
    expect(HOME_SLIDES).toHaveLength(4);
    expect(slide.kicker).toBe("Akşamları üst katta");
    expect(slide.title).toEqual(["Sahne", "senin"]);
    expect(slide.scene).toBe("berry");
    expect(slide.primary).toEqual({ label: "Saatini seç", action: "karaoke" });
    expect(slide.secondary).toEqual({
      label: "Ziyaret bilgileri",
      action: "visit",
    });
    // Unique: the thumbnails are keyed by photo.
    expect(new Set(HOME_SLIDES.map((s) => s.photo)).size).toBe(4);
  });

  it("fills the room's size and closing hour from the panel", () => {
    expect(slideText(slide.text, FACTS)).toBe(
      "Gündüz kahve, akşam şarkı. Üst kattaki oda 8 kişiye kadar, gece 24:00’e kadar senin.",
    );
    expect(
      slideText(slide.text, { ...FACTS, capacity: 6, closeHour: 22 }),
    ).toBe(
      "Gündüz kahve, akşam şarkı. Üst kattaki oda 6 kişiye kadar, gece 22:00’ye kadar senin.",
    );
    // Without the settings the sentence that needs them is left out.
    expect(slideText(slide.text)).toBe("Gündüz kahve, akşam şarkı.");
    // The drinks' text passes through untouched.
    expect(slideText(HOME_SLIDES[0].text, FACTS)).toBe(HOME_SLIDES[0].text);
    expect(splitLead(slideText(slide.text, FACTS))[0]).toBe(
      "Gündüz kahve, akşam şarkı.",
    );
  });

  it("stands on a transparent 581 x 942 cut-out of the room's microphone", async () => {
    expect(slide.photo).toBe("/illustrations/karaoke-mic-cut.webp");
    const { default: sharp } = await import("sharp");
    const meta = await sharp(`public${slide.photo}`).metadata();
    expect([meta.width, meta.height]).toEqual([581, 942]);
    expect(meta.hasAlpha).toBe(true);
    // Transparent around the drawing, like the drinks' cut-outs.
    const { data, info } = await sharp(`public${slide.photo}`)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const alphaAt = (x: number, y: number) =>
      data[(y * info.width + x) * info.channels + 3];
    expect(alphaAt(0, 0)).toBe(0);
    expect(alphaAt(580, 941)).toBe(0);
    expect(alphaAt(290, 400)).toBeGreaterThan(200);
  });

  it("gives every slide its own thumbnail column", () => {
    const slider = read("src/components/laffogato/home-hero-slider.tsx");
    expect(slider).toContain('"--thumbs": HOME_SLIDES.length');
    expect(slider).toContain("splitLead(slideText(slide.text, karaoke))");
    expect(CSS).toMatch(
      /\.hero-x-thumbs \{[^}]*grid-template-columns: repeat\(var\(--thumbs, 3\), minmax\(0, 1fr\)\);/,
    );
  });
});

describe("motion", () => {
  /** Every rule body for a selector list that starts with `selector`. */
  const rules = (selector: string) =>
    [...CSS.matchAll(/\n([^\n{}]+) \{([^}]*)\}/g)]
      .filter((m) => m[1].trim().startsWith(selector))
      .map((m) => m[2]);

  it("plays the band's sheen once, only as .reveal brings it in", () => {
    expect(
      rules(".home-karaoke.will-reveal.is-in .home-karaoke-stage::after"),
    ).toEqual([
      expect.stringContaining(
        "animation: home-karaoke-sheen 1.5s var(--ease-out) 0.3s 1 both;",
      ),
    ]);
    expect(CSS).toMatch(
      /@media \(prefers-reduced-motion: reduce\) \{\n\s*\.home-karaoke-stage::after \{\n\s*display: none;\n\s*animation: none;/,
    );
  });

  it("presses the two filled stamps once, and not under reduced motion", () => {
    const press = rules(".loyalty-block.will-reveal.is-in .stamp.filled");
    expect(press.join("\n")).toContain(
      "animation: stamp-press 0.5s var(--ease-spring) 0.45s both;",
    );
    expect(press.join("\n")).toContain(
      "animation: stamp-ring 0.5s var(--ease-out) 0.6s both;",
    );
    expect(CSS).toMatch(
      /@media \(prefers-reduced-motion: reduce\) \{\n\s*\.loyalty-block \.stamp\.filled,\n\s*\.loyalty-block \.stamp\.filled::after \{\n\s*animation: none;/,
    );
    // Over in about a second and a half, never looping (WCAG 2.2.2).
    for (const name of ["stamp-press", "stamp-ring", "home-karaoke-sheen"]) {
      expect(CSS).not.toMatch(new RegExp(`${name}[^;]*infinite`));
    }
  });

  it("leaves the reveal driver alone under reduced motion", () => {
    // Both moments hang off `.will-reveal.is-in`, which RevealMotion never
    // sets when the visitor asked for reduced motion.
    expect(read("src/components/laffogato/reveal-motion.tsx")).toContain(
      'if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;',
    );
  });
});
