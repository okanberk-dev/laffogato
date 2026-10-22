// Client-safe (no server-only): how /admin/olay-kaydi filters and shows a
// row. The entity ids used to be plain text and the payload a raw
// JSON.stringify; these turn them into a link to the record and a short list
// of fields, every name and every known value in Turkish (admin audit
// SYS-10: "before.shippingFlatMinor", "owner, manager", "cancelled" and the
// settings section "general" as a record number).

import {
  parseSettingsTab,
  SETTINGS_TABS,
  settingsTabHref,
} from "@/app/admin/ayarlar/settings-core";
import { KARAOKE_PAYMENT_LABELS } from "@/lib/mobile/karaoke-core";
import { isKaraokeRef } from "@/lib/mobile/karaoke-ref";

import type { AuditAction, AuditEntity, AuditFilter } from "./audit";
import { DAY_LABELS, type DayOfWeek } from "./days";
import {
  auditActorLabel,
  KARAOKE_PANEL_PATH,
  KARAOKE_STATUS_TEXT,
  karaokeDetailHref,
} from "./karaoke-panel";
import type { FilterField, FilterValues } from "./list-params";
import {
  MANUAL_PAYMENT_LABELS,
  REFUND_DESTINATION_LABELS,
} from "./order-actions";
import { ORDER_FULFILLMENT_LABELS } from "./order-channel";
import { ORDER_FILTER_FIELDS, ORDER_TABS } from "./order-filters";
import { ORDER_STATUS_LABELS } from "./order-ui";
import { ROLE_LABELS } from "./roles";
import type { AdminTone } from "./tone";

/** The log's path; an event's own page is `${AUDIT_LOG_PATH}/<id>`. */
export const AUDIT_LOG_PATH = "/admin/olay-kaydi";

/** Events per page. */
export const AUDIT_LOG_PAGE_SIZE = 50;

/** One event's page. */
export function auditEventHref(id: string): string {
  return `${AUDIT_LOG_PATH}/${encodeURIComponent(id)}`;
}

/**
 * An event id from the URL, or null when it cannot be one. Rows are
 * `aud-0001234`; the shape is kept loose for rows written by hand, but
 * never longer than a hundred plain characters.
 */
export function auditEventIdOf(raw: unknown): string | null {
  const text = typeof raw === "string" ? raw.trim() : "";
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/.test(text) ? text : null;
}

export const AUDIT_ENTITY_LABELS: Record<AuditEntity, string> = {
  product: "Ürün",
  menu_item: "Menü",
  category: "Kategori",
  shop_hero_slide: "Mağaza vitrini",
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
  settings: "Ayarlar",
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
  iys: "İYS",
  invoice: "e-Arşiv fatura",
  audit_log: "Olay kaydı",
  retention: "Periyodik imha",
};

/**
 * The periodic destruction's rules (src/lib/retention.ts, `RETENTION_RULES`)
 * by id, as a `retention` row names them. Kept here because that module is
 * server-only; tests/admin-audit-log.test.ts fails on a rule with no name.
 */
export const RETENTION_RULE_LABELS: Record<string, string> = {
  "auth-attempts": "Giriş denemeleri",
  "campaign-email-sends": "Kampanya e-postası gönderimleri",
  "email-suppressions": "E-posta gönderim engelleri",
  "customer-consents": "Ticari ileti onay geçmişi",
  "audit-logs": "Olay kaydı",
  "legal-override-history": "Hukuk metni arşivi",
  "legal-doc-versions": "Gösterilen hukuk metni sürümleri",
  "fal-readings": "fA'L kullanım kaydı",
  "fal-reports": "fA'L yorum bildirimleri",
  "feature-consents": "Özellik açık rızaları",
  "counter-tokens": "Kasa kodları",
  "push-devices": "Uygulama bildirim jetonları",
  "karaoke-guest-data": "Karaoke misafir ve iletişim bilgisi",
  "karaoke-reservations": "Karaoke rezervasyonları",
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
  "2fa_enable": "2FA açma",
  "2fa_disable": "2FA kapatma",
  send: "Gönderim",
  send_test: "Test gönderimi",
  export: "Dışa aktarma",
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
  // Personal data left the panel as a file: it should stand out.
  export: "accent",
};

