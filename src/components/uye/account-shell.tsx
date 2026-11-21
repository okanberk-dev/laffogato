import type { ReactNode } from "react";

import Link from "@/components/link";
import type { PublicCustomer } from "@/lib/customer/store";

import { logoutAction } from "@/app/uye/actions";
import { AccountSidebar, AccountTopNav } from "./account-nav";

export function AccountShell({
  customer,
  active,
  children,
}: {
  customer: PublicCustomer;
  active: AccountSection;
  children: ReactNode;
}) {
  const initials = (customer.name || customer.email)
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="account-shell">
      <div className="account-shell-wrap">
        <header className="account-shell-header">
          <Link
            href="/"
            className="eyebrow"
            style={{ display: "inline-block", marginBottom: 14 }}
          >
            ← Anasayfa
          </Link>
          <div className="account-shell-greeting">
            <div className="account-shell-avatar" aria-hidden="true">
              {initials || "L"}
            </div>
            <div>
              <h1 className="account-shell-title">Hesabım</h1>
              <p
                style={{
                  marginTop: 6,
                  color: "var(--ink-soft)",
                  fontSize: 14,
                }}
              >
                Merhaba {customer.name || customer.email}.
              </p>
            </div>
            <form action={logoutAction} style={{ marginLeft: "auto" }}>
              <button type="submit" className="btn btn-ghost btn-sm">
                Çıkış yap
              </button>
            </form>
          </div>
        </header>

        <div className="account-shell-body">
          <aside className="account-shell-sidebar">
            <AccountSidebar active={active} customer={customer} />
          </aside>
          <div className="account-shell-mobilenav">
            <AccountTopNav active={active} />
          </div>
          <section className="account-shell-content">{children}</section>
        </div>
      </div>
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
  hint: string;
}

export const ACCOUNT_NAV: AccountNavItem[] = [
  { key: "dashboard", href: "/uye/hesap", label: "Özet", hint: "Hesap panosu" },
  {
    key: "siparislerim",
    href: "/uye/hesap/siparislerim",
    label: "Siparişlerim",
    hint: "Geçmiş ve takip",
  },
  {
    key: "karaoke",
    href: "/uye/hesap/karaoke",
    label: "Karaoke rezervasyonlarım",
    hint: "Saatlerin ve iptal",
  },
  {
    key: "adreslerim",
    href: "/uye/hesap/adreslerim",
    label: "Adreslerim",
    hint: "Teslimat adresleri",
  },
  {
    key: "kartlarim",
    href: "/uye/hesap/kartlarim",
    label: "Kayıtlı kartlarım",
    hint: "PayNkolay'da saklı kartlar",
  },
  {
    key: "favorilerim",
    href: "/uye/hesap/favorilerim",
    label: "Favorilerim",
    hint: "Beğendiklerin",
  },
  {
    key: "promosyonlar",
    href: "/uye/hesap/promosyonlar",
    label: "Promosyonlar",
    hint: "Kullanılabilir kodlar",
  },
  {
    key: "bilgilerim",
    href: "/uye/hesap/bilgilerim",
    label: "Bilgilerim",
    hint: "Ad, telefon, doğum günü",
  },
  {
    key: "bildirimler",
    href: "/uye/hesap/bildirimler",
    label: "Bildirim tercihleri",
    hint: "E-posta + SMS",
  },
  {
    key: "sifre",
    href: "/uye/hesap/sifre",
    label: "Şifre",
    hint: "Şifre değiştir",
  },
  // "Hesabı sil" is no longer in this list (operator, 26 Eyl 2026): it lives
  // at the foot of Bilgilerim, still one click from the account, which keeps
  // the way out the membership agreement §14 and the stores require.
];

export function AccountCard({
  title,
  hint,
  action,
  children,
}: {
  title?: string;
  hint?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="account-card">
      {(title || action) && (
        <header className="account-card-head">
          <div>
            {title && <h2 className="h3">{title}</h2>}
            {hint && (
              <p
                style={{ marginTop: 4, fontSize: 13, color: "var(--ink-soft)" }}
              >
                {hint}
              </p>
            )}
          </div>
          {action && <div>{action}</div>}
        </header>
      )}
      <div className="account-card-body">{children}</div>
    </section>
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
      <div className="eyebrow" style={{ marginBottom: 6 }}>
        {label}
      </div>
      <div className="account-stat-value">{value}</div>
      {hint && (
        <div style={{ marginTop: 4, fontSize: 12, color: "var(--ink-mute)" }}>
          {hint}
        </div>
      )}
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
