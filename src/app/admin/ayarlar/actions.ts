"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { fieldErrorsFromIssues } from "@/lib/admin/action-result";
import { listEnvAdminContacts, requireRole } from "@/lib/admin/auth";
import { DAY_LABELS } from "@/lib/admin/days";
import {
  DAYS_OF_WEEK,
  getSettings,
  updateSettings,
  type DayOfWeek,
  type WeeklyHours,
} from "@/lib/admin/store";
import { ADMIN_ROLES } from "@/lib/admin/roles";
import { listAdminUsers } from "@/lib/admin/users";
import { sendTestEmail } from "@/lib/email/send";
import {
  MAX_ORDER_NOTIFY_EMAILS,
  normalizeNotifyRoles,
  parseNotifyEmails,
  resolveStaffRecipients,
} from "@/lib/email/staff-order-notice-core";
import { forgetEmailHealth, senderDomainStatus } from "@/lib/email/health";
import {
  MENU_PRICES_DATE_FIELD,
  parseMenuPricesDate,
} from "@/lib/menu/price-list";
import { MONEY_TOO_LARGE_ERROR } from "@/lib/utils/format";
import {
  parseTaxRateInput,
  TAX_RATE_INPUT_ERROR,
  TAX_RATE_KEYS,
  TAX_RATE_LABELS,
  type TaxRates,
} from "@/lib/utils/kdv";

import {
  askToConfirm,
  changedKeys,
  EMAIL_RE,
  NO_CHANGE,
  ok,
  readMoney,
  readWholeNumber,
  refuse,
  revalidateAll,
} from "./action-helpers";
import { GENERAL_LIMITS, type SettingsState } from "./settings-core";

/**
 * "HH:MM" (or "H:MM") within 00:00-23:59, normalised; null for anything
 * else, which the action turns into the form's error.
 *
 * It used to clamp: "24:00", "99:99" or a hand-made POST came out as a
 * stored "24:00" / "24:59", and garbage became "00:00" - a midnight close
 * the operator never typed. A close at midnight is "00:00": the hours
 * reader treats a close not later than the open as running past midnight.
 */
function parseTime(raw: unknown): string | null {
  const s = String(raw ?? "").trim();
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/** The first refusal of a zod parse, and every field's own message. */
function refuseIssues(
  issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }>,
  fallback: string,
): SettingsState {
  return {
    error: issues[0]?.message ?? fallback,
    fieldErrors: fieldErrorsFromIssues(issues),
  };
}

const tooLong = (what: string, max: number) => ({
  error: `${what} en fazla ${max} karakter olabilir.`,
});

/**
 * Genel. The browser's type="url" / type="email" were the only checks: a
 * hand-made POST, or an http:// image the browser accepts and the site's
 * CSP then blocks, reached the home hero and the reply-to address as typed.
 */
const generalSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { error: "Kafe adı en az 2 karakter olmalı." })
    .max(GENERAL_LIMITS.name, tooLong("Kafe adı", GENERAL_LIMITS.name)),
  tagline: z
    .string()
    .trim()
    .max(GENERAL_LIMITS.tagline, tooLong("Slogan", GENERAL_LIMITS.tagline)),
  phone: z
    .string()
    .trim()
    .max(GENERAL_LIMITS.phone, tooLong("Telefon", GENERAL_LIMITS.phone)),
  email: z
    .string()
    .trim()
    .max(GENERAL_LIMITS.email, tooLong("E-posta", GENERAL_LIMITS.email))
    .refine((v) => !v || EMAIL_RE.test(v), {
      error: "Geçerli bir e-posta gir ya da alanı boş bırak.",
    }),
  address: z
    .string()
    .trim()
    .max(GENERAL_LIMITS.address, tooLong("Adres", GENERAL_LIMITS.address)),
  heroImageUrl: z
    .string()
    .trim()
    .max(
      GENERAL_LIMITS.heroImageUrl,
      tooLong("Görsel adresi", GENERAL_LIMITS.heroImageUrl),
    )
    .refine((v) => !v || /^https:\/\/\S+$/i.test(v), {
      error:
        "Görsel adresi https:// ile başlamalı (http görseller sitede açılmaz).",
    }),
  isShopOpen: z.boolean(),
});

const GENERAL_TEXT_FIELDS = [
  "name",
  "tagline",
  "phone",
  "email",
  "address",
  "heroImageUrl",
] as const;

