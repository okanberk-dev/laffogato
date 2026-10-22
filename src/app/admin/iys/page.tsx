import { DashboardNotice } from "@/components/admin/dashboard/notice";
import { PageHeader, TextInput } from "@/components/admin/forms";
import {
  ActionModal,
  Badge,
  ConfirmButton,
  DataTable,
  EmptyState,
  KeyValueGrid,
  NUMERIC_STYLE,
  PageShell,
  Section,
} from "@/components/admin/ui";
import { requireRole } from "@/lib/admin/auth";
import {
  IYS_SOURCE_LABELS,
  IYS_STATE_LABELS,
  iysConsentDateFormat,
  iysDueLabel,
  iysDueTone,
  istanbulDateTimeLabel,
  maskIysEmail,
  type IysSource,
} from "@/lib/iys/iys-core";
import {
  iysCheckNow,
  iysCounts,
  listOpenIysEvents,
  listSettledIysEvents,
  reconcileIys,
  type IysEvent,
} from "@/lib/iys/store";

import {
  attestIysCheckAction,
  importIysListAction,
  rejectIysEventAction,
  settleIysExportAction,
} from "./actions";
import { IysExportButton } from "./export-button";

export const metadata = { title: "Admin · İYS" };
export const dynamic = "force-dynamic";

const DUE_INK = {
  overdue: "text-[var(--admin-danger-ink)] font-medium",
  soon: "text-[var(--admin-warning)] font-medium",
  ok: "text-[var(--admin-text-soft)]",
} as const;

function sourceLabel(source: string): string {
  return IYS_SOURCE_LABELS[source as IysSource] ?? source;
}

/** Masked by default; the full address opens on the row itself. */
function Recipient({ email }: { email: string }) {
  return (
    <details className="min-w-0">
      <summary className="cursor-pointer [overflow-wrap:anywhere]">
        {maskIysEmail(email)}
      </summary>
      <span
        className="mt-1 block text-xs [overflow-wrap:anywhere] text-[var(--admin-text-soft)]"
        style={NUMERIC_STYLE}
      >
        {email}
      </span>
    </details>
  );
}

function StatusBadge({ e }: { e: IysEvent }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <Badge tone={e.status === "ONAY" ? "success" : "warning"} dot>
        {e.status}
      </Badge>
      {e.legacy ? <Badge tone="neutral">Eski onay</Badge> : null}
    </span>
  );
}

function Due({ e, now }: { e: IysEvent; now: Date }) {
  const tone = iysDueTone(e.dueAt, now);
  return (
    <span className={`text-xs whitespace-nowrap ${DUE_INK[tone]}`}>
      {iysDueLabel(e.dueAt, now)}
      <span className="block font-normal text-[var(--admin-text-soft)]">
        {e.dueAt ? istanbulDateTimeLabel(e.dueAt) : ""}
      </span>
    </span>
  );
}

function RejectEvent({ e }: { e: IysEvent }) {
  return (
    <ActionModal
      action={rejectIysEventAction}
      hidden={{ id: e.id }}
      title="İYS bu kaydı reddetti mi?"
      description={
        e.status === "ONAY"
          ? "Reddedilen onay İYS'de kayıtlı sayılmaz: bu adres, kişi sitede ya da uygulamada yeniden onay verene kadar kampanya almaz."
          : "Ret kaydı İYS'ye işlenemedi. Adres bizde zaten kapalı; İYS'deki durumu İYS Web'den kontrol et."
      }
      trigger="İYS reddetti"
      triggerVariant="ghost"
      ariaLabel={`İYS reddetti: ${maskIysEmail(e.email)} ${e.status}`}
      submitLabel="Reddedildi olarak kaydet"
      size="sm"
    >
      <label className="grid gap-1 text-sm text-[var(--admin-text)]">
        İYS hata kodu ya da not (isteğe bağlı)
        <TextInput name="note" maxLength={300} placeholder="Örn. H467" />
      </label>
    </ActionModal>
  );
}