/**
 * Kinds the filter offers. `reel` stays a type (and a label) for any row
 * written before reels left the panel, but nothing writes it any more, so
 * choosing it could only ever show an empty log.
 */
const RETIRED_ENTITIES: ReadonlySet<AuditEntity> = new Set(["reel"]);

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
    options: (Object.keys(AUDIT_ENTITY_LABELS) as AuditEntity[])
      .filter((e) => !RETIRED_ENTITIES.has(e))
      .map((e) => ({ value: e, label: AUDIT_ENTITY_LABELS[e] })),
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
    case "invoice":
      return "/admin/faturalar";
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
    case "iys":
      return "/admin/iys";
    case "settings":
      // The section's own tab (`?sekme=`); "email-test" opens E-posta.
      return settingsTabHref(parseSettingsTab(id));
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

/** The mobile app settings' sections (Uygulama ayarları), by key. */
const APP_CONFIG_SECTIONS: Record<string, string> = {
  minSupportedAppVersion: "En düşük uygulama sürümü",
  maintenance: "Bakım",
  ordering: "Sipariş",
  loyalty: "Sadakat",
  karaoke: "Karaoke",
  reminders: "Hatırlatmalar",
  campaignCards: "Kampanya kartları",
  happyHour: "Mutlu saat",
  venue: "Mekân",
  store: "Mağaza bağlantıları",
};

const SETTINGS_SECTIONS: Record<string, string> = {
  ...Object.fromEntries(SETTINGS_TABS.map((t) => [t.id, t.label])),
  "email-test": "Test e-postası",
};

/**
 * What the Kayıt column prints for a row's record: the id itself, except
 * where the id is a section name ("general", "email-test", "ordering"),
 * which reads as the section's Turkish name.
 */
export function auditRecordText(entity: EntityName, entityId: string): string {
  const id = entityId.trim();
  if (entity === "settings") return SETTINGS_SECTIONS[id] ?? id;
  if (entity === "mobile_app_config") return APP_CONFIG_SECTIONS[id] ?? id;
  // A destruction run is filed under its instant: read it on the köşk's
  // clock, to the second.
  if (entity === "retention") return auditTime(id);
  return id;
}

/** "Sistem", "Üye", or the panel user's address. */
export function auditActorText(actor: string): string {
  return auditActorLabel(actor);
}

/**
 * Turkish names for the payload keys the actions write: the fields of each
 * record, the settings (Ayarlar and Uygulama ayarları) and the filters an
 * export records. A nested key is named segment by segment
 * ("Önceki · Kargo ücreti"); an unknown segment keeps its own name.
 */
