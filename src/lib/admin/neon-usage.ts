import "server-only";

import {
  neonLimitFrom,
  parseNeonProject,
  type NeonUsageRead,
} from "./neon-usage-core";

/**
 * The read half of Sistem durumu's Neon row: this billing period's compute
 * from Neon's own API, for the owner. Neon's control plane answers it, so
 * reading never wakes the database. Off unless the deployment has both
 * `NEON_API_KEY` and `NEON_PROJECT_ID`; the key is read here only, sent to
 * Neon only, and never logged. Pure rules: ./neon-usage-core.ts.
 */

const NEON_API = "https://console.neon.tech/api/v2";

/** The dashboard does not wait longer: past this the row says unreadable. */
export const NEON_READ_TIMEOUT_MS = 3_000;

/** A good answer is kept this long per server; Neon's counters lag anyway. */
export const NEON_MEMO_MS = 10 * 60_000;

/**
 * A failed one is kept this long: an API that hangs or refuses costs each
 * server one wait a minute, not one per owner view (review of #235).
 */
export const NEON_FAIL_MEMO_MS = 60_000;

/** Neon's project ids ("misty-cell-35394291"); anything else is not sent. */
const PROJECT_ID = /^[a-z0-9-]{1,64}$/;

let memo: { until: number; read: NeonUsageRead } | null = null;
let inFlight: Promise<NeonUsageRead> | null = null;

/** Drops the kept answer (tests; a changed key takes a new server anyway). */
export function forgetNeonUsage(): void {
  memo = null;
  inFlight = null;
}

/** The plan's monthly hours (`NEON_CU_HOURS_LIMIT`; the Free plan's 100). */
export function neonLimit(
  env: Record<string, string | undefined> = process.env,
): number | null {
  return neonLimitFrom(env.NEON_CU_HOURS_LIMIT);
}

/** The key and project when both are set and the project is an id. */
export function neonConfig(
  env: Record<string, string | undefined> = process.env,
): { key: string; project: string } | null {
  const key = env.NEON_API_KEY?.trim() ?? "";
  const project = env.NEON_PROJECT_ID?.trim() ?? "";
  return key && PROJECT_ID.test(project) ? { key, project } : null;
}

/**
 * Never throws: one status line must not take the page down. A refused
 * key, a timeout or an unexpected body is `unreadable`, logged by its
 * class (HTTP status, error name), never the body. Views that ask at the
 * same time share one question; a good answer is not kept past its
 * period's end, so a new month is read as soon as it begins.
 */
export async function loadNeonUsage(
  now: Date = new Date(),
  fetchImpl: typeof fetch = fetch,
): Promise<NeonUsageRead> {
  const config = neonConfig();
  if (!config) return { kind: "off" };
  if (memo && now.getTime() < memo.until) return memo.read;
  inFlight ??= askNeon(config, now, fetchImpl).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function askNeon(
  config: { key: string; project: string },
  now: Date,
  fetchImpl: typeof fetch,
): Promise<NeonUsageRead> {
  const read = await readNeon(config, now, fetchImpl);
  const keep =
    read.kind === "usage"
      ? Math.min(NEON_MEMO_MS, Date.parse(read.usage.periodEnd) - now.getTime())
      : NEON_FAIL_MEMO_MS;
  memo = keep > 0 ? { until: now.getTime() + keep, read } : null;
  return read;
}

async function readNeon(
  config: { key: string; project: string },
  now: Date,
  fetchImpl: typeof fetch,
): Promise<NeonUsageRead> {
  try {
    const res = await fetchImpl(`${NEON_API}/projects/${config.project}`, {
      headers: {
        Authorization: `Bearer ${config.key}`,
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(NEON_READ_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error(`[admin] Neon usage unreadable: HTTP ${res.status}`);
      return { kind: "unreadable" };
    }
    const usage = parseNeonProject(await res.json(), now);
    if (!usage) {
      console.error("[admin] Neon usage unreadable: unexpected body");
      return { kind: "unreadable" };
    }
    return { kind: "usage", usage };
  } catch (err) {
    console.error(
      `[admin] Neon usage unreadable: ${err instanceof Error ? err.name : "error"}`,
    );
    return { kind: "unreadable" };
  }
}
