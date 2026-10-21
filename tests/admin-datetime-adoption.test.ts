import { readFileSync } from "node:fs";

import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/**
 * The ten publish-window boxes on DateTimeField (admin UI v2, UI-15): each
 * form still server-renders a native `datetime-local` input with its old
 * name and value (the server render, the no-JavaScript path and the touch
 * path), now with its own aria-label, and no form writes the type by hand.
 * The widget swap is in the PR's browser checklist.
 */

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    prefetch: _prefetch,
    ...rest
  }: {
    href: string;
    children?: ReactNode;
    prefetch?: boolean;
  }) => createElement("a", { href, ...rest }, children),
  useLinkStatus: () => ({ pending: false }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  unstable_rethrow: vi.fn(),
}));

const { PromoForm } = await import("@/components/admin/promo-form");
const { CampaignMailForm } =
  await import("@/app/admin/bulten/kampanya/campaign-mail-form");
const { HomeSlideForm } = await import("@/app/admin/anasayfa-hero/slide-form");
const { AppSlideForm } = await import("@/app/admin/mobil/slaytlar/slide-form");
const { AppAnnouncementForm } =
  await import("@/app/admin/mobil/duyurular/announcement-form");
const { AppPostForm } = await import("@/app/admin/mobil/gonderiler/post-form");

const action = vi.fn(async () => ({}));

// 20 Eki 2026 12:00 Istanbul = 09:00 UTC; the box shows the Istanbul clock.
const START_UTC = "2026-10-20T09:00:00.000Z";
const START_BOX = "2026-10-20T12:00";
const END_UTC = "2026-10-30T18:30:00.000Z";
const END_BOX = "2026-10-30T21:30";

const inputs = (html: string) =>
  [...html.matchAll(/<input\b[^>]*>/g)].map((m) => m[0]);

/** The datetime-local inputs as { name, value, label }. */
function boxes(html: string) {
  return inputs(html)
    .filter((tag) => /type="datetime-local"/.test(tag))
    .map((tag) => ({
      name: /name="([^"]*)"/.exec(tag)?.[1],
      value: /value="([^"]*)"/.exec(tag)?.[1] ?? "",
      label: /aria-label="([^"]*)"/.exec(tag)?.[1],
    }));
}

const HERO = {
  sortOrder: 1,
  isActive: true,
  startsAt: START_UTC,
  endsAt: END_UTC,
  kicker: "",
  titleLine1: "Başlık",
  titleLine2: "",
  body: "",
  image: "",
  alt: "",
  scene: "latte",
  primaryLabel: "",
  primaryAction: "",
  primaryHref: "",
  secondaryLabel: "",
  secondaryAction: "",
  secondaryHref: "",
};
const WINDOW = { startsAt: START_UTC, endsAt: END_UTC };

describe("the publish-window boxes on DateTimeField", () => {
  it("promo form: expiresAt keeps its Istanbul value, empty without one", () => {
    const empty = renderToStaticMarkup(
      createElement(PromoForm, { action, submitLabel: "Kaydet" } as never),
    );
    expect(boxes(empty)).toEqual([
      {
        name: "expiresAt",
        value: "",
        label: "Son geçerlilik tarihi ve saati",
      },
    ]);
    const set = renderToStaticMarkup(
      createElement(PromoForm, {
        action,
        submitLabel: "Kaydet",
        promo: {
          id: "prm-0001",
          code: "YAZ",
          kind: "pct",
          value: 10,
          expiresAt: END_UTC,
          isActive: true,
        },
      } as never),
    );
    expect(boxes(set).map((b) => [b.name, b.value])).toEqual([
      ["expiresAt", END_BOX],
    ]);
  });

  it("campaign composer: scheduledAt is the controlled box with its value", () => {
    const html = renderToStaticMarkup(
      createElement(CampaignMailForm, {
        action,
        submitLabel: "Kaydet",
        defaults: { scheduledAt: START_BOX },
      } as never),
    );
    expect(boxes(html)).toEqual([
      {
        name: "scheduledAt",
        value: START_BOX,
        label: "Gönderim tarihi ve saati",
      },
    ]);
    const blank = renderToStaticMarkup(
      createElement(CampaignMailForm, { action, submitLabel: "Kaydet" }),
    );
    expect(boxes(blank).map((b) => [b.name, b.value])).toEqual([
      ["scheduledAt", ""],
    ]);
  });

  it.each([
    [
      "home hero slide",
      () =>
        createElement(HomeSlideForm, {
          action,
          submitLabel: "Kaydet",
          defaults: HERO,
        } as never),
    ],
    [
      "app slide",
      () =>
        createElement(AppSlideForm, {
          action,
          submitLabel: "Kaydet",
          defaults: WINDOW,
        } as never),
    ],
    [
      "app announcement",
      () =>
        createElement(AppAnnouncementForm, {
          action,
          submitLabel: "Kaydet",
          defaults: WINDOW,
        } as never),
    ],
    [
      "app post",
      () =>
        createElement(AppPostForm, {
          action,
          mode: "create",
          submitLabel: "Kaydet",
          defaults: WINDOW,
        } as never),
    ],
  ])(
    "%s: startsAt and endsAt render native with the Istanbul values",
    (_n, make) => {
      expect(boxes(renderToStaticMarkup(make()))).toEqual([
        {
          name: "startsAt",
          value: START_BOX,
          label: "Başlangıç tarihi ve saati",
        },
        { name: "endsAt", value: END_BOX, label: "Bitiş tarihi ve saati" },
      ]);
    },
  );

  it("no form writes the box by hand any more", () => {
    for (const file of [
      "src/components/admin/promo-form.tsx",
      "src/app/admin/bulten/kampanya/campaign-mail-form.tsx",
      "src/app/admin/anasayfa-hero/slide-form.tsx",
      "src/app/admin/mobil/slaytlar/slide-form.tsx",
      "src/app/admin/mobil/duyurular/announcement-form.tsx",
      "src/app/admin/mobil/gonderiler/post-form.tsx",
    ]) {
      const src = readFileSync(file, "utf8");
      expect(src, file).not.toMatch(/type="datetime-local"/);
      expect(src, file).toMatch(/<DateTimeField\b/);
      expect(src, file).not.toMatch(/react-aria|@internationalized/);
    }
  });
});
