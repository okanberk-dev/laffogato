// Pure and client-safe: the order's invoice wizard checks a company's VKN
// as it is typed, with the same function the server and the carriers list
// use (re-exported by ./invoice-core).

/**
 * Whether a VKN is ten digits with the right check digit (GİB's
 * algorithm). Catches a typo in a carrier's or a buyer's number before
 * Paraşüt does.
 */
export function isValidVkn(vkn: string): boolean {
  if (!/^\d{10}$/.test(vkn)) return false;
  const d = vkn.split("").map(Number);
  let sum = 0;
  for (let i = 0; i < 9; i += 1) {
    const tmp = (d[i] + 9 - i) % 10;
    let r = (tmp * 2 ** (9 - i)) % 9;
    if (tmp !== 0 && r === 0) r = 9;
    sum += r;
  }
  return (10 - (sum % 10)) % 10 === d[9];
}

/**
 * A tax office as typed, without the "V.D." / "Vergi Dairesi" people add
 * (the invoice prints "<office> V.D." itself).
 */
export function cleanTaxOffice(value: string): string {
  return value
    .trim()
    .replace(/\s+v\.?\s*d\.?$/iu, "")
    .replace(/\s+vergi\s+dairesi(\s+müdürlüğü)?$/iu, "")
    .trim();
}
