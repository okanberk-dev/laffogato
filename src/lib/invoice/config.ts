// Pure (no I/O, no "server-only"): the e-Arşiv settings, read from the
// environment the caller hands in (docs/EARSIV.md "Ortam değişkenleri").
// The values themselves never leave the server: the panel shows the mode,
// which names are missing and what is wrong, never a value.

export type EarsivMode = "off" | "draft" | "live";

export const PARASUT_ENV = [
  "PARASUT_CLIENT_ID",
  "PARASUT_CLIENT_SECRET",
  "PARASUT_USERNAME",
  "PARASUT_PASSWORD",
  "PARASUT_COMPANY_ID",
] as const;

export const DEFAULT_PARASUT_BASE_URL = "https://api.parasut.com";

export interface ParasutConfig {
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
  companyId: string;
  /** No trailing slash; https only. */
  baseUrl: string;
}

export interface EarsivConfig {
  /** Never "off": an off feature has no config. */
  mode: "draft" | "live";
  /**
   * ISO instant (UTC). Only orders paid, and karaoke evenings ending, at or
   * after it are invoiced here: everything before was cut by hand.
   */
  startAt: string;
  parasut: ParasutConfig;
  /** Paraşüt kasa/banka account for PayNkolay collections; null: none. */
  paymentAccountId: number | null;
}

export interface EarsivConfigStatus {
  mode: EarsivMode;
  /** Null when off, or when something below is wrong. */
  config: EarsivConfig | null;
  /** Required variables that are not set (names only). */
  missing: string[];
  /** Turkish sentences, one per problem. */
  errors: string[];
}

type Env = Record<string, string | undefined>;

function value(env: Env, name: string): string {
  return String(env[name] ?? "").trim();
}

/**
 * The mode, what is missing and what is wrong. A mode other than off with
 * any problem has no config, so nothing is invoiced until it is fixed: an
 * unset EARSIV_START_AT would otherwise invoice orders that were already
 * cut by hand.
 */
export function earsivConfigStatus(env: Env): EarsivConfigStatus {
  const raw = value(env, "EARSIV_MODE").toLowerCase();
  const errors: string[] = [];
  let mode: EarsivMode = "off";
  if (raw === "draft" || raw === "live") mode = raw;
  else if (raw !== "" && raw !== "off") {
    errors.push(
      `EARSIV_MODE "${raw.slice(0, 20)}" tanınmıyor; off, draft ya da live olmalı. Kapalı sayıldı.`,
    );
  }
  if (mode === "off") return { mode, config: null, missing: [], errors };

  const missing: string[] = PARASUT_ENV.filter((name) => !value(env, name));
  const startRaw = value(env, "EARSIV_START_AT");
  let startAt = "";
  if (!startRaw) {
    missing.push("EARSIV_START_AT");
  } else {
    const ms = Date.parse(startRaw);
    // A day alone ("2026-10-23") is midnight UTC to Date.parse, and a time
    // without a zone is read in the server's zone (UTC on Vercel): both
    // three hours into the Istanbul day, so refused. The zone is written out.
    if (
      !/T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/.test(startRaw) ||
      !Number.isFinite(ms)
    ) {
      errors.push(
        "EARSIV_START_AT saat diliminiyle bir an olmalı, örneğin 2026-10-23T00:00:00+03:00.",
      );
    } else {
      startAt = new Date(ms).toISOString();
    }
  }
  const base = (
    value(env, "PARASUT_BASE_URL") || DEFAULT_PARASUT_BASE_URL
  ).replace(/\/+$/, "");
  if (!/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(base)) {
    errors.push(
      "PARASUT_BASE_URL https ile başlayan bir sunucu adresi olmalı.",
    );
  }
  const accountRaw = value(env, "EARSIV_PAYMENT_ACCOUNT_ID");
  let paymentAccountId: number | null = null;
  if (accountRaw) {
    if (/^[1-9]\d{0,14}$/.test(accountRaw))
      paymentAccountId = Number(accountRaw);
    else
      errors.push(
        "EARSIV_PAYMENT_ACCOUNT_ID Paraşüt'teki hesabın sayı kimliği olmalı.",
      );
  }
  if (missing.length > 0) {
    errors.push(`Eksik ortam değişkeni: ${missing.join(", ")}.`);
  }
  if (errors.length > 0) return { mode, config: null, missing, errors };
  return {
    mode,
    missing,
    errors,
    config: {
      mode,
      startAt,
      paymentAccountId,
      parasut: {
        clientId: value(env, "PARASUT_CLIENT_ID"),
        clientSecret: value(env, "PARASUT_CLIENT_SECRET"),
        username: value(env, "PARASUT_USERNAME"),
        // A password may well begin or end with a space: kept as given.
        password: String(env.PARASUT_PASSWORD ?? ""),
        companyId: value(env, "PARASUT_COMPANY_ID"),
        baseUrl: base,
      },
    },
  };
}

/**
 * Paraşüt's credentials alone, whatever EARSIV_MODE says: enough to read an
 * invoice that was already issued (its PDF). Turning the automation off, or
 * a later mistake in EARSIV_START_AT, must not lock members and the panel
 * out of invoices cut while it was on. Null when a credential is missing or
 * the base URL is not https.
 */
export function parasutReadConfig(env: Env): ParasutConfig | null {
  if (PARASUT_ENV.some((name) => !value(env, name))) return null;
  const base = (
    value(env, "PARASUT_BASE_URL") || DEFAULT_PARASUT_BASE_URL
  ).replace(/\/+$/, "");
  if (!/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(base)) return null;
  return {
    clientId: value(env, "PARASUT_CLIENT_ID"),
    clientSecret: value(env, "PARASUT_CLIENT_SECRET"),
    username: value(env, "PARASUT_USERNAME"),
    password: String(env.PARASUT_PASSWORD ?? ""),
    companyId: value(env, "PARASUT_COMPANY_ID"),
    baseUrl: base,
  };
}

/** The config, or null when the feature is off or misconfigured. */
export function earsivConfig(env: Env): EarsivConfig | null {
  return earsivConfigStatus(env).config;
}

/** Turkish name of a mode, for the panel. */
export const EARSIV_MODE_LABELS: Record<EarsivMode, string> = {
  off: "Kapalı",
  draft: "Taslak (resmileştirmez)",
  live: "Canlı",
};
