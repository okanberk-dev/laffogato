// Client-safe role vocabulary (no server-only).

export type AdminRole = "owner" | "manager" | "staff";

export const ROLE_LABELS: Record<AdminRole, string> = {
  owner: "Sahip",
  manager: "Yönetici",
  staff: "Personel",
};

/**
 * Section keys map to admin nav entries + bulk feature areas. The matrix
 * below is the single source of truth — change it here and both server
 * gates and nav rendering update together.
 */
export type AdminSection =
  | "dashboard"
  | "orders"
  | "refunds"
  | "products"
  | "menu"
  | "categories"
  | "shopHero"
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
  | "settings";

const SECTION_ROLES: Record<AdminSection, AdminRole[]> = {
  dashboard: ["owner", "manager", "staff"],
  orders: ["owner", "manager", "staff"],
  // Moving money back out is not a shift task: a refund is irreversible and
  // has no approval step behind it.
  refunds: ["owner", "manager"],
  products: ["owner", "manager"],
  menu: ["owner", "manager"],
  categories: ["owner", "manager"],
  shopHero: ["owner", "manager"],
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
