import { parseCsv } from "@/lib/admin/csv";

/**
 * İYS (İleti Yönetim Sistemi) rules that need no database: pure, shared by
 * the store, the panel, the CSV route and the tests.
 *
 * The law (Ticari İletişim ve Ticari Elektronik İletiler Hakkında
 * Yönetmelik, as amended in 2020): a consent obtained outside İYS is
 * registered in İYS within three business days or it cannot be relied on; a
 * refusal that reaches us stops the mail and is reported to İYS within three
 * business days; a refusal made on İYS itself is honoured too.
 *
 * The transport is manual today (a sender under 250,000 addresses cannot
 * call the İYS API without a paid integrator): /admin/iys hands over a file
 * in İYS's own column order and the operator uploads it on İYS Web. An
 * event row carries exactly the fields of İYS's
 * `POST /sps/{iysCode}/brands/{brandCode}/consents` (`toIysConsentRequest`),
 * so an integrator adapter only posts the pending rows. docs/IYS.md.
 */

// ── Vocabulary ──────────────────────────────────────────────────────────────

/** İYS's `status`: an approval or a refusal (never "RED"). */
export type IysStatus = "ONAY" | "RET";

/**
 * İYS's `source` values (the official enum, plus HS_KARAR: a refusal the
 * sender decided itself, which İYS accepts for a RET but never for a first
 * ONAY). Only the four the map below uses are ever written.
 */
export const IYS_SOURCES = [
  "HS_2015",
  "HS_FIZIKSEL_ORTAM",
  "HS_ISLAK_IMZA",
  "HS_ETKINLIK",
  "HS_ATM",
  "HS_EORTAM",
  "HS_WEB",
  "HS_MOBIL",
  "HS_MESAJ",
  "HS_EPOSTA",
  "HS_CAGRI_MERKEZI",
  "HS_SOSYAL_MEDYA",
  "HS_KARAR",
] as const;
export type IysSource = (typeof IYS_SOURCES)[number];

/** Where an event is in the manual round trip. */
export type IysEventState =
  "pending" | "exported" | "registered" | "rejected" | "superseded";

/** Our channel: e-mail only. No SMS, no calls; app push is not an İYS channel. */
export const IYS_TYPE = "EPOSTA";
/** Our recipients are consumers. */
export const IYS_RECIPIENT_TYPE = "BIREYSEL";

/**
 * Where a consent or a refusal came from, as the SQL reconcile names it,
 * mapped to İYS's `source`. The keys are the consent ledger's sources
 * (`customer_consents.source`), plus:
 *   - `account-deletion/admin`: an account the team closed (ledger IP '');
 *   - `subscriber:<source>`: a bulletin row's own source (footer, register,
 *     account) when no ledger row says more;
 *   - `subscriber-link`: a bulletin row unsubscribed by its link;
 *   - `subscriber-panel`: a bulletin row the panel took off the list;
 *   - `deletion-request`: a member's request to close the account (web);
 *   - `unknown-grant` / `unknown-withdrawal`: nothing on record says more.
 *
 * Passed to `iys_reconcile` as `p_sources`, so this map is the rule's one
 * home. A refusal İYS itself reported (ledger source `iys`) produces no
 * event: the import already set the address's İYS status to RET. The entry
 * is there for the rare case İYS later shows ONAY again for an address we
 * switched off on its word; then the RET is our own decision.
 */
export const IYS_SOURCE_MAP = {
  "site-signup": "HS_WEB",
  "site-account": "HS_WEB",
  "app-signup": "HS_MOBIL",
  "app-account": "HS_MOBIL",
  "unsubscribe-link": "HS_EPOSTA",
  "newsletter-unsubscribe": "HS_EPOSTA",
  admin: "HS_KARAR",
  "account-deletion": "HS_MOBIL",
  "account-deletion/admin": "HS_KARAR",
  iys: "HS_KARAR",
  "subscriber:footer": "HS_WEB",
  "subscriber:register": "HS_WEB",
  "subscriber:account": "HS_WEB",
  "subscriber-link": "HS_EPOSTA",
  "subscriber-panel": "HS_KARAR",
  "deletion-request": "HS_WEB",
  "unknown-grant": "HS_WEB",
  "unknown-withdrawal": "HS_KARAR",
} as const satisfies Record<string, IysSource>;