const KEY_LABELS: Record<string, string> = {
  // Records
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
  allergens: "Alerjenler",
  taxRatePct: "KDV oranı",
  priceMinor: "Fiyat",
  priceMinorL: "Fiyat (L)",
  year: "Yıl",
  tone: "Ton",
  move: "Taşıma",
  imported: "Eklenen",
  published: "Yayında",
  effectiveDate: "Yürürlük tarihi",
  archivedId: "Arşiv no",
  restoredFrom: "Geri alınan arşiv",
  reset: "Sıfırlama",
  saved: "Kaydedilen",
  toDefault: "Varsayılana dönen",
  rotatedAt: "Kod yenilendi",
  // Stock
  delta: "Değişim",
  stockAfter: "Yeni stok",
  totalAfter: "Yeni toplam stok",
  variantId: "Varyant",
  stockRefused: "Reddedilen stok alanı",
  // Bulk and import
  op: "İşlem",
  updated: "Güncellenen",
  idCount: "Kayıt sayısı",
  ids: "Kayıtlar",
  names: "Adlar",
  created: "Oluşturulan",
  createdIds: "Oluşturulan kayıtlar",
  updatedIds: "Güncellenen kayıtlar",
  skipped: "Değişmeyen",
  errors: "Hatalı satır",
  stockMoves: "Stok hareketi",
  notStarted: "Başlamayan",
  // Orders and money
  orderNo: "Sipariş no",
  manual: "Panelden",
  total: "Toplam",
  fulfillment: "Teslimat",
  paymentMethod: "Ödeme yolu",
  method: "Ödeme yolu",
  paymentRow: "Ödeme kaydı",
  promoDropped: "Düşen promosyon",
  status: "Durum",
  from: "Önceki",
  to: "Yeni",
  transition: "Geçiş",
  reason: "Neden",
  restock: "Stoğa dönen",
  units: "Adet",
  bulk: "Toplu işlem",
  amountMinor: "Tutar",
  refundedMinor: "İade edilen",
  expectedMinor: "Beklenen",
  collectedMinor: "Tahsil edilen",
  destination: "İade yeri",
  provider: "Ödeme sağlayıcı",
  providerRef: "POS referansı",
  outcome: "Sonuç",
  tracking: "Kargo takibi",
  carrier: "Kargo firması",
  event: "Olay",
  was: "Önceki dikkat",
  note: "Not",
  length: "Uzunluk",
  fields: "Alanlar",
  customerName: "Müşteri adı",
  customerEmail: "Müşteri e-postası",
  customerPhone: "Müşteri telefonu",
  shippingAddress: "Teslimat adresi",
  // Karaoke
  date: "Tarih",
  startHour: "Başlangıç saati",
  paymentStatus: "Ödeme durumu",
  lateRefundPercent: "Geç iptal iadesi (%)",
  share: "Kısmi iade",
  ended: "Saati geçmişti",
  by: "Yapan",
  message: "Mesaj",
  // People
  customer: "Üye",
  count: "Adet",
  stamp: "Damga",
  stamps: "Damga",
  // Kasa: a redemption that stopped after some of its stamps were written.
  asked: "İstenen damga",
  partial: "Yarım kaldı",
  source: "Kaynak",
  via: "Kanal",
  passwordReset: "Parola sıfırlandı",
  closedBy: "Kapatan",
  closure: "Kapatma",
  identity: "Giriş kimliği",
  verification: "Doğrulama",
  deletionRequest: "Silme talebi",
  deletionRequestedAt: "Silme talebi tarihi",
  requestedAt: "Talep tarihi",
  withReason: "Neden yazıldı",
  karaokeRoomUsed: "Kullanılmış karaoke saatleri",
  needs2FA: "2FA gerekli",
  // Mail and app content
  template: "Şablon",
  audience: "Kitle",
  subject: "Konu",
  scheduledAt: "Planlanan gönderim",
  sourcePostId: "Gönderi",
  // Live status
  manualOverride: "Elle ayar",
  freeTables: "Boş masa",
  totalTables: "Toplam masa",
  wifi: "Wi-Fi",
  noise: "Gürültü",
  power: "Priz",
  // Ayarlar
  section: "Bölüm",
  before: "Önceki",
  after: "Yeni",
  changed: "Değişti",
  tagline: "Slogan",
  phone: "Telefon",
  email: "E-posta",
  address: "Adres",
  openingHours: "Çalışma saatleri",
  weeklyHours: "Haftalık saatler",
  isShopOpen: "Online mağaza açık",
  heroImageUrl: "Kapak görseli",
  taxRates: "KDV oranları",
  menuPricesEffectiveDate: "Fiyat listesi tarihi",
  menuPricesChangedAt: "Son fiyat değişikliği",
  shippingFlatMinor: "Kargo ücreti",
  shippingFreeThresholdMinor: "Ücretsiz kargo eşiği",
  courierFeeMinor: "Kurye ücreti",
  pickupReadyMinutes: "Hazırlık süresi (dk)",
  seoTitle: "Ana sayfa başlığı",
  seoOgImageUrl: "Paylaşım görseli",
  seoIndexable: "Arama motorlarına açık",
  notificationEmail: "Bildirim adresi",
  notificationEmailDomain: "Bildirim adresinin alan adı",
  orderNotifyEnabled: "Yeni sipariş e-postası",
  orderNotifyRoles: "Bildirim alan roller",
  orderNotifyEmails: "Ek alıcılar",
  orderNotifyEmailCount: "Ek alıcı sayısı",
  orderNotifyEmailDomains: "Ek alıcıların alan adları",
  orderNotifyEmailsAdded: "Eklenen alıcı",
  orderNotifyEmailsRemoved: "Çıkarılan alıcı",
  emailFromName: "Gönderen adı",
  emailFromAddress: "Gönderen adresi",
  emailReplyTo: "Yanıt adresi",
  karaokeHourlyMinor: "Karaoke saat ücreti",
  karaokeCapacity: "Karaoke kapasitesi",
  karaokeNotifyEmail: "Karaoke bildirim adresi",
  karaokePrepay: "Karaokede ön ödeme",
  karaokeFreeCancelHours: "Ücretsiz iptal süresi (saat)",
  karaokeLateRefundPercent: "Geç iptal iadesi (%)",
  karaokeCancelPolicyAt: "İptal kuralı tarihi",
  mobileApp: "Uygulama",
  menu: "Menü",
  karaoke: "Karaoke",
  beans: "Kahve çekirdeği",
  pantry: "Kiler",
  gift: "Hediye",
  gear: "Ekipman",
  merch: "Marka ürünü",
  open: "Açılış",
  close: "Kapanış",
  closed: "Kapalı",
  ...(DAY_LABELS as Record<string, string>),
  // Uygulama ayarları
  ...APP_CONFIG_SECTIONS,
  enabled: "Açık",
  cafeEnabled: "Kafe siparişi",
  deliveryEnabled: "Kurye",
  pickupEnabled: "Gel-al",
  tableEnabled: "Masaya sipariş",
  courierEtaMinutes: "Kurye süresi (dk)",
  closedMessage: "Kapalıyken mesaj",
  stampTarget: "Damga hedefi",
  rewardTitle: "Ödül",
  rewardValueMinor: "Ödül tutarı",
  rewardTtlDays: "Ödül süresi (gün)",
  firstHour: "İlk saat",
  closeHour: "Kapanış saati",
  maxHours: "En çok saat",
  bookingWindowDays: "Rezervasyon aralığı (gün)",
  oroDiscountPct: "Oro indirimi (%)",
  items: "Öğeler",
  invite: "Davet",
  subscription: "Abonelik",
  days: "Günler",
  pct: "İndirim (%)",
  shortName: "Kısa ad",
  landmark: "Yer tarifi",
  mapsQuery: "Harita araması",
  appStoreUrl: "App Store bağlantısı",
  playStoreUrl: "Google Play bağlantısı",
  appleTeamId: "Apple ekip kimliği",
  bundleId: "Uygulama kimliği",
  androidSha256: "Android imza parmak izleri",
  // An export's filters (siparisler, olay-kaydi)
  filters: "Süzgeç",
  tab: "Sekme",
  rows: "Satır",
  q: "Arama",
  durum: "Durum",
  kanal: "Kanal",
  tur: "Tür",
  teslimat: "Teslimat",
  odeme: "Ödeme",
  dikkat: "Dikkat",
  bas: "Başlangıç",
  bit: "Bitiş",
  actor: "Kim",
  entity: "Kayıt türü",
  action: "İşlem",
  entityId: "Kayıt no",
};

