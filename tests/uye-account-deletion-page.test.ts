import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * /uye/hesap/sil since 18 Eki 2026: a signed-in member sends a request (one
 * box, unticked), a member with an open request sees it and can take it
 * back, and a signed-out visitor - the store listings send people here -
 * gets the KVKK application channels, with no form and no account lookup.
 */

const h = vi.hoisted(() => ({
  customer: null as Record<string, unknown> | null,
  request: null as { requestedAt: string; reason: string } | null,
  lookups: [] as string[],
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children?: ReactNode;
  }) => createElement("a", { href, ...rest }, children),
}));
vi.mock("@/lib/customer/auth", () => ({
  getActiveCustomer: vi.fn(async () => h.customer),
  requireCustomer: vi.fn(async () => h.customer),
}));
vi.mock("@/lib/customer/deletion-request", () => ({
  getDeletionRequest: vi.fn(async (email: string) => {
    h.lookups.push(email);
    return h.request;
  }),
}));
const noop = vi.fn(async () => ({}));
vi.mock("@/app/uye/actions", () => ({
  logoutAction: noop,
  requestAccountDeletionAction: noop,
  withdrawAccountDeletionAction: noop,
}));
vi.mock("@/components/uye/account-nav", () => ({
  AccountSidebar: () => null,
  AccountTopNav: () => null,
}));

const { default: HesapSilPage } = await import("@/app/uye/hesap/sil/page");

const MEMBER = {
  id: "cus-0042",
  email: "eda@example.com",
  name: "Eda",
  emailVerified: true,
  isActive: true,
  addresses: [],
  wishlist: [],
};

async function render(): Promise<string> {
  return renderToStaticMarkup(await HesapSilPage());
}

const text = (html: string) =>
  html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

beforeEach(() => {
  h.customer = null;
  h.request = null;
  h.lookups = [];
});

describe("/uye/hesap/sil", () => {
  it("shows a signed-out visitor how to apply, with no form and no lookup", async () => {
    const html = await render();
    const t = text(html);
    expect(html).not.toContain("<form");
    expect(html).not.toContain("<textarea");
    expect(h.lookups).toEqual([]);
    expect(t).toContain("info@nextgenlab.com.tr");
    expect(t).toContain("34940 Tuzla/İstanbul");
    expect(t).toContain("Hesabımı sil");
    expect(html).toContain('href="/uye/giris?next=/uye/hesap/sil"');
    expect(html).toContain('href="/hukuk/kvkk-basvuru-formu"');
    // The subject rides the mailto; nothing personal does.
    expect(html).toContain(
      'href="mailto:info@nextgenlab.com.tr?subject=Hesap%20silme%20talebi"',
    );
  });

  it("gives a member the request form: the box starts unticked", async () => {
    h.customer = MEMBER;
    const html = await render();
    const t = text(html);
    expect(t).toContain("en geç 30 gün içinde");
    expect(t).toContain("3 iş günü");
    expect(t).toContain("yasal saklama süresi");
    // hesap-silme §8 promises this warning on the Site's page too.
    expect(t).toContain("Damgaların ve kullanılmamış kuponların");
    expect(t).toContain("Hesabımı sil");
    const box = html.match(/<input[^>]*name="confirm"[^>]*>/)?.[0] ?? "";
    expect(box).toContain('type="checkbox"');
    expect(box).not.toMatch(/\bchecked\b/);
    expect(t).toContain("Hesabımın silinmesini istiyorum");
    expect(html).toMatch(/<textarea[^>]*name="reason"[^>]*maxLength="500"/);
    // The send button waits for the box.
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Silme talebini gönder/);
    expect(t).not.toContain("Silme talebin alındı");
  });

  it("shows an open request with its date and the way back, not the form", async () => {
    h.customer = MEMBER;
    h.request = { requestedAt: "2026-10-18T09:15:00.000Z", reason: "" };
    const html = await render();
    const t = text(html);
    expect(t).toContain("Silme talebin alındı (18 Ekim 2026)");
    expect(t).toContain("17 Kasım 2026");
    expect(t).toContain("Talebi geri al");
    expect(html).not.toContain('name="confirm"');
  });
});
