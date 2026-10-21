// Client-safe, no icons: the panel's five soft colours, one per nav group
// (operator, 21 Oct 2026: "yumuşat, daha estetik, biraz renklendir"). A
// group's pages carry its colour wherever the panel shows them with an
// icon: the sidebar's tiles and current row, the dashboard's tiles and
// "Hızlı ekle". A pastel ground under a deep ink; every ink clears AA on its
// ground and on white, and so do the page's inks on the grounds
// (tests/admin-ui-kit.test.ts). The values are admin/layout.tsx's
// --admin-hue-* tokens. Class strings are written out whole for Tailwind's
// scanner, which cannot read a name built from parts.

import type { AdminSection } from "@/lib/admin/roles";

export const ADMIN_HUES = ["blue", "amber", "rose", "violet", "green"] as const;
export type AdminHue = (typeof ADMIN_HUES)[number];

/** Each nav group's colour, by its title (admin/layout.tsx NAV_GROUPS). */
export const GROUP_HUE: Readonly<Record<string, AdminHue>> = {
  Bugün: "blue",
  Katalog: "amber",
  Pazarlama: "rose",
  İçerik: "violet",
  Yönetim: "green",
};

/**
 * Each section's colour: the nav group its pages sit in. For a page named
 * by its section ("Hızlı ekle"); the sidebar colours a row by its group.
 */
export const SECTION_HUE: Readonly<Record<AdminSection, AdminHue>> = {
  dashboard: "blue",
  orders: "blue",
  refunds: "blue",
  karaoke: "blue",
  till: "blue",
  venue: "blue",
  menu: "amber",
  products: "amber",
  categories: "amber",
  stock: "amber",
  customers: "rose",
  promos: "rose",
  newsletter: "rose",
  leads: "rose",
  content: "violet",
  shopHero: "violet",
  mobileApp: "violet",
  story: "violet",
  press: "violet",
  reports: "green",
  tables: "green",
  settings: "green",
  adminUsers: "green",
  legal: "green",
  audit: "green",
};

/** A section's colour from its name as a nav item carries it (a string). */
export function hueOfSection(section: string): AdminHue | undefined {
  return (SECTION_HUE as Readonly<Record<string, AdminHue>>)[section];
}

/** An icon's tile: the colour's ground under its ink. */
export const HUE_TILE: Readonly<Record<AdminHue, string>> = {
  blue: "bg-[var(--admin-hue-blue-soft)] text-[var(--admin-hue-blue)]",
  amber: "bg-[var(--admin-hue-amber-soft)] text-[var(--admin-hue-amber)]",
  rose: "bg-[var(--admin-hue-rose-soft)] text-[var(--admin-hue-rose)]",
  violet: "bg-[var(--admin-hue-violet-soft)] text-[var(--admin-hue-violet)]",
  green: "bg-[var(--admin-hue-green-soft)] text-[var(--admin-hue-green)]",
};

/** The ground alone: the sidebar's current row, a dashboard tile. */
export const HUE_SOFT: Readonly<Record<AdminHue, string>> = {
  blue: "bg-[var(--admin-hue-blue-soft)]",
  amber: "bg-[var(--admin-hue-amber-soft)]",
  rose: "bg-[var(--admin-hue-rose-soft)]",
  violet: "bg-[var(--admin-hue-violet-soft)]",
  green: "bg-[var(--admin-hue-green-soft)]",
};

/** The ink alone: an icon on white or on its own ground. */
export const HUE_INK: Readonly<Record<AdminHue, string>> = {
  blue: "text-[var(--admin-hue-blue)]",
  amber: "text-[var(--admin-hue-amber)]",
  rose: "text-[var(--admin-hue-rose)]",
  violet: "text-[var(--admin-hue-violet)]",
  green: "text-[var(--admin-hue-green)]",
};

/** A small dot in the ink: a nav group's title. */
export const HUE_DOT: Readonly<Record<AdminHue, string>> = {
  blue: "bg-[var(--admin-hue-blue)]",
  amber: "bg-[var(--admin-hue-amber)]",
  rose: "bg-[var(--admin-hue-rose)]",
  violet: "bg-[var(--admin-hue-violet)]",
  green: "bg-[var(--admin-hue-green)]",
};