/** Known values of a key, in Turkish; anything else prints as written. */
const VALUE_LABELS: Record<string, Record<string, string>> = {
  transition: {
    cancel: "İptal",
    mark_paid: "Ödendi olarak işaretleme",
    start_preparing: "Hazırlamaya başlama",
    mark_shipped: "Kargoya verme / hazır",
    complete: "Tamamlama",
  },
  op: {
    delete: "Silme",
    activate: "Aktif etme",
    deactivate: "Pasif etme",
    set_category: "Kategori değiştirme",
    csv_import: "CSV içe aktarma",
  },
  event: {
    code_rotated: "Kod yenilendi",
    stock_released: "Stok geri alındı",
    attention_cleared: "Dikkat işareti kaldırıldı",
    mail_resent: "E-posta yeniden gönderildi",
    payment_unreconciled: "Ödeme siparişle eşleşmedi",
    payment_amount_mismatch: "Tahsilat tutarı rezervasyonla uyuşmadı",
    late_payment_refunded: "Geç gelen ödeme iade edildi",
    late_payment_refund_refused: "Geç gelen ödemenin iadesi reddedildi",
    late_payment_refund_unknown: "Geç gelen ödemenin iade sonucu belirsiz",
    second_charge_refunded: "İkinci tahsilat iade edildi",
    second_charge_refund_refused: "İkinci tahsilatın iadesi reddedildi",
    second_charge_refund_unknown: "İkinci tahsilatın iade sonucu belirsiz",
    cancel_refund_refused: "İptalde iade reddedildi",
    cancel_refund_unknown: "İptalde iade sonucu belirsiz",
    hold_released_payment_unknown:
      "Ödemesi doğrulanamayan rezervasyon bırakıldı",
    refund_without_payment_row: "İade edilecek ödeme kaydı yok",
    refund_unanswered: "İade cevapsız kaldı",
    refund_retry: "İade yeniden denendi",
    refund_settled_by_hand: "İade elle kaydedildi",
    late_cancel_share_owed: "Geç iptal, kısmi iade bekliyor",
    resale_refund_owed: "Geç iptal edilen saat yeniden satıldı, iade bekliyor",
    resale_refund_unrecorded: "Yeniden satılan saatin iadesi kaydedilemedi",
    make_good_hour_given: "Telafi saati verildi",
    make_good_hour: "Telafi saati olarak verildi",
    make_good_paid: "Telafi banka hesabına ödendi",
    make_good_reopened: "Telafi yeniden açıldı",
    account_closed_room_used: "Hesap kapandı, saat kullanılmıştı",
    account_closed_room_use_unknown: "Hesap kapandı, saatin kullanımı belirsiz",
    account_closed_passed_since_request:
      "Hesap kapandı, saat talepten sonra geçti",
    account_closed_late_paid_booking:
      "Hesap kapandı, ödenmiş rezervasyon duruyor",
    account_closed_late_make_good_hour: "Hesap kapandı, telafi saati duruyor",
    account_closed_payment_unknown: "Hesap kapandı, ödeme durumu belirsiz",
  },
  destination: REFUND_DESTINATION_LABELS,
  paymentMethod: MANUAL_PAYMENT_LABELS,
  method: { ...MANUAL_PAYMENT_LABELS, pos: "POS" },
  fulfillment: ORDER_FULFILLMENT_LABELS,
  paymentStatus: KARAOKE_PAYMENT_LABELS,
  fields: { customer_delivery: "Müşteri ve teslimat" },
  paymentRow: { failed: "Yazılamadı" },
  verification: { resent: "Doğrulama e-postası yeniden gönderildi" },
  closure: { failed: "Başarısız" },
  closedBy: { admin: "Panel", customer: "Üye" },
  deletionRequest: { opened: "Açıldı", withdrawn: "Geri çekildi" },
  reset: { owner: "Sahip sıfırladı" },
  tracking: { set: "Kaydedildi" },
  via: { app: "Uygulama", panel: "Yönetim paneli" },
  source: { counter: "Kasa", admin: "Panel", app: "Uygulama" },
  move: { up: "Yukarı", down: "Aşağı" },
  outcome: { unknown: "Belirsiz", refunded: "Yapıldı", refused: "Reddedildi" },
  provider: { none: "Yok", manual: "Elle" },
  by: { staff: "Ekip", member: "Üye", system: "Sistem" },
};

