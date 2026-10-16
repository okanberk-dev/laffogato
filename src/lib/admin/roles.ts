// Client-safe role vocabulary (no server-only).

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
 * too and bounce them between two redirects forever.
 */
const LANDING_SECTION: Record<AdminRole, AdminSection> = {
  owner: "dashboard",
  manager: "dashboard",
  staff: "dashboard",
  cashier: "till",
};

const SECTION_PATH: Partial<Record<AdminSection, string>> = {
  dashboard: "/admin",
  till: "/admin/kasa",
};

export function landingPathFor(role: AdminRole): string {
  return SECTION_PATH[LANDING_SECTION[role]] ?? "/admin";
}
