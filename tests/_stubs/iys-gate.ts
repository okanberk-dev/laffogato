/**
 * A controllable stand-in for src/lib/iys/gate.ts, for the suites that run
 * the campaign pipeline over an in-memory database (the gate itself reads
 * `iys_state`, which those fakes do not model; tests/iys-gate.test.ts and
 * tests/db-integration-iys.test.ts test it for real). `iysGate.fresh` says
 * whether the last İYS refusal check is recent; the real IysGateError is
 * thrown, so callers that tell it apart are exercised as written.
 */
export const iysGate = { fresh: true, reconciled: 0 };

export function resetIysGate(): void {
  iysGate.fresh = true;
  iysGate.reconciled = 0;
}

export async function iysGateMock(
  importOriginal: () => Promise<unknown>,
): Promise<Record<string, unknown>> {
  const real = (await importOriginal()) as typeof import("@/lib/iys/gate");
  const check = () => ({
    fresh: iysGate.fresh,
    lastCheckAt: iysGate.fresh ? "2026-10-22T08:00:00.000Z" : "",
    expiresAt: iysGate.fresh ? "2026-10-27T08:00:00.000Z" : "",
    message: iysGate.fresh ? "" : "İYS ret kontrolü hiç yapılmadı.",
  });
  return {
    ...real,
    iysSendGate: async () => check(),
    assertIysSendable: async () => {
      if (!iysGate.fresh) throw new real.IysGateError(check());
    },
    reconcileIysQuietly: async () => {
      iysGate.reconciled += 1;
      return true;
    },
  };
}
