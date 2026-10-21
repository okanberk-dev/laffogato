import { Geist, Geist_Mono } from "next/font/google";

import {
  AdminSidebar,
  type AdminNavGroup,
} from "@/components/admin/admin-sidebar";
import { OrderAlerts } from "@/components/admin/order-alerts";
import { PanelHomeProvider } from "@/components/admin/panel-home";
import { ToastProvider } from "@/components/admin/ui/toast";
import { VenueQuick } from "@/components/admin/venue-quick";
import { getAdminSession, type AdminSession } from "@/lib/admin/auth";
import { readAdminFlash } from "@/lib/admin/flash";
import {
  alertMayStartPreparing,
  orderAlertsFor,
} from "@/lib/admin/order-alerts-core";
import {
  hasNavChrome,
  visibleNav,
  type NavGroupDef,
} from "@/lib/admin/nav-match";
import { paletteAccountKey } from "@/lib/admin/palette-account";
import { canAccess, landingPathFor, ROLE_LABELS } from "@/lib/admin/roles";
import { searchSectionsFor } from "@/lib/admin/search";

import { logoutAction } from "./actions";
import { settingsPaletteEntries } from "./palette-settings";

/**
 * The panel wears the venue back-office's look (lafmaliyet, ladmin.laffogato.net:
 * the AkmanOS light theme, docs/TASARIM.md there), by the operator's decision
 * of 21 Eki 2026. Geist Sans for every word, Geist Mono for codes and the
 * keyboard. The admin is internal (customers never see it); the customer site
 * keeps Gabarito and Poppins and its own palette (docs/BRAND.md).
 */
const geistSans = Geist({
  subsets: ["latin", "latin-ext"],
  variable: "--font-geist-sans",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin", "latin-ext"],
  variable: "--font-geist-mono",
  display: "swap",
});

const ADMIN_SANS =
  "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif";

// The AkmanOS light theme: a white canvas, zinc-100 cards, white controls,
// #171717 ink, black primary actions, lime only as a fill under dark ink.
// Tokens are explicit hex (not the global :root vars) so a dark-mode scheme
// can never flip the admin to dark, and the site's type tokens are
// repointed to Geist inside this wrapper only (the site's h1-h3 rule reads
// --headline, its labels --mono), leaving the customer site untouched.
const adminFontStyle = {
  fontFamily: ADMIN_SANS,
  "--sans": ADMIN_SANS,
  "--display": ADMIN_SANS,
  "--headline": ADMIN_SANS,
  "--serif": ADMIN_SANS,
  "--serif-modern": ADMIN_SANS,
  "--serif-display": ADMIN_SANS,
  // MONO_STYLE's labels (role, counts, column heads) are sans in AkmanOS;
  // real monospace (codes, amounts) is NUMERIC_STYLE's Geist Mono.
  "--mono": ADMIN_SANS,
  // AkmanOS, softened (operator, 21 Oct 2026: "yumuşat, daha estetik,
  // biraz renklendir"): the same white page and controls, the cards and
  // the sidebar a warm stone instead of cold zinc, the ink a warm
  // near-black, and five pastel colours for the nav groups (below).
  // Surfaces: the page and every control, menu and dialog are white; cards
  // and the sidebar are warm stone (--admin-panel), hovers and wells too.
  "--admin-bg": "#FFFFFF",
  "--admin-surface": "#FFFFFF",
  "--admin-surface-2": "#F6F4F0",
  "--admin-panel": "#F6F4F0",
  "--admin-border": "#E9E5DE",
  "--admin-border-strong": "#D9D3CA",
  // A field's outline: 3.45:1 on the stone cards and 3.8:1 on white, so an
  // empty field can be found (non-text contrast is 3:1). --admin-border
  // stays for cards and dividers.
  "--admin-border-field": "#8A8278",
  // Text: a warm near-black and its two greys
  "--admin-text": "#1C1917",
  "--admin-text-soft": "#44403C",
  // Labels, hints, eyebrows and placeholders: 5.2:1 on the stone cards
  // and 4.7:1 on a hovered control (tests/admin-ui-kit.test.ts).
  "--admin-text-mute": "#6B655E",
  // Actions: a warm black primary, lime accent (a fill only, under dark ink)
  "--admin-primary": "#1C1917",
  "--admin-primary-hover": "#292524",
  "--admin-accent": "#C0F21E",
  "--admin-danger": "#DC2626",
  // Tones (components/admin/ui/tone.ts): an ink for text and a soft ground
  // for badges, toasts and notices. Every ink clears AA (4.5:1) on its soft
  // ground and on white - tests/admin-ui-kit.test.ts holds them to it.
  // --admin-danger (red-600) stays for buttons and borders; on its soft
  // red-50 it is 4.41:1, so danger TEXT uses --admin-danger-ink (red-700).
  "--admin-neutral-soft": "#F6F4F0",
  "--admin-primary-soft": "#ECE8E1",
  "--admin-accent-ink": "#1F3A08",
  "--admin-accent-soft": "#EFFCC7",
  "--admin-info": "#2563EB",
  "--admin-info-soft": "#EFF6FF",
  "--admin-success": "#3F6212",
  "--admin-success-soft": "#ECFCCB",
  "--admin-warning": "#C2410C",
  "--admin-warning-soft": "#FFF7ED",
  "--admin-danger-ink": "#B91C1C",
  "--admin-danger-soft": "#FEF2F2",
  // The nav groups' colours (ui/hues.ts): a pastel ground and a deep ink,
  // 5.3:1 or more on each other and on white. Bugün, Katalog, Pazarlama,
  // İçerik, Yönetim.
  "--admin-hue-blue": "#1E50C8",
  "--admin-hue-blue-soft": "#E9F0FF",
  "--admin-hue-amber": "#9A4F0A",
  "--admin-hue-amber-soft": "#FDF0DA",
  "--admin-hue-rose": "#B8195A",
  "--admin-hue-rose-soft": "#FDE8EF",
  "--admin-hue-violet": "#6930C8",
  "--admin-hue-violet-soft": "#F0EBFE",
  "--admin-hue-green": "#0C6E50",
  "--admin-hue-green-soft": "#E3F4EC",
} as React.CSSProperties;

