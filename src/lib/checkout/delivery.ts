/**
 * The delivery details a web order needs, and the rules they are checked by.
 *
 * One copy for both sides: the checkout checks them as the customer types
 * (and before anything is sent), `startCheckoutAction` checks the same rules
 * again with Zod (`start-schema.ts`) - the browser's check is a courtesy, the
 * server's is the rule (CLAUDE.md rule 3). Pure and client-safe.
 */

export interface DeliveryDraft {
  customerName: string;
  customerPhone: string;
  line1: string;
  line2: string;
  district: string;
  city: string;
  zip: string;
}

export const EMPTY_DELIVERY_DRAFT: DeliveryDraft = {
  customerName: "",
  customerPhone: "",
  line1: "",
  line2: "",
  district: "",
  city: "",
  zip: "",
};

export type DeliveryField = keyof DeliveryDraft;

export const NAME_MIN = 2;
export const NAME_MAX = 100;
export const ADDRESS_MIN = 5;
export const ADDRESS_MAX = 500;

/** 10 to 13 digits: `532…`, `0532…`, `+90 532…`, with any spacing. */
export function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, "");
  return (
    digits.length >= 10 && digits.length <= 13 && /^[\d\s()+.-]+$/.test(phone)
  );
}

/** The order's one-line address, as the panel and the cargo label read it. */
export function joinAddress(parts: {
  line1: string;
  line2?: string;
  district?: string;
  city?: string;
  zip?: string;
}): string {
  return [parts.line1, parts.line2, parts.district, parts.city, parts.zip]
    .map((p) => (p ?? "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join(", ");
}

const MESSAGES = {
  customerName: "Ad soyad yaz.",
  customerPhone: "Telefon numaranı yaz (ör. 0532 123 45 67).",
  line1: "Mahalle, cadde ve bina numarasını yaz.",
  district: "İlçeyi yaz.",
  city: "Şehri yaz.",
} as const;

/**
 * Every field of a typed address that is not good enough yet, with the
 * message to show under it. Empty when the address can be sent.
 */
export function deliveryDraftErrors(
  draft: DeliveryDraft,
): Partial<Record<DeliveryField, string>> {
  const errors: Partial<Record<DeliveryField, string>> = {};
  const name = draft.customerName.trim();
  if (name.length < NAME_MIN || name.length > NAME_MAX) {
    errors.customerName = MESSAGES.customerName;
  }
  if (!isValidPhone(draft.customerPhone.trim())) {
    errors.customerPhone = MESSAGES.customerPhone;
  }
  if (draft.line1.trim().length < ADDRESS_MIN) errors.line1 = MESSAGES.line1;
  if (!draft.district.trim()) errors.district = MESSAGES.district;
  if (!draft.city.trim()) errors.city = MESSAGES.city;
  return errors;
}

/** The phone rule's message, for a saved address that has no number. */
export const PHONE_MESSAGE = MESSAGES.customerPhone;