export type IysSourceKey = keyof typeof IYS_SOURCE_MAP;

/** The İYS source for a key, `fallback` for an unknown one. */
export function iysSourceFor(
  key: string,
  fallback: IysSource = "HS_WEB",
): IysSource {
  return (IYS_SOURCE_MAP as Record<string, IysSource>)[key] ?? fallback;
}

export const IYS_SOURCE_LABELS: Record<IysSource, string> = {
  HS_2015: "2015 öncesi",
  HS_FIZIKSEL_ORTAM: "Fiziksel ortam",
  HS_ISLAK_IMZA: "Islak imza",
  HS_ETKINLIK: "Etkinlik",
  HS_ATM: "ATM",
  HS_EORTAM: "Elektronik ortam",
  HS_WEB: "Web sitesi",
  HS_MOBIL: "Mobil uygulama",
  HS_MESAJ: "Mesaj",
  HS_EPOSTA: "E-postadaki bağlantı",
  HS_CAGRI_MERKEZI: "Çağrı merkezi",
  HS_SOSYAL_MEDYA: "Sosyal medya",
  HS_KARAR: "Bizim kararımız",
};

export const IYS_STATE_LABELS: Record<IysEventState, string> = {
  pending: "Yüklenecek",
  exported: "Dosyada, onay bekliyor",
  registered: "İYS'de kayıtlı",
  rejected: "İYS reddetti",
  superseded: "Gerek kalmadı",
};

// ── Business days (Europe/Istanbul, conservative) ──────────────────────────

/** Türkiye keeps UTC+3 all year (CLAUDE.md rule 22). */
const ISTANBUL_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 86_400_000;

/** The legal window: three business days, for registration and refusal. */
export const IYS_BUSINESS_DAYS = 3;

/**
 * `iso` plus `days` business days, on the köşk's wall clock: step one day
 * at a time, count only Monday to Friday, keep the time of day. A Saturday
 * 10:00 consent is due Wednesday 10:00; a Friday 20:00 one, Wednesday 20:00.
 *
 * Conservative on purpose: public holidays are NOT skipped. A holiday only
 * lengthens the legal deadline, so ignoring holidays makes ours earlier or
 * equal, never later. The weekday is the Istanbul one: 01:30 on a Saturday
 * in Tuzla is still Friday in UTC, and counts as Saturday here.
 *
 * Mirrored in SQL by `iys_add_business_days`
 * (db/migrations/20261022180000_iys_consent_sync.sql); the integration test
 * holds the two together. '' for an unreadable instant.
 */
export function addIstanbulBusinessDays(iso: string, days: number): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  let wall = t + ISTANBUL_OFFSET_MS;
  let counted = 0;
  while (counted < days) {
    wall += DAY_MS;
    const weekday = new Date(wall).getUTCDay();
    if (weekday !== 0 && weekday !== 6) counted += 1;
  }
  return new Date(wall - ISTANBUL_OFFSET_MS).toISOString();
}

/** The deadline of an event dated `consentDate`. */
export function iysDueAt(consentDate: string): string {
  return addIstanbulBusinessDays(consentDate, IYS_BUSINESS_DAYS);
}

/**
 * `YYYY-MM-DD HH:mm:ss` on the köşk's clock: İYS's `consentDate` format
 * (GMT+3). Sending UTC here would date every consent three hours early.
 */
export function iysConsentDateFormat(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  return new Date(t + ISTANBUL_OFFSET_MS)
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");
}

// ── The refusal check's freshness ──────────────────────────────────────────

