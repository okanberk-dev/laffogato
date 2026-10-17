// Client-safe (no server-only): how /admin/olay-kaydi filters and shows a
// row. The entity ids used to be plain text and the payload a raw
// JSON.stringify; these turn them into a link to the record and a short list
// of fields.

import { isKaraokeRef } from "@/lib/mobile/karaoke-ref";

import type { AuditAction, AuditEntity } from "./audit";
import { KARAOKE_PANEL_PATH, karaokeDetailHref } from "./karaoke-panel";
import type { FilterField } from "./list-params";
import type { AdminTone } from "./tone";

export const AUDIT_ENTITY_LABELS: Record<AuditEntity, string> = {
  product: "Ürün",
  menu_item: "Menü",
  category: "Kategori",
  shop_hero_slide: "Mağaza Hero",
  home_hero_slide: "Anasayfa slaytı",
  app_hero_slide: "Uygulama slaytı",
  app_announcement: "Uygulama duyurusu",
  app_post: "Uygulama gönderisi",
  reel: "Reel",
  press: "Basın",
  story: "Hikaye",
  content: "Site metni",
  order: "Sipariş",
  order_item: "Sipariş kalemi",
  promo: "Promosyon",
  coupon: "Kupon",
  settings: "Ayar",
  stock: "Stok",
  customer: "Üye",
  newsletter: "Bülten",
  legal_doc: "Yasal belge",
  auth: "Giriş",
  "2fa": "2FA",
  venue_status: "Canlı durum",
  karaoke_reservation: "Karaoke rezervasyonu",
  mobile_app_config: "Uygulama ayarları",
  admin_user: "Panel kullanıcısı",
  counter_token: "Kasa jetonu",
  staff_member: "Barista (uygulamadan kasa)",
  campaign_email: "Kampanya e-postası",
  cafe_table: "Masa · QR",
};

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  create: "Oluşturma",
  update: "Güncelleme",
  delete: "Silme",
  bulk_update: "Toplu güncelleme",
  bulk_delete: "Toplu silme",
  transition: "Durum geçişi",
  refund: "İade",
  note: "Not",
  login_success: "Giriş başarılı",
  login_fail: "Giriş başarısız",
  logout: "Çıkış",
  "2fa_enable": "2FA aktif",
  "2fa_disable": "2FA kapatma",
  send: "Gönderim",
  send_test: "Test gönderimi",
};

export const AUDIT_ACTION_TONES: Record<AuditAction, AdminTone> = {
  create: "success",
  update: "info",
  delete: "danger",
  bulk_update: "info",
  bulk_delete: "danger",
  transition: "accent",
  refund: "warning",
  note: "neutral",
  login_success: "success",
  login_fail: "warning",
  logout: "neutral",
  "2fa_enable": "success",
  "2fa_disable": "warning",
  send: "primary",
  send_test: "neutral",
};

/**
 * The log's filters, shared by the page and its FilterBar (parseFilters only
 * keeps a known entity or action and a real day). `entityId` is matched
 * exactly; every row's "Geçmişi" link fills it in.
 */
export const AUDIT_FILTER_FIELDS: readonly FilterField[] = [
  { type: "search", name: "actor", label: "Kim", placeholder: "ali@…" },
  {
    type: "select",
    name: "entity",
    label: "Kayıt türü",
    options: (Object.keys(AUDIT_ENTITY_LABELS) as AuditEntity[]).map((e) => ({
      value: e,
      label: AUDIT_ENTITY_LABELS[e],
    })),
  },
  {
    type: "select",
    name: "action",
    label: "İşlem",
    options: (Object.keys(AUDIT_ACTION_LABELS) as AuditAction[]).map((a) => ({
      value: a,
      label: AUDIT_ACTION_LABELS[a],
    })),
  },
  {
    type: "search",
    name: "entityId",
    label: "Kayıt no",
    placeholder: "prd-0001",
    maxLength: 200,
  },
  { type: "date-range", label: "Tarih", from: "bas", to: "bit" },
];

/** An entity name as lib/admin/audit.ts writes it (kept loose: old rows). */
type EntityName = string;

/**
 * Where a row's record lives in the panel, or null when there is no page for
 * it (a coupon, a sign-in) or the id cannot be one (a closed account's
 * customer id: the address it was filed under is gone).
 */
export function auditRecordHref(
  entity: EntityName,
  entityId: string,
): string | null {
  const id = entityId.trim();
  const seg = encodeURIComponent(id);
  switch (entity) {
    case "product":
      return id ? `/admin/urunler/${seg}/duzenle` : null;
    case "menu_item":
      return id ? `/admin/menu/${seg}/duzenle` : null;
    case "category":
      return id ? `/admin/kategoriler/${seg}/duzenle` : null;
    case "promo":
      return id ? `/admin/promosyon/${seg}/duzenle` : null;
    case "shop_hero_slide":
      return id ? `/admin/magaza-hero/${seg}` : null;
    case "home_hero_slide":
      return id ? `/admin/anasayfa-hero/${seg}` : null;
    case "app_hero_slide":
      return id ? `/admin/mobil/slaytlar/${seg}` : null;
    case "app_announcement":
      return id ? `/admin/mobil/duyurular/${seg}` : null;
    case "app_post":
      return id ? `/admin/mobil/gonderiler/${seg}` : null;
    case "cafe_table":
      return id ? `/admin/masalar/${seg}/duzenle` : null;
    case "campaign_email":
      return id ? `/admin/bulten/kampanya/${seg}` : null;
    case "legal_doc":
      return id ? `/admin/hukuk/${seg}` : null;
    case "order":
      return id ? `/admin/siparisler/${seg}` : null;
    case "order_item": {
      // Written as `<orderId>#<index>`.
      const orderId = id.split("#")[0];
      return orderId
        ? `/admin/siparisler/${encodeURIComponent(orderId)}`
        : null;
    }
    case "stock":
      return id ? `/admin/stok-hareketleri?productId=${seg}` : null;
    case "customer":
      return id.includes("@")
        ? `/admin/musteriler/${encodeURIComponent(id.toLowerCase())}`
        : null;
    case "karaoke_reservation":
      // The booking's own page (`krk-00042`, the id its rows carry);
      // anything else, the list.
      return isKaraokeRef(id) ? karaokeDetailHref(id) : KARAOKE_PANEL_PATH;
    case "admin_user":
    case "staff_member":
      return "/admin/kullanicilar";
    case "newsletter":
      return "/admin/bulten";
    case "settings":
      return "/admin/ayarlar";
    case "mobile_app_config":
      return "/admin/mobil/ayarlar";
    case "venue_status":
      return "/admin/mobil/canli-durum";
    case "story":
      return "/admin/hikaye";
    case "press":
      return "/admin/basin";
    case "content":
      return "/admin/icerik";
    default:
      return null;
  }
}

