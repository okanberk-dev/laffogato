import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";

import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AdminNavGroup } from "@/components/admin/admin-sidebar";
import type { PaletteEntry } from "@/lib/admin/palette-shell";
import type { AdminRole } from "@/lib/admin/roles";

/**
 * The panel's ⌘K palette (admin UI v2, UI-6, design §4): what it lists for
 * each role, how it matches Turkish, how it ranks, what "Son açılanlar"
 * may keep and for whom, how it reads the record search, and the
 * trigger's server markup. The rules are pure (palette-core.ts and its
 * always-loaded half palette-shell.ts) and run here in node; the dialog,
 * React Aria and the keys were checked in a scripted browser (the PR's
 * checklist).
 *
 * The nav is read the way the layout hands it to the sidebar (the sidebar
 * module is replaced by a recorder), so the old names tested below are the
 * layout's real keywords.
 */

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/siparisler",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));
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
vi.mock("next/font/google", () => ({
  Inter: () => ({ variable: "font-admin-sans", className: "" }),
}));
vi.mock("@/app/admin/siparisler/actions", () => ({
  openOrderSignalAction: vi.fn(async () => ({ count: null, cursor: "" })),
}));
vi.mock("@/app/admin/mobil/karaoke/actions", () => ({
  karaokeTodaySignalAction: vi.fn(async () => ({ count: null, cursor: "" })),
}));
vi.mock("@/app/admin/ara/actions", () => ({ adminSearchAction: vi.fn() }));
vi.mock("@/app/admin/actions", () => ({ logoutAction: vi.fn() }));
vi.mock("@/components/admin/order-alerts", () => ({
  OrderAlerts: () => null,
}));
const session = vi.hoisted(() => ({
  role: "owner" as string,
  email: "x@laffogato.net",
}));
vi.mock("@/lib/admin/auth", () => ({
  getAdminSession: async () => ({
    email: session.email,
    role: session.role,
    expiresAt: 0,
  }),
}));
vi.mock("@/lib/admin/flash", () => ({ readAdminFlash: async () => null }));
const captured = vi.hoisted(() => ({ props: null as unknown }));
vi.mock("@/components/admin/admin-sidebar", () => ({
  AdminSidebar: (props: unknown) => {
    captured.props = props;
    return null;
  },
}));

process.env.ADMIN_SESSION_SECRET ??=
  "test-secret-for-the-palette-key-0123456789";

const AdminLayout = (await import("@/app/admin/layout")).default;
const core = await import("@/lib/admin/palette-core");
const recents = await import("@/components/admin/palette/recents");
const { paletteAccountKey } = await import("@/lib/admin/palette-account");
const { SEARCH_MIN_LENGTH, ADMIN_SEARCH_PATH, searchSectionsFor } =
  await import("@/lib/admin/search-core");
const { canAccess } = await import("@/lib/admin/roles");
const { settingsPaletteEntries } = await import("@/app/admin/palette-settings");
const { SETTINGS_TABS, SETTINGS_TAB_PARAM, parseSettingsTab } =
  await import("@/app/admin/ayarlar/settings-core");
const { APP_CONFIG_TABS, APP_CONFIG_TAB_PARAM, parseAppConfigTab } =
  await import("@/app/admin/mobil/ayarlar/app-config-core");

type Props = {
  groups: AdminNavGroup[];
  canSearch?: boolean;
  palette?: {
    role: AdminRole;
    accountKey: string;
    settings?: PaletteEntry[];
  };
};

async function shellFor(role: AdminRole, email = "x@laffogato.net") {
  session.role = role;
  session.email = email;
  captured.props = null;
  renderToStaticMarkup(
    await AdminLayout({ children: createElement("p", null, "PAGE") }),
  );
  const props = captured.props as Props | null;
  if (!props) throw new Error(`no sidebar for ${role}`);
  return props;
}

const ROLES: AdminRole[] = ["owner", "manager", "staff", "cashier"];
const NAV = Object.fromEntries(
  await Promise.all(
    ROLES.map(async (r) => [r, (await shellFor(r)).groups] as const),
  ),
) as Record<AdminRole, AdminNavGroup[]>;

const go = (role: AdminRole) => core.goEntries(NAV[role], role);
const labels = (entries: { label: string }[]) => entries.map((e) => e.label);
const first = (role: AdminRole, q: string) =>
  core.rankEntries(go(role), q)[0]?.label;

describe("matching: the Turkish fold, then the loose ASCII one, on both sides", () => {
  it("folds the I family and the marks the operator leaves out", () => {
    expect(core.foldLoose("Siparişler")).toBe("siparisler");
    expect(core.foldLoose("Müşteriler")).toBe("musteriler");
    expect(core.foldLoose("İade")).toBe("iade");
    expect(core.foldLoose("IADE")).toBe("iade");
    expect(core.foldLoose("iade")).toBe("iade");
    expect(core.foldLoose("Fındık")).toBe(core.foldLoose("findik"));
    expect(core.foldLoose("IRMAK")).toBe(core.foldLoose("ırmak"));
    expect(core.foldLoose("IRMAK")).toBe("irmak");
    expect(core.foldLoose("ÇAY ŞEKER ĞÖÜ âîû")).toBe("cay seker gou aiu");
    // A decomposed ş (s + U+0327) is the same letter.
    expect(core.foldLoose("şube")).toBe("sube");
    expect(core.foldLoose("fA'L")).toBe("fal");
    expect(core.foldLoose("  Kasa  ·   damga ")).toBe("kasa · damga");
  });

  it("finds the nav's pages by their names typed without the marks", () => {
    expect(first("owner", "siparis")).toBe("Siparişler");
    expect(first("owner", "SİPARİŞ")).toBe("Siparişler");
    expect(first("owner", "musteri")).toBe("Müşteriler");
    expect(first("owner", "urun")).toBe("Ürünler");
    expect(labels(core.rankEntries(go("owner"), "İADE"))).toContain(
      "Siparişler",
    );
    expect(labels(core.rankEntries(go("owner"), "iade"))).toContain(
      "Siparişler",
    );
    expect(first("owner", "fal")).toBe("fA'L bildirimleri");
    expect(first("owner", "gun sonu")).toBe("Gün sonu");
  });

  it("finds them by their old names, English words and synonyms", () => {
    expect(
      labels(core.rankEntries(go("owner"), "mağaza hero")).slice(0, 2),
    ).toEqual(["Mağaza", "Slaytlar"]);
    expect(
      labels(core.rankEntries(go("owner"), "magaza hero")).slice(0, 2),
    ).toEqual(["Mağaza", "Slaytlar"]);
    expect(first("owner", "kupon")).toBe("Promosyonlar");
    expect(first("owner", "damga")).toBe("Kasa");
    expect(first("owner", "Kasa · damga")).toBe("Kasa");
    expect(first("owner", "qr")).toBe("Masalar");
    expect(first("owner", "Masalar · QR")).toBe("Masalar");
    expect(first("owner", "abone")).toBe("Aboneler");
    expect(first("owner", "vitrin")).toBe("Slaytlar");
    expect(first("owner", "crm")).toBe("Müşteriler");
    expect(first("owner", "Stok Hareketleri")).toBe("Stok");
    expect(first("owner", "Kampanya e-postası")).toBe("Bülten");
    expect(first("owner", "Uygulama ayarları")).toBe("Ayarlar");
    expect(first("owner", "rezervasyon")).toBe("Karaoke");
    expect(first("owner", "kategori")).toBe("Kategoriler");
    expect(core.rankEntries(go("owner"), "zzzz-yok")).toEqual([]);
  });

  it("ranks label prefix > word prefix > keyword prefix > substring, ties in Turkish order", () => {
    const e = (label: string, keywords: string[] = []) => ({
      id: label,
      label,
      href: `/admin/${label}`,
      keywords,
    });
    const entries = [
      e("Ödemeler"), // substring of the label: tier 3
      e("Ayarlar", ["mesai saatleri"]), // keyword prefix: tier 2
      e("Kafe menüsü"), // a word of the label: tier 1
      e("Mesai"), // label prefix: tier 0
      e("Menü"), // label prefix: tier 0
      e("Raporlar"), // no match
    ];
    expect(core.matchTier(entries[3], "me")).toBe(0);
    expect(core.matchTier(entries[2], "me")).toBe(1);
    expect(core.matchTier(entries[1], "me")).toBe(2);
    expect(core.matchTier(entries[0], "me")).toBe(3);
    expect(core.matchTier(entries[5], "me")).toBeNull();
    expect(labels(core.rankEntries(entries, "me"))).toEqual([
      "Menü",
      "Mesai",
      "Kafe menüsü",
      "Ayarlar",
      "Ödemeler",
    ]);
    // Turkish order: c before ç, o before ö, u before ü.
    const ties = [e("Çay"), e("Cam"), e("Ürün"), e("Uzun")];
    expect(labels(core.rankEntries(ties, " "))).toEqual(labels(ties));
    expect(labels(core.rankEntries([e("Çay"), e("Cam")], "c"))).toEqual([
      "Cam",
      "Çay",
    ]);
    expect(labels(core.rankEntries([e("Ürün"), e("Uzun")], "u"))).toEqual([
      "Uzun",
      "Ürün",
    ]);
    // An empty query keeps the nav's own order.
    expect(labels(core.rankEntries(entries, ""))).toEqual(labels(entries));
  });
});