/** The roles a panel user or a barista can have, by id. */
const ROLE_NAMES: Record<string, string> = {
  ...(ROLE_LABELS as Record<string, string>),
  barista: "Barista",
};

/** An order line's own states (order-timeline.ts uses the same words). */
const ORDER_ITEM_STATUS: Record<string, string> = {
  pending: "Bekliyor",
  ready: "Hazır",
  cancelled: "İptal",
};

const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const MAX_VALUE = 300;
const MAX_DEPTH = 3;
const DAY_CODES = /\b(mon|tue|wed|thu|fri|sat|sun)\b/g;

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

const ISTANBUL_SECONDS = new Intl.DateTimeFormat("tr-TR", {
  timeZone: "Europe/Istanbul",
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/**
 * When a row was written, on the köşk's clock and to the second: two
 * events in the same minute used to print the same time (SYS-09).
 */
export function auditTime(iso: string): string {
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? iso : ISTANBUL_SECONDS.format(at);
}

/** What a row is about: shapes its labels and values. */
export interface AuditRowContext {
  entity?: string;
  action?: string;
  entityId?: string;
}

export interface AuditPayloadEntry {
  /** Dotted path for a nested field ("before.courierFeeMinor"). */
  key: string;
  /** The Turkish name, segment by segment ("Önceki · Kurye ücreti"). */
  label: string;
  value: string;
}

function clip(text: string, limit: number): string {
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Where a row's `status`, `from` and `to` come from. */
function statusNames(ctx: AuditRowContext): Record<string, string> | null {
  switch (ctx.entity) {
    case "order":
      return ORDER_STATUS_LABELS;
    case "order_item":
      return ORDER_ITEM_STATUS;
    case "karaoke_reservation":
      return KARAOKE_STATUS_TEXT;
    default:
      return null;
  }
}

/** A key's own name for this row, where the generic one would mislead. */
function keyLabel(key: string, ctx: AuditRowContext, value: unknown): string {
  // A test mail's `to` is its recipient, not a "new" value (SYS-10).
  if (key === "to" && ctx.action === "send_test") return "Alıcı";
  // A destruction run's own instant.
  if (key === "at" && ctx.entity === "retention") return "Çalışma anı";
  // `from` / `to` are a status only when they hold one: an order row may
  // carry other before / after values (a KDV rate, 1 to 10).
  const names = statusNames(ctx);
  if (names && typeof value === "string" && Object.hasOwn(names, value)) {
    if (key === "to") return "Yeni durum";
    if (key === "from") return "Önceki durum";
  }
  if (key === "total" && ctx.action === "send") return "Alıcı sayısı";
  if (key === "length" && ctx.action === "note") return "Not uzunluğu";
  return KEY_LABELS[key] ?? key;
}

/** Kuruş in a field that does not say so in its name. */
function isMoneyKey(key: string, ctx: AuditRowContext): boolean {
  if (/Minor$/.test(key)) return true;
  return key === "total" && ctx.entity === "order" && ctx.action === "create";
}

/** The fields an export's `filters` came from, by the exported list. */
function exportedFields(ctx: AuditRowContext): readonly FilterField[] {
  if (ctx.entity === "order") return ORDER_FILTER_FIELDS;
  if (ctx.entity === "audit_log") return AUDIT_FILTER_FIELDS;
  return [];
}

/** A select filter's value as its option's label ("manuel" → "Panelden"). */
function optionLabel(
  fields: readonly FilterField[],
  name: string,
  value: string,
): string | null {
  for (const field of fields) {
    if (field.type === "select" && field.name === name) {
      return field.options.find((o) => o.value === value)?.label ?? null;
    }
  }
  return null;
}

function scalar(
  path: readonly string[],
  v: unknown,
  ctx: AuditRowContext,
  limit: number,
): string {
  const key = path[path.length - 1] ?? "";
  if (v === null || v === undefined || v === "") return "-";
  if (typeof v === "boolean") return v ? "evet" : "hayır";
  if (typeof v === "number") {
    // `amountMinor`, `totalMinor`…: kuruş, shown as lira.
    return isMoneyKey(key, ctx) && Number.isFinite(v)
      ? TRY.format(v / 100)
      : String(v);
  }
  if (typeof v === "string") {
    if (ISO_INSTANT.test(v)) {
      const at = new Date(v);
      if (!Number.isNaN(at.getTime())) return ISTANBUL.format(at);
    }
    if (key === "role" || key === "orderNotifyRoles") {
      return ROLE_NAMES[v] ?? v;
    }
    if (key === "status" || key === "from" || key === "to") {
      const names = statusNames(ctx);
      if (names?.[v]) return names[v];
    }
    if (key === "section") {
      const name =
        ctx.entity === "mobile_app_config"
          ? APP_CONFIG_SECTIONS[v]
          : SETTINGS_SECTIONS[v];
      if (name) return name;
    }
    if (key === "openingHours") {
      // The hours tab writes English day codes ("mon 09:00-02:00").
      return clip(
        v.replace(DAY_CODES, (d) => DAY_LABELS[d as DayOfWeek] ?? d),
        limit,
      );
    }
    if (path[0] === "filters" && path.length === 2 && ctx.action === "export") {
      const option = optionLabel(exportedFields(ctx), key, v);
      if (option) return option;
    }
    if (key === "tab" && ctx.entity === "order" && ctx.action === "export") {
      const tab = ORDER_TABS.find((t) => t.value === v);
      if (tab) return tab.label;
    }
    const known = VALUE_LABELS[key]?.[v];
    if (known) return known;
    if (key === "entity") {
      return AUDIT_ENTITY_LABELS[v as AuditEntity] ?? v;
    }
    if (key === "action") {
      return AUDIT_ACTION_LABELS[v as AuditAction] ?? v;
    }
    return clip(v, limit);
  }
  return clip(JSON.stringify(v) ?? String(v), limit);
}

/**
 * A destruction run's `results` (src/lib/retention.ts, `destructionRecord`):
 * one line per rule, named in Turkish, with its counts and its cutoff on the
 * köşk's clock, instead of the list as raw JSON.
 */
function retentionResultEntries(
  results: readonly unknown[],
  ctx: AuditRowContext,
  limit: number,
): AuditPayloadEntry[] {
  return results.map((item, i) => {
    if (!isPlainObject(item)) {
      return {
        key: `results.${i}`,
        label: "Kural",
        value: clip(JSON.stringify(item) ?? String(item), limit),
      };
    }
    const id = typeof item.id === "string" ? item.id : String(i);
    const parts = [
      item.method === "clear" ? "Alanlar boşaltıldı" : "Silindi",
      `Eşleşen ${scalar(["matched"], item.matched, ctx, limit)}`,
      `İmha edilen ${scalar(["destroyed"], item.destroyed, ctx, limit)}`,
      `Sınır ${scalar(["cutoff"], item.cutoff, ctx, limit)}`,
    ];
    if (item.failed === true) parts.push("Çalışmadı");
    return {
      key: `results.${id}`,
      label: `Kural · ${RETENTION_RULE_LABELS[id] ?? id}`,
      value: clip(parts.join(" · "), limit),
    };
  });
}

/**
 * A row's payload as label / value lines: nested objects are flattened to
 * dotted keys (three levels) and named segment by segment ("before" is
 * Önceki, "after" Yeni, "changed" Değişti), a list of plain values is
 * joined with commas, amounts in kuruş read as lira, instants as the köşk's
 * clock, role, status and section ids as their Turkish names. The order of
 * the keys is the order they were written.
 *
 * Values are clipped at 300 characters for the list; the event's own page
 * passes `{ clip: false }` and shows every character.
 *
 * A settings row's `section` is left out where it repeats the record (the
 * Kayıt column already names it). A destruction run's `results` read rule
 * by rule (`retentionResultEntries`).
 */
export function auditPayloadEntries(
  payload: Record<string, unknown> | null | undefined,
  ctx: AuditRowContext = {},
  options: { clip?: boolean } = {},
): AuditPayloadEntry[] {
  const limit = options.clip === false ? Infinity : MAX_VALUE;
  const out: AuditPayloadEntry[] = [];
  const walk = (
    obj: Record<string, unknown>,
    path: readonly string[],
    depth: number,
  ) => {
    for (const [k, v] of Object.entries(obj)) {
      const keys = [...path, k];
      const key = keys.join(".");
      if (
        depth === 0 &&
        k === "section" &&
        ctx.entity === "settings" &&
        v === ctx.entityId
      ) {
        continue;
      }
      if (
        depth === 0 &&
        k === "results" &&
        ctx.entity === "retention" &&
        Array.isArray(v)
      ) {
        out.push(...retentionResultEntries(v, ctx, limit));
        continue;
      }
      if (isPlainObject(v) && depth < MAX_DEPTH && Object.keys(v).length > 0) {
        walk(v, keys, depth + 1);
        continue;
      }
      let value: string;
      if (Array.isArray(v)) {
        value =
          v.length === 0
            ? "-"
            : v.every((x) => x === null || typeof x !== "object")
              ? clip(
                  v.map((x) => scalar(keys, x, ctx, limit)).join(", "),
                  limit,
                )
              : clip(JSON.stringify(v), limit);
      } else {
        value = scalar(keys, v, ctx, limit);
      }
      const label = keys
        .map((segment, i) =>
          i === keys.length - 1
            ? keyLabel(segment, ctx, v)
            : (KEY_LABELS[segment] ?? segment),
        )
        .join(" · ");
      out.push({ key, label, value });
    }
  };
  if (isPlainObject(payload)) walk(payload, [], 0);
  return out;
}

/**
 * The URL's filters (parseFilters over AUDIT_FILTER_FIELDS) as the log's
 * query. The page and its CSV read the same rows from the same URL.
 */
export function auditFilterOf(filters: FilterValues): AuditFilter {
  const range = istanbulDayRange(filters.bas, filters.bit);
  return {
    actor: filters.actor,
    entity: filters.entity as AuditEntity | undefined,
    action: filters.action as AuditAction | undefined,
    entityId: filters.entityId,
    from: range.from,
    to: range.to,
  };
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
