import type { ReactNode } from "react";

import Link from "@/components/link";
import type { PublicCustomer } from "@/lib/customer/store";

import { logoutAction } from "@/app/uye/actions";
import {
  Illustration,
  type IllustrationName,
} from "@/components/laffogato/illustration";
import { cx } from "@/components/laffogato/cx";
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

/**
 * An empty list in the account. With `art` it leads with the list's own
 * drawing - a café receipt, the app's spot plates (open envelope, empty
 * plate, coupon), the karaoke room - instead of the generic "✻".
 */
export function EmptyState({
  title,
  hint,
  cta,
  art,
}: {
  title: string;
  hint?: ReactNode;
  cta?: ReactNode;
  art?: IllustrationName;
}) {
  return (
    <div className="account-empty">
      {art ? (
        <Illustration
          name={art}
          width={96}
          sizes="96px"
          className={cx(
            "account-empty-art",
            art === "karaoke-room" && "is-picture",
          )}
        />
      ) : (
        <div className="account-empty-icon" aria-hidden="true">
          ✻
        </div>
      )}
      <div className="account-empty-title">{title}</div>
      {hint && <p className="account-empty-hint">{hint}</p>}
      {cta && <div style={{ marginTop: 14 }}>{cta}</div>}
    </div>
  );
}