export interface IysCheckFreshness {
  /** A check was made and its three business days have not run out. */
  fresh: boolean;
  /** When the last check was, '' for never. */
  lastCheckAt: string;
  /** When it stops counting, '' for never checked. */
  expiresAt: string;
}

/**
 * A commercial send needs a recent İYS refusal check: an import of İYS's
 * consent list, or the operator's "İYS'de yeni ret yok", within the last
 * three business days (the same conservative count). A refusal made on İYS
 * right after a check is then applied at most three business days later.
 */
export function iysCheckFreshness(
  lastCheckAt: string,
  now: Date,
): IysCheckFreshness {
  const expiresAt = lastCheckAt
    ? addIstanbulBusinessDays(lastCheckAt, IYS_BUSINESS_DAYS)
    : "";
  return {
    fresh: expiresAt !== "" && now.getTime() < Date.parse(expiresAt),
    lastCheckAt,
    expiresAt,
  };
}

/** "22 Ekim 2026 14:05" on the köşk's clock. */
export function istanbulDateTimeLabel(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(t));
}

/**
 * Why a commercial send is refused while the check is stale: the sentence
 * the campaign page, the runner's `lastError` and the birthday log share.
 */
export function iysStaleMessage(check: IysCheckFreshness): string {
  const how =
    "Bülten → İYS sayfasında İYS izin listesini yükle ya da İYS'yi kontrol ettiğini onayla.";
  if (!check.lastCheckAt) {
    return `İYS ret kontrolü hiç yapılmadı. Ticari e-posta göndermeden önce son 3 iş günü içinde İYS'deki retler kontrol edilmiş olmalı. ${how}`;
  }
  return `İYS ret kontrolü güncel değil (son kontrol ${istanbulDateTimeLabel(check.lastCheckAt)}, geçerliliği ${istanbulDateTimeLabel(check.expiresAt)} bitti). Ticari e-posta göndermeden önce son 3 iş günü içinde İYS'deki retler kontrol edilmiş olmalı. ${how}`;
}

// ── Deadlines, for the panel ───────────────────────────────────────────────

export type IysDueTone = "overdue" | "soon" | "ok";

/**
 * How close a deadline is: past (`overdue`), within one business day
 * (`soon`), or further (`ok`).
 */
export function iysDueTone(dueAt: string, now: Date): IysDueTone {
  const due = Date.parse(dueAt);
  if (!Number.isFinite(due)) return "overdue";
  if (due <= now.getTime()) return "overdue";
  const soon = Date.parse(addIstanbulBusinessDays(now.toISOString(), 1));
  return due <= soon ? "soon" : "ok";
}

/** "2 gün 3 saat kaldı", "5 saat kaldı", "1 gün 2 saat gecikti". */
export function iysDueLabel(dueAt: string, now: Date): string {
  const due = Date.parse(dueAt);
  if (!Number.isFinite(due)) return "Son gün bilinmiyor";
  const diff = due - now.getTime();
  const abs = Math.abs(diff);
  const days = Math.floor(abs / DAY_MS);
  const hours = Math.floor((abs % DAY_MS) / 3_600_000);
  const minutes = Math.floor((abs % 3_600_000) / 60_000);
  const span =
    days > 0
      ? `${days} gün${hours > 0 ? ` ${hours} saat` : ""}`
      : hours > 0
        ? `${hours} saat`
        : `${Math.max(1, minutes)} dakika`;
  return diff > 0 ? `${span} kaldı` : `${span} gecikti`;
}

// ── Addresses ──────────────────────────────────────────────────────────────

