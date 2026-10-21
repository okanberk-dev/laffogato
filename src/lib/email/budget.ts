/**
 * How long the two confirmations awaited inside a payment return may hold
 * it, the confirmed contract's copy included (ASK-DURABLE). Each is an
 * instant handed to `sendTemplate`'s `deadline` (./send.ts): no attempt
 * starts with less than a second left, each is cut at what is left, and
 * the retry is skipped when it would not fit.
 *
 * - `paid`: "ödemen alındı", inside the same 9.5 s worst case it always had
 *   (4 s, the 1.5 s pause, 4 s): the copy's read now comes out of it.
 * - `karaoke`: the booking's confirmation, one 4 s attempt as before plus
 *   the copy's read.
 * - `copy`: the longest the copy may take (its loader's import included)
 *   before the mail goes without it (src/lib/legal/durable-copy-time.ts).
 *
 * Its own module, no imports: the payment paths read it without loading
 * the mail sender, and a test that stubs the sender keeps it.
 */
export const MAIL_BUDGET = {
  paid: 9_500,
  karaoke: 5_500,
  copy: 1_500,
} as const;
