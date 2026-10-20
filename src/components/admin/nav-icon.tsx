"use client";

import {
  ADMIN_ICONS,
  AdminIcon,
  type AdminIconName,
} from "@/components/admin/ui/icons";

/** Whether `name` is a key of the panel's icon map. */
export function isNavIconName(name: string): name is AdminIconName {
  return Object.prototype.hasOwnProperty.call(ADMIN_ICONS, name);
}

/**
 * A nav icon by its key (`item.icon ?? item.section`), the dashboard's
 * when the key names none. The sidebar loads this file lazily
 * (next/dynamic): lucide then rides in a chunk of its own that only the
 * full nav asks for, so a cashier's /admin/kasa, which draws no nav, gets
 * no library code (CLAUDE.md, "Admin arayüz kütüphaneleri").
 */
export function NavIcon({ name }: { name: string }) {
  return <AdminIcon name={isNavIconName(name) ? name : "dashboard"} />;
}