// An apostrophe is valid inside an address (an O'Brien-style local part) and both
// the member and the bulletin validators accept it; only a leading one (a
// spreadsheet's text marker) is stripped before this test.
const EMAIL_RE = /^[^\s@,;"<>]+@[^\s@,;"<>]+\.[^\s@,;"<>]+$/;

/** Never registered: the placeholders of closed and test accounts. */
export function iysExcludedAddress(email: string): boolean {
  return /@(laffogato|anon)\.local$/i.test(email);
}

/** `ah***@<domain>`: enough to recognise a row, not to be one. */
export function maskIysEmail(address: string): string {
  const at = address.indexOf("@");
  if (at < 1) return "***";
  return `${address.slice(0, Math.min(2, at))}***${address.slice(at)}`;
}

// ── The file for İYS Web ───────────────────────────────────────────────────

/** İYS's own column order (its bulk-upload sample, data.csv). */
export const IYS_EXPORT_COLUMNS = [
  "type",
  "source",
  "recipient",
  "status",
  "consentDate",
  "recipientType",
] as const;

/** One event as İYS reads it. */
export interface IysExportEvent {
  email: string;
  status: IysStatus;
  source: string;
  consentDate: string;
}

/**
 * The body of İYS's `POST /sps/{iysCode}/brands/{brandCode}/consents`, the
 * same six fields as the file: what an integrator adapter would post.
 */
export function toIysConsentRequest(event: IysExportEvent): {
  type: string;
  source: string;
  recipient: string;
  status: IysStatus;
  consentDate: string;
  recipientType: string;
} {
  return {
    type: IYS_TYPE,
    source: event.source,
    recipient: event.email,
    status: event.status,
    consentDate: iysConsentDateFormat(event.consentDate),
    recipientType: IYS_RECIPIENT_TYPE,
  };
}

/**
 * One cell of the İYS file, quoted when it holds a comma, a quote or a line
 * break. Never prefixed: the shared csvField puts a ' before a cell that
 * starts with = + - @ (a spreadsheet guard), and İYS would read
 * `'+promo@<domain>` as the recipient, refusing the row or registering
 * a different address. Every other column is a fixed code or a date.
 */
function iysCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * The file: a header row, then one row per event, comma separated, CRLF,
 * no byte order mark, the consent date on the köşk's clock. Events are
 * written oldest consent first; a download holds at most one event per
 * address (iys_export_events), because İYS refuses a list with the same
 * address twice (H194). The recipient is written as it is (iysCell).
 */
export function iysExportCsv(events: readonly IysExportEvent[]): string {
  const sorted = [...events].sort(
    (a, b) =>
      a.consentDate.localeCompare(b.consentDate) ||
      a.email.localeCompare(b.email),
  );
  const rows = sorted.map((e) => {
    const r = toIysConsentRequest(e);
    return [
      r.type,
      r.source,
      r.recipient,
      r.status,
      r.consentDate,
      r.recipientType,
    ];
  });
  return `${[[...IYS_EXPORT_COLUMNS], ...rows]
    .map((row) => row.map(iysCell).join(","))
    .join("\r\n")}\r\n`;
}

/** `iys-20261022-1405-ab12.csv`: the batch id, on the köşk's clock. */
export function iysExportFileName(exportId: string): string {
  return `${exportId.replace(/[^A-Za-z0-9-]/g, "")}.csv`;
}

/** What a batch id looks like; anything else posted back is refused. */
export const IYS_EXPORT_ID_RE = /^iys-[0-9]{8}-[0-9]{4}-[0-9a-f]{4}$/;

/** A new batch id: `iys-YYYYMMDD-HHmm-xxxx` (Istanbul) plus 4 hex. */
export function newIysExportId(now: Date, random: string): string {
  const stamp = new Date(now.getTime() + ISTANBUL_OFFSET_MS)
    .toISOString()
    .slice(0, 16)
    .replace(/[-:]/g, "")
    .replace("T", "-");
  return `iys-${stamp.slice(0, 8)}-${stamp.slice(9)}-${random.slice(0, 4)}`;
}

// ── İYS's consent list, read tolerantly ────────────────────────────────────

/**
 * At most this many records in one import (the file itself is capped at
 * 1 MB by `readImportFile`, the product import's reader).
 */
export const IYS_IMPORT_MAX_ROWS = 50_000;

export interface IysListRow {
  /** File line the record starts on, from 1. */
  line: number;
  email: string;
  status: IysStatus;
}

export type IysListParse =
  | {
      ok: true;
      rows: IysListRow[];
      /** Records with no address or no ONAY / RET cell (headers, other channels). */
      skipped: number;
      /** Addresses listed more than once; a RET among them wins. */
      duplicates: number;
      /** Placeholder addresses (@laffogato.local, @anon.local), ignored. */
      excluded: number;
    }
  | { ok: false; error: string };

/**
 * Reads İYS's consent list without trusting its layout: İYS Web's export
 * template could not be verified from here, and its columns may move. Per
 * record, the first cell that looks like an e-mail address is the
 * recipient and the first cell that is exactly `ONAY` or `RET` (any case,
 * spaces trimmed) is the status; everything else is ignored. Cells may be
 * separated by commas, semicolons or tabs. A record missing either is
 * skipped (a header, a phone-number row of another channel). An address
 * listed twice keeps RET if any of its rows says RET: a refusal is never
 * lost to an older approval row.
 */
export function parseIysConsentList(text: string): IysListParse {
  const parsed = parseCsv(text);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  if (parsed.records.length > IYS_IMPORT_MAX_ROWS) {
    return {
      ok: false,
      error: `Dosyada en fazla ${IYS_IMPORT_MAX_ROWS} satır olabilir.`,
    };
  }
  const byEmail = new Map<string, IysListRow>();
  let skipped = 0;
  let duplicates = 0;
  let excluded = 0;
  for (const record of parsed.records) {
    const cells = record.cells
      .flatMap((c) => c.split("\t"))
      .map((c) =>
        c
          .trim()
          .replace(/^'+/, "")
          .replace(/^mailto:/i, ""),
      );
    const email = cells.find((c) => EMAIL_RE.test(c))?.toLowerCase();
    const statusCell = cells.find((c) => {
      const u = c.toUpperCase();
      return u === "ONAY" || u === "RET";
    });
    if (!email || !statusCell) {
      skipped += 1;
      continue;
    }
    if (iysExcludedAddress(email)) {
      excluded += 1;
      continue;
    }
    const status = statusCell.toUpperCase() as IysStatus;
    const seen = byEmail.get(email);
    if (seen) {
      duplicates += 1;
      if (status === "RET" && seen.status !== "RET") {
        byEmail.set(email, { line: record.line, email, status });
      }
      continue;
    }
    byEmail.set(email, { line: record.line, email, status });
  }
  return {
    ok: true,
    rows: [...byEmail.values()],
    skipped,
    duplicates,
    excluded,
  };
}

/** The counts an import reports, in one Turkish sentence. */
export function iysImportSentence(s: {
  onayListed: number;
  retListed: number;
  refusalsApplied: number;
  onayIgnored: number;
  registered: number;
  skipped: number;
}): string {
  const parts = [
    `${s.onayListed + s.retListed} adres okundu: ${s.onayListed} ONAY, ${s.retListed} RET.`,
  ];
  if (s.refusalsApplied > 0) {
    parts.push(
      `${s.refusalsApplied} adresin İYS'deki reddi sitede de uygulandı; bu adreslere ticari e-posta gitmez.`,
    );
  }
  if (s.registered > 0) {
    parts.push(`${s.registered} kayıt İYS'de görüldü ve kayıtlı sayıldı.`);
  }
  if (s.onayIgnored > 0) {
    parts.push(
      `${s.onayIgnored} ONAY bizde bir onay izi olmayan adreslere ait; dokunulmadı.`,
    );
  }
  if (s.skipped > 0) {
    parts.push(
      `${s.skipped} satırda adres ya da ONAY/RET bulunamadı, atlandı.`,
    );
  }
  return parts.join(" ");
}
