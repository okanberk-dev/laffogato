// Client-safe: what each panel role opens, in the words of the sidebar.

import { sectionsFor, type AdminRole, type AdminSection } from "./roles";

/**
 * Every section under the name the operator knows it by (the sidebar's,
 * app/admin/layout.tsx), plus what is not obvious from the name: Müşteriler
 * is every member's personal data and "Hesabı sil", Bülten is mass mail,
 * İadeler is money going back out. A section with no page of its own is
 * "" and left out of the summary.
 */
export const SECTION_LABELS: Record<AdminSection, string> = {
  dashboard: "Genel bakış",
  till: "Kasa · damga",
  orders: "Siparişler",
  tables: "Masalar · QR",
  refunds: "İadeler",
  products: "Ürünler",
  menu: "Menü",
  categories: "Kategoriler",
  shopHero: "Mağaza Hero",
  mobileApp: "Mobil uygulama",
  karaoke: "Karaoke",
  press: "Basın",
  story: "Hikaye",
  content: "Site metinleri",
  customers: "Müşteriler (üye kişisel verileri, Hesabı sil)",
  newsletter: "Bülten ve kampanya e-postası",
  leads: "",
  legal: "Yasal belgeler",
  promos: "Promosyon",
  stock: "Stok",
  reports: "Raporlar",
  audit: "Olay kaydı",
  adminUsers: "Kullanıcılar",
  settings: "Ayarlar",
};

/**
 * The sections a role opens, from the same matrix the server gates read
 * (roles.ts). The users page used to describe the roles in a sentence of
 * its own: "Yönetici katalog, içerik ve siparişleri yönetir" hid refunds,
 * member deletion and mass e-mail from the owner choosing the role.
 */
export function roleSectionLabels(role: AdminRole): string[] {
  return sectionsFor(role)
    .map((section) => SECTION_LABELS[section])
    .filter(Boolean);
}
