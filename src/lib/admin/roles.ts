// Client-safe role vocabulary (no server-only).

import { withDenied } from "./nav-match";

export type AdminRole = "owner" | "manager" | "staff" | "cashier";

/** Every role, in descending privilege - the order the user form offers them. */
export const ADMIN_ROLES: AdminRole[] = [
  "owner",
  "manager",
  "staff",
  "cashier",
];

export const ROLE_LABELS: Record<AdminRole, string> = {
  owner: "Sahip",
  manager: "Yönetici",
  staff: "Personel",
  cashier: "Kasiyer",
};

export function isAdminRole(value: string): value is AdminRole {
  return (ADMIN_ROLES as string[]).includes(value);
}

/**
 * Section keys map to admin nav entries + bulk feature areas. The matrix
 * below is the single source of truth - change it here and both server
 * gates and nav rendering update together.
 */
export type AdminSection =
  | "dashboard"
  | "till"
  | "orders"
  | "tables"
  | "refunds"
  | "products"
  | "menu"
  | "categories"
  | "shopHero"
  | "mobileApp"
  | "venue"
  | "karaoke"
  | "press"
  | "story"
  | "content"
  | "customers"
  | "newsletter"
  | "leads"
  | "legal"
  | "promos"
  | "stock"
  | "reports"
  | "audit"
  | "adminUsers"
  | "settings";

const SECTION_ROLES: Record<AdminSection, AdminRole[]> = {
  dashboard: ["owner", "manager", "staff"],
  // The till is the only thing a cashier can open. It is deliberately its own
  // section rather than part of `orders`: a cashier who could read Siparişler
  // could also read every customer's name, address and phone, and the shift
  // worker at the counter has no reason to.
  till: ["owner", "manager", "staff", "cashier"],
  orders: ["owner", "manager", "staff"],
  // The köşk's tables and their QR codes. Rotating a code kills a printed
  // card at once, so it is not a shift task.
  tables: ["owner", "manager"],
  // Moving money back out is not a shift task: a refund is irreversible and
  // has no approval step behind it.
  refunds: ["owner", "manager"],
  products: ["owner", "manager"],
  menu: ["owner", "manager"],
  categories: ["owner", "manager"],
  shopHero: ["owner", "manager"],
  mobileApp: ["owner", "manager"],
  // Canlı durum (/admin/mobil/canli-durum and the top bar's köşk chip): the
  // shift at the köşk sees the room, so Personel says whether it is open
  // and how many tables are free (admin UI v2, decision D3). The table
  // count itself stays with `mobileApp`, and so do the app's slides, posts
  // and settings.
  venue: ["owner", "manager", "staff"],
  // Karaoke bookings are the köşk shift's evening: Personel sees who is
  // coming, confirms and cancels unpaid ones. Anything that sends money back
  // (cancelling a paid booking, a refund retry) still needs `refunds`, which
  // each action checks on its own.
  karaoke: ["owner", "manager", "staff"],
  press: ["owner", "manager"],
  story: ["owner", "manager"],
  content: ["owner", "manager"],
  customers: ["owner", "manager"],
  newsletter: ["owner", "manager"],
  leads: ["owner", "manager"],
  legal: ["owner"],
  promos: ["owner", "manager"],
  stock: ["owner", "manager", "staff"],
  reports: ["owner", "manager"],
  audit: ["owner"],
  // Handing out panel access is the one privilege that can grant every other
  // one; it stays with the owner.
  adminUsers: ["owner"],
  settings: ["owner"],
};

export function canAccess(section: AdminSection, role: AdminRole): boolean {
  return SECTION_ROLES[section].includes(role);
}

export function sectionsFor(role: AdminRole): AdminSection[] {
  return (Object.keys(SECTION_ROLES) as AdminSection[]).filter((s) =>
    SECTION_ROLES[s].includes(role),
  );
}

/**
 * Where a role lands after signing in, and where it is sent when a page denies
 * it. The dashboard cannot be that place for every role any more: a cashier
 * has no `dashboard` access, so sending them to /admin would deny them there
 * too and bounce them between two redirects forever. Personel's shift starts
 * with the orders still open (admin UI v2, decision D2): the dashboard's
 * catalogue tiles are not shift work.
 */
const LANDING_SECTION: Record<AdminRole, AdminSection> = {
  owner: "dashboard",
  manager: "dashboard",
  staff: "orders",
  cashier: "till",
};

/** A landing path may carry a query: the orders list opens on its "Açık" tab. */
const SECTION_PATH: Partial<Record<AdminSection, string>> = {
  dashboard: "/admin",
  orders: "/admin/siparisler?durum=acik",
  till: "/admin/kasa",
};

export function landingPathFor(role: AdminRole): string {
  return SECTION_PATH[LANDING_SECTION[role]] ?? "/admin";
}

/**
 * Where a page that refuses the role sends it: the landing page with
 * `denied=1`, which the shell says once ("Bu sayfaya yetkin yok.") and takes
 * off the address again. Joined through `withDenied`, because the landing
 * path may already have a query: `${landing}?denied=1` made Personel's
 * `/admin/siparisler?durum=acik?denied=1`, a tab named "acik?denied=1" (so
 * every order) and no notice.
 */
export function deniedPathFor(role: AdminRole): string {
  return withDenied(landingPathFor(role));
}