/** Only the fields a save changes are checked; the switch always is. */
const generalChangeSchema = generalSchema.partial({
  name: true,
  tagline: true,
  phone: true,
  email: true,
  address: true,
  heroImageUrl: true,
});

export async function saveGeneralAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  await requireRole("settings");
  const before = await getSettings();
  // A field posted back as it is stored is neither checked nor written. A
  // value saved before these checks (an http:// hero image, a phone past 40
  // characters) would refuse the whole tab, and closing the shop would wait
  // on a field nobody touched. Once edited, it has to pass.
  const input: Record<string, unknown> = {
    isShopOpen: formData.get("isShopOpen") === "on",
  };
  for (const key of GENERAL_TEXT_FIELDS) {
    const value = String(formData.get(key) ?? "");
    if (value.trim() !== (before[key] ?? "")) input[key] = value;
  }
  const parsed = generalChangeSchema.safeParse(input);
  if (!parsed.success) {
    return refuseIssues(parsed.error.issues, "Genel bilgiler geçersiz.");
  }
  const next = parsed.data;
  if (before.isShopOpen && !next.isShopOpen) {
    const ask = askToConfirm(
      formData,
      [
        {
          key: "shop-off",
          line: "Online mağaza kapanır: sitede ve uygulamada kargolu ürün siparişi alınmaz. Kafe siparişleri (gel-al, kurye, masa) etkilenmez.",
        },
      ],
      { title: "Online mağaza kapansın mı?", submitLabel: "Mağazayı kapat" },
    );
    if (ask) return ask;
  }
  const moved = changedKeys(before, next);
  if (!moved) return NO_CHANGE;
  await updateSettings(next);
  revalidateAll();
  return ok("general", "Genel bilgiler kaydedildi.", moved);
}

export async function saveHoursAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  await requireRole("settings");
  const before = await getSettings();
  const weekly: WeeklyHours = {} as WeeklyHours;
  const summary: string[] = [];
  for (const day of DAYS_OF_WEEK) {
    const closed = formData.get(`${day}-closed`) === "on";
    const rawOpen = String(formData.get(`${day}-open`) ?? "").trim();
    const rawClose = String(formData.get(`${day}-close`) ?? "").trim();
    // A day ticked "Kapalı" may have its time boxes cleared; it keeps the
    // hours it had rather than failing the whole form over them.
    const kept = before.weeklyHours?.[day as DayOfWeek];
    const open =
      closed && !rawOpen ? (kept?.open ?? "00:00") : parseTime(rawOpen);
    const close =
      closed && !rawClose ? (kept?.close ?? "00:00") : parseTime(rawClose);
    if (open === null || close === null) {
      const label = DAY_LABELS[day as DayOfWeek] ?? day;
      return refuse(
        `${label}: saatler 00:00 ile 23:59 arasında olmalı (ss:dd). Gece yarısı kapanış için 00:00 yaz.`,
        open === null ? `${day}-open` : `${day}-close`,
      );
    }
    weekly[day as DayOfWeek] = { open, close, closed };
    summary.push(closed ? `${day} Kapalı` : `${day} ${open}-${close}`);
  }
  if (!changedKeys(before, { weeklyHours: weekly })) return NO_CHANGE;
  await updateSettings({
    weeklyHours: weekly,
    openingHours: summary.join(" · "),
  });
  revalidateAll();
  return ok("hours", "Çalışma saatleri kaydedildi.", {
    before: { openingHours: before.openingHours },
    after: { openingHours: summary.join(" · ") },
  });
}

/**
 * The KDV defaults (Ayarlar > Vergi): one whole-number rate per kind of sale,
 * `taxRate_<key>` in the form. Every field is required here - "use the
 * default" is a product's or a menu item's choice, not the default's.
 *
 * The old single rate kept two decimals ("1.5" passed) and wrote them into
 * an integer column, which the database refused. Rates are whole numbers.
 *
 * A form without a key's field at all (a tab opened before `shipping`
 * existed, 18 Eki 2026) leaves that stored rate alone; an empty field is
 * still refused.
 */