// The same ground for the signed-in panel and the login / 2FA screens. The
// signed-in wrapper used to be bg-neutral-50 and only the logged-out one
// carried the (never styled) `admin-shell` class. `data-admin-root` lets
// the panel's Tailwind classes beat the site's element resets (globals.css).
//
// The phone's bottom bar (ui/bottom-bar.tsx, UI-7) takes the bottom 3.5rem
// and the home indicator below `lg`. That room is one variable here,
// `--admin-bottom-inset`, set while the bar is on the page and no bulk
// bar has taken its place; the page ends that much higher, and the toasts,
// the bulk bar, the order alert sheet and the sticky save bars add it to
// their own distance from the bottom. Unset (0) everywhere else: from
// `lg`, for the cashier and on the sign-in screens.
//
// The laptop sidebar's width (UI-9) is one variable too, `--admin-side`:
// 17.5rem (AkmanOS's sidebar), or 4rem once the shell wrote `data-admin-rail="on"` on this root
// (view-prefs.tsx; the choice is the browser's, so the server always draws
// the 17.5rem default and the stored rail applies right after hydration).
// The sidebar, the top bar, the tab strip, the page's left edge and the bulk
// bar read it from `lg`; the cashier's shell has no sidebar and never sets it.
const FONT_VARIABLES = `${geistSans.variable} ${geistMono.variable}`;

const shellClass = (fontVariable: string) =>
  `${fontVariable} min-h-screen bg-[var(--admin-bg)] text-[var(--admin-text)] [--admin-side:17.5rem] data-[admin-rail=on]:[--admin-side:4rem] max-lg:has-[[data-admin-tabbar]]:not-has-[[data-admin-bulk-bar]]:[--admin-bottom-inset:calc(3.5rem+env(safe-area-inset-bottom))] pb-[var(--admin-bottom-inset,0px)] print:pb-0`;

/*
 * The panel's nav (admin UI v2, UI-5): five groups, and items that own
 * tabs. A tab is another existing page; the shell draws the strip on the
 * tab's own page, so no route moved and every bookmark and mail link still
 * lands. Tabs are filtered by role like items (visibleNav), and an item's
 * href is its first permitted tab: a manager's Ayarlar opens Uygulama
 * ayarları. Every item says its icon (ui/icons.tsx ADMIN_ICONS). Keywords
 * keep the old names findable (the palette searches them).
 */
