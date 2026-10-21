/**
 * The record of the standard contract that lets the fA'L photo leave
 * Türkiye (OP-FAL-OFF, 18 Eki 2026). Its own module so that nothing but a
 * reviewed change to this file can fill it: `fal-core.ts` reads it, and so
 * do the route's switch (`falAiEnabled`) and the one function that sends the
 * photo (`readCupWithAI`).
 *
 * The transfer to Anthropic, PBC (USA) is not incidental - the photo goes
 * with every reading - so the member's consent (Açık Rıza Metni R12) cannot
 * carry it alone: it needs the Board's Standard Contract 2 (KVKK m.9/4-c),
 * notified to the Kurum within five business days of the later signature
 * (m.9/5, Yönetmelik m.14/5). R12 promises that no photo is sent before the
 * contract is signed AND notified, and this record is what keeps that
 * promise whatever the environment says.
 *
 * Empty until then. The enabling PR fills all three fields at once, from
 * the KVKK folder, and in the same PR dates the R12 sentence
 * ("imzalanacak ve" becomes the signing and filing days) and moves
 * `FAL_CONSENT_TEXT_DAY` (docs/LEGAL-REDLINES-2026-09.md §15.5).
 */
export type FalTransferSafeguard = {
  /** The later of the two signatures, YYYY-MM-DD. */
  readonly signedOn: string;
  /** The day the contract was filed with the Kurum, YYYY-MM-DD. */
  readonly notifiedOn: string;
  /** The filing's receipt or document number from the notification module. */
  readonly receipt: string;
};

export const FAL_TRANSFER_SAFEGUARD: FalTransferSafeguard = Object.freeze({
  signedOn: "",
  notifiedOn: "",
  receipt: "",
});
