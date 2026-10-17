/**
 * Stock codes made from a product name: "Çay Bardağı" is CAYB-00012.
 *
 * Client-safe (no "server-only"): the store derives the code on save, and
 * the product wizard shows the same prefix as the SKU field's placeholder.
 *
 * Admin audit CAT-18: the wizard used to prefill "<PREFIX>-00001" for every
 * product, so the store's sequence-numbered code never ran and two products
 * with the same first four letters shared one SKU. The prefix also dropped
 * every Turkish letter ("Çay Bardağı" gave AYBA, "Şeker Kutusu" EKER):
 * Turkish letters now fold to their Latin base, the way slugify does.
 */

/** The four-letter prefix of a name: Turkish letters folded, padded with X. */
export function skuPrefix(name: string): string {
  return name
    .replace(/ı/g, "i")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "")
    .slice(0, 4)
    .toUpperCase()
    .padEnd(4, "X");
}

/** The full code: the prefix and the product's sequence number, 5 digits. */
export function deriveSku(name: string, n: number): string {
  return `${skuPrefix(name)}-${String(n).padStart(5, "0")}`;
}