const NAV_GROUPS: NavGroupDef[] = [
  {
    title: "Bugün",
    items: [
      {
        href: "/admin",
        label: "Genel bakış",
        section: "dashboard",
        icon: "dashboard",
        keywords: ["Genel", "pano", "dashboard", "özet"],
      },
      {
        href: "/admin/siparisler",
        label: "Siparişler",
        section: "orders",
        icon: "orders",
        keywords: ["sipariş", "Satış", "orders", "fiş"],
      },
      // Its own section, not `mobileApp`: the köşk shift (Personel) runs the
      // evening's bookings. The path stays under /mobil, where the mails and
      // the operator's bookmarks point.
      { href: "/admin/mobil/karaoke", label: "Karaoke", section: "karaoke" },
      // `till`, not `orders`: this is the one page a cashier can open, and a
      // cashier must not reach the order list, refunds or customer records.
      {
        href: "/admin/kasa",
        label: "Kasa",
        section: "till",
        icon: "till",
        keywords: ["Kasa · damga", "damga", "sadakat", "kart"],
      },
      // `venue`, not `mobileApp`: the köşk shift (Personel) says whether
      // the house is open and how many tables are free (decision D3); the
      // app's slides, posts and settings stay with owner and manager.
      {
        href: "/admin/mobil/canli-durum",
        label: "Canlı durum",
        section: "venue",
        icon: "appLive",
        keywords: ["köşk", "açık kapalı", "boş masa", "Wi-Fi"],
      },
    ],
  },
  {
    title: "Katalog",
    items: [
      {
        href: "/admin/menu",
        label: "Kafe menüsü",
        section: "menu",
        icon: "menu",
        keywords: ["Menü", "içecek", "yiyecek"],
      },
      {
        href: "/admin/urunler",
        label: "Ürünler",
        section: "products",
        icon: "products",
        keywords: ["Mağaza", "shop", "ürün", "CSV"],
        tabs: [
          { href: "/admin/urunler", label: "Ürünler", section: "products" },
          {
            href: "/admin/kategoriler",
            label: "Kategoriler",
            section: "categories",
          },
        ],
      },
      {
        href: "/admin/stok-hareketleri",
        label: "Stok",
        section: "stock",
        icon: "stock",
        keywords: ["Stok Hareketleri", "envanter", "sayım"],
      },
    ],
  },
  {
    title: "Pazarlama",
    items: [
      {
        href: "/admin/musteriler",
        label: "Müşteriler",
        section: "customers",
        icon: "customers",
        keywords: ["üye", "müşteri", "crm"],
      },
      {
        href: "/admin/promosyon",
        label: "Promosyonlar",
        section: "promos",
        icon: "promos",
        keywords: ["Promosyon", "kupon", "indirim kodu"],
      },
      // Composing a commercial mail is the same trust as reading who
      // consented to receive one: both tabs are `newsletter`.
      {
        href: "/admin/bulten/kampanya",
        label: "Bülten",
        section: "newsletter",
        icon: "newsletter",
        keywords: ["Kampanya e-postası", "abone", "e-posta", "newsletter"],
        tabs: [
          {
            href: "/admin/bulten/kampanya",
            label: "Kampanyalar",
            section: "newsletter",
          },
          { href: "/admin/bulten", label: "Aboneler", section: "newsletter" },
        ],
      },
    ],
  },
  {
    title: "İçerik",
    items: [
      // Every carousel in one place: the home page's, the shop's and the
      // app's. "Slaytı değiştirmek istiyorum" has one answer.
      {
        href: "/admin/anasayfa-hero",
        label: "Slaytlar",
        section: "content",
        icon: "slides",
        keywords: [
          "Anasayfa slaytları",
          "Mağaza vitrini",
          "Mağaza Hero",
          "Mobil Slaytlar",
          "vitrin",
          "hero",
          "slider",
          "banner",
        ],
        tabs: [
          {
            href: "/admin/anasayfa-hero",
            label: "Anasayfa",
            section: "content",
          },
          { href: "/admin/magaza-hero", label: "Mağaza", section: "shopHero" },
          {
            href: "/admin/mobil/slaytlar",
            label: "Uygulama",
            section: "mobileApp",
          },
        ],
      },
      {
        href: "/admin/icerik",
        label: "Site metinleri",
        section: "content",
        icon: "content",
        keywords: ["Site Metinleri", "metin", "hikayemiz", "basında biz"],
        tabs: [
          { href: "/admin/icerik", label: "Metinler", section: "content" },
          { href: "/admin/hikaye", label: "Hikaye", section: "story" },
          { href: "/admin/basin", label: "Basın", section: "press" },
        ],
      },
      {
        href: "/admin/mobil/duyurular",
        label: "Uygulama akışı",
        section: "mobileApp",
        icon: "mobileApp",
        keywords: ["Mobil Uygulama", "duyuru", "gönderi", "app"],
        tabs: [
          {
            href: "/admin/mobil/duyurular",
            label: "Duyurular",
            section: "mobileApp",
          },
          {
            href: "/admin/mobil/gonderiler",
            label: "Gönderiler",
            section: "mobileApp",
          },
        ],
      },
      {
        href: "/admin/mobil/fal-bildirimleri",
        label: "fA'L bildirimleri",
        section: "mobileApp",
        icon: "appFal",
        keywords: ["fal", "fA'L", "bildir", "şikayet"],
      },
    ],
  },
  {
    title: "Yönetim",
    items: [
      {
        href: "/admin/raporlar",
        label: "Raporlar",
        section: "reports",
        icon: "reports",
        keywords: ["ciro", "rapor", "satış raporu"],
      },
      {
        href: "/admin/masalar",
        label: "Masalar",
        section: "tables",
        icon: "tables",
        keywords: ["Masalar · QR", "qr", "masa kartı"],
      },
      {
        href: "/admin/ayarlar",
        label: "Ayarlar",
        section: "settings",
        icon: "settings",
        keywords: ["Uygulama ayarları", "Site ayarları", "bakım", "kargo"],
        tabs: [
          { href: "/admin/ayarlar", label: "Site", section: "settings" },
          {
            href: "/admin/mobil/ayarlar",
            label: "Uygulama",
            section: "mobileApp",
          },
        ],
      },
      {
        href: "/admin/kullanicilar",
        label: "Kullanıcılar",
        section: "adminUsers",
        icon: "adminUsers",
        keywords: ["yetki", "rol", "personel", "panel kullanıcısı"],
      },
      {
        href: "/admin/hukuk",
        label: "Yasal belgeler",
        section: "legal",
        icon: "legal",
        keywords: ["hukuk", "sözleşme", "KVKK", "aydınlatma"],
      },
      {
        href: "/admin/olay-kaydi",
        label: "Olay kaydı",
        section: "audit",
        icon: "audit",
        keywords: ["audit", "kayıt", "geçmiş"],
      },
    ],
  },
];