/** The open events of one downloaded file, with its "İYS'ye yüklendi". */
function ExportBatch({ id, events }: { id: string; events: IysEvent[] }) {
  const onay = events.filter((e) => e.status === "ONAY").length;
  const ret = events.length - onay;
  const at = events[0]?.exportedAt ?? "";
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[var(--admin-surface)] px-4 py-3">
      <span className="min-w-0 text-sm text-[var(--admin-text)]">
        <span className="block font-medium" style={NUMERIC_STYLE}>
          {id}.csv
        </span>
        <span className="text-xs text-[var(--admin-text-soft)]">
          {at ? `${istanbulDateTimeLabel(at)} indirildi · ` : ""}
          {onay} ONAY, {ret} RET
        </span>
      </span>
      <ConfirmButton
        action={settleIysExportAction}
        hidden={{ exportId: id }}
        label="İYS'ye yüklendi"
        variant="primary"
        title="Bu dosya İYS Web'e yüklendi mi?"
        description={`Dosyadaki ${events.length} kayıt İYS'de kayıtlı sayılır; onaylar kampanya kitlesine girer. İYS bazı satırları reddettiyse önce o satırlarda "İYS reddetti" de, sonra bunu onayla.`}
        confirmLabel="Yüklendi"
      />
    </li>
  );
}

/**
 * /admin/iys: the İYS (İleti Yönetim Sistemi) outbox. The law gives three
 * business days to register a consent obtained here in İYS and to report a
 * refusal to it, and the site may mail only consents İYS holds. Without an
 * integrator the transport is manual: this page says what to upload and by
 * when, hands over the file, and takes the confirmation and İYS's own list
 * back. docs/IYS.md is the operator's runbook.
 *
 * The outbox is reconciled on every view, so what is listed is what the
 * consent stores say now.
 */