export async function saveTaxAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  await requireRole("settings");
  const before = await getSettings();
  const taxRates = {} as TaxRates;
  for (const key of TAX_RATE_KEYS) {
    const raw = formData.get(`taxRate_${key}`);
    if (raw === null) {
      taxRates[key] = before.taxRates[key];
      continue;
    }
    const parsed = parseTaxRateInput(raw);
    if (!parsed.ok || parsed.value === null) {
      return refuse(
        `${TAX_RATE_LABELS[key]}: ${TAX_RATE_INPUT_ERROR}`,
        `taxRate_${key}`,
      );
    }
    taxRates[key] = parsed.value;
  }
  // The day the menu prices started to apply, printed under /menu and
  // /masa (Fiyat Etiketi Yön. m.5/2-d). A form without the field (a tab
  // opened before it existed) leaves the stored day alone.
  const dateRaw = formData.get(MENU_PRICES_DATE_FIELD);
  let menuPricesEffectiveDate: string | undefined;
  if (dateRaw !== null) {
    const day = parseMenuPricesDate(dateRaw, new Date());
    if (!day.ok) return refuse(day.error, MENU_PRICES_DATE_FIELD);
    menuPricesEffectiveDate = day.value;
  }
  const next = {
    taxRates,
    ...(menuPricesEffectiveDate === undefined
      ? {}
      : { menuPricesEffectiveDate }),
  };
  const moved = changedKeys(before, next);
  if (!moved) return NO_CHANGE;
  await updateSettings(next);
  revalidateAll();
  // The menu, the shop and karaoke pages print these rates.
  revalidatePath("/admin/menu");
  revalidatePath("/admin/urunler");
  return ok("tax", "KDV oranları ve fiyat listesi tarihi kaydedildi.", moved);
}

export async function saveShippingAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  await requireRole("settings");
  const flat = readMoney(formData.get("shippingFlat"));
  if (!flat.ok) {
    return refuse(
      flat.tooLarge
        ? MONEY_TOO_LARGE_ERROR
        : "Kargo ücreti sayı olmalı (örn. 49 ya da 49,90).",
      "shippingFlat",
    );
  }
  const threshold = readMoney(formData.get("shippingFreeThreshold"));
  if (!threshold.ok) {
    return refuse(
      threshold.tooLarge
        ? MONEY_TOO_LARGE_ERROR
        : "Ücretsiz kargo eşiği sayı olmalı (0 = kapalı).",
      "shippingFreeThreshold",
    );
  }
  // Cafe delivery (mobile app): a flat courier fee, never free - the
  // free-shipping threshold above applies to shop parcels only. Zero would
  // make every kurye order ship free, so it is rejected rather than stored.
  const courier = readMoney(formData.get("courierFee"));
  if (!courier.ok || courier.minor <= 0) {
    return refuse(
      !courier.ok && courier.tooLarge
        ? MONEY_TOO_LARGE_ERROR
        : "Kurye ücreti sıfırdan büyük bir sayı olmalı.",
      "courierFee",
    );
  }
  // The home page's "Gel-al · N dk". A form without the field (an open tab
  // from before it existed) leaves the stored value alone.
  const pickupRaw = formData.get("pickupReadyMinutes");
  let pickupReadyMinutes: number | undefined;
  if (pickupRaw !== null) {
    const n = readWholeNumber(pickupRaw);
    if (n === null || n < 1 || n > 180) {
      return refuse(
        "Gel-al hazırlık süresi 1 ile 180 dakika arasında tam sayı olmalı.",
        "pickupReadyMinutes",
      );
    }
    pickupReadyMinutes = n;
  }

  const next = {
    shippingFlatMinor: flat.minor,
    shippingFreeThresholdMinor: threshold.minor,
    courierFeeMinor: courier.minor,
    ...(pickupReadyMinutes === undefined ? {} : { pickupReadyMinutes }),
  };
  const before = await getSettings();
  const moved = changedKeys(before, next);
  if (!moved) return NO_CHANGE;
  await updateSettings(next);
  revalidateAll();
  return ok("shipping", "Kargo ve kurye ayarları kaydedildi.", moved);
}

