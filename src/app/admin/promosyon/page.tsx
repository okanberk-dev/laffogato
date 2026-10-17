import Link from "next/link";

import { ActionButton } from "@/components/admin/action-form";
import {
  Card,
  PageHeader,
  formatDateTime,
  formatTRY,
} from "@/components/admin/forms";
import {
  ActionMenu,
  ActionMenuLink,
  ActionMenuSeparator,
  Badge,
  ConfirmButton,
  DataTable,
  EmptyState,
} from "@/components/admin/ui";
import { requireRole } from "@/lib/admin/auth";
import { parsePublishInstant } from "@/lib/admin/publish-window";
import { listPromos, type AdminPromo } from "@/lib/admin/store";
import type { AdminTone } from "@/lib/admin/tone";

import { deletePromoAction, setPromoActiveAction } from "./actions";

export const metadata = { title: "Admin · Promosyon Kodları" };
export const dynamic = "force-dynamic";

/** Same reading as applyPromoCode: offsetless = Istanbul; unreadable = over. */
function isPromoExpired(expiresAt: string): boolean {
  if (!expiresAt) return false;
  const at = parsePublishInstant(expiresAt);
  return at === null || at < Date.now();
}

function discountLabel(p: { kind: "pct" | "fixed"; value: number }): string {
  return p.kind === "pct" ? `%${p.value}` : `−${formatTRY(p.value)}`;
}

function promoState(p: AdminPromo): { label: string; tone: AdminTone } {
  if (!p.isActive) return { label: "Pasif", tone: "neutral" };
  if (isPromoExpired(p.expiresAt)) {
    return { label: "Süresi dolmuş", tone: "danger" };
  }
  if (p.usageLimit > 0 && p.usageCount >= p.usageLimit) {
    return { label: "Limit doldu", tone: "warning" };
  }
  return { label: "Aktif", tone: "success" };
}

const MONO = { fontFamily: "var(--mono), monospace" } as const;

/** Aktif / Pasif in one click, right in the row; the answer as a toast. */
function ActiveToggle({ promo }: { promo: AdminPromo }) {
  return (
    <ActionButton
      action={setPromoActiveAction}
      hidden={{ id: promo.id, isActive: promo.isActive ? "false" : "true" }}
      pendingLabel="Kaydediliyor…"
      ariaLabel={`${promo.isActive ? "Pasife al" : "Aktifleştir"}: ${promo.code}`}
      title={
        promo.isActive
          ? "Kodu durdur: sepette kabul edilmez"
          : "Kodu yeniden sepete aç"
      }
    >
      {promo.isActive ? "Pasife al" : "Aktifleştir"}
    </ActionButton>
  );
}

export default async function PromoCodesPage() {
  await requireRole("promos");
  const promos = await listPromos();

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Pazarlama"
        title="Promosyon Kodları"
        description="Sepette uygulanan indirim kodları. Yüzde veya sabit tutar, minimum sepet, kullanım limiti ve son geçerlilik desteklenir."
        action={
          <Link
            href="/admin/promosyon/yeni"
            className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--admin-primary)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--admin-primary-hover)] sm:w-auto"
          >
            + Yeni kod
          </Link>
        }
      />

      {promos.length === 0 ? (
        <Card>
          <EmptyState
            title="Henüz promosyon kodu yok."
            description="“+ Yeni kod” ile ekle."
          />
        </Card>
      ) : (
        <DataTable
          caption="Promosyon kodları"
          rows={promos}
          rowKey={(p) => p.id}
          rowHref={(p) => `/admin/promosyon/${p.id}/duzenle`}
          rowClassName={(p) => !p.isActive && "opacity-70"}
          columns={[
            {
              key: "code",
              header: "Kod",
              cell: (p) => <span style={MONO}>{p.code}</span>,
            },
            {
              key: "discount",
              header: "İndirim",
              cell: (p) => <span style={MONO}>{discountLabel(p)}</span>,
            },
            {
              key: "min",
              header: "Min. sepet",
              align: "right",
              cell: (p) => (
                <span style={MONO}>
                  {p.minSubtotalMinor > 0 ? formatTRY(p.minSubtotalMinor) : "-"}
                </span>
              ),
            },
            {
              key: "usage",
              header: "Kullanım",
              align: "right",
              cell: (p) => (
                <span style={MONO}>
                  {p.usageCount}
                  {p.usageLimit > 0 ? `/${p.usageLimit}` : ""}
                </span>
              ),
            },
            {
              key: "expires",
              header: "Geçerlilik",
              cell: (p) => (
                <span className="text-xs" style={MONO}>
                  {p.expiresAt ? formatDateTime(p.expiresAt) : "Süresiz"}
                </span>
              ),
            },
            {
              key: "state",
              header: "Durum",
              cell: (p) => {
                const st = promoState(p);
                return <Badge tone={st.tone}>{st.label}</Badge>;
              },
            },
          ]}
          rowActions={(p) => (
            <div className="flex items-center justify-end gap-2">
              <ActiveToggle promo={p} />
              <ActionMenu label={`${p.code} işlemleri`}>
                <ActionMenuLink href={`/admin/promosyon/${p.id}/duzenle`}>
                  Düzenle
                </ActionMenuLink>
                <ActionMenuSeparator />
                <ConfirmButton
                  action={deletePromoAction}
                  hidden={{ id: p.id }}
                  label="Sil"
                  variant="menuDanger"
                  title={`${p.code} silinsin mi?`}
                  description="Kod kalıcı olarak silinir; daha önce kullanıldığı siparişlerdeki kayıt kalır. Yalnız durdurmak istiyorsan pasife al."
                />
              </ActionMenu>
            </div>
          )}
        />
      )}
    </main>
  );
}
