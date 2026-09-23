import { Poppins } from "next/font/google";

import {
  AdminSidebar,
  type AdminNavGroup,
} from "@/components/admin/admin-sidebar";
import { getAdminSession } from "@/lib/admin/auth";
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
} as React.CSSProperties;

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
      { href: "/admin/mobil/karaoke", label: "Karaoke", section: "mobileApp" },
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
      // `till`, not `orders`: this is the one page a cashier can open, and a
      // cashier must not reach the order list, refunds or customer records.
      { href: "/admin/kasa", label: "Kasa · damga", section: "till" },
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
  const session = await getAdminSession();

  // Unauthenticated routes (login, 2FA challenge) render bare - they ship
  // their own centered layout and must not show the admin sidebar.
  if (!session) {
    return (
      <div
        className={`admin-shell ${poppins.variable} min-h-screen bg-[var(--admin-bg)] text-[var(--admin-text)]`}
        style={adminFontStyle}
      >
        {children}
      </div>
    );
  }

  const groups: AdminNavGroup[] = NAV_GROUPS.map((g) => ({
    title: g.title,
    items: g.items.filter((i) => canAccess(i.section, session.role)),
  })).filter((g) => g.items.length > 0);

  return (
    <div
      className={`${poppins.variable} min-h-screen bg-neutral-50`}
      style={adminFontStyle}
    >
      <AdminSidebar
        groups={groups}
        email={session.email}
        roleLabel={ROLE_LABELS[session.role]}
        logout={logoutAction}
      />
      <div className="lg:pl-64">{children}</div>
    </div>
  );
}