export async function saveSeoAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  await requireRole("settings");
  const seoTitle = String(formData.get("seoTitle") ?? "").trim();
  if (seoTitle.length > 120) {
    return refuse(
      "Ana sayfa başlığı en fazla 120 karakter olabilir.",
      "seoTitle",
    );
  }
  const ogImage = String(formData.get("seoOgImageUrl") ?? "").trim();
  if (
    ogImage &&
    (!/^https?:\/\/\S+$/i.test(ogImage) || ogImage.length > 2000)
  ) {
    return refuse(
      "Paylaşım görseli http(s) ile başlayan bir adres olmalı.",
      "seoOgImageUrl",
    );
  }
  const next = {
    seoTitle,
    seoOgImageUrl: ogImage,
    seoIndexable: formData.get("seoIndexable") === "on",
  };
  const before = await getSettings();
  if (before.seoIndexable && !next.seoIndexable) {
    const ask = askToConfirm(
      formData,
      [
        {
          key: "indexing-off",
          line: "Arama motorları siteyi taramayı bırakır ve site haritası boş döner. Google'da zaten görünen sayfalar kendiliğinden düşmez; yeni ürünler ve sayfalar da aramada görünmez.",
        },
      ],
      {
        title: "Site arama motorlarına kapansın mı?",
        submitLabel: "Taramayı kapat",
      },
    );
    if (ask) return ask;
  }
  const moved = changedKeys(before, next);
  if (!moved) return NO_CHANGE;
  await updateSettings(next);
  revalidateAll();
  return ok("seo", "SEO ayarları kaydedildi.", moved);
}

const notificationsSchema = z.object({
  notificationEmail: z
    .string()
    .trim()
    .max(254, { error: "Operasyon e-postası çok uzun." })
    .refine((v) => !v || EMAIL_RE.test(v), {
      error: "Geçerli bir e-posta gir.",
    }),
  orderNotifyEnabled: z.boolean(),
  orderNotifyRoles: z
    .array(z.enum(ADMIN_ROLES as [string, ...string[]]), {
      error: "Rol seçimi geçersiz.",
    })
    .max(ADMIN_ROLES.length),
  orderNotifyEmails: z
    .string()
    .max(4000, { error: "Ek adres listesi çok uzun." })
    .transform((raw, ctx) => {
      const { valid, invalid } = parseNotifyEmails(raw);
      if (invalid.length > 0) {
        ctx.addIssue({
          code: "custom",
          message: `Geçersiz e-posta: ${invalid.slice(0, 3).join(", ")}`,
        });
        return z.NEVER;
      }
      if (valid.length > MAX_ORDER_NOTIFY_EMAILS) {
        ctx.addIssue({
          code: "custom",
          message: `En fazla ${MAX_ORDER_NOTIFY_EMAILS} ek adres yazılabilir.`,
        });
        return z.NEVER;
      }
      // Stored one per line, normalised, so the panel shows what is used.
      return valid.join("\n");
    }),
});

/**
 * How many inboxes the staff "yeni sipariş" mail would reach with these
 * settings, by the sender's own rule (resolveStaffRecipients). Null when the
 * panel accounts cannot be read: then nobody is warned on a guess.
 */
async function staffRecipientCount(input: {
  roles: string[];
  extraEmails: string;
  notificationEmail: string;
}): Promise<number | null> {
  let panelUsers: Awaited<ReturnType<typeof listAdminUsers>>;
  try {
    panelUsers = await listAdminUsers();
  } catch {
    return null;
  }
  return resolveStaffRecipients({
    enabled: true,
    roles: normalizeNotifyRoles(input.roles),
    extraEmails: input.extraEmails,
    notificationEmail: input.notificationEmail,
    panelUsers,
    envAdmins: listEnvAdminContacts(),
  }).length;
}

/**
 * Ayarlar → Bildirimler: the operations address and who gets the staff
 * "yeni sipariş" mail (`src/lib/email/staff-order-notice.ts`). Owner only,
 * like every settings tab. The audit row keeps the before/after of the
 * switch and the roles. The addresses are not logged as text, but enough of
 * them is to see a redirect: whether the operations address and the extra
 * list changed, how many addresses were added and removed, and the domains
 * on each side - so "kasa@laffogato.net" swapped for an outside inbox shows
 * as a new domain rather than as a no-op save of one address.
 *
 * Switching the mail off, or leaving it on with nobody to receive it, asks
 * first: either way the köşk stops hearing about paid orders.
 */
