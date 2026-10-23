import { readFileSync } from "node:fs";

import { UnrecognizedActionError } from "next/dist/client/components/unrecognized-action-error";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  isStaleActionError,
  STALE_ACTION_MESSAGE,
} from "@/components/laffogato/stale-action";

/**
 * A page loaded before a deploy calls a Server Action the new build no
 * longer has ("Failed to find Server Action", 19 Eki 2026 logs). Next 16
 * answers 404 + `x-nextjs-action-not-found` and the client throws an
 * `UnrecognizedActionError`; it does not reload by itself
 * (next/dist/client/components/router-reducer/reducers/
 * server-action-reducer.js). The customer must be told to reload, not to
 * "try again" from the same stale page.
 */

vi.mock("@/components/laffogato/site-chrome", () => ({
  SiteChrome: ({ children }: { children: ReactNode }) =>
    createElement("div", null, children),
}));

const { default: AppError } = await import("@/app/error");

function renderBoundary(error: Error): string {
  vi.spyOn(console, "error").mockImplementation(() => {});
  return renderToStaticMarkup(
    createElement(AppError, { error, reset: () => {} }),
  );
}

describe("isStaleActionError", () => {
  it("knows Next's own error for an action the server no longer has", () => {
    const err = new UnrecognizedActionError(
      'Server Action "abc" was not found on the server.',
    );
    expect(err.name).toBe("UnrecognizedActionError");
    expect(isStaleActionError(err)).toBe(true);
  });

  it("leaves every other failure alone", () => {
    expect(isStaleActionError(new Error("boom"))).toBe(false);
    expect(isStaleActionError(new TypeError("Failed to fetch"))).toBe(false);
    expect(isStaleActionError(new Error("timeout"))).toBe(false);
    expect(isStaleActionError({ name: "UnrecognizedActionError" })).toBe(false);
    expect(isStaleActionError(null)).toBe(false);
    expect(isStaleActionError("UnrecognizedActionError")).toBe(false);
  });
});

describe("the site's error boundary", () => {
  it("asks for a reload, not a retry, when the page predates a deploy", () => {
    const html = renderBoundary(
      new UnrecognizedActionError("Server Action was not found"),
    );
    expect(html).toContain("güncellendi");
    expect(html).toContain("Sayfayı yenile");
    expect(html).toContain("sepetin duruyor");
    expect(html).not.toContain("Tekrar dene");
    expect(html).not.toContain("bağlanamadık");
  });

  it("keeps the retry for every other failure", () => {
    const html = renderBoundary(new Error("connect ECONNREFUSED"));
    expect(html).toContain("Tekrar dene");
    expect(html).toContain("yarım kaldı");
    expect(html).not.toContain("Sayfayı yenile");
  });
});

describe("the checkout", () => {
  const source = readFileSync("src/app/odeme/checkout.tsx", "utf8");

  it("tells a stale page apart from a lost connection when the order starts", () => {
    const start = source.indexOf("startCheckoutAction(new FormData(form))");
    const handler = source.slice(start, source.indexOf("finally", start));
    expect(handler).toContain("isStaleActionError(err)");
    expect(handler).toContain("STALE_ACTION_MESSAGE");
    expect(handler).toContain("setStaleSite(true)");
    expect(source).toMatch(
      /staleSite \? \([\s\S]*?window\.location\.reload\(\)[\s\S]*?Sayfayı yenile/,
    );
  });

  it("says no money was taken and the cart is kept", () => {
    expect(source).toContain(
      "`Kartından para çekilmedi. ${STALE_ACTION_MESSAGE}`",
    );
    expect(STALE_ACTION_MESSAGE).toContain("Sayfayı yenile");
    expect(STALE_ACTION_MESSAGE).toContain("sepetin duruyor");
  });
});
