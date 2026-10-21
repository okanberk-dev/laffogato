import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { EmailText } from "@/components/admin/ui/email-text";

/**
 * A phone card's narrow column broke "deneme.musteri@example.com" as
 * "…example.co" and "m" (21 Oct 2026): the address now offers its own break
 * points, before "@" and at the domain's dots, and nothing in between.
 */
const html = (value: string) =>
  renderToStaticMarkup(createElement(EmailText, { value }));

describe("EmailText", () => {
  it("breaks before @ and at the domain's dots", () => {
    expect(html("deneme.musteri@example.com")).toBe(
      "deneme.musteri<wbr/>@example<wbr/>.com",
    );
    expect(html("a@b.com.tr")).toBe("a<wbr/>@b<wbr/>.com<wbr/>.tr");
  });

  it("draws anything that is not an address as it is", () => {
    expect(html("system")).toBe("system");
    expect(html("@handle")).toBe("@handle");
    expect(html("Panel · Selin")).toBe("Panel · Selin");
  });
});
