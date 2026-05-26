import Link from "next/link";

import { requireCustomer } from "@/lib/customer/auth";
import { customerOrdersByEmail } from "@/lib/admin/store";

import { logoutAction } from "../actions";
import { ProfileForm } from "./profile-form";

export const metadata = { title: "Hesabım · L'Affogato" };
export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  pending_payment: "Ödeme bekleniyor",
  paid: "Ödendi",
  preparing: "Hazırlanıyor",
  shipped: "Kargoda",
  completed: "Tamamlandı",
  cancelled: "İptal",
  refunded: "İade",
};

const STATUS_TONE: Record<string, string> = {
  pending_payment: "background:#fef3c7;color:#92400e",
  paid: "background:#dbeafe;color:#1e40af",
  preparing: "background:#ede9fe;color:#5b21b6",
  shipped: "background:#e0e7ff;color:#3730a3",
  completed: "background:#d1fae5;color:#065f46",
  cancelled: "background:#f3f4f6;color:#6b7280",
  refunded: "background:#fee2e2;color:#991b1b",
};

function formatTRY(minor: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
  }).format(minor / 100);
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export default async function HesapPage() {
  const customer = await requireCustomer();
  const orders = await customerOrdersByEmail(customer.email);

  return (
    <main
      style={{
        maxWidth: 900,
        margin: "0 auto",
        padding: "clamp(40px, 6vw, 80px) var(--gutter) clamp(60px, 8vw, 100px)",
      }}
    >
      <header
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 16,
          marginBottom: 32,
        }}
      >
        <div>
          <Link href="/" className="eyebrow" style={{ display: "inline-block", marginBottom: 14 }}>
            ← Anasayfa
          </Link>
          <h1 className="h-1" style={{ fontSize: "clamp(36px, 6vw, 64px)" }}>
            Hesabım<span className="script">.</span>
          </h1>
          <p style={{ marginTop: 8, color: "var(--ink-soft)" }}>
            Merhaba {customer.name || customer.email}.
          </p>
        </div>
        <form action={logoutAction}>
          <button type="submit" className="btn btn-ghost btn-sm">
            Çıkış yap
          </button>
        </form>
      </header>

      <section
        style={{
          background: "#FFF",
          border: "1px solid var(--ink-line)",
          borderRadius: "var(--r-lg)",
          padding: "clamp(22px, 4vw, 32px)",
          marginBottom: 32,
        }}
      >
        <h2 className="h-3" style={{ marginBottom: 18 }}>
          Bilgilerim
        </h2>
        <ProfileForm
          defaultName={customer.name}
          defaultPhone={customer.phone}
          email={customer.email}
        />
      </section>

      <section
        style={{
          background: "#FFF",
          border: "1px solid var(--ink-line)",
          borderRadius: "var(--r-lg)",
          padding: "clamp(22px, 4vw, 32px)",
        }}
      >
        <h2 className="h-3" style={{ marginBottom: 18 }}>
          Sipariş geçmişim
        </h2>
        {orders.length === 0 ? (
          <p style={{ color: "var(--ink-soft)", fontSize: 14 }}>
            Henüz siparişin yok. Mağazaya göz at —{" "}
            <Link
              href="/#shop"
              style={{ color: "var(--gold-deep)", textDecoration: "underline", textUnderlineOffset: 3 }}
            >
              alışverişe başla →
            </Link>
          </p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 14 }}>
            {orders.map((o) => {
              const itemText = o.items
                .map((it) => `${it.qty}× ${it.productName}`)
                .join(", ");
              return (
                <li
                  key={o.id}
                  style={{
                    border: "1px solid var(--ink-line)",
                    borderRadius: "var(--r-md)",
                    padding: 18,
                    display: "grid",
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      gap: 8,
                    }}
                  >
                    <div style={{ fontFamily: "var(--mono)", fontSize: 13 }}>
                      #{o.orderNo}
                    </div>
                    <span
                      style={
                        {
                          padding: "3px 10px",
                          borderRadius: 999,
                          fontFamily: "var(--mono)",
                          fontSize: 10,
                          letterSpacing: "0.18em",
                          textTransform: "uppercase",
                        } as React.CSSProperties
                      }
                      data-style={STATUS_TONE[o.status]}
                      // Inline-css fallback for the lookup (since style attr can't accept string)
                    >
                      <span style={parseInlineStyle(STATUS_TONE[o.status] ?? "")}>
                        {STATUS_LABEL[o.status] ?? o.status}
                      </span>
                    </span>
                  </div>
                  <div style={{ fontSize: 14, color: "var(--ink-soft)" }}>{itemText}</div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontFamily: "var(--mono)",
                      fontSize: 12,
                      color: "var(--ink-mute)",
                    }}
                  >
                    <span>{formatDate(o.createdAt)}</span>
                    <span>{formatTRY(o.totalMinor)}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}

function parseInlineStyle(s: string): React.CSSProperties {
  const out: Record<string, string> = {};
  for (const part of s.split(";")) {
    const [k, v] = part.split(":").map((x) => x.trim());
    if (!k || !v) continue;
    const camel = k.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    out[camel] = v;
  }
  return out as React.CSSProperties;
}
