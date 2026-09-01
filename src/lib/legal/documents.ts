import { LEGAL_CONTENT, type LegalDocSource } from "./content";
import { fillTokens, hasEmptyToken } from "./entity";

/**
 * Hukuki belge modeli.
 *
 * İçerik `./content.ts` içinde ham metin olarak, şirket bilgisi geçen her yerde
 * `{{TOKEN}}` yer tutucusuyla durur. Bu modül tokenları `./entity.ts`'teki tek
 * kaynaktan doldurur; değeri **bilinmeyen** (boş) bir token içeren tablo satırı
 * veya liste maddesi tamamen düşürülür — böylece belgede "MERSİS:" yazıp
 * karşısı boş kalan bir satır hiç render edilmez.
 */

export interface LegalSection {
  /** H2 başlık — "1. Taraflar" gibi numaralı. */
  heading: string;
  /** Düz paragraflar (markdown'sız). */
  paragraphs?: string[];
  /** İsteğe bağlı sıralı liste. */
  ordered?: string[];
  /** İsteğe bağlı sırasız liste. */
  bullets?: string[];
  /** Anahtar/değer tablosu — kimlik ve özet bilgilerinde kullanılır. */
  table?: { key: string; value: string }[];
}

export interface LegalDoc {
  slug: string;
  title: string;
  shortTitle: string;
  /** Sayfanın altındaki son güncelleme tarihi. */
  updatedAt: string;
  /** Üst eyebrow (kategori). */
  category: string;
  /** H1'in altındaki kısa özet. */
  summary: string;
  /** Yasal dayanaklar. */
  references?: string[];
  sections: LegalSection[];
}

export type { LegalDocSource };

/** Tüm belgelerin ortak yürürlük/revizyon tarihi. */
export const LEGAL_UPDATED = "1 Eylül 2026";

/**
 * /hukuk dizin sayfasındaki kategori sırası. Listede olmayan bir kategori
 * sona eklenir, böylece yeni kategori eklemek burayı güncellemeyi zorunlu
 * kılmaz.
 */
export const LEGAL_CATEGORY_ORDER = [
  "Sipariş",
  "Ödeme & Güvenlik",
  "Veri & Gizlilik",
  "Site & Üyelik",
  "Kurumsal",
] as const;

/**
 * Ödeme adımında onaylanması zorunlu belgeler. Mesafeli Sözleşmeler
 * Yönetmeliği, siparişten **önce** ön bilgilendirmenin yapıldığının ve
 * tüketicinin bunu teyit ettiğinin kanıtlanmasını arar; sanal POS
 * başvurularında da aynı kayıt istenir.
 */
export const CHECKOUT_CONSENT_DOCS = [
  "on-bilgilendirme-formu",
  "mesafeli-satis-sozlesmesi",
] as const;

// ── Token doldurma ──────────────────────────────────────────────────────────

/** Değeri bilinen tokenları doldurur; bilinmeyeni içeren satırı düşürür. */
function fillList(items: string[] | undefined): string[] | undefined {
  if (!items?.length) return undefined;
  const out = items.filter((t) => !hasEmptyToken(t)).map(fillTokens);
  return out.length ? out : undefined;
}

function fillTable(
  rows: { key: string; value: string }[] | undefined,
): { key: string; value: string }[] | undefined {
  if (!rows?.length) return undefined;
  const out = rows
    // Karşılığı bilinmeyen satır (MERSİS, ticaret sicil, KEP, IBAN) gizlenir.
    .filter((r) => !hasEmptyToken(r.value) && fillTokens(r.value).trim() !== "")
    .map((r) => ({ key: fillTokens(r.key), value: fillTokens(r.value) }));
  return out.length ? out : undefined;
}

function hydrateSection(s: LegalSection): LegalSection {
  return {
    heading: fillTokens(s.heading),
    paragraphs: fillList(s.paragraphs),
    ordered: fillList(s.ordered),
    bullets: fillList(s.bullets),
    table: fillTable(s.table),
  };
}

/** Bir bölümde hiç içerik kalmadıysa (hepsi boş token'dı) render etme. */
function hasContent(s: LegalSection): boolean {
  return Boolean(
    s.paragraphs?.length ||
    s.ordered?.length ||
    s.bullets?.length ||
    s.table?.length,
  );
}

function hydrate(src: LegalDocSource): LegalDoc {
  return {
    slug: src.slug,
    title: fillTokens(src.title),
    shortTitle: fillTokens(src.shortTitle),
    updatedAt: LEGAL_UPDATED,
    category: src.category,
    summary: fillTokens(src.summary),
    references: src.references?.length
      ? src.references.map(fillTokens)
      : undefined,
    sections: src.sections.map(hydrateSection).filter(hasContent),
  };
}

function categoryRank(category: string): number {
  const i = (LEGAL_CATEGORY_ORDER as readonly string[]).indexOf(category);
  return i === -1 ? LEGAL_CATEGORY_ORDER.length : i;
}

/** Yayındaki tüm hukuki belgeler — kategori sırasına göre. */
export const LEGAL_DOCS: LegalDoc[] = LEGAL_CONTENT.map(hydrate).sort(
  (a, b) => categoryRank(a.category) - categoryRank(b.category),
);

export function findLegalDoc(slug: string): LegalDoc | undefined {
  return LEGAL_DOCS.find((d) => d.slug === slug);
}
