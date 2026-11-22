import { DM_Sans, Inter } from "next/font/google";

import {
  AdminSidebar,
  type AdminNavGroup,
} from "@/components/admin/admin-sidebar";
import { OrderAlerts } from "@/components/admin/order-alerts";
import { PanelHomeProvider } from "@/components/admin/panel-home";
import { ToastProvider } from "@/components/admin/ui/toast";
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

import "./admin-theme.css";

/**
 * The panel wears Madame Coco Kenya's admin look (StorageBox), by the
 * operator's decision of 21 Kas 2026 ("madamecoco reposundaki admin panel
 * ile aynı tarz"); the recipe is docs/ADMIN-STORAGEBOX.md and the tokens
 * are in ./admin-theme.css. Inter for text and controls, DM Sans 400 for
 * page titles, card titles and big figures (`.admin-display`). It replaced
 * the Innex look (22 Eki 2026). The admin is internal (customers never see
 * it); the customer site keeps its own faces and palette (docs/BRAND.md).
 */
const adminSans = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-admin-sans",
  display: "swap",
});
const adminDisplay = DM_Sans({
  subsets: ["latin", "latin-ext"],
  variable: "--font-admin-display",
  display: "swap",
});

const ADMIN_SANS =
  "var(--font-admin-sans), ui-sans-serif, system-ui, sans-serif";

// The colours, corners and type scale are admin-theme.css's, on
// [data-admin-root]. Here only the site's type tokens are repointed to Inter
// inside this wrapper (the site's title classes read --headline, its labels
// --mono), leaving the customer site untouched.
const adminFontStyle = {
  fontFamily: ADMIN_SANS,
  "--sans": ADMIN_SANS,
  "--display": ADMIN_SANS,
  "--headline": ADMIN_SANS,
  "--serif": ADMIN_SANS,
  "--serif-modern": ADMIN_SANS,
  "--serif-display": ADMIN_SANS,
  // MONO_STYLE's labels (role, counts, column heads) are sans; amounts and
  // codes are NUMERIC_STYLE's tabular figures, in the same face.
  "--mono": ADMIN_SANS,
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
// 15.5rem (Innex's sidebar card), or 4rem once the shell wrote `data-admin-rail="on"` on this root
// (view-prefs.tsx; the choice is the browser's, so the server always draws
// the 15.5rem default and the stored rail applies right after hydration).
// The sidebar card, the page card's left edge and the bulk bar read it from
// `lg`; the cashier's shell has no sidebar and never sets it.
const FONT_VARIABLES = `${adminSans.variable} ${adminDisplay.variable}`;

// `flow-root`: the page card's 8 px top margin stays inside the grey
// ground; without it the margin collapsed through and the site's porcelain
// body showed above the cards.
const shellClass = (fontVariable: string) =>
  `${fontVariable} flow-root min-h-screen bg-[var(--admin-bg)] text-[var(--admin-text)] antialiased [--admin-side:15.5rem] data-[admin-rail=on]:[--admin-side:4rem] max-lg:has-[[data-admin-tabbar]]:not-has-[[data-admin-bulk-bar]]:[--admin-bottom-inset:calc(3.5rem+env(safe-area-inset-bottom))] pb-[var(--admin-bottom-inset,0px)] print:pb-0 print:bg-white`;

// The page frame (StorageBox): from `lg`, a pale grey canvas with a 1 px
// edge and 28-32 px corners on the outer ground, 8 px from the window and
// 8 px right of the sidebar card (which is fixed, so it sits outside this
// box whatever the DOM says). The white cards sit on the canvas. The top
// bar, the tab strip and the page are inside it, and the window scrolls,
// not the frame: sticky bars and the toasts keep working. Below `lg` it is
// the whole canvas, edge to edge.
const PAGE_CARD =
  "admin-frame min-h-dvh bg-[var(--admin-canvas)] lg:my-2 lg:mr-2 lg:min-h-[calc(100dvh-1rem)] lg:border lg:border-[var(--admin-frame-border)] print:m-0 print:min-h-0 print:border-0 print:bg-white";
const PAGE_CARD_SIDE = "lg:ml-[calc(var(--admin-side,15.5rem)+1rem)]";

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
        keywords: [
          "Kampanya e-postası",
          "abone",
          "e-posta",
          "newsletter",
          "İleti Yönetim Sistemi",
          "izin",
          "ret",
        ],
        tabs: [
          {
            href: "/admin/bulten/kampanya",
            label: "Kampanyalar",
            section: "newsletter",
          },
          { href: "/admin/bulten", label: "Aboneler", section: "newsletter" },
          // Registering the consents above in İYS, and İYS's refusals here
          // (docs/IYS.md): the same trust as the list itself.
          { href: "/admin/iys", label: "İYS", section: "newsletter" },
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
        keywords: [
          "Site Metinleri",
          "metin",
          "hikayemiz",
          "basında biz",
          "görsel",
          "fotoğraf",
          "Görseller",
        ],
        tabs: [
          { href: "/admin/icerik", label: "Metinler", section: "content" },
          { href: "/admin/gorseller", label: "Görseller", section: "content" },
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
      // fA'L bildirimleri left the nav on 27 Oct 2026: fA'L and its AI
      // reading left the app (App Review 4.3(b), lafmobil karar 330), so the
      // app sends no new report. /admin/mobil/fal-bildirimleri still opens
      // from a direct link, read-only, until the old rows run out (90 days).
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
      // e-Arşiv invoices (docs/EARSIV.md): owner and manager, like Raporlar,
      // whose money it is. Here and not under Bugün: Bugün is the shift's
      // group, and the urgent part (a deadline within two days, a refund on
      // an invoiced order, a config error) is on Genel bakış anyway.
      {
        href: "/admin/faturalar",
        label: "Faturalar",
        section: "invoices",
        icon: "invoices",
        keywords: ["fatura", "e-Arşiv", "Paraşüt", "earsiv", "invoice"],
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
  // The top bar's control: the new-order alert. The köşk's open/closed is
  // no longer set by hand from here (operator, 21 Kas 2026): it follows
  // Ayarlar → Saatler on its own (Canlı durum shows it).
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
          <div
            data-admin-page-card=""
            className={`${PAGE_CARD} ${chrome ? PAGE_CARD_SIDE : "lg:ml-2"}`}
          >
            {/* Top-bar controls go in AdminSidebar's `actions` (one slot after
              the search, at every width, mounted once): the new-order alert
              for the roles with Siparişler, on every panel page (the till
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
                orderAlerts ? (
                  <OrderAlerts
                    mayStartPreparing={alertMayStartPreparing(session.role)}
                  />
                ) : undefined
              }
            />
            {/* "İçeriğe geç" (the shell's first link) lands here. The pages
              draw their own <main>, so this is a plain wrapper. Focusable,
              so a click on the page's empty space focuses it too, and the
              next arrow key drew the panel's focus ring round the whole
              page. That ring (globals.css) is unlayered and beats any
              class: only an inline style turns it off here. */}
            <div id="admin-main" tabIndex={-1} style={{ outline: "none" }}>
              {children}
            </div>
          </div>
        </PanelHomeProvider>
      </ToastProvider>
    </div>
  );
}
