import { Poppins } from "next/font/google";

import {
  AdminSidebar,
  type AdminNavGroup,
} from "@/components/admin/admin-sidebar";
import { ToastProvider } from "@/components/admin/ui/toast";
import { getAdminSession } from "@/lib/admin/auth";
import { readAdminFlash } from "@/lib/admin/flash";
import { canAccess, ROLE_LABELS, type AdminSection } from "@/lib/admin/roles";

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
  // Text (espresso ink)
  "--admin-text": "#2C1D11",
  "--admin-text-soft": "#5A4636",
  "--admin-text-mute": "#8A7A64",
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

interface NavItemDef {
  href: string;
  label: string;
  section: AdminSection;
}

const NAV_GROUPS: Array<{ title: string; items: NavItemDef[] }> = [
  {
    title: "Genel",
    items: [{ href: "/admin", label: "Genel bakış", section: "dashboard" }],
  },
  {
    title: "Katalog",
    items: [
      { href: "/admin/menu", label: "Menü", section: "menu" },
      { href: "/admin/urunler", label: "Ürünler", section: "products" },
      {
        href: "/admin/kategoriler",
        label: "Kategoriler",
        section: "categories",
      },
      { href: "/admin/magaza-hero", label: "Mağaza Hero", section: "shopHero" },
    ],
  },
  {
    title: "İçerik",
    items: [
      { href: "/admin/basin", label: "Basın", section: "press" },
      { href: "/admin/hikaye", label: "Hikaye", section: "story" },
      { href: "/admin/icerik", label: "Site Metinleri", section: "content" },
      // The home page's hero: the same editors as the site's copy.
      {
        href: "/admin/anasayfa-hero",
        label: "Anasayfa slaytları",
        section: "content",
      },
    ],
  },
  {
    title: "Mobil Uygulama",
    items: [
      {
        href: "/admin/mobil/slaytlar",
        label: "Slaytlar",
        section: "mobileApp",
      },
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
      {
        href: "/admin/mobil/canli-durum",
        label: "Canlı durum",
        section: "mobileApp",
      },
      {
        href: "/admin/mobil/fal-bildirimleri",
        label: "fA'L bildirimleri",
        section: "mobileApp",
      },
      {
        href: "/admin/mobil/ayarlar",
        label: "Uygulama ayarları",
        section: "mobileApp",
      },
    ],
  },
  {
    title: "Satış",
    items: [
      { href: "/admin/siparisler", label: "Siparişler", section: "orders" },
      // Its own section, not `mobileApp`: the köşk shift (Personel) runs the
      // evening's bookings. The path stays under /mobil, where the mails and
      // the operator's bookmarks point.
      { href: "/admin/mobil/karaoke", label: "Karaoke", section: "karaoke" },
      // `till`, not `orders`: this is the one page a cashier can open, and a
      // cashier must not reach the order list, refunds or customer records.
      { href: "/admin/kasa", label: "Kasa · damga", section: "till" },
      { href: "/admin/masalar", label: "Masalar · QR", section: "tables" },
      { href: "/admin/musteriler", label: "Müşteriler", section: "customers" },
      { href: "/admin/bulten", label: "Bülten", section: "newsletter" },
      // Same section as Bülten: composing a commercial mail is the same trust
      // as reading who consented to receive one.
      {
        href: "/admin/bulten/kampanya",
        label: "Kampanya e-postası",
        section: "newsletter",
      },
      { href: "/admin/promosyon", label: "Promosyon", section: "promos" },
      { href: "/admin/stok-hareketleri", label: "Stok", section: "stock" },
      { href: "/admin/raporlar", label: "Raporlar", section: "reports" },
    ],
  },
  {
    title: "Sistem",
    items: [
      { href: "/admin/hukuk", label: "Yasal belgeler", section: "legal" },
      { href: "/admin/olay-kaydi", label: "Olay kaydı", section: "audit" },
      {
        href: "/admin/kullanicilar",
        label: "Kullanıcılar",
        section: "adminUsers",
      },
      { href: "/admin/ayarlar", label: "Ayarlar", section: "settings" },
    ],
  },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, flash] = await Promise.all([
    getAdminSession(),
    // A toast left by a redirecting action (lib/admin/flash.ts); the client
    // deletes the cookie once it is on screen.
    readAdminFlash(),
  ]);

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

  const groups: AdminNavGroup[] = NAV_GROUPS.map((g) => ({
    title: g.title,
    items: g.items.filter((i) => canAccess(i.section, session.role)),
  })).filter((g) => g.items.length > 0);

  return (
    <div
      data-admin-root=""
      className={shellClass(poppins.variable)}
      style={adminFontStyle}
    >
      <ToastProvider flash={flash}>
        <AdminSidebar
          groups={groups}
          email={session.email}
          roleLabel={ROLE_LABELS[session.role]}
          logout={logoutAction}
        />
        <div className="lg:pl-64">{children}</div>
      </ToastProvider>
    </div>
  );
}
