import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TextInput } from "@/components/admin/forms";
import { DateTimeField } from "@/components/admin/ui/date-time-field";
import {
  formatLocalDateTime,
  parseLocalDateTime,
} from "@/lib/admin/date-time-local";
import {
  normalizePublishInstant,
  parsePublishInstant,
  toDateTimeLocalInput,
} from "@/lib/admin/publish-window";

/**
 * DateTimeField (admin UI v2, UI-14; UI-15 puts it in the publish-window
 * boxes). Whichever control draws it, a form posts `YYYY-MM-DDTHH:mm`, the
 * Istanbul wall clock, and publish-window.ts reads it back.
 */

const SAMPLES = [
  "2026-10-21T09:05",
  "2026-10-21T00:00",
  "2026-10-21T23:59",
  "2026-12-31T21:30",
  "2028-02-29T00:30",
  "2026-03-29T03:00",
];

describe("the value the widget posts", () => {
  it("is the shape a native box posts, whole minutes, no seconds", () => {
    for (const value of SAMPLES) {
      const parts = parseLocalDateTime(value);
      expect(parts, value).not.toBeNull();
      expect(formatLocalDateTime(parts!), value).toBe(value);
    }
    // Seconds a stored value may carry are dropped, as the box drops them.
    expect(
      formatLocalDateTime(parseLocalDateTime("2026-10-21T09:05:00")!),
    ).toBe("2026-10-21T09:05");
  });

  it("round-trips through parsePublishInstant: the Istanbul wall clock, stored as UTC, shown again unchanged", () => {
    for (const value of SAMPLES) {
      // A bare value is Istanbul time (UTC+3).
      expect(parsePublishInstant(value), value).toBe(
        Date.parse(`${value}:00+03:00`),
      );
      // What the action stores, and what the edit form puts back in the box.
      const stored = normalizePublishInstant(value);
      expect(stored).toMatch(/Z$/);
      expect(toDateTimeLocalInput(stored), value).toBe(value);
    }
    // 00:30 in Tuzla is the evening before in UTC.
    expect(normalizePublishInstant("2026-10-21T00:30")).toBe(
      "2026-10-20T21:30:00.000Z",
    );
  });

  it("is not a time when it is not a real minute on a real day", () => {
    for (const bad of [
      "",
      "2026-10-21",
      "2026-10-21 09:05",
      "21.10.2026 09:05",
      "2026-13-01T09:05",
      "2026-02-30T09:05",
      "2027-02-29T09:05",
      "2026-10-21T24:00",
      "2026-10-21T09:60",
      "nonsense",
    ]) {
      expect(parseLocalDateTime(bad), bad).toBeNull();
    }
  });
});

/** Attributes of the first <input>, order aside. */
const attrs = (html: string) =>
  [
    ...(/<input ([^>]*)\/?>/.exec(html)?.[1] ?? "").matchAll(
      /([\w-]+)(?:="([^"]*)")?/g,
    ),
  ]
    .map((m) => `${m[1]}=${m[2] ?? ""}`)
    .sort();

describe("DateTimeField on the server and on a phone: the native box", () => {
  it("is the box the forms draw today, attribute for attribute", () => {
    const old = renderToStaticMarkup(
      createElement(TextInput, {
        name: "startsAt",
        type: "datetime-local",
        defaultValue: "2026-10-21T09:05",
      }),
    );
    const now = renderToStaticMarkup(
      createElement(DateTimeField, {
        name: "startsAt",
        defaultValue: "2026-10-21T09:05",
      }),
    );
    expect(now).toContain('type="datetime-local"');
    expect(attrs(now)).toEqual(attrs(old));
    expect(attrs(now)).toContain("name=startsAt");
    expect(attrs(now)).toContain("value=2026-10-21T09:05");
  });

  it("keeps min, max, required, id, the labelling and the invalid mark", () => {
    const html = renderToStaticMarkup(
      createElement(DateTimeField, {
        id: "istek-ani",
        name: "istekAni",
        defaultValue: "2026-10-21T09:05",
        min: "2026-10-20T18:00",
        max: "2026-10-22T18:00",
        required: true,
        className: "extra",
        "aria-label": "İstek anı",
        "aria-describedby": "istek-hint",
        "aria-invalid": true,
      }),
    );
    const a = attrs(html);
    for (const expected of [
      "id=istek-ani",
      "name=istekAni",
      "min=2026-10-20T18:00",
      "max=2026-10-22T18:00",
      "required=",
      "aria-label=İstek anı",
      "aria-describedby=istek-hint",
      "aria-invalid=true",
    ]) {
      expect(a, expected).toContain(expected);
    }
    expect(html).toMatch(/class="[^"]* extra"/);
  });

  it("controlled: the value, as a native box is with value and onChange", () => {
    const html = renderToStaticMarkup(
      createElement(DateTimeField, {
        name: "scheduledAt",
        value: "2026-10-21T09:05",
        onChange: () => {},
      }),
    );
    expect(attrs(html)).toContain("value=2026-10-21T09:05");
    expect(attrs(html)).toContain("name=scheduledAt");
  });

  it("empty: no value", () => {
    expect(
      attrs(
        renderToStaticMarkup(createElement(DateTimeField, { name: "endsAt" })),
      ),
    ).not.toEqual(expect.arrayContaining([expect.stringMatching(/^value=/)]));
  });
});

describe("DateTimePicker (the widget) on the server", () => {
  const render = async (props: Record<string, unknown>) => {
    const { DateTimePicker } =
      await import("@/components/admin/ui/date-time-picker");
    return renderToStaticMarkup(
      createElement(DateTimePicker, { name: "startsAt", ...props }),
    );
  };

  it("posts the original name with the YYYY-MM-DDTHH:mm value, in 24-hour Turkish segments", async () => {
    const html = await render({ defaultValue: "2026-10-21T09:05" });
    expect(html).toContain(
      '<input type="hidden" name="startsAt" value="2026-10-21T09:05"/>',
    );
    const segments = [...html.matchAll(/data-type="(\w+)"[^>]*>([^<]*)</g)]
      .filter((m) => m[1] !== "literal")
      .map((m) => `${m[1]}:${m[2]}`);
    expect(segments).toEqual([
      "day:21",
      "month:10",
      "year:2026",
      "hour:09",
      "minute:05",
    ]);
    // No AM/PM: the köşk reads 24 hours.
    expect(html).not.toContain('data-type="dayPeriod"');
  });

  it("controlled and empty", async () => {
    expect(
      await render({ value: "2026-12-31T23:59", onChange: () => {} }),
    ).toContain('name="startsAt" value="2026-12-31T23:59"');
    const empty = await render({});
    expect(empty).toContain('name="startsAt" value=""');
    expect(empty).toContain(">gg<");
    expect(empty).toContain(">aa<");
    expect(empty).toContain(">yyyy<");
  });

  it("names itself when the form gives no label, and keeps the form's own", async () => {
    expect(await render({})).toContain('aria-label="Tarih ve saat"');
    const named = await render({ "aria-label": "Başlangıç" });
    expect(named).toContain('aria-label="Başlangıç"');
    expect(named).not.toContain('aria-label="Tarih ve saat"');
  });
});