export default async function IysPage() {
  await requireRole("newsletter");
  const now = new Date();
  let reconcileFailed = false;
  try {
    await reconcileIys(now);
  } catch (err) {
    reconcileFailed = true;
    console.error(
      "[admin/iys] eşitleme yapılamadı",
      err instanceof Error ? err.message.replace(/\S+@\S+/g, "***") : "",
    );
  }
  const [open, settled, counts, check] = await Promise.all([
    listOpenIysEvents(),
    listSettledIysEvents(30),
    iysCounts(),
    iysCheckNow(now),
  ]);

  const pendingOnay = open.filter((e) => e.status === "ONAY").length;
  const pendingRet = open.length - pendingOnay;
  const overdue = open.filter((e) => iysDueTone(e.dueAt, now) === "overdue");
  const soon = open.filter((e) => iysDueTone(e.dueAt, now) === "soon");
  const legacy = open.filter((e) => e.legacy).length;
  const next = open.find((e) => iysDueTone(e.dueAt, now) !== "overdue");
  const batches = new Map<string, IysEvent[]>();
  for (const e of open) {
    if (e.state !== "exported" || !e.exportId) continue;
    batches.set(e.exportId, [...(batches.get(e.exportId) ?? []), e]);
  }
  const state = check.state;
  const checkHow =
    state.lastCheckKind === "import"
      ? "İYS izin listesi yüklendi"
      : state.lastCheckKind === "attest"
        ? "Elle kontrol edildi"
        : "";

  return (
    <PageShell width="list">
      <PageHeader
        title="İYS"
        description="Ticari e-posta onaylarının ve retlerinin İleti Yönetim Sistemi'ne kaydı."
        help={
          <>
            <p>
              Kural: sitede ya da uygulamada alınan her ticari e-posta onayı 3
              iş günü içinde İYS&apos;ye kaydedilir; kaydedilmeyen onaya
              dayanılarak ileti gönderilmez. Bize ulaşan ret anında uygulanır ve
              3 iş günü içinde İYS&apos;ye bildirilir. Kişi İYS&apos;den de ret
              verebilir: bu yüzden her kampanyadan önce İYS&apos;deki retler
              kontrol edilmiş olmalı (son 3 iş günü içinde).
            </p>
            <p className="mt-2">
              Site bunları kendisi zorlar: İYS&apos;de kayıtlı olmayan adrese
              kampanya ve doğum günü e-postası gitmez; son İYS kontrolü 3 iş
              gününden eskiyse hiç ticari e-posta gitmez (kuyruktaki kampanya
              bekler, doğum günü kuponu yine verilir). Sipariş, kargo ve parola
              e-postaları etkilenmez.
            </p>
            <p className="mt-2">
              İş günü temkinli sayılır: hafta sonu atlanır, resmî tatiller
              atlanmaz; son günümüz yasal son günden hep önce ya da aynı gün
              gelir.
            </p>
          </>
        }
      />

      {reconcileFailed ? (
        <DashboardNotice tone="warning">
          <strong>Liste şu an güncellenemedi.</strong> Aşağıdaki kayıtlar son
          başarılı eşitlemeden. Sayfayı biraz sonra yenile.
        </DashboardNotice>
      ) : null}
      {overdue.length > 0 ? (
        <DashboardNotice tone="danger">
          <strong>{overdue.length} kaydın 3 iş günlük süresi geçti.</strong>{" "}
          {legacy > 0
            ? `${legacy} tanesi bu özellikten önce verilmiş eski onaylar; İYS onları H467 ile reddedebilir. `
            : ""}
          Dosyayı indirip İYS Web&apos;e yükle.
        </DashboardNotice>
      ) : soon.length > 0 ? (
        <DashboardNotice tone="warning">
          <strong>{soon.length} kaydın süresi 1 iş günü içinde doluyor.</strong>{" "}
          Dosyayı indirip İYS Web&apos;e yükle.
        </DashboardNotice>
      ) : null}
      {!check.fresh ? (
        <DashboardNotice tone="warning">
          <strong>Ticari e-posta gönderimi kapalı.</strong>{" "}
          {check.lastCheckAt
            ? `Son İYS kontrolü ${istanbulDateTimeLabel(check.lastCheckAt)}; geçerliliği ${istanbulDateTimeLabel(check.expiresAt)} bitti.`
            : "İYS'deki retler hiç kontrol edilmedi."}{" "}
          İYS izin listesini yükle ya da İYS Web&apos;de yeni ret olmadığını
          kontrol edip aşağıdan onayla.
        </DashboardNotice>
      ) : null}

      <div className="grid gap-6">
        <Section title="Durum">
          <KeyValueGrid
            columns={3}
            items={[
              {
                label: "İYS'de kayıtlı onay",
                value: <span style={NUMERIC_STYLE}>{counts.registered}</span>,
                hint: "Kampanya yalnız bu adreslere gidebilir.",
              },
              {
                label: "Yüklenecek onay",
                value: <span style={NUMERIC_STYLE}>{pendingOnay}</span>,
                hint:
                  legacy > 0
                    ? `${legacy} eski onay (süresi baştan geçmiş)`
                    : undefined,
              },
              {
                label: "Yüklenecek ret",
                value: <span style={NUMERIC_STYLE}>{pendingRet}</span>,
              },
              {
                label: "Süresi geçen",
                value: (
                  <span
                    style={NUMERIC_STYLE}
                    className={
                      overdue.length > 0
                        ? "font-semibold text-[var(--admin-danger-ink)]"
                        : undefined
                    }
                  >
                    {overdue.length}
                  </span>
                ),
              },
              {
                label: "En yakın son gün",
                value: next ? istanbulDateTimeLabel(next.dueAt) : "",
                hint: next ? iysDueLabel(next.dueAt, now) : undefined,
              },
              {
                label: "İYS'nin reddettiği onay",
                value: <span style={NUMERIC_STYLE}>{counts.rejected}</span>,
                hint: "Kişi yeniden onay verene kadar kampanya almaz.",
              },
              {
                label: "Son İYS kontrolü",
                value: check.lastCheckAt
                  ? `${istanbulDateTimeLabel(check.lastCheckAt)} · ${checkHow}`
                  : "Hiç yapılmadı",
                hint: check.lastCheckAt
                  ? `${state.lastCheckBy} · ${
                      check.fresh
                        ? `geçerli: ${istanbulDateTimeLabel(check.expiresAt)} tarihine kadar`
                        : "süresi doldu"
                    }`
                  : "Kampanya göndermek için gerekli.",
                full: true,
              },
            ]}
          />
        </Section>

        <Section
          title="Yapılacaklar"
          description="Haftada en az iki kez (3 iş günü dolmadan) ve her kampanyadan önce."
        >
          <ol className="grid list-decimal gap-4 pl-5 text-sm text-[var(--admin-text)]">
            <li className="grid gap-2">
              <span>
                <strong>Dosyayı indir.</strong> Yüklenecek bütün onay ve retler
                ile daha önce indirilip onaylanmamış olanlar tek dosyaya girer.
              </span>
              <span>
                <IysExportButton count={open.length} />
              </span>
            </li>
            <li>
              <strong>İYS Web&apos;e yükle</strong> (hs.iys.org.tr → İzin
              Yönetimi → toplu izin yükleme). Dosyanın sütunları İYS&apos;nin
              kendi sırasında:{" "}
              <code style={NUMERIC_STYLE}>
                type, source, recipient, status, consentDate, recipientType
              </code>{" "}
              (EPOSTA, kaynak, e-posta, ONAY/RET, İstanbul saatiyle YYYY-AA-GG
              SS:DD:ss, BIREYSEL). İYS Web&apos;in yükleme şablonunun sütun
              adları buradan doğrulanamadı; farklıysa sütunları şablondakilerle
              eşleştir.
            </li>
            <li>
              <strong>Sonucu buraya işle.</strong> İYS&apos;nin reddettiği
              satırlarda (ör. H467: 3 iş gününden eski onay; H178: zaten
              kayıtlı, sorun değil, reddedilmiş sayma) &quot;İYS reddetti&quot;
              de, sonra dosyada &quot;İYS&apos;ye yüklendi&quot; de.
            </li>
            <li className="grid gap-2">
              <span>
                <strong>İYS&apos;deki retleri kontrol et.</strong> İYS
                Web&apos;den markanın e-posta izin listesini indirip yükle: yeni
                retler sitede hemen uygulanır (üyenin tercihleri ve bülten kaydı
                kapanır), İYS&apos;de görünen kayıtlar kayıtlı sayılır. Listeyi,
                bekleyen dosyayı yükledikten sonra indir. İndiremiyorsan İYS
                Web&apos;deki son değişikliklere bakıp yeni ret yoksa onayla.
                İkisi de 3 iş günü geçerli.
              </span>
              <span className="flex flex-wrap gap-2">
                <ActionModal
                  action={importIysListAction}
                  title="İYS izin listesini yükle"
                  description="İYS Web'den indirdiğin e-posta izin listesi, CSV olarak (en fazla 1 MB). Her satırda bir e-posta adresi ve ONAY ya da RET yazan bir hücre aranır, öteki sütunlar yok sayılır. RET satırları sitede hemen uygulanır; ONAY satırı kimse için yeni onay açmaz."
                  trigger="İYS izin listesini yükle"
                  triggerVariant="ghost"
                  submitLabel="Yükle ve uygula"
                >
                  <input
                    type="file"
                    name="file"
                    accept=".csv,.txt,text/csv"
                    required
                    className="block w-full text-sm text-[var(--admin-text)]"
                  />
                </ActionModal>
                <ConfirmButton
                  action={attestIysCheckAction}
                  label="İYS'yi kontrol ettim, yeni ret yok"
                  variant="ghost"
                  title="İYS'de sitede uygulanmamış bir ret yok mu?"
                  description="İYS Web'de markanın son izin değişikliklerine baktın ve sitede uygulanmamış bir RET görmedin. Bu beyan adınla kaydedilir ve 3 iş günü geçerli: bu sürede kampanya gönderilebilir."
                  confirmLabel="Kontrol ettim"
                />
              </span>
            </li>
          </ol>
          <p className="mt-4 text-xs text-[var(--admin-text-soft)]">
            &quot;Eski onay&quot;: bu özellik açılmadan önce verilmiş onaylar.
            İYS&apos;nin 3 iş günlük yükleme süresi geçmiş olduğu için İYS
            onları reddedebilir (H467). Reddedilen adres, kişi sitede ya da
            uygulamada yeniden onay verene kadar kampanya almaz; yeni onay yeni
            bir kayıtla gelir.
          </p>
        </Section>

        {batches.size > 0 ? (
          <Section
            title="İndirilen, onay bekleyen dosyalar"
            description="Yükledikten sonra onayla; onaylanana kadar bu onaylar kampanya almaz."
          >
            <ul className="grid gap-2">
              {[...batches].map(([id, events]) => (
                <ExportBatch key={id} id={id} events={events} />
              ))}
            </ul>
          </Section>
        ) : null}

        <Section
          title="İYS'ye bildirilecekler"
          description="Son günü en yakın olan üstte. Adres gizli; tam adres satırın içinde açılır."
          flush
        >
          <DataTable<IysEvent>
            caption="İYS'ye bildirilecek onay ve retler"
            rows={open}
            rowKey={(e) => e.id}
            empty={<EmptyState title="İYS'ye bildirilecek kayıt yok." />}
            columns={[
              {
                key: "alici",
                header: "Alıcı",
                className: "min-w-[12rem] max-w-[20rem]",
                cell: (e) => <Recipient email={e.email} />,
              },
              {
                key: "durum",
                header: "Durum",
                cell: (e) => <StatusBadge e={e} />,
              },
              {
                key: "kaynak",
                header: "Kaynak",
                hideBelow: "lg",
                cell: (e) => (
                  <span className="text-xs text-[var(--admin-text-soft)]">
                    {sourceLabel(e.source)}
                    <span className="block" style={NUMERIC_STYLE}>
                      {e.source}
                    </span>
                  </span>
                ),
              },
              {
                key: "tarih",
                header: "İzin tarihi (İYS)",
                hideBelow: "md",
                cell: (e) => (
                  <span
                    className="text-xs whitespace-nowrap text-[var(--admin-text-soft)]"
                    style={NUMERIC_STYLE}
                  >
                    {iysConsentDateFormat(e.consentDate)}
                  </span>
                ),
              },
              {
                key: "son",
                header: "Son gün",
                cell: (e) => <Due e={e} now={now} />,
              },
              {
                key: "asama",
                header: "Aşama",
                hideBelow: "md",
                cell: (e) => (
                  <Badge tone={e.state === "exported" ? "info" : "neutral"}>
                    {IYS_STATE_LABELS[e.state]}
                  </Badge>
                ),
              },
            ]}
            rowActions={(e) => <RejectEvent e={e} />}
            mobileCard={(e) => (
              <div className="flex flex-col gap-1.5">
                <Recipient email={e.email} />
                <StatusBadge e={e} />
                <span
                  className="text-xs text-[var(--admin-text-soft)]"
                  style={NUMERIC_STYLE}
                >
                  {e.source} · {iysConsentDateFormat(e.consentDate)} ·{" "}
                  {IYS_STATE_LABELS[e.state]}
                </span>
                <Due e={e} now={now} />
              </div>
            )}
          />
        </Section>

        {settled.length > 0 ? (
          <Section title="Son sonuçlananlar" flush>
            <DataTable<IysEvent>
              caption="Son sonuçlanan İYS kayıtları"
              rows={settled}
              rowKey={(e) => e.id}
              columns={[
                {
                  key: "alici",
                  header: "Alıcı",
                  className: "min-w-[12rem] max-w-[20rem]",
                  cell: (e) => <Recipient email={e.email} />,
                },
                {
                  key: "durum",
                  header: "Durum",
                  cell: (e) => <StatusBadge e={e} />,
                },
                {
                  key: "sonuc",
                  header: "Sonuç",
                  cell: (e) => (
                    <span className="text-xs text-[var(--admin-text-soft)]">
                      <Badge
                        tone={
                          e.state === "registered"
                            ? "success"
                            : e.state === "rejected"
                              ? "danger"
                              : "neutral"
                        }
                      >
                        {IYS_STATE_LABELS[e.state]}
                      </Badge>
                      {e.note ? <span className="block">{e.note}</span> : null}
                    </span>
                  ),
                },
                {
                  key: "ne-zaman",
                  header: "Ne zaman",
                  hideBelow: "md",
                  cell: (e) => (
                    <span className="text-xs whitespace-nowrap text-[var(--admin-text-soft)]">
                      {e.settledAt ? istanbulDateTimeLabel(e.settledAt) : ""}
                      <span className="block">
                        {e.settledBy === "system" ? "Sistem" : e.settledBy}
                      </span>
                    </span>
                  ),
                },
              ]}
            />
          </Section>
        ) : null}
      </div>
    </PageShell>
  );
}
