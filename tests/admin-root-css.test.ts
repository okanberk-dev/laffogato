import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("the panel's buttons keep their Tailwind look", () => {
  it("rolls the site's element resets back inside the admin root", () => {
    // globals.css resets `a` and `button` unlayered, which beats every
    // Tailwind utility (a layer): "Uygula" and each modal's submit drew as
    // bare text, the active status tab dark on dark (seen in the browser).
    const css = readFileSync("src/app/globals.css", "utf8");
    const at = css.indexOf("[data-admin-root] :is(a, button) {");
    expect(at).toBeGreaterThan(-1);
    const rule = css.slice(at, css.indexOf("}", at));
    for (const prop of ["color", "background", "border", "padding", "text-decoration"]) {
      expect(rule).toContain(`${prop}: revert-layer;`);
    }
    const layout = readFileSync("src/app/admin/layout.tsx", "utf8");
    expect(layout.match(/data-admin-root=""/g)).toHaveLength(2);
  });
});
