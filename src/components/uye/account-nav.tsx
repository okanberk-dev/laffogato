"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

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

export function AccountTopNav({ active }: { active: AccountSection }) {
  const router = useRouter();
  const ref = useRef<HTMLSelectElement | null>(null);
  useEffect(() => {
    if (ref.current) ref.current.value = active;
  }, [active]);
  return (
    <label className="account-topnav" aria-label="Hesap menüsü">
      <span className="eyebrow" style={{ marginBottom: 8 }}>
        Hesap menüsü
      </span>
      <select
        ref={ref}
        defaultValue={active}
        className="account-topnav-select"
        onChange={(e) => {
          const target = ACCOUNT_NAV.find((i) => i.key === e.target.value);
          if (target) router.push(target.href);
        }}
      >
        {ACCOUNT_NAV.map((i) => (
          <option key={i.key} value={i.key}>
            {i.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function formatJoinDate(iso: string | undefined | null): string {
  if (!iso) return "-";
  try {
    return new Intl.DateTimeFormat("tr-TR", {
      month: "short",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return "-";
  }
}