describe("Git, Oluştur and Komutlar per role", () => {
  it("Git is every item and permitted tab of the role's nav, nothing more", () => {
    const hrefs = (role: AdminRole) => go(role).map((e) => e.href);
    const navHrefs = (role: AdminRole) =>
      NAV[role].flatMap((g) =>
        g.items.flatMap((i) => [i.href, ...(i.tabs ?? []).map((t) => t.href)]),
      );
    for (const role of ROLES) {
      const expected = new Set(navHrefs(role));
      if (canAccess("reports", role)) expected.add("/admin/raporlar/gun-sonu");
      expect(new Set(hrefs(role)), role).toEqual(expected);
      // One entry per page.
      expect(new Set(hrefs(role)).size, role).toBe(hrefs(role).length);
    }
    expect(hrefs("staff")).toEqual([
      "/admin",
      "/admin/siparisler",
      "/admin/mobil/karaoke",
      "/admin/kasa",
      // UI-13 (decision D3): Canlı durum through the `venue` section.
      "/admin/mobil/canli-durum",
      "/admin/stok-hareketleri",
    ]);
    expect(hrefs("cashier")).toEqual(["/admin/kasa"]);
    // A tab names the item it belongs to.
    const mağaza = go("owner").find((e) => e.href === "/admin/magaza-hero");
    expect(mağaza).toMatchObject({ label: "Mağaza", hint: "Slaytlar" });
  });

  it("the Gün sonu entry is the sheet's own (day-close-core), copied to keep the order filters out of the chunk", async () => {
    const { DAY_CLOSE_ENTRY } = await import("@/lib/admin/day-close-core");
    expect(core.DAY_CLOSE_GO).toEqual(DAY_CLOSE_ENTRY);
    expect(readFileSync("src/lib/admin/palette-core.ts", "utf8")).not.toMatch(
      /^import (?!type\b)[^;]*from "\.\/(day-close-core|order-filters|search-core)";/m,
    );
  });

  it("asks each entry's section again: an owner's nav handed to Personel shrinks to Personel's", () => {
    const leaked = core.goEntries(NAV.owner, "staff").map((e) => e.href);
    expect(new Set(leaked)).toEqual(new Set(go("staff").map((e) => e.href)));
    expect(core.goEntries(NAV.owner, null)).toEqual([]);
  });

  it("Oluştur: Personel gets Yeni sipariş only, the cashier nothing", () => {
    expect(labels(core.createEntries("staff"))).toEqual(["Yeni sipariş"]);
    expect(core.createEntries("cashier")).toEqual([]);
    expect(core.createEntries(null)).toEqual([]);
    expect(labels(core.createEntries("owner"))).toEqual([
      "Yeni sipariş",
      "Yeni ürün",
      "Ürünleri CSV ile içe aktar",
      "Yeni menü kalemi",
      "Yeni kategori",
      "Yeni promosyon",
      "Yeni kampanya",
      "Yeni anasayfa slaytı",
      "Yeni mağaza slaytı",
      "Yeni uygulama slaytı",
      "Yeni duyuru",
      "Yeni gönderi",
      "Yeni masa",
      "Masa kartlarını yazdır",
    ]);
    expect(core.createEntries("manager")).toHaveLength(14);
    expect(core.rankEntries(core.createEntries("owner"), "yeni")).toHaveLength(
      12,
    );
    expect(
      labels(core.rankEntries(core.createEntries("owner"), "kupon")),
    ).toEqual(["Yeni promosyon"]);
  });

  it("every Oluştur page exists and asks for the section the entry is gated by", () => {
    for (const entry of core.CREATE_ENTRIES) {
      const file = `src/app${entry.href}/page.tsx`;
      expect(existsSync(file), file).toBe(true);
      expect(readFileSync(file, "utf8"), file).toContain(
        `requireRole("${entry.section}")`,
      );
    }
  });

  it("Komutlar: the 2FA page for everyone, the shortcut sheet and Sıkı görünüm for the roles with the full shell, the order sound for the roles that hear it", () => {
    expect(labels(core.commandEntries("staff", { soundOn: true }))).toEqual([
      "Güvenlik / 2FA",
      "Klavye kısayolları",
      "Sıkı görünüm",
      "Sipariş sesini kapat",
    ]);
    expect(labels(core.commandEntries("owner", { soundOn: false }))).toEqual([
      "Güvenlik / 2FA",
      "Klavye kısayolları",
      "Sıkı görünüm",
      "Sipariş sesini aç",
    ]);
    expect(labels(core.commandEntries("cashier", { soundOn: true }))).toEqual([
      "Güvenlik / 2FA",
    ]);
    const sheet = core.commandEntries("staff", { soundOn: true })[1];
    expect(sheet).toMatchObject({ command: "shortcutSheet" });
    expect(sheet.href).toBeUndefined();
    const density = core.commandEntries("staff", { soundOn: true })[2];
    expect(density).toMatchObject({ command: "toggleDensity" });
    expect(density.href).toBeUndefined();
    const sound = core.commandEntries("staff", { soundOn: true })[3];
    expect(sound).toMatchObject({ command: "toggleSound" });
    expect(sound.href).toBeUndefined();
  });
});