export async function saveNotificationsAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  await requireRole("settings");
  const parsed = notificationsSchema.safeParse({
    notificationEmail: String(formData.get("notificationEmail") ?? ""),
    orderNotifyEnabled: formData.get("orderNotifyEnabled") === "on",
    orderNotifyRoles: formData.getAll("orderNotifyRoles").map((v) => String(v)),
    orderNotifyEmails: String(formData.get("orderNotifyEmails") ?? ""),
  });
  if (!parsed.success) {
    return refuseIssues(parsed.error.issues, "Bildirim ayarları geçersiz.");
  }
  const roles = ADMIN_ROLES.filter((r) =>
    parsed.data.orderNotifyRoles.includes(r),
  );
  const before = await getSettings();
  const list = (s: string) => parseNotifyEmails(s).valid;
  const beforeList = list(before.orderNotifyEmails ?? "");
  const afterList = list(parsed.data.orderNotifyEmails);
  const beforeOps = (before.notificationEmail ?? "").trim().toLowerCase();
  const afterOps = parsed.data.notificationEmail.trim().toLowerCase();
  const unchanged =
    before.orderNotifyEnabled === parsed.data.orderNotifyEnabled &&
    JSON.stringify(normalizeNotifyRoles(before.orderNotifyRoles)) ===
      JSON.stringify(roles) &&
    (before.orderNotifyEmails ?? "") === parsed.data.orderNotifyEmails &&
    (before.notificationEmail ?? "") === parsed.data.notificationEmail;
  if (unchanged) return NO_CHANGE;

  if (before.orderNotifyEnabled && !parsed.data.orderNotifyEnabled) {
    const ask = askToConfirm(
      formData,
      [
        {
          key: "order-mail-off",
          line: "Ödemesi alınan siparişler için ekibe e-posta gitmez. Yeni siparişleri yalnız panelden görürsün.",
        },
      ],
      {
        title: "Yeni sipariş e-postası kapansın mı?",
        submitLabel: "E-postayı kapat",
      },
    );
    if (ask) return ask;
  } else if (parsed.data.orderNotifyEnabled) {
    const count = await staffRecipientCount({
      roles,
      extraEmails: parsed.data.orderNotifyEmails,
      notificationEmail: parsed.data.notificationEmail,
    });
    if (count === 0) {
      const ask = askToConfirm(
        formData,
        [
          {
            key: "no-recipients",
            line: "Seçili rollerde aktif panel kullanıcısı yok; operasyon e-postası ve ek adresler de boş. Yeni sipariş e-postası kimseye gitmez.",
          },
        ],
        {
          title: "Bu e-postayı kimse almayacak",
          submitLabel: "Yine de kaydet",
        },
      );
      if (ask) return ask;
    }
  }

  await updateSettings({
    notificationEmail: parsed.data.notificationEmail,
    orderNotifyEnabled: parsed.data.orderNotifyEnabled,
    orderNotifyRoles: roles,
    orderNotifyEmails: parsed.data.orderNotifyEmails,
  });
  revalidateAll();
  return ok("notifications", "Bildirim ayarları kaydedildi.", {
    before: {
      orderNotifyEnabled: before.orderNotifyEnabled,
      orderNotifyRoles: before.orderNotifyRoles,
      orderNotifyEmailCount: beforeList.length,
      orderNotifyEmailDomains: notifyDomains(beforeList),
      notificationEmailDomain: notifyDomains([beforeOps])[0] ?? "",
    },
    after: {
      orderNotifyEnabled: parsed.data.orderNotifyEnabled,
      orderNotifyRoles: roles,
      orderNotifyEmailCount: afterList.length,
      orderNotifyEmailDomains: notifyDomains(afterList),
      notificationEmailDomain: notifyDomains([afterOps])[0] ?? "",
    },
    changed: {
      notificationEmail: beforeOps !== afterOps,
      orderNotifyEmails:
        beforeList.length !== afterList.length ||
        beforeList.some((e) => !afterList.includes(e)),
      orderNotifyEmailsAdded: afterList.filter((e) => !beforeList.includes(e))
        .length,
      orderNotifyEmailsRemoved: beforeList.filter((e) => !afterList.includes(e))
        .length,
    },
  });
}

/** The sorted, distinct domains of a list of addresses - never the local part. */
function notifyDomains(emails: readonly string[]): string[] {
  const out = new Set<string>();
  for (const e of emails) {
    const at = e.lastIndexOf("@");
    if (at > 0) out.add(e.slice(at + 1).toLowerCase());
  }
  return [...out].sort();
}

