import type { ReactNode } from "react";

import Link from "@/components/link";
import type { PublicCustomer } from "@/lib/customer/store";

import { logoutAction } from "@/app/uye/actions";
import { AccountSidebar, AccountTopNav } from "./account-nav";

/**
 * The member area's frame. A band rail runs down the left edge under the
 * site's bar: the title, who is signed in, the menu, the way out. The
 * pages fill the white beside it to the right gutter. Under 1024px the
 * rail lies across the top and its menu is a strip of tabs.
 */
export function AccountShell({
  customer,
  active,
  children,
}: {
  customer: PublicCustomer;
  active: AccountSection;
  children: ReactNode;
}) {
  return (
    <div className="account-shell">
      <div className="account-shell-rail">
        <div className="account-shell-rail-inner">
          <header className="account-shell-header">
            <div className="account-shell-id">
              <h1 className="account-shell-title">Hesabım</h1>
              <p className="account-shell-hello">
                Merhaba {customer.name || customer.email}.
              </p>
            </div>
            <form action={logoutAction} className="account-shell-logout">
              <button type="submit" className="link-u">
                Çıkış yap
              </button>
            </form>
          </header>
          <div className="account-shell-sidebar">
            <AccountSidebar active={active} customer={customer} />
          </div>
          <div className="account-shell-mobilenav">
            <AccountTopNav active={active} />
          </div>
        </div>
      </div>
      <div className="account-shell-content">{children}</div>
    </div>
  );
}

export type AccountSection =
  | "dashboard"
  | "bilgilerim"
  | "siparislerim"
  | "adreslerim"
  | "kartlarim"
  | "favorilerim"
  | "promosyonlar"
  | "bildirimler"
  | "sifre"
  | "sil"
  | "karaoke";

export interface AccountNavItem {
  key: AccountSection;
  href: string;
  label: string;
}

export const ACCOUNT_NAV: AccountNavItem[] = [
  { key: "dashboard", href: "/uye/hesap", label: "Özet" },
  {
    key: "siparislerim",
    href: "/uye/hesap/siparislerim",
    label: "Siparişlerim",
  },
  {
    key: "karaoke",
    href: "/uye/hesap/karaoke",
    label: "Karaoke rezervasyonlarım",
  },
  {
    key: "adreslerim",
    href: "/uye/hesap/adreslerim",
    label: "Adreslerim",
  },
  {
    key: "kartlarim",
    href: "/uye/hesap/kartlarim",
    label: "Kayıtlı kartlarım",
  },
  {
    key: "favorilerim",
    href: "/uye/hesap/favorilerim",
    label: "Favorilerim",
  },
  {
    key: "promosyonlar",
    href: "/uye/hesap/promosyonlar",
    label: "Promosyonlar",
  },
  {
    key: "bilgilerim",
    href: "/uye/hesap/bilgilerim",
    label: "Bilgilerim",
  },
  {
    key: "bildirimler",
    href: "/uye/hesap/bildirimler",
    label: "Bildirim tercihleri",
  },
  {
    key: "sifre",
    href: "/uye/hesap/sifre",
    label: "Şifre",
  },
  // "Hesabı sil" is no longer in this list (operator, 26 Eyl 2026): it lives
  // at the foot of Bilgilerim, still one click from the account, which keeps
  // the way out the membership agreement §14 and the stores require.
];

/**
 * One panel of the member area: a band block with its title over the
 * content. `layout="split"` is for the forms: from a wide enough page the
 * title stands beside the fields instead of over them, so a form does not
 * stretch across the whole panel.
 */
export function AccountCard({
  title,
  hint,
  action,
  layout = "stack",
  children,
}: {
  title?: string;
  hint?: string;
  action?: ReactNode;
  layout?: "stack" | "split";
  children: ReactNode;
}) {
  return (
    <section
      className={
        layout === "split" ? "account-card account-card--split" : "account-card"
      }
    >
      {(title || action) && (
        <header className="account-card-head">
          <div>
            {title && <h2 className="h3">{title}</h2>}
            {hint && <p className="account-card-hint">{hint}</p>}
          </div>
          {action && <div className="account-card-action">{action}</div>}
        </header>
      )}
      <div className="account-card-body">{children}</div>
    </section>
  );
}

/**
 * Two columns of panels side by side once the page is wide enough, one
 * column under it. `even` gives both the same width; otherwise the first
 * is the wider, main one.
 */
export function AccountCols({
  even,
  children,
}: {
  even?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={even ? "account-cols account-cols--even" : "account-cols"}>
      {children}
    </div>
  );
}

export function AccountCol({ children }: { children: ReactNode }) {
  return <div className="account-col">{children}</div>;
}

/** The way back from a detail page to its list. */
export function AccountBack({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="account-back">
      ← {label}
    </Link>
  );
}

export function AccountStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="account-stat">
      <div className="account-stat-label">{label}</div>
      <div className="account-stat-value">{value}</div>
      {hint && <div className="account-stat-hint">{hint}</div>}
    </div>
  );
}

/** An empty list in the account: a title, a hint, one action. */
export function EmptyState({
  title,
  hint,
  cta,
}: {
  title: string;
  hint?: ReactNode;
  cta?: ReactNode;
}) {
  return (
    <div className="account-empty">
      <div className="account-empty-title">{title}</div>
      {hint && <p className="account-empty-hint">{hint}</p>}
      {cta && <div className="account-empty-cta">{cta}</div>}
    </div>
  );
}
