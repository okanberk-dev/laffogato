/**
 * The confirmed contract for a mail, or null within `ms` (ASK-DURABLE).
 *
 * The order and karaoke confirmations are awaited inside a payment return
 * (src/lib/email/budget.ts `MAIL_BUDGET`): the copy must not make them wait
 * longer than its share of the budget, and must never fail them. `build`
 * runs entirely inside the race, the import of the loader included, so a
 * cold chunk counts against the same bound. A slow build, a missing
 * version or any error is logged with the record's id only (no address,
 * CLAUDE.md rule 9) and the mail goes without the file.
 *
 * Pure: no I/O of its own, no "server-only"; light enough for the mail
 * modules to import statically.
 */
export async function durableCopyWithin<T>(
  label: string,
  build: () => Promise<T | null>,
  ms: number,
): Promise<T | null> {
  if (!(ms > 0)) {
    console.warn(`[durable-copy] ${label}: no attachment (no time left)`);
    return null;
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), ms);
  });
  try {
    const result = await Promise.race([
      // Started inside the race: a throw before the first await (a failed
      // import) is a rejection here, not an escape.
      Promise.resolve().then(build),
      timeout,
    ]);
    if (result === "timeout") {
      console.warn(`[durable-copy] ${label}: no attachment (timed out)`);
      return null;
    }
    if (!result) {
      console.warn(
        `[durable-copy] ${label}: no attachment (no stored version)`,
      );
    }
    return result;
  } catch (err) {
    console.warn(
      `[durable-copy] ${label}: no attachment (${(err instanceof Error ? err.message : String(err)).slice(0, 120)})`,
    );
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