/**
 * The session, or `unavailable` when the database could not be asked about
 * the account behind a valid cookie (admin audit SHE-11). That is not
 * "signed out": the shell must not send the operator to the sign-in screen
 * over a one-second stumble, nor let the error fall to the SHOP's error page
 * (admin/error.tsx does not catch its own segment's layout).
 *
 * The error is shell-access's AdminSessionUnavailableError
 * (src/lib/admin/auth.ts), recognised the way its own
 * `isAdminSessionUnavailable` does, by its marker or code rather than
 * `instanceof` (Next may load a module once per bundle layer). Until that
 * change lands the session read never throws it and this stays dormant;
 * any other error still throws.
 */
async function readSession(): Promise<
  { session: AdminSession | null; unavailable: false } | { unavailable: true }
> {
  try {
    return { session: await getAdminSession(), unavailable: false };
  } catch (err) {
    if (!isSessionUnavailable(err)) throw err;
    console.error("[admin] oturum doğrulanamadı: veritabanına ulaşılamıyor");
    return { unavailable: true };
  }
}

function isSessionUnavailable(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as { __adminSessionUnavailable?: unknown; code?: unknown };
  return (
    e.__adminSessionUnavailable === true ||
    e.code === "ADMIN_SESSION_UNAVAILABLE"
  );
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [read, flash] = await Promise.all([
    readSession(),
    // A toast left by a redirecting action (lib/admin/flash.ts); the client
    // deletes the cookie once it is on screen.
    readAdminFlash(),
  ]);

  // The account could not be checked. The page below asks the same cached
  // session and throws into admin/error.tsx ("Tekrar dene"); the shell says
  // why, without a nav it cannot know the role for.
  if (read.unavailable) {
    return (
      <div
        data-admin-root=""
        className={shellClass(FONT_VARIABLES)}
        style={adminFontStyle}
      >
        <ToastProvider flash={flash}>
          <div
            role="alert"
            className="border-b border-[var(--admin-warning)]/30 bg-[var(--admin-warning-soft)] px-4 py-3 text-sm text-[var(--admin-warning)] sm:px-6 print:hidden"
          >
            <strong className="font-semibold">
              Oturumun şu an doğrulanamıyor.
            </strong>{" "}
            Veritabanı yanıt vermedi; çıkış yapılmadı. Birkaç saniye sonra
            sayfayı yenile.
          </div>
          {children}
        </ToastProvider>
      </div>
    );
  }

  const { session } = read;

  // Unauthenticated routes (login, 2FA challenge) render bare - they ship
  // their own centered layout and must not show the admin sidebar.
  if (!session) {
    return (
      <div
        data-admin-root=""
        className={shellClass(FONT_VARIABLES)}
        style={adminFontStyle}
      >
        <ToastProvider flash={flash}>{children}</ToastProvider>
      </div>
    );
  }

  const groups: AdminNavGroup[] = visibleNav(NAV_GROUPS, (section) =>
    canAccess(section, session.role),
  );
  const landingPath = landingPathFor(session.role);
  // A one-page role (Kasiyer) has no sidebar, so nothing to clear room for.
  const chrome = hasNavChrome(groups);
  // The ⌘K palette, for a role its record search covers: not the cashier,
  // whose shell gets no trigger, no recents and no key.
  const canSearch = searchSectionsFor(session.role).length > 0;
  // Never the e-mail: an HMAC of it (palette-account.ts). The palette's
  // recents and the lists' saved views (ui/saved-views.tsx, read from the
  // root's data-admin-account) are kept under it in the browser.
  const accountKey = canSearch ? paletteAccountKey(session.email) : "";
  // The top bar's controls. The köşk chip polls its own status (a Server
  // Action, once a minute): the layout reads nothing for it.
  const venueChip = canAccess("venue", session.role);
  const orderAlerts = orderAlertsFor(session.role);

  return (
    <div
      data-admin-root=""
      data-admin-account={accountKey || undefined}
      className={shellClass(FONT_VARIABLES)}
      style={adminFontStyle}
    >
      <ToastProvider flash={flash}>
        <PanelHomeProvider href={landingPath}>
          {/* Top-bar controls go in AdminSidebar's `actions` (one slot after
              the search, at every width, mounted once): the köşk chip for
              the roles with Canlı durum, then the new-order alert for the
              roles with Siparişler, on every panel page (the till
              included). */}
          <AdminSidebar
            groups={groups}
            email={session.email}
            roleLabel={ROLE_LABELS[session.role]}
            landingPath={landingPath}
            logout={logoutAction}
            canSearch={canSearch}
            palette={
              canSearch
                ? {
                    role: session.role,
                    accountKey,
                    // "Ayarlar içinde": plain data, built here (the list's
                    // chunk has no code for it).
                    settings: settingsPaletteEntries(session.role),
                  }
                : undefined
            }
            actions={
              venueChip || orderAlerts ? (
                <>
                  {venueChip ? <VenueQuick /> : null}
                  {orderAlerts ? (
                    <OrderAlerts
                      mayStartPreparing={alertMayStartPreparing(session.role)}
                    />
                  ) : null}
                </>
              ) : undefined
            }
          />
          {/* "İçeriğe geç" (the shell's first link) lands here. The pages
              draw their own <main>, so this is a plain wrapper. Focusable,
              so a click on the page's empty space focuses it too, and the
              next arrow key drew the panel's focus ring round the whole
              page. That ring (globals.css) is unlayered and beats any
              class: only an inline style turns it off here. */}
          <div
            id="admin-main"
            tabIndex={-1}
            className={
              chrome
                ? "lg:pl-[var(--admin-side,17.5rem)] print:pl-0"
                : "print:pl-0"
            }
            style={{ outline: "none" }}
          >
            {children}
          </div>
        </PanelHomeProvider>
      </ToastProvider>
    </div>
  );
}
