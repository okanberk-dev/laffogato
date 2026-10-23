import { readFileSync } from "node:fs";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

/**
 * A record's tabs (ui/detail-tabs.tsx), review of #231: a tab's link keeps
 * the page's other params, a click writes the address so Next's router
 * keeps it, and an odd anchor is read, never thrown.
 */

const { DetailTabs } = await import("@/components/admin/ui/detail-tabs");

const TABS = [
  { id: "rezervasyon", label: "Rezervasyon", content: "a" },
  { id: "odeme", label: "Ödeme", content: "b" },
];

describe("the record's tabs", () => {
  it("a tab's link keeps the page's other params", () => {
    const html = renderToStaticMarkup(
      createElement(DetailTabs, {
        tabs: TABS,
        label: "Rezervasyon ayrıntıları",
        query: { geri: "/admin/mobil/karaoke?sekme=dikkat" },
      }),
    );
    expect(html).toContain(
      'href="?geri=%2Fadmin%2Fmobil%2Fkaraoke%3Fsekme%3Ddikkat&amp;sekme=odeme"',
    );
    // Without any, the tab alone, as before.
    expect(
      renderToStaticMarkup(
        createElement(DetailTabs, { tabs: TABS, label: "x" }),
      ),
    ).toContain('href="?sekme=odeme"');
  });

  it("writes the address as Next's docs do, and reads an odd anchor as written", () => {
    const src = readFileSync("src/components/admin/ui/detail-tabs.tsx", "utf8");
    // Next's own state would mark the call as the router's, which then
    // keeps the old address and puts it back on the next server action.
    expect(src).toContain('window.history.replaceState(null, "", url);');
    expect(src).not.toContain("replaceState(window.history.state");
    expect(src).toMatch(
      /try \{\s*hash = decodeURIComponent\(raw\);\s*\} catch \{/,
    );
  });
});
