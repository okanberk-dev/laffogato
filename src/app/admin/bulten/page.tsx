import {
  Card,
  DangerButton,
  GhostButton,
  PageHeader,
  formatDateTime,
} from "@/components/admin/forms";
import { requireRole } from "@/lib/admin/auth";
import { listNewsletterSubscribers } from "@/lib/newsletter/store";

import {
  deleteNewsletterSubscriberAction,
  deactivateNewsletterAction,
} from "./actions";

export const metadata = { title: "Admin · Bülten Aboneleri" };
export const dynamic = "force-dynamic";

const SOURCE_LABEL: Record<string, string> = {
  footer: "Footer",
  register: "Kayıt",
  account: "Hesap",
};

export default async function NewsletterPage() {
  await requireRole("newsletter");
  const subscribers = await listNewsletterSubscribers();
  const active = subscribers.filter((s) => s.isActive);
  const activeEmails = active.map((s) => s.email).join(", ");

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Pazarlama"
        title="Bülten Aboneleri"
        description="Footer, kayıt ve hesap tercihlerinden gelen aboneler. Pasif aboneler bülten gönderiminden çıkarılır."
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Toplam abone" value={String(subscribers.length)} />
        <Stat label="Aktif" value={String(active.length)} />
        <Stat
          label="Pasif"
          value={String(subscribers.length - active.length)}
        />
      </div>

      {active.length > 0 && (
        <Card className="mb-4">
          <h2
            className="mb-2 text-[10px] tracking-[0.22em] text-neutral-500 uppercase"
            style={{ fontFamily: "var(--mono), monospace" }}
          >
            Aktif e-postalar — dışa aktar (kopyala)
          </h2>
          <textarea
            readOnly
            defaultValue={activeEmails}
            rows={3}
            className="w-full rounded-md border border-[var(--admin-border)] bg-neutral-50 px-3 py-2 text-xs text-neutral-700"
            style={{ fontFamily: "var(--mono), monospace" }}
          />
        </Card>
      )}

      <Card>
        {subscribers.length === 0 ? (
          <p className="text-sm text-neutral-500">Henüz abone yok.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="border-b border-[var(--admin-border)] text-left text-[10px] tracking-[0.22em] text-neutral-500 uppercase"
                  style={{ fontFamily: "var(--mono), monospace" }}
                >
                  <th className="py-3 pr-3">E-posta</th>
                  <th className="pr-3">Kaynak</th>
                  <th className="pr-3">Durum</th>
                  <th className="pr-3">Tarih</th>
                  <th className="pr-3">Onay (6563)</th>
                  <th className="text-right">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {subscribers.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-neutral-100 align-top last:border-b-0"
                  >
                    <td className="py-3 pr-3 text-neutral-900">
                      {s.email}
                      {s.name && (
                        <div className="text-xs text-neutral-500">{s.name}</div>
                      )}
                    </td>
                    <td className="pr-3 text-xs text-neutral-600">
                      {SOURCE_LABEL[s.source] ?? s.source}
                    </td>
                    <td className="pr-3">
                      {s.isActive ? (
                        <span className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] tracking-[0.18em] text-green-700 uppercase">
                          Aktif
                        </span>
                      ) : s.confirmToken ? (
                        // Double opt-in: asked, not yet confirmed by the owner.
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] tracking-[0.18em] text-amber-700 uppercase">
                          Onay bekliyor
                        </span>
                      ) : (
                        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] tracking-[0.18em] text-neutral-500 uppercase">
                          Pasif
                        </span>
                      )}
                    </td>
                    <td
                      className="pr-3 text-xs text-neutral-500"
                      style={{ fontFamily: "var(--mono), monospace" }}
                    >
                      {formatDateTime(s.createdAt)}
                    </td>
                    {/* Onayın ne zaman ve nereden alındığı: şikâyet hâlinde
                        ispat yükümlülüğü bizde. */}
                    <td
                      className="pr-3 text-xs text-neutral-500"
                      style={{ fontFamily: "var(--mono), monospace" }}
                    >
                      {s.consentAt ? (
                        <span title={s.consentText}>
                          {formatDateTime(s.consentAt)}
                          {s.consentIp ? ` · ${s.consentIp}` : ""}
                        </span>
                      ) : (
                        <span className="text-amber-700">kayıt yok</span>
                      )}
                    </td>
                    <td className="text-right">
                      <div className="flex justify-end gap-2">
                        {/* Off only: re-subscribing is the person's own
                            act, confirmed from their inbox (6563). */}
                        {s.isActive ? (
                          <form action={deactivateNewsletterAction}>
                            <input type="hidden" name="id" value={s.id} />
                            <GhostButton type="submit" className="text-xs">
                              Pasifleştir
                            </GhostButton>
                          </form>
                        ) : null}
                        <form action={deleteNewsletterSubscriberAction}>
                          <input type="hidden" name="id" value={s.id} />
                          <DangerButton type="submit" className="text-xs">
                            Sil
                          </DangerButton>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--admin-border)] bg-white p-4 shadow-sm">
      <div
        className="text-[10px] tracking-[0.22em] text-neutral-500 uppercase"
        style={{ fontFamily: "var(--mono), monospace" }}
      >
        {label}
      </div>
      <div className="mt-1 text-xl text-neutral-900">{value}</div>
    </div>
  );
}
