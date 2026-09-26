import Link from "next/link";

import type { PublicCustomer } from "@/lib/customer/store";

import {
  ACCOUNT_NAV,
  type AccountNavItem,
  type AccountSection,
} from "./account-shell";

export function AccountSidebar({
  active,
  customer,
}: {
  active: AccountSection;
  customer: PublicCustomer;
}) {
  return (
    <nav className="account-nav" aria-label="Hesap menüsü">
      <ul className="account-nav-list">
        {ACCOUNT_NAV.map((item) => (
          <li key={item.key}>
            <SidebarLink item={item} isActive={item.key === active} />
          </li>
        ))}
      </ul>
      <div className="account-nav-meta">
        <div className="account-nav-meta-row">
          <span>Üyelik</span>
          <span>{formatJoinDate(customer.createdAt)}</span>
        </div>
      </div>
    </nav>
  );
}

function SidebarLink({
  item,
  isActive,
}: {
  item: AccountNavItem;
  isActive: boolean;
}) {
  return (
    <Link
      href={item.href}
      className="account-nav-link"
      aria-current={isActive ? "page" : undefined}
      data-active={isActive ? "true" : undefined}
    >
      <span className="account-nav-link-label">{item.label}</span>
      <span className="account-nav-link-hint">{item.hint}</span>
    </Link>
  );
}

/**
 * The compact account menu shown above the content on narrow screens.
 *
 * This was a <select> that navigated on `change`. Arrowing through a select
 * fires `change` per option in several browsers, so a keyboard user was thrown
 * onto a different page mid-choice - and the focus ring had been removed
 * outright, leaving no way to see where you were. It is a scrollable row of
 * links now: one target per activation, and the current page marked for
 * assistive technology.
 */
export function AccountTopNav({ active }: { active: AccountSection }) {
  return (
    <nav className="account-topnav" aria-label="Hesap menüsü">
      <span className="eyebrow">Hesap menüsü</span>
      <ul className="account-topnav-list">
        {ACCOUNT_NAV.map((i) => (
          <li key={i.key}>
            <Link
              href={i.href}
              className="account-topnav-link"
              aria-current={i.key === active ? "page" : undefined}
              data-active={i.key === active ? "true" : undefined}
            >
              {i.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function formatJoinDate(iso: string | undefined | null): string {
  if (!iso) return "-";
  try {
    // The köşk's calendar (rule 22): on a UTC server a member who joined
    // at 01:00 on the 1st would otherwise read as the previous month.
    return new Intl.DateTimeFormat("tr-TR", {
      month: "long",
      year: "numeric",
      timeZone: "Europe/Istanbul",
    }).format(new Date(iso));
  } catch {
    return "-";
  }
}
