/**
 * The köşk's other branches, as the site shows them (operator, 5 Kas 2026:
 * "Laffogato Marina şubesi ... açıldı olarak göster").
 *
 * Only the SITE shows a branch. The app, its orders, the stamp card, the
 * karaoke room and the table QR serve the Tuzla köşk alone (lafmobil rule 6,
 * "tek şube gerçeği"; the operator chose "yalnız sitede"), so every page that
 * shows a branch also says so. lafmaliyet keeps its own branch register for
 * the books (`docs/SUBE.md` there); the ids match on purpose.
 *
 * NOTHING here is guessed. On 5 Kas 2026 no repository, panel or public page
 * knew Marina's street address, phone or hours, so those fields are empty and
 * a field that is empty is not printed: the card says the branch opened and
 * that its address follows. Fill a field the day the operator gives it; the
 * pages pick it up with no other change. No JSON-LD `LocalBusiness` is
 * published for a branch without a street address (an address-less place is
 * worse than none for search), and no map link without a `mapsQuery`.
 */
export interface SiteBranch {
  /** The same short id as lafmaliyet's branch register. */
  id: string;
  /** How the branch is named on the page. */
  name: string;
  /** "open" is the only state a branch is shown in. */
  status: "open";
  /** Street, number, neighbourhood: "" until known. */
  streetAddress: string;
  /** District / city line, e.g. "34940 Tuzla / İstanbul": "" until known. */
  localityLine: string;
  /** Display phone, "" until known. Dialled with its digits only. */
  phone: string;
  /** One line of hours, e.g. "Her gün 09:00 - 24:00": "" until known. */
  hoursLabel: string;
  /** What a map search is given: "" until the address is known. */
  mapsQuery: string;
}

/**
 * Operator, 5 Kas 2026: "Marina tuzla marinada". Hours the same day:
 * "açılış 10 kapanış 2300" (no days named, so none are printed). 22 Kas
 * 2026: "Marinadaki adrese tuzla viaport marina adresi yazabilirsin": the
 * marina's own address (Viaport Marina Tuzla, Cami Mahallesi, 34940 Tuzla;
 * public marina listings disagree on the street, so none is printed). The
 * unit inside the marina and the phone are still unknown and stay empty.
 * The branch's karaoke is not running yet and will not take bookings
 * (operator, 22 Kas 2026): the bookable room is the köşk's alone.
 */
export const MARINA_BRANCH: SiteBranch = {
  id: "marina",
  name: "L'Affogato Marina",
  status: "open",
  streetAddress: "Viaport Marina Tuzla, Cami Mah.",
  localityLine: "34940 Tuzla / İstanbul",
  phone: "",
  hoursLabel: "10:00 - 23:00",
  mapsQuery: "Viaport Marina Tuzla, Tuzla, İstanbul",
};

/** Every branch the site shows besides the Tuzla köşk, in page order. */
export const OTHER_BRANCHES: readonly SiteBranch[] = [MARINA_BRANCH];

/** The address lines that are known, in print order; [] when none is. */
export function branchAddressLines(branch: SiteBranch): string[] {
  return [branch.streetAddress, branch.localityLine]
    .map((l) => l.trim())
    .filter(Boolean);
}

/** The `tel:` target for a known phone, or null. */
export function branchTel(branch: SiteBranch): string | null {
  const digits = branch.phone.replace(/[^\d+]/g, "");
  return digits.length >= 10 ? digits : null;
}

/** Google Maps search for a known address, or null. */
export function branchMapUrl(branch: SiteBranch): string | null {
  const q = branch.mapsQuery.trim();
  return q
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`
    : null;
}