/** Turkish names for the payload keys the actions write most. */
const KEY_LABELS: Record<string, string> = {
  name: "Ad",
  title: "Başlık",
  label: "Etiket",
  code: "Kod",
  slug: "Slug",
  sku: "SKU",
  kind: "Tür",
  value: "Değer",
  role: "Rol",
  isActive: "Aktif",
  sortOrder: "Sıra",
  categoryKey: "Kategori",
  delta: "Değişim",
  stockAfter: "Yeni stok",
  note: "Not",
  reason: "Neden",
  status: "Durum",
  from: "Önceki",
  to: "Yeni",
  count: "Adet",
  idCount: "Kayıt sayısı",
  tone: "Ton",
  event: "Olay",
  stamps: "Damga",
  passwordReset: "Parola sıfırlandı",
  closedBy: "Kapatan",
  identity: "Giriş kimliği",
};

const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const MAX_VALUE = 300;
const MAX_DEPTH = 3;

const TRY = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  minimumFractionDigits: 2,
});

const ISTANBUL = new Intl.DateTimeFormat("tr-TR", {
  timeZone: "Europe/Istanbul",
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export interface AuditPayloadEntry {
  /** Dotted path for a nested field ("ok.op"). */
  key: string;
  /** The Turkish name when there is one, else the key itself. */
  label: string;
  value: string;
}

function clip(text: string): string {
  return text.length > MAX_VALUE ? `${text.slice(0, MAX_VALUE - 1)}…` : text;
}

function scalar(key: string, v: unknown): string {
  if (v === null || v === undefined || v === "") return "-";
  if (typeof v === "boolean") return v ? "evet" : "hayır";
  if (typeof v === "number") {
    // `amountMinor`, `totalMinor`…: kuruş, shown as lira.
    return /Minor$/.test(key) && Number.isFinite(v)
      ? TRY.format(v / 100)
      : String(v);
  }
  if (typeof v === "string") {
    if (ISO_INSTANT.test(v)) {
      const at = new Date(v);
      if (!Number.isNaN(at.getTime())) return ISTANBUL.format(at);
    }
    return clip(v);
  }
  return clip(JSON.stringify(v) ?? String(v));
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * A row's payload as label / value lines: nested objects are flattened to
 * dotted keys (three levels), a list of plain values is joined with commas,
 * amounts in kuruş read as lira and instants as the köşk's clock. Long
 * values are clipped. The order of the keys is the order they were written.
 */
export function auditPayloadEntries(
  payload: Record<string, unknown> | null | undefined,
): AuditPayloadEntry[] {
  const out: AuditPayloadEntry[] = [];
  const walk = (
    obj: Record<string, unknown>,
    prefix: string,
    depth: number,
  ) => {
    for (const [k, v] of Object.entries(obj)) {
      const key = prefix ? `${prefix}.${k}` : k;
      if (isPlainObject(v) && depth < MAX_DEPTH && Object.keys(v).length > 0) {
        walk(v, key, depth + 1);
        continue;
      }
      let value: string;
      if (Array.isArray(v)) {
        value =
          v.length === 0
            ? "-"
            : v.every((x) => x === null || typeof x !== "object")
              ? clip(v.map((x) => scalar(k, x)).join(", "))
              : clip(JSON.stringify(v));
      } else {
        value = scalar(k, v);
      }
      out.push({ key, label: prefix ? key : (KEY_LABELS[k] ?? k), value });
    }
  };
  if (isPlainObject(payload)) walk(payload, "", 0);
  return out;
}

/**
 * A `bas` / `bit` day pair (YYYY-MM-DD, already checked by parseFilters) as
 * the instants the log is filtered by: from the köşk's midnight at the start
 * of `from` up to (not including) its midnight after `to`. Turkey is a fixed
 * UTC+3, the same constant the reports use.
 */
export function istanbulDayRange(
  from: string | undefined,
  to: string | undefined,
): { from?: string; to?: string } {
  const start = (day: string) => Date.parse(`${day}T00:00:00+03:00`);
  const out: { from?: string; to?: string } = {};
  if (from && !Number.isNaN(start(from))) {
    out.from = new Date(start(from)).toISOString();
  }
  if (to && !Number.isNaN(start(to))) {
    out.to = new Date(start(to) + 24 * 60 * 60 * 1000).toISOString();
  }
  return out;
}