describe("Son açılanlar: what may be kept", () => {
  it("keeps the allow-listed record pages only, with the section each needs", () => {
    const yes: Array<[string, string]> = [
      ["/admin/siparisler/ord-8f2k", "orders"],
      ["/admin/mobil/karaoke/krk-00042", "karaoke"],
      ["/admin/urunler/prd-0001", "products"],
      ["/admin/menu/mnu-0003", "menu"],
      ["/admin/kategoriler/cat-2/duzenle", "categories"],
      ["/admin/anasayfa-hero/hhs-1", "content"],
      ["/admin/magaza-hero/hero-3", "shopHero"],
      ["/admin/mobil/slaytlar/sl-1", "mobileApp"],
      ["/admin/promosyon/YAZ2026", "promos"],
      ["/admin/bulten/kampanya/cmp-1", "newsletter"],
      ["/admin/masalar/tbl-4", "tables"],
      ["/admin/mobil/gonderiler/post-1", "mobileApp"],
      ["/admin/mobil/duyurular/ann-1", "mobileApp"],
    ];
    for (const [path, section] of yes) {
      expect(core.recentSection(path), path).toBe(section);
    }
    for (const path of [
      "/admin/musteriler/ayse@example.com",
      "/admin/musteriler/ayse%40example.com",
      "/admin/musteriler/c-1",
      "/admin/musteriler/ayse@example.com/duzenle",
      "/admin/kullanicilar/k1",
      "/admin/bulten/sub-1", // a subscriber: their address
      "/admin/olay-kaydi/41",
      "/admin/siparisler",
      "/admin/siparisler/yeni",
      "/admin/urunler/ice-aktar",
      "/admin/masalar/yazdir",
      "/admin/bulten/kampanya/yeni",
      "/admin/siparisler/ord-1/extra",
      "/admin/siparisler/ord 1",
      "/admin/siparisler/a@b.co",
      "/admin/promosyon/%C3%87AY",
      "/admin/ara",
      "/admin",
    ]) {
      expect(core.recentSection(path), path).toBeNull();
    }
  });

  it("labels are the page's heading on one line, at most 60 characters, never personal", () => {
    expect(core.recentLabel("  #10234\n   Ayşe Yılmaz ")).toBe(
      "#10234 Ayşe Yılmaz",
    );
    const long = core.recentLabel("Ç".repeat(80));
    expect(long).toHaveLength(60);
    expect(long?.endsWith("…")).toBe(true);
    for (const personal of [
      "ayse@example.com",
      "Ayşe ＠ example",
      "Ayşe 0532 123 45 67",
      "+90 (532) 123-45-67",
      "0532/123/45/67",
      "0532_123_45_67",
      "٠٥٣٢١٢٣٤٥٦٧",
    ]) {
      expect(core.recentLabel(personal), personal).toBeNull();
    }
    expect(core.recentLabel("Cumartesi 18 Ekim, 21:00")).toBe(
      "Cumartesi 18 Ekim, 21:00",
    );
    // A colon between the groups does not make a phone a clock.
    expect(core.recentLabel("0532:123:45:67")).toBeNull();
    expect(core.recentLabel("Bu sayfa ya da kayıt bulunamadı.")).toBeNull();
    expect(core.recentLabel("Bu ekran yüklenemedi.")).toBeNull();
    expect(core.recentLabel("")).toBeNull();
    expect(core.recentLabel(null)).toBeNull();
  });

  it("keeps a karaoke booking under its own heading: the year and the two clock times are not a phone", async () => {
    // The booking page's h1 (mobil/karaoke/[id]/page.tsx): "{day}, {time}".
    const { formatReservationDate, formatReservationTime } =
      await import("@/lib/mobile/karaoke-format");
    const heading = `${formatReservationDate("2026-10-19")}, ${formatReservationTime(20, 2)}`;
    expect(heading).toBe("19 Ekim 2026, 20:00 - 22:00");
    expect(core.recentLabel(heading)).toBe(heading);
    expect(
      core.addRecent([], "/admin/mobil/karaoke/krk-00042", heading),
    ).toEqual([{ href: "/admin/mobil/karaoke/krk-00042", label: heading }]);
    expect(
      core.parseRecents(
        JSON.stringify([
          { href: "/admin/mobil/karaoke/krk-00042", label: heading },
        ]),
      ),
    ).toHaveLength(1);
    // Midnight closes the evening as 24:00; still a heading, not a phone.
    expect(
      core.recentLabel(
        `${formatReservationDate("2026-12-31")}, ${formatReservationTime(22, 2)}`,
      ),
    ).toBe("31 Aralık 2026, 22:00 - 24:00");
  });

  it("the list is newest first, one entry a page, at most eight; refused pages leave it as it was", () => {
    let list: ReturnType<typeof core.parseRecents> = [];
    for (let i = 1; i <= 10; i += 1) {
      list = core.addRecent(list, `/admin/siparisler/ord-${i}`, `#1000${i}`);
    }
    expect(list).toHaveLength(core.RECENT_MAX);
    expect(list[0]).toEqual({
      href: "/admin/siparisler/ord-10",
      label: "#100010",
    });
    list = core.addRecent(list, "/admin/siparisler/ord-5", "#10005 Ayşe");
    expect(list[0]).toEqual({
      href: "/admin/siparisler/ord-5",
      label: "#10005 Ayşe",
    });
    expect(
      list.filter((e) => e.href === "/admin/siparisler/ord-5"),
    ).toHaveLength(1);
    expect(core.addRecent(list, "/admin/musteriler/a@b.co", "Ayşe")).toEqual(
      list,
    );
    expect(core.addRecent(list, "/admin/kullanicilar/k1", "Kasa")).toEqual(
      list,
    );
    expect(core.addRecent(list, "/admin/siparisler/ord-9", "a@b.co")).toEqual(
      list,
    );
  });

  it("reads the stored list back through the same rules", () => {
    expect(core.parseRecents(null)).toEqual([]);
    expect(core.parseRecents("{")).toEqual([]);
    expect(core.parseRecents('{"href":"/admin/siparisler/o"}')).toEqual([]);
    const tampered = JSON.stringify([
      { href: "/admin/musteriler/ayse@example.com", label: "Ayşe" },
      { href: "/admin/siparisler/ord-1", label: "0532 123 45 67" },
      { href: "/admin/siparisler/ord-2", label: "#10002" },
      { href: "/admin/siparisler/ord-2", label: "#10002 again" },
      { href: "https://evil.example/admin/siparisler/x", label: "x" },
      "junk",
      ...Array.from({ length: 12 }, (_, i) => ({
        href: `/admin/menu/m-${i}`,
        label: `Latte ${i}`,
      })),
    ]);
    const back = core.parseRecents(tampered);
    expect(back[0]).toEqual({
      href: "/admin/siparisler/ord-2",
      label: "#10002",
    });
    expect(back).toHaveLength(core.RECENT_MAX);
    expect(back.some((e) => e.href.includes("musteriler"))).toBe(false);
  });

  it("shows each entry only to a role that may open it now, never the page it is on", () => {
    const list = [
      { href: "/admin/urunler/prd-1", label: "Fındık kreması" },
      { href: "/admin/siparisler/ord-1", label: "#10001" },
      { href: "/admin/mobil/karaoke/krk-00001", label: "Cuma, 21:00" },
      { href: "/admin/masalar/tbl-1", label: "Masa 4" },
    ];
    expect(core.visibleRecents(list, "staff").map((e) => e.href)).toEqual([
      "/admin/siparisler/ord-1",
      "/admin/mobil/karaoke/krk-00001",
    ]);
    expect(core.visibleRecents(list, "owner")).toHaveLength(4);
    expect(core.visibleRecents(list, "cashier")).toEqual([]);
    expect(core.visibleRecents(list, null)).toEqual([]);
    expect(
      core
        .visibleRecents(list, "owner", "/admin/siparisler/ord-1")
        .map((e) => e.href),
    ).not.toContain("/admin/siparisler/ord-1");
  });
});

