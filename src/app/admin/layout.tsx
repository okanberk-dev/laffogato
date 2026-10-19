import { Poppins } from "next/font/google";

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
import { canAccess, landingPathFor, ROLE_LABELS } from "@/lib/admin/roles";
import { searchSectionsFor } from "@/lib/admin/search";

import { logoutAction } from "./actions";

/**
 * Admin panel uses Poppins - a clean, geometric UI sans. The admin is internal
 * (customers never see it), so it deliberately diverges from the customer
 * site's editorial Playfair/Inter type system for better dashboard legibility.
 */
const poppins = Poppins({
  subsets: ["latin", "latin-ext"],
  variable: "--font-poppins",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// The admin shell uses Poppins + a brand-aligned palette (cream surfaces,
// espresso primary, gold accent) so it feels of-a-piece with the customer
// site. Tokens are explicit hex (not the global :root vars) so a dark-mode
// scheme can never flip the admin to dark, and we locally override the brand
// serif tokens so any var(--serif) element renders Poppins too - all scoped
// to this wrapper, leaving the customer site's type system untouched.
const adminFontStyle = {
  fontFamily: "var(--font-poppins), var(--sans)",
  "--serif": "var(--font-poppins), var(--sans)",
  "--serif-modern": "var(--font-poppins), var(--sans)",
  // Surfaces
  "--admin-bg": "#F7F1E5",
  "--admin-surface": "#FFFFFF",
  "--admin-surface-2": "#FBF6EC",
  "--admin-border": "#E7DAC2",
  "--admin-border-strong": "#D7C7A9",
  // A field's outline: 3.31:1 on a white card and 3.07:1 on the field's
  // own fill, so an empty field can be found (non-text contrast is 3:1).
  // --admin-border is 1.38:1 on white and stays for cards and dividers.
  "--admin-border-field": "#9C8B70",
  // Text (espresso ink)
  "--admin-text": "#2C1D11",
  "--admin-text-soft": "#5A4636",
  // Labels, hints, eyebrows and placeholders. #8A7A64 was 4.16:1 on white
  // and 3.70:1 on the page; this clears 4.5:1 on white, the page,
  // surface-2 and neutral-soft (tests/admin-ui-kit.test.ts).
  "--admin-text-mute": "#74644F",
  // Brand actions
  "--admin-primary": "#44301C",
  "--admin-primary-hover": "#2C1D11",
  "--admin-accent": "#B88A4A",
  "--admin-danger": "#C5435A",
  // Tones (components/admin/ui/tone.ts): an ink for text and a soft ground
  // for badges, toasts and notices. Every ink clears AA (4.5:1) on its soft
  // ground and on white - tests/admin-ui-kit.test.ts holds them to it.
  // --admin-danger itself stays for buttons and borders; on its soft pink
  // it is 4.05:1, so danger TEXT uses --admin-danger-ink.
  "--admin-neutral-soft": "#F1ECE4",
  "--admin-primary-soft": "#F1E8DA",
  "--admin-accent-ink": "#765923",
  "--admin-accent-soft": "#F6ECD6",
  "--admin-info": "#1F5C99",
  "--admin-info-soft": "#E4EEF8",
  "--admin-success": "#1D6D56",
  "--admin-success-soft": "#E3F1EA",
  "--admin-warning": "#8A5300",
  "--admin-warning-soft": "#FBEFD9",
  "--admin-danger-ink": "#A8344B",
  "--admin-danger-soft": "#F9E6EA",
} as React.CSSProperties;

// The same ground for the signed-in panel and the login / 2FA screens. The
// signed-in wrapper used to be bg-neutral-50 and only the logged-out one
// carried the (never styled) `admin-shell` class. `data-admin-root` lets
// the panel's Tailwind classes beat the site's element resets (globals.css).
const shellClass = (fontVariable: string) =>
  `${fontVariable} min-h-screen bg-[var(--admin-bg)] text-[var(--admin-text)]`;

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
      {
        href: "/admin/mobil/canli-durum",
        label: "Canlı durum",
        section: "mobileApp",
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
        className={shellClass(poppins.variable)}
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
        className={shellClass(poppins.variable)}
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

  return (
    <div
      data-admin-root=""
      className={shellClass(poppins.variable)}
      style={adminFontStyle}
    >
      <ToastProvider flash={flash}>
        <PanelHomeProvider href={landingPath}>
          {/* Top-bar controls go in AdminSidebar's `actions` (one slot after
              the search, at every width, mounted once). The new-order
              alert lives there for the roles with Siparişler, on every
              panel page (the till included). */}
          <AdminSidebar
            groups={groups}
            email={session.email}
            roleLabel={ROLE_LABELS[session.role]}
            landingPath={landingPath}
            logout={logoutAction}
            canSearch={searchSectionsFor(session.role).length > 0}
            actions={
              orderAlertsFor(session.role) ? (
                <OrderAlerts
                  mayStartPreparing={alertMayStartPreparing(session.role)}
                />
              ) : undefined
            }
          />
          {/* "İçeriğe geç" (the shell's first link) lands here. The pages
              draw their own <main>, so this is a plain wrapper. */}
          <div
            id="admin-main"
            tabIndex={-1}
            className={chrome ? "lg:pl-64 print:pl-0" : "print:pl-0"}
          >
            {children}
          </div>
        </PanelHomeProvider>
      </ToastProvider>
    </div>
  );
}
