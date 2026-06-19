import {
  AdminSidebar,
  type AdminNavGroup,
} from "@/components/admin/admin-sidebar";
import { getAdminSession } from "@/lib/admin/auth";
import { canAccess, ROLE_LABELS, type AdminSection } from "@/lib/admin/roles";

import { logoutAction } from "./actions";

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
      { href: "/admin/kategoriler", label: "Kategoriler", section: "categories" },
      { href: "/admin/magaza-hero", label: "Mağaza Hero", section: "shopHero" },
    ],
  },
  {
    title: "İçerik",
    items: [
      { href: "/admin/reels", label: "Reels", section: "reels" },
      { href: "/admin/basin", label: "Basın", section: "press" },
      { href: "/admin/hikaye", label: "Hikaye", section: "story" },
      { href: "/admin/franchise", label: "Franchise", section: "franchise" },
      { href: "/admin/icerik", label: "Site Metinleri", section: "content" },
    ],
  },
  {
    title: "Satış",
    items: [
      { href: "/admin/siparisler", label: "Siparişler", section: "orders" },
      { href: "/admin/musteriler", label: "Müşteriler", section: "customers" },
      { href: "/admin/promosyon", label: "Promosyon", section: "promos" },
      { href: "/admin/stok-hareketleri", label: "Stok", section: "stock" },
      { href: "/admin/raporlar", label: "Raporlar", section: "reports" },
    ],
  },
  {
    title: "Sistem",
    items: [
      { href: "/admin/olay-kaydi", label: "Olay kaydı", section: "audit" },
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

  // Unauthenticated routes (login, 2FA challenge) render bare — they ship
  // their own centered layout and must not show the admin sidebar.
  if (!session) {
    return <div className="min-h-screen bg-neutral-50">{children}</div>;
  }

  const groups: AdminNavGroup[] = NAV_GROUPS.map((g) => ({
    title: g.title,
    items: g.items.filter((i) => canAccess(i.section, session.role)),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="min-h-screen bg-neutral-50">
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
