/**
 * Turkish-aware matching for the panel's search boxes (admin audit PEO-05,
 * CAT-19).
 *
 * A locale-free toLowerCase() turns "İ" into "i" plus a combining dot
 * (U+0307), so "ismail" did not find "İsmail", "italyan" did not find
 * "İtalyan Kavrum", and the box echoed the query back with the dot. And
 * no lower-casing at all makes "irmak" find "IRMAK" or "findik" find
 * "Fındık": the dotted and dotless i are different letters. foldTr()
 * lower-cases the Turkish way, drops a stray U+0307 and reads ı as i, so
 * every spelling of the I family meets. Other letters keep their marks
 * (ç, ş, ğ, ö, ü are what the operator types).
 *
 * Fold both sides, and show the operator's own text back in the box, not
 * the folded one.
 */
export function foldTr(value: string): string {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/\u0307/g, "")
    .replace(/ı/g, "i");
}

/** Whether `haystack` contains `needle`, both folded; "" matches all. */
export function includesTr(haystack: string, needle: string): boolean {
  return foldTr(haystack).includes(foldTr(needle));
}

/**
 * The same fold in SQL, for a search that runs in the database (Postgres
 * lower() and ILIKE do not fold the I family either):
 * `lower(translate(<expr>, TR_FOLD_SQL_FROM, TR_FOLD_SQL_TO))` on the
 * column and on the parameter. translate() maps İ, I and ı to i, lowers
 * the other Turkish capitals (Ç Ş Ğ Ö Ü Â Î Û) itself and drops U+0307
 * (the last FROM letter, it has no partner in TO) before lower() sees the
 * text. lower() is then left with ASCII only: under the "C" collation it
 * folds nothing else, so "ÇAY" would have missed "çay".
 *
 * Use it for a substring search (`LIKE '%' || … || '%'`), which reads
 * every row anyway. An equality lookup keeps plain lower(): the e-mail
 * indexes are built on lower(...), and a translate() around the column
 * would skip them.
 */
export const TR_FOLD_SQL_FROM = "İIıÇŞĞÖÜÂÎÛ\u0307";
export const TR_FOLD_SQL_TO = "iiiçşğöüâîû";
