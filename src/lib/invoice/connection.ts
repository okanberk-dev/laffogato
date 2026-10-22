// "Paraşüt bağlantısını sına" on Faturalar: one login with the site's own
// credentials and one read of the company, so the operator knows the
// variables in Vercel are right before the first order needs them. It cuts
// nothing, writes nothing in Paraşüt and works whatever EARSIV_MODE is. The
// answer names what is wrong, never a value.

import { PARASUT_ENV, parasutReadConfig } from "./config";
import { maskText } from "./invoice-core";
import {
  ParasutAuthError,
  ParasutClient,
  ParasutError,
  type ParasutDeps,
} from "./parasut-client";

type Env = Record<string, string | undefined>;

export type ParasutCheck = { ok: true } | { ok: false; error: string };

/** How long the check may take before it gives up. */
const CHECK_BUDGET_MS = 20_000;

export async function checkParasutConnection(
  env: Env,
  deps: ParasutDeps,
): Promise<ParasutCheck> {
  const cfg = parasutReadConfig(env);
  if (!cfg) {
    const missing = PARASUT_ENV.filter(
      (name) => !String(env[name] ?? "").trim(),
    );
    return {
      ok: false,
      error:
        missing.length > 0
          ? `Paraşüt bilgileri eksik: ${missing.join(", ")}.`
          : "PARASUT_BASE_URL https ile başlayan bir sunucu adresi olmalı.",
    };
  }
  const client = new ParasutClient(cfg, deps);
  client.setDeadline((deps.now ?? Date.now)() + CHECK_BUDGET_MS);
  try {
    // The smallest read that needs both the login and the company.
    await client.request("GET", "contacts", { query: { "page[size]": 1 } });
    return { ok: true };
  } catch (err) {
    if (err instanceof ParasutAuthError) {
      return {
        ok: false,
        error:
          "Paraşüt girişi reddedildi: kullanıcı adı, şifre ya da uygulama kimliği / sırrı yanlış.",
      };
    }
    if (
      err instanceof ParasutError &&
      (err.status === 403 || err.status === 404)
    ) {
      return {
        ok: false,
        error: `Giriş yapıldı ama ${cfg.companyId} numaralı firma okunamadı: PARASUT_COMPANY_ID'yi ve kullanıcının o firmaya erişimini kontrol et.`,
      };
    }
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Paraşüt'e ulaşılamadı: ${maskText(message)}` };
  }
}