/** What Resend's word for a domain means, for the confirm sentence. */
const UNVERIFIED_SENDER: Partial<Record<string, string>> = {
  absent: "Resend hesabında kayıtlı değil",
  not_started: "henüz doğrulanmadı",
  pending: "henüz doğrulanmadı (DNS kayıtları bekleniyor)",
  failed: "doğrulanamadı",
  temporary_failure: "şu an doğrulanamıyor",
};

/**
 * Who transactional mail comes from.
 *
 * Resend refuses any address whose domain is not verified on the account, and
 * which domain that is changes outside this codebase - a DNS record added on
 * a Tuesday. Compiling the address in would mean a deploy each time; this is
 * the panel field that avoids one.
 *
 * A new address on a domain Resend says is not verified asks first: saved,
 * it stops every mail the site sends, verification links included, and the
 * banner only turned red after the fact.
 */
export async function saveEmailSenderAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  await requireRole("settings");
  const emailFromName = String(formData.get("emailFromName") ?? "").trim();
  const emailFromAddress = String(formData.get("emailFromAddress") ?? "")
    .trim()
    .toLowerCase();
  const emailReplyTo = String(formData.get("emailReplyTo") ?? "")
    .trim()
    .toLowerCase();
  const looksLikeEmail = (s: string) => EMAIL_RE.test(s) && s.length <= 254;
  if (emailFromName.length > 80) {
    return refuse(
      "Gönderen adı en fazla 80 karakter olabilir.",
      "emailFromName",
    );
  }
  if (emailFromAddress && !looksLikeEmail(emailFromAddress)) {
    return refuse(
      "Gönderen adresi geçerli bir e-posta olmalı.",
      "emailFromAddress",
    );
  }
  if (emailReplyTo && !looksLikeEmail(emailReplyTo)) {
    return refuse("Yanıt adresi geçerli bir e-posta olmalı.", "emailReplyTo");
  }
  const next = { emailFromName, emailFromAddress, emailReplyTo };
  const before = await getSettings();
  const moved = changedKeys(before, next);
  if (!moved) {
    // Nothing to write, but Kaydet is also how an operator back from
    // Resend's Domains page asks again: the banner is read afresh.
    forgetEmailHealth();
    revalidatePath("/admin/ayarlar");
    return NO_CHANGE;
  }
  if (emailFromAddress && emailFromAddress !== before.emailFromAddress) {
    const why = UNVERIFIED_SENDER[await senderDomainStatus(emailFromAddress)];
    if (why) {
      const domain = emailFromAddress.slice(emailFromAddress.indexOf("@") + 1);
      const ask = askToConfirm(
        formData,
        [
          {
            key: `sender-unverified:${domain}`,
            line: `${domain} alan adı ${why}. Kaydedersen site hiçbir e-posta gönderemez: sipariş onayı, doğrulama bağlantısı ve şifre sıfırlama da gitmez.`,
          },
        ],
        { title: "Bu adresten e-posta çıkmaz", submitLabel: "Yine de kaydet" },
      );
      if (ask) return ask;
    }
  }
  await updateSettings(next);
  // The banner is about the address that was just changed; a two-minute cache
  // would show the operator the old verdict on the new sender.
  forgetEmailHealth();
  revalidateAll();
  return ok("email", "E-posta gönderim ayarları kaydedildi.", moved);
}

/**
 * Sends one mail and reports what the provider said.
 *
 * Every other path swallows a delivery failure on purpose - a customer must
 * not lose an order because mail bounced - so without this the operator's
 * only signal that nothing is arriving is that nothing is arriving.
 *
 * It tests the SAVED sender; the form holds the button back while the
 * sender form has unsaved changes. The banner above is read again either
 * way: a failed test is news about the sender too.
 */
export async function sendTestEmailAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  await requireRole("settings");
  const to = String(formData.get("testEmailTo") ?? "")
    .trim()
    .toLowerCase();
  if (!EMAIL_RE.test(to) || to.length > 254) {
    return refuse("Test için geçerli bir e-posta gir.", "testEmailTo");
  }
  forgetEmailHealth();
  const result = await sendTestEmail(to);
  revalidatePath("/admin/ayarlar");
  if (!result.ok) return { error: `Gönderilemedi: ${result.error}` };
  // The address is the point of the audit row: it is the one place a test
  // mail's recipient is recorded, and it left the building.
  return ok(
    "email-test",
    `Test e-postası ${to} adresine gönderildi.`,
    { to },
    "send_test",
  );
}