/** A sessionStorage stand-in. */
function memoryStore(seed: Record<string, string> = {}) {
  const map = new Map(Object.entries(seed));
  return {
    map,
    get length() {
      return map.size;
    },
    key: (i: number) => [...map.keys()][i] ?? null,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

const A = "0123456789abcdef";
const B = "fedcba9876543210";

describe("Son açılanlar: per account, in this tab", () => {
  it("one account never reads another's list", () => {
    const store = memoryStore();
    recents.rememberRecent(A, "/admin/siparisler/ord-1", "#10001", store);
    recents.rememberRecent(B, "/admin/menu/m-1", "Latte", store);
    expect(recents.readRecents(A, store).map((e) => e.href)).toEqual([
      "/admin/siparisler/ord-1",
    ]);
    expect(recents.readRecents(B, store).map((e) => e.href)).toEqual([
      "/admin/menu/m-1",
    ]);
    expect([...store.map.keys()].sort()).toEqual([
      `laf_admin_recent_v1:${A}`,
      `laf_admin_recent_v1:${B}`,
    ]);
  });

  it("another account's list goes when this one opens the panel; Çıkış takes them all", () => {
    const store = memoryStore({ other: "kept", laf_admin_nav_note_v2: "1" });
    recents.rememberRecent(A, "/admin/siparisler/ord-1", "#10001", store);
    recents.rememberRecent(B, "/admin/siparisler/ord-2", "#10002", store);
    recents.forgetRecents(store, A);
    expect(recents.readRecents(B, store)).toEqual([]);
    expect(recents.readRecents(A, store)).toHaveLength(1);
    recents.forgetRecents(store);
    expect(recents.readRecents(A, store)).toEqual([]);
    expect(store.map.get("other")).toBe("kept");
    expect(store.map.get("laf_admin_nav_note_v2")).toBe("1");
  });

  it("an account key that is not the layout's 16 hex keeps nothing", () => {
    const store = memoryStore();
    for (const key of ["", "x@laffogato.net", "0123", A.toUpperCase()]) {
      recents.rememberRecent(key, "/admin/siparisler/ord-1", "#10001", store);
      expect(recents.readRecents(key, store)).toEqual([]);
    }
    expect(store.map.size).toBe(0);
    expect(core.recentStorageKey(A)).toBe(`laf_admin_recent_v1:${A}`);
  });

  it("storage that throws leaves the list empty, never the panel broken", () => {
    const broken = {
      length: 1,
      key: () => {
        throw new Error("denied");
      },
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("quota");
      },
      removeItem: () => {
        throw new Error("denied");
      },
    };
    expect(recents.readRecents(A, broken)).toEqual([]);
    expect(() =>
      recents.rememberRecent(A, "/admin/siparisler/ord-1", "#1", broken),
    ).not.toThrow();
    expect(() => recents.forgetRecents(broken)).not.toThrow();
    expect(recents.readRecents(A, null)).toEqual([]);
  });

  it("the recorder waits for the record page's heading, and never looks at a page off the list", () => {
    const store = memoryStore();
    let heading: string | null = null;
    const root = vi.fn(() => ({
      querySelector: (sel: string) =>
        sel === "h1" && heading !== null ? { textContent: heading } : null,
    }));
    let fire: (() => void) | null = null;
    class FakeObserver {
      constructor(cb: () => void) {
        fire = cb;
      }
      observe() {}
      disconnect = vi.fn();
    }
    const stop = recents.watchRecentPage({
      pathname: "/admin/siparisler/ord-7",
      accountKey: A,
      root: root as never,
      store,
      Observer: FakeObserver as never,
      waitMs: 60_000,
    });
    expect(recents.readRecents(A, store)).toEqual([]); // the skeleton
    heading = "#10007 Ayşe";
    fire!();
    expect(recents.readRecents(A, store)).toEqual([
      { href: "/admin/siparisler/ord-7", label: "#10007 Ayşe" },
    ]);
    stop();

    // Already drawn: kept at once.
    heading = "Latte";
    recents.watchRecentPage({
      pathname: "/admin/menu/m-1",
      accountKey: A,
      root: root as never,
      store,
      Observer: FakeObserver as never,
    });
    expect(recents.readRecents(A, store)[0]?.href).toBe("/admin/menu/m-1");

    root.mockClear();
    heading = "Ayşe Yılmaz";
    recents.watchRecentPage({
      pathname: "/admin/musteriler/ayse@example.com",
      accountKey: A,
      root: root as never,
      store,
      Observer: FakeObserver as never,
    });
    expect(root).not.toHaveBeenCalled();
    expect(recents.readRecents(A, store).map((e) => e.href)).not.toContain(
      "/admin/musteriler/ayse@example.com",
    );
  });
});

describe("the account key", () => {
  afterEach(() => {
    process.env.ADMIN_SESSION_SECRET ??=
      "test-secret-for-the-palette-key-0123456789";
  });

  it("is 16 hex of an HMAC of the e-mail: stable, per account, never the address", () => {
    const a = paletteAccountKey("ayse@laffogato.net");
    expect(a).toMatch(/^[0-9a-f]{16}$/);
    expect(paletteAccountKey(" Ayse@Laffogato.net ")).toBe(a);
    expect(paletteAccountKey("mehmet@laffogato.net")).not.toBe(a);
    expect(core.validAccountKey(a)).toBe(true);
    const saved = process.env.ADMIN_SESSION_SECRET;
    process.env.ADMIN_SESSION_SECRET = "another-secret-another-secret-0123";
    expect(paletteAccountKey("ayse@laffogato.net")).not.toBe(a);
    delete process.env.ADMIN_SESSION_SECRET;
    expect(paletteAccountKey("ayse@laffogato.net")).toBe("");
    process.env.ADMIN_SESSION_SECRET = saved;
  });

  it("the layout hands it to the search roles' shell, and nothing of the palette to the cashier", async () => {
    for (const role of ["owner", "manager", "staff"] as const) {
      const props = await shellFor(role, "ayse@laffogato.net");
      expect(props.canSearch, role).toBe(true);
      expect(props.palette, role).toEqual({
        role,
        accountKey: paletteAccountKey("ayse@laffogato.net"),
        // "Ayarlar içinde" (UI-12): the role's own entries, as plain data.
        settings: settingsPaletteEntries(role),
      });
      expect(JSON.stringify(props.palette)).not.toContain("ayse");
    }
    const cashier = await shellFor("cashier");
    expect(searchSectionsFor("cashier")).toEqual([]);
    expect(cashier.canSearch).toBe(false);
    expect(cashier.palette).toBeUndefined();
  });
});

describe("the ⌘K key and its label", () => {
  const key = (k: string, mods: Partial<Record<string, boolean>> = {}) => ({
    key: k,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    isComposing: false,
    ...mods,
  });

  it("⌘K and Ctrl+K, Caps Lock too; never with Alt (AltGr), Shift, while composing or from a script", () => {
    expect(core.isPaletteShortcut(key("k", { metaKey: true }))).toBe(true);
    expect(core.isPaletteShortcut(key("k", { ctrlKey: true }))).toBe(true);
    expect(core.isPaletteShortcut(key("K", { ctrlKey: true }))).toBe(true);
    expect(core.isPaletteShortcut(key("k"))).toBe(false);
    expect(
      core.isPaletteShortcut(key("k", { ctrlKey: true, altKey: true })),
    ).toBe(false);
    expect(
      core.isPaletteShortcut(key("K", { ctrlKey: true, shiftKey: true })),
    ).toBe(false);
    expect(
      core.isPaletteShortcut(key("k", { metaKey: true, isComposing: true })),
    ).toBe(false);
    expect(core.isPaletteShortcut(key("j", { ctrlKey: true }))).toBe(false);
    // React Aria re-sends the box's keys to its list as script events: the
    // second copy of a ⌘K that just closed the palette must not reopen it.
    expect(
      core.isPaletteShortcut(key("k", { ctrlKey: true, isTrusted: false })),
    ).toBe(false);
    expect(
      core.isPaletteShortcut(key("k", { ctrlKey: true, isTrusted: true })),
    ).toBe(true);
    expect(core.isPaletteShortcut(key("ı", { ctrlKey: true }))).toBe(false);
  });

  it("says ⌘K on Apple keyboards and Ctrl K elsewhere", () => {
    expect(core.paletteShortcutLabel(true)).toBe("⌘K");
    expect(core.paletteShortcutLabel(false)).toBe("Ctrl K");
    expect(core.isApplePlatform({ platform: "MacIntel" })).toBe(true);
    expect(core.isApplePlatform({ platform: "iPad" })).toBe(true);
    expect(core.isApplePlatform({ userAgentData: { platform: "macOS" } })).toBe(
      true,
    );
    expect(core.isApplePlatform({ platform: "Win32" })).toBe(false);
    expect(core.isApplePlatform({ platform: "Linux x86_64" })).toBe(false);
    expect(
      core.isApplePlatform({
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
      }),
    ).toBe(true);
  });
});

describe("Kayıtlar: the record search's answer", () => {
  it("asks the palette's route from the results page's floor, and falls back to that page", () => {
    expect(core.PALETTE_SEARCH_MIN).toBe(SEARCH_MIN_LENGTH);
    expect(core.PALETTE_FALLBACK_HREF).toBe(ADMIN_SEARCH_PATH);
    expect(core.PALETTE_SEARCH_DEBOUNCE_MS).toBe(200);
    expect(existsSync(`src/app${core.PALETTE_SEARCH_ROUTE}/route.ts`)).toBe(
      true,
    );
    // The bare lists are search.ts's own, with no text.
    const server = readFileSync("src/lib/admin/search.ts", "utf8");
    for (const [section, path] of Object.entries(core.SEARCH_LIST_PATHS)) {
      expect(server).toContain(`${section}: "${path}"`);
      expect(path).not.toContain("?");
    }
  });

  it("keeps the hits as the server sent them, only links that stay in the panel", () => {
    const groups = core.parseSearchAnswer({
      groups: [
        {
          section: "customers",
          label: "Müşteriler",
          more: true,
          listHref: null,
          hits: [
            // A phone number's hit has a name as its title: not matched again.
            {
              href: "/admin/musteriler/ayse@example.com",
              title: "Ayşe Yılmaz",
              meta: ["ayse@example.com"],
            },
            { href: "https://evil.example/x", title: "x", meta: [] },
            { href: "//evil.example/x", title: "x", meta: [] },
            { href: "javascript:alert(1)", title: "x", meta: [] },
            { href: "/admin/x y", title: "x", meta: [] },
          ],
        },
        {
          section: "orders",
          label: "Siparişler",
          more: false,
          listHref: "/admin/siparisler",
          hits: [
            {
              href: "/admin/siparisler/ord-1",
              title: "#10001",
              meta: ["Hazırlanıyor"],
              amountMinor: 12500,
              at: "2026-10-19T10:00:00.000Z",
            },
          ],
        },
        { section: "nope", label: "?", hits: [], more: false, listHref: null },
      ],
    });
    expect(groups?.map((g) => g.section)).toEqual(["customers", "orders"]);
    expect(groups?.[0].hits).toEqual([
      {
        href: "/admin/musteriler/ayse@example.com",
        title: "Ayşe Yılmaz",
        meta: ["ayse@example.com"],
      },
    ]);
    expect(groups?.[1].hits[0]).toMatchObject({ amountMinor: 12500 });
    expect(core.parseSearchAnswer({ error: "unavailable" })).toBeNull();
    expect(core.parseSearchAnswer(null)).toBeNull();
  });

  it("the list row: 'Listede ara' to the bare list, with the route's link or without it, nothing under five hits", () => {
    // The route's link is the bare list (search.ts LIST_HREF has no text
    // since #181), so the row never says the hits are shown there.
    expect(
      core.listRow({
        section: "orders",
        more: true,
        listHref: "/admin/siparisler",
      }),
    ).toEqual({ href: "/admin/siparisler", label: "Listede ara" });
    expect(
      core.listRow({ section: "customers", more: true, listHref: null }),
    ).toEqual({ href: "/admin/musteriler", label: "Listede ara" });
    expect(
      core.listRow({
        section: "orders",
        more: false,
        listHref: "/admin/siparisler",
      }),
    ).toBeNull();
    // No row anywhere carries what was typed (no "Tüm sonuçlar: <q>").
    const src = readFileSync(
      "src/components/admin/palette/palette.tsx",
      "utf8",
    );
    expect(src).not.toMatch(/Tüm sonuçlar/);
    expect(src).not.toMatch(/\?q=|[?&]q=\$\{/);
  });

  it("an expired session, the proxy's redirect and an outage each get their own answer", () => {
    expect(core.searchOutcome({ type: "basic", status: 200 })).toBe("ok");
    expect(core.searchOutcome({ type: "basic", status: 401 })).toBe("expired");
    expect(core.searchOutcome({ type: "opaqueredirect", status: 0 })).toBe(
      "expired",
    );
    expect(core.searchOutcome({ type: "basic", status: 503 })).toBe(
      "unavailable",
    );
    expect(core.searchOutcome({ type: "basic", status: 500 })).toBe(
      "unavailable",
    );
    expect(core.searchOutcome({ type: "basic", status: 403 })).toBe(
      "unavailable",
    );
    expect(core.signInHref("/admin/siparisler/ord-1")).toBe(
      "/admin/giris?next=%2Fadmin%2Fsiparisler%2Ford-1",
    );
    expect(core.signInHref("https://evil.example")).toBe(
      "/admin/giris?next=%2Fadmin",
    );
    expect(core.resultCountText(0)).toBe("Sonuç yok.");
    expect(core.resultCountText(3)).toBe("3 sonuç.");
  });
});

const PALETTE_FILES = [
  "src/components/admin/palette/trigger.tsx",
  "src/components/admin/palette/palette.tsx",
  "src/components/admin/palette/recents.ts",
  "src/lib/admin/palette-core.ts",
  "src/lib/admin/palette-shell.ts",
];

function resolveLocal(from: string, spec: string): string | null {
  const base = spec.startsWith("@/")
    ? `src/${spec.slice(2)}`
    : relative(process.cwd(), join(dirname(from), spec));
  for (const cand of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`]) {
    if (existsSync(cand) && statSync(cand).isFile()) return cand;
  }
  return null;
}

/** Every local module a file reaches: static, type-free and import(). */
function reach(entry: string): string[] {
  const seen = new Set<string>();
  const stack = [entry];
  while (stack.length > 0) {
    const file = stack.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    const src = readFileSync(file, "utf8");
    const specs = [
      ...src.matchAll(
        /\b(?:import|export)\s+(?!type\b)(?:[\w$*{}\s,]+?\s+from\s*)?["']([^"']+)["']/g,
      ),
      ...src.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g),
    ].map((m) => m[1]);
    for (const spec of specs) {
      if (!spec.startsWith(".") && !spec.startsWith("@/")) continue;
      const next = resolveLocal(file, spec);
      if (next) stack.push(next);
    }
  }
  return [...seen];
}

describe("the palette is read-only and keeps to one modal system", () => {
  it("no palette file reaches a Server Action module", () => {
    const useServer = (src: string) =>
      /^(?:\s|\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)*["']use server["']/.test(src);
    for (const file of PALETTE_FILES) {
      const hits = reach(file).filter((f) =>
        useServer(readFileSync(f, "utf8")),
      );
      expect(hits, file).toEqual([]);
    }
    // The checker sees one: the sidebar imports the badge counts.
    expect(
      reach("src/components/admin/admin-sidebar.tsx").some((f) =>
        useServer(readFileSync(f, "utf8")),
      ),
    ).toBe(true);
  });

  it("the list is React Aria's Autocomplete, TextField and ListBox in Turkish, nothing that opens its own overlay", () => {
    const src = readFileSync(
      "src/components/admin/palette/palette.tsx",
      "utf8",
    );
    for (const part of [
      "Autocomplete",
      "TextField",
      "ListBox",
      "Header",
      "I18nProvider",
      "Input",
    ]) {
      expect(src).toContain(`from "react-aria-components/${part}"`);
    }
    expect(src).toContain('<I18nProvider locale="tr-TR">');
    // TextField over SearchField (the budget): the first Esc empties the
    // box and keeps the dialog (preventDefault stops the native cancel);
    // on an empty box it is left to the dialog, which closes.
    expect(src).not.toContain("react-aria-components/SearchField");
    expect(src).toMatch(
      /if \(e\.key === "Escape" && text !== ""\) \{\s+e\.preventDefault\(\);\s+setText\(""\);\s+return;\s+\}\s+e\.continuePropagation\(\);/,
    );
    expect(src).not.toMatch(
      /react-aria-components\/(Modal|Dialog|Popover|Menu|Link)\b|RouterProvider/,
    );
    // Items navigate through onAction, not as links React Aria would open
    // (or prefetch) itself.
    expect(src).toContain("onAction={(key) => run(String(key))}");
    // The trigger opens the page (router.push) after asking a form with
    // unsaved changes; the list hands it the address.
    expect(src).toContain("navigate(target.href);");
    expect(src).not.toContain("router.push");
    expect(src).not.toMatch(/<ListBoxItem[^>]*\bhref=/);
    expect(src).not.toMatch(/\bprefetch\s*[=:(]|router\.prefetch/);
    // Typed text goes to the route in a POST body, never an address.
    expect(src).toMatch(/method: "POST"/);
    expect(src).toMatch(/redirect: "manual"/);
    expect(src).toMatch(/body: JSON\.stringify\(\{ q: query \}\)/);
    expect(src).toMatch(/new AbortController\(\)/);
  });

  it("the trigger hosts it in a native dialog through the panel's portal, opened modally before the list focuses its box", () => {
    const src = readFileSync(
      "src/components/admin/palette/trigger.tsx",
      "utf8",
    );
    expect(src).toContain("createPortal(");
    expect(src).toContain("adminPortalRoot()");
    expect(src).toMatch(
      /useLayoutEffect\(\(\) => \{\s+const dialog = dialogRef\.current;\s+if \(dialog && !dialog\.open\) dialog\.showModal\(\);/,
    );
    // A list already loaded mounts with the dialog, before showModal():
    // its own autofocus is lost, so the box is focused by hand after.
    expect(src).toContain(
      'dialog?.querySelector<HTMLInputElement>("input")?.focus();',
    );
    // Picked once per opening, never per render: a list that came through
    // next/dynamic must not be swapped for the loaded component when the
    // shell re-renders while it is open (it would mount anew and drop what
    // was typed; seen in a scripted browser).
    expect(src).toContain(
      "const [Body] = useState(() => loadedPalette ?? LazyPalette);",
    );
    expect(src).not.toMatch(/const Body = loadedPalette/);
    expect(src).toContain('window.addEventListener("keydown", onKey, true)');
    expect(src).toContain('querySelectorAll("dialog[open]")');
    expect(src).toContain("triggerRef.current?.focus()");
    // The list is a chunk of its own, never a static import of the shell.
    expect(src).toMatch(/dynamic\(\(\) => import\("\.\/palette"\)/);
    expect(src).not.toMatch(/^import [^;]*from "\.\/palette";/m);
    // What every page loads takes the small half only: palette-core (the
    // entries, the matching) and search-core (it brings the order filters)
    // stay in the list's chunk. Types are erased and load nothing.
    const valueFrom = (code: string, mod: string) =>
      new RegExp(`^import (?!type\\b)[^;]*from "${mod}";`, "m").test(code);
    for (const f of ["trigger.tsx", "recents.ts"]) {
      const code = readFileSync(`src/components/admin/palette/${f}`, "utf8");
      expect(valueFrom(code, "@/lib/admin/palette-core"), f).toBe(false);
      expect(valueFrom(code, "@/lib/admin/search-core"), f).toBe(false);
      expect(valueFrom(code, "@/lib/admin/palette-shell"), f).toBe(true);
    }
    expect(
      valueFrom(
        readFileSync("src/components/admin/admin-sidebar.tsx", "utf8"),
        "@/lib/admin/palette-core",
      ),
    ).toBe(false);
  });

  it("Çıkış forgets the recents before the action posts", () => {
    const src = readFileSync("src/components/admin/admin-sidebar.tsx", "utf8");
    expect(src).toContain(
      "<form action={logout} onSubmit={() => forgetRecents()}>",
    );
  });
});

describe("the trigger's server markup", () => {
  it("is one link to the results page that says it opens a dialog and which keys do", async () => {
    const { PaletteTrigger } =
      await import("@/components/admin/palette/trigger");
    const html = renderToStaticMarkup(
      createElement(PaletteTrigger, {
        groups: NAV.owner,
        role: "owner",
        accountKey: A,
      }),
    );
    const a = /<a [^>]*>/.exec(html)?.[0] ?? "";
    expect(a).toContain('href="/admin/ara"');
    // Its name is the words the field shows from `lg` (label in name);
    // the keys still open it, but no key is printed (operator, 22 Eki
    // 2026: the search "not Ctrl K").
    expect(a).toContain('aria-label="Sipariş, müşteri ya da sayfa ara"');
    expect(html).toContain(">Sipariş, müşteri ya da sayfa ara</span>");
    expect(a).toContain('aria-haspopup="dialog"');
    expect(a).toContain('aria-keyshortcuts="Meta+K Control+K"');
    expect(a).not.toContain("title=");
    // No dialog until it is opened.
    expect(html).not.toContain("<kbd");
    expect(html).not.toContain("<dialog");
    expect(html).not.toContain("Yükleniyor");
    expect(html).not.toMatch(/Ctrl K|⌘K/);
    // A 44 px square on a phone; from `lg` Innex's search field.
    expect(a).toMatch(/\bmax-lg:size-11\b/);
    expect(a).toMatch(/\blg:w-72\b/);
    expect(html.match(/<a /g)).toHaveLength(1);
  });

  it("a list that cannot load stays inside the dialog: a message and the results page, never the site's error page", async () => {
    // The shell sits above admin/error.tsx: an error leaving the dialog
    // (a chunk a deploy replaced, a köşk offline) reached app/error.tsx
    // and the whole panel became the site's error page (seen in a
    // scripted browser with the chunk missing).
    const { PaletteBoundary } =
      await import("@/components/admin/palette/trigger");
    expect(PaletteBoundary.getDerivedStateFromError()).toEqual({
      failed: true,
    });
    const draw = (failed: boolean) => {
      const b = new PaletteBoundary({
        children: createElement("p", null, "LIST"),
      });
      b.state = { failed };
      return renderToStaticMarkup(createElement(() => b.render()));
    };
    expect(draw(false)).toBe("<p>LIST</p>");
    const failed = draw(true);
    expect(failed).toContain('role="alert"');
    expect(failed).toContain(
      "Arama yüklenemedi. Sayfayı yenileyip yeniden dene.",
    );
    expect(failed).toMatch(
      /<a href="\/admin\/ara"[^>]*>Arama sayfasını aç<\/a>/,
    );
    expect(failed).not.toContain("LIST");
    // It wraps the list, whichever way the list came.
    const src = readFileSync(
      "src/components/admin/palette/trigger.tsx",
      "utf8",
    );
    expect(src).toMatch(/<PaletteBoundary>\s*<Body\b[^]*?<\/PaletteBoundary>/);
  });
});

describe("Ayarlar içinde: the settings tabs, built by the layout", () => {
  const owner = settingsPaletteEntries("owner");
  const hrefs = (entries: readonly PaletteEntry[]) =>
    entries.map((e) => e.href);
  const site = (entries: readonly PaletteEntry[]) =>
    entries.filter((e) => e.href?.startsWith("/admin/ayarlar"));
  const app = (entries: readonly PaletteEntry[]) =>
    entries.filter((e) => e.href?.startsWith("/admin/mobil/ayarlar"));
  const top = (entries: readonly PaletteEntry[], q: string) =>
    core.rankEntries(entries, q)[0]?.label;

  it("every site entry opens a tab SETTINGS_TABS has, and every tab has one", () => {
    const opened = site(owner).map((e) => {
      const url = new URL(e.href!, "https://laffogato.net");
      expect(url.pathname).toBe("/admin/ayarlar");
      return url.searchParams.get(SETTINGS_TAB_PARAM);
    });
    expect(opened).toEqual(SETTINGS_TABS.map((t) => t.id));
    for (const id of opened) expect(parseSettingsTab(id)).toBe(id);
    expect(SETTINGS_TAB_PARAM).toBe("sekme");
    expect(owner.map((e) => e.label).slice(0, SETTINGS_TABS.length)).toEqual([
      "Genel bilgiler",
      "Çalışma saatleri",
      "KDV",
      "Kargo ücreti",
      "Karaoke ücreti ve ön ödeme",
      "SEO",
      "Sipariş bildirimi e-postası",
      "E-posta gönderen",
    ]);
    // The hint says which tab of the page it opens, in the page's own word.
    expect(site(owner).map((e) => e.hint)).toEqual(
      SETTINGS_TABS.map((t) => `Ayarlar · ${t.label}`),
    );
  });

  it("the app's page is the first entry of its own, its other tabs follow with their ids", () => {
    const entries = app(owner);
    expect(entries[0]).toMatchObject({
      label: "Uygulama ayarları",
      href: "/admin/mobil/ayarlar",
    });
    const opened = entries.slice(1).map((e) => {
      const url = new URL(e.href!, "https://laffogato.net");
      expect(url.pathname).toBe("/admin/mobil/ayarlar");
      return url.searchParams.get(APP_CONFIG_TAB_PARAM);
    });
    expect(opened).toEqual(
      APP_CONFIG_TABS.filter((t) => t.id !== "version").map((t) => t.id),
    );
    for (const id of opened) expect(parseAppConfigTab(id)).toBe(id);
    expect(entries.slice(1).map((e) => e.label)).toEqual(
      APP_CONFIG_TABS.filter((t) => t.id !== "version").map((t) => t.label),
    );
    // "Bakım modu" is the app's switch, in the first tab: not the site's.
    expect(top(owner, "bakım modu")).toBe("Uygulama ayarları");
    expect(top(owner, "bakim")).toBe("Uygulama ayarları");
  });

  it("ids and addresses are unique, and none is a command", () => {
    expect(new Set(owner.map((e) => e.id)).size).toBe(owner.length);
    expect(new Set(hrefs(owner)).size).toBe(owner.length);
    for (const e of owner) {
      expect(e.command, e.id).toBeUndefined();
      expect(e.id, e.id).toMatch(/^set:\/admin\//);
    }
    expect(owner).toHaveLength(SETTINGS_TABS.length + APP_CONFIG_TABS.length);
  });

  it("Sahip gets the site and the app, Yönetici the app only, Personel and Kasiyer nothing", () => {
    expect(hrefs(settingsPaletteEntries("manager"))).toEqual(hrefs(app(owner)));
    expect(site(settingsPaletteEntries("manager"))).toEqual([]);
    expect(settingsPaletteEntries("staff")).toEqual([]);
    expect(settingsPaletteEntries("cashier")).toEqual([]);
    expect(settingsPaletteEntries(null)).toEqual([]);
    expect(settingsPaletteEntries(undefined)).toEqual([]);
  });

  it("the layout hands each role its own list, and the cashier no palette at all", async () => {
    const owned = (await shellFor("owner")).palette?.settings;
    expect(owned).toEqual(settingsPaletteEntries("owner"));
    expect(hrefs(owned ?? [])).toContain("/admin/ayarlar?sekme=shipping");

    const manager = (await shellFor("manager")).palette?.settings ?? [];
    expect(manager.length).toBeGreaterThan(0);
    expect(hrefs(manager).some((h) => h?.startsWith("/admin/ayarlar"))).toBe(
      false,
    );
    expect(hrefs(manager)).toContain("/admin/mobil/ayarlar");

    expect((await shellFor("staff")).palette?.settings).toEqual([]);
    const cashier = await shellFor("cashier");
    expect(cashier.palette).toBeUndefined();
    expect(JSON.stringify(cashier)).not.toContain("Kargo ücreti");
  });

  it("each page asks for the section its entries are gated by", () => {
    for (const [file, section] of [
      ["src/app/admin/ayarlar/page.tsx", "settings"],
      ["src/app/admin/mobil/ayarlar/page.tsx", "mobileApp"],
    ] as const) {
      expect(readFileSync(file, "utf8"), file).toContain(
        `requireRole("${section}")`,
      );
    }
    for (const role of ROLES) {
      const entries = settingsPaletteEntries(role);
      expect(site(entries).length > 0, role).toBe(canAccess("settings", role));
      expect(app(entries).length > 0, role).toBe(canAccess("mobileApp", role));
    }
  });

  it("finds the settings by what the operator types, marks or not", () => {
    expect(top(owner, "kargo")).toBe("Kargo ücreti");
    expect(top(owner, "KARGO ÜCRETİ")).toBe("Kargo ücreti");
    expect(top(owner, "kdv")).toBe("KDV");
    expect(top(owner, "KDV")).toBe("KDV");
    expect(top(owner, "calisma saatleri")).toBe("Çalışma saatleri");
    expect(top(owner, "çalışma saatleri")).toBe("Çalışma saatleri");
    expect(top(owner, "karaoke ucreti")).toBe("Karaoke ücreti ve ön ödeme");
    expect(top(owner, "on odeme")).toBe("Karaoke ücreti ve ön ödeme");
    expect(top(owner, "siparis bildirimi")).toBe("Sipariş bildirimi e-postası");
    expect(top(owner, "e-posta gonderen")).toBe("E-posta gönderen");
    expect(top(owner, "gonderen")).toBe("E-posta gönderen");
    expect(top(owner, "seo")).toBe("SEO");
    expect(top(owner, "vergi")).toBe("KDV");
    expect(top(owner, "mağaza durumu")).toBe("Genel bilgiler");
    expect(top(owner, "damga hedefi")).toBe("Sadakat");
    expect(top(owner, "app store")).toBe("Mağaza ve bağlantılar");
    expect(core.rankEntries(owner, "zzzz-yok")).toEqual([]);
    // The manager is offered the app's settings and no site setting.
    const manager = settingsPaletteEntries("manager");
    expect(top(manager, "kargo")).toBeUndefined();
    expect(top(manager, "kdv")).toBeUndefined();
    expect(top(manager, "bakım modu")).toBe("Uygulama ayarları");
    expect(top(manager, "mutlu saat")).toBe("Mutlu saatler");
  });

  it("the list draws them as they come: after Oluştur, before Kayıtlar, no code of their own", async () => {
    const src = readFileSync(
      "src/components/admin/palette/palette.tsx",
      "utf8",
    );
    expect(src).toContain(
      'if (all) section("settings", "Ayarlar içinde", entryItems(settings));',
    );
    expect(src.indexOf('section("create"')).toBeLessThan(
      src.indexOf('section("settings"'),
    );
    expect(src.indexOf('section("settings"')).toBeLessThan(
      src.indexOf("for (const g of hitGroups)"),
    );
    // The list's chunk is at its 45 KB: the builder, the tab lists and the
    // settings forms stay on the server, only their result arrives.
    for (const file of PALETTE_FILES) {
      const reached = reach(file);
      expect(reached, file).not.toContain("src/app/admin/palette-settings.ts");
      expect(reached, file).not.toContain(
        "src/app/admin/ayarlar/settings-core.ts",
      );
      expect(reached, file).not.toContain(
        "src/app/admin/mobil/ayarlar/app-config-core.ts",
      );
    }
    // The layout is the one that builds it.
    expect(readFileSync("src/app/admin/layout.tsx", "utf8")).toContain(
      "settings: settingsPaletteEntries(session.role)",
    );

    // Drawn for real: the headings come in the design's order, the settings
    // rows are links of the list like any other, and an empty query keeps
    // the whole list.
    const { Palette } = await import("@/components/admin/palette/palette");
    const html = (view: "all" | "create") =>
      renderToStaticMarkup(
        createElement(Palette, {
          groups: NAV.owner,
          settings: owner,
          role: "owner",
          accountKey: A,
          pathname: "/admin",
          view,
          close: () => {},
          navigate: () => {},
        }),
      );
    const all = html("all");
    const heads = [...all.matchAll(/>(Git|Oluştur|Ayarlar içinde|Komutlar)</g)];
    expect(heads.map((m) => m[1])).toEqual([
      "Git",
      "Oluştur",
      "Ayarlar içinde",
      "Komutlar",
    ]);
    expect(all).toContain("Kargo ücreti");
    expect(all).toContain("Ayarlar · Kargo");
    // `n` opens Oluştur alone: no settings there.
    const create = html("create");
    expect(create).not.toContain("Ayarlar içinde");
    expect(create).not.toContain("Kargo ücreti");
  });
});

describe("foldLoose and decomposed input (review of #198)", () => {
  it("a decomposed İ folds like a composed one", () => {
    expect(core.foldLoose("I\u0307ade")).toBe(core.foldLoose("İade"));
    expect(core.foldLoose("I\u0307ade")).toBe("iade");
  });
});
