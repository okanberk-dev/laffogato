import {
  Card,
  DangerButton,
  PageHeader,
  Select,
  formatDateTime,
} from "@/components/admin/forms";
import { requireRole } from "@/lib/admin/auth";
import {
  listFranchiseApplications,
  FRANCHISE_STATUSES,
  type FranchiseStatus,
} from "@/lib/franchise/store";

import {
  deleteFranchiseApplicationAction,
  setFranchiseStatusAction,
} from "./actions";

export const metadata = { title: "Admin · Franchise Başvuruları" };
export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<FranchiseStatus, string> = {
  new: "Yeni",
  contacted: "İletişime geçildi",
  qualified: "Uygun",
  rejected: "Reddedildi",
  closed: "Kapandı",
};

const STATUS_TONE: Record<FranchiseStatus, string> = {
  new: "bg-amber-50 text-amber-700",
  contacted: "bg-blue-50 text-blue-700",
  qualified: "bg-green-50 text-green-700",
  rejected: "bg-rose-50 text-rose-700",
  closed: "bg-neutral-100 text-neutral-500",
};

export default async function FranchiseApplicationsPage() {
  await requireRole("leads");
  const apps = await listFranchiseApplications();
  const newCount = apps.filter((a) => a.status === "new").length;

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Satış · Lead"
        title="Franchise Başvuruları"
        description="Franchise sayfasındaki formdan gelen başvurular. Durumu güncelleyerek pipeline'ı takip edebilirsin."
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Toplam başvuru" value={String(apps.length)} />
        <Stat label="Yeni" value={String(newCount)} />
        <Stat
          label="Uygun"
          value={String(apps.filter((a) => a.status === "qualified").length)}
        />
      </div>

      {apps.length === 0 ? (
        <Card>
          <p className="text-sm text-neutral-500">Henüz başvuru yok.</p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {apps.map((a) => (
            <Card key={a.id} className="grid gap-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-medium text-neutral-900">
                      {a.name || "—"}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] tracking-[0.18em] uppercase ${STATUS_TONE[a.status]}`}
                    >
                      {STATUS_LABEL[a.status]}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-neutral-600">
                    {a.city || "—"}
                    {a.experience ? ` · Deneyim: ${a.experience}` : ""}
                    {a.budget ? ` · Bütçe: ${a.budget}` : ""}
                    {a.package ? ` · Paket: ${a.package}` : ""}
                  </div>
                </div>
                <div
                  className="shrink-0 text-right text-[10px] text-neutral-500"
                  style={{ fontFamily: "var(--mono), monospace" }}
                >
                  {formatDateTime(a.createdAt)}
                </div>
              </div>

              <div className="grid gap-1 text-sm text-neutral-700 sm:grid-cols-2">
                <div>
                  <a href={`mailto:${a.email}`} className="hover:underline">
                    {a.email || "—"}
                  </a>
                </div>
                <div>
                  {a.phone ? (
                    <a
                      href={`tel:${a.phone.replace(/\s/g, "")}`}
                      className="hover:underline"
                    >
                      {a.phone}
                    </a>
                  ) : (
                    "—"
                  )}
                </div>
              </div>

              {a.message && (
                <p className="rounded-lg border border-neutral-100 bg-neutral-50 p-3 text-sm whitespace-pre-line text-neutral-700">
                  {a.message}
                </p>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2">
                <form
                  action={setFranchiseStatusAction}
                  className="flex items-center gap-2"
                >
                  <input type="hidden" name="id" value={a.id} />
                  <Select
                    name="status"
                    defaultValue={a.status}
                    className="w-auto"
                  >
                    {FRANCHISE_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </option>
                    ))}
                  </Select>
                  <button
                    type="submit"
                    className="rounded-xl bg-[var(--admin-primary)] px-4 py-2 text-xs font-medium text-white hover:bg-[var(--admin-primary-hover)]"
                  >
                    Durumu güncelle
                  </button>
                </form>
                <form action={deleteFranchiseApplicationAction}>
                  <input type="hidden" name="id" value={a.id} />
                  <DangerButton type="submit" className="text-xs">
                    Sil
                  </DangerButton>
                </form>
              </div>
            </Card>
          ))}
        </div>
      )}
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
