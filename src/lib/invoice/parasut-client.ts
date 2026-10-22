import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
} from "node:crypto";

import type { ParasutConfig } from "./config";
import { maskText, MAX_PDF_BYTES } from "./invoice-core";

/**
 * Paraşüt API v4 client for selling (docs/EARSIV.md). Ported from the köşk
 * panel's live-proven read-only client (RiosenBeq/lafmaliyet
 * src/server/parasut/client.ts), with writes added:
 *
 * - OAuth2 "password" grant, refreshed with "refresh_token". Paraşüt hands
 *   a new refresh token on every refresh (rotation), so the newest one is
 *   written at once, sealed (AES-256-GCM, key derived from the Paraşüt
 *   secrets: the database alone cannot open it), and two refreshes never
 *   run at once: a short lease in invoice_state stands in for the panel's
 *   advisory lock (this site's data layer has no transactions).
 * - JSON:API bodies; serial calls at least 1.1 s apart (10 requests per
 *   10 s); 429 waits for Retry-After (at most 60 s); 5xx backs off 2/4/8 s
 *   on reads; 401 refreshes once.
 * - A POST is never repeated after a 5xx or a lost answer: it may have
 *   landed. It fails as `ambiguous`, and the caller looks before it posts
 *   again (run.ts).
 * - A per-run deadline: no request starts that could end after it.
 * - Errors carry Paraşüt's x-request-id and are masked (rule 9).
 */

const TOKEN_KEY = "parasut.token";
const TOKEN_LEASE_KEY = "parasut.token.lease";
const LEASE_MS = 20_000;
export const MIN_GAP_MS = 1100;
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RETRY_AFTER_MS = 60_000;
const BACKOFF_MS = [2_000, 4_000, 8_000];
const MAX_429_RETRIES = 3;

export interface StoredToken {
  access: string;
  refresh: string | null;
  /** epoch ms */
  expiresAt: number;
  clientId: string;
  username: string;
}

/** Where the sealed token lives (invoice_state in production, memory in tests). */
export interface TokenStore {
  read(key: string): Promise<string | null>;
  write(key: string, sealed: string): Promise<void>;
  /** Takes or renews a lease; true when the caller holds it. */
  lease(
    key: string,
    owner: string,
    nowIso: string,
    untilIso: string,
  ): Promise<boolean>;
}

export interface ParasutDeps {
  tokens: TokenStore;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

export class ParasutError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly options: {
      body?: string;
      requestId?: string;
      /** A write whose answer was lost: it may have been applied. */
      ambiguous?: boolean;
      /** Paraşüt's own error lines, masked. */
      details?: string[];
    } = {},
  ) {
    super(message);
  }
  get ambiguous(): boolean {
    return Boolean(this.options.ambiguous);
  }
}

/** /oauth/token refused: wrong password or client. Not retried. */
export class ParasutAuthError extends ParasutError {}

/** The run's time is up; it resumes where it stopped next time. */
export class ParasutDeadlineError extends ParasutError {
  constructor() {
    super("Süre doldu; kalan iş bir sonraki çalıştırmada sürecek.", 0);
  }
}

/** Paraşüt's own error lines out of a body (JSON:API or OAuth), masked. */
export function parasutErrorDetails(body: string): string[] {
  try {
    const j = JSON.parse(body) as {
      errors?: Array<{ title?: string; detail?: string } | string>;
      error_description?: string;
      error?: string;
    };
    const lines = (j.errors ?? [])
      .map((e) => (typeof e === "string" ? e : e.detail || e.title || ""))
      .filter(Boolean);
    if (lines.length) return lines.map((l) => maskText(String(l)));
    const oauth = j.error_description || j.error;
    return oauth ? [maskText(String(oauth))] : [];
  } catch {
    return body.trim() ? [maskText(body.trim().slice(0, 200))] : [];
  }
}

/** A Turkish sentence for a refused request. */
export function parasutErrorText(status: number, body: string): string {
  const detail = parasutErrorDetails(body).join("; ");
  if (status === 401)
    return `Paraşüt girişi reddedildi (kullanıcı, parola ya da istemci bilgisi hatalı). ${detail}`.trim();
  if (status === 403)
    return `Paraşüt kullanıcısının bu firmaya ya da işleme yetkisi yok. ${detail}`.trim();
  if (status === 404) return `Paraşüt'te kayıt bulunamadı. ${detail}`.trim();
  if (status === 422)
    return `Paraşüt isteği kabul etmedi: ${detail || "geçersiz alan"}`;
  if (status === 429)
    return "Paraşüt istek sınırına takıldı; biraz sonra yeniden denenecek.";
  if (status >= 500)
    return "Paraşüt şu an yanıt vermiyor; biraz sonra yeniden denenecek.";
  return `Paraşüt isteği kabul etmedi (HTTP ${status}). ${detail}`.trim();
}

function sealKey(cfg: ParasutConfig): Buffer {
  return createHash("sha256")
    .update(
      `laffogato-earsiv-token:${cfg.clientId}:${cfg.clientSecret}:${cfg.password}`,
    )
    .digest();
}

export function sealToken(cfg: ParasutConfig, token: StoredToken): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", sealKey(cfg), iv);
  const data = Buffer.concat([
    cipher.update(JSON.stringify(token), "utf8"),
    cipher.final(),
  ]);
  return [iv, cipher.getAuthTag(), data]
    .map((b) => b.toString("base64url"))
    .join(".");
}

export function openToken(
  cfg: ParasutConfig,
  sealed: string,
): StoredToken | null {
  try {
    const [iv, tag, data] = sealed
      .split(".")
      .map((p) => Buffer.from(p, "base64url"));
    const decipher = createDecipheriv("aes-256-gcm", sealKey(cfg), iv);
    decipher.setAuthTag(tag);
    const t = JSON.parse(
      Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8"),
    ) as StoredToken;
    // A token taken for another client or user is not this one's.
    if (t.clientId !== cfg.clientId || t.username !== cfg.username) return null;
    return t;
  } catch {
    return null;
  }
}

export type Query = Record<string, string | number | undefined>;

export interface JsonResource<A = Record<string, unknown>> {
  id: string;
  type: string;
  attributes: A;
  relationships?: Record<
    string,
    {
      data?:
        | { id: string; type: string }
        | Array<{ id: string; type: string }>
        | null;
    }
  >;
}

export interface JsonDocument<A = Record<string, unknown>> {
  data: JsonResource<A>;
  included?: JsonResource[];
}

export interface JsonList<A = Record<string, unknown>> {
  data: JsonResource<A>[];
  included?: JsonResource[];
  meta?: { total_pages?: number; total_count?: number };
}

type Method = "GET" | "POST" | "PUT" | "DELETE";

export class ParasutClient {
  private lastCall = 0;
  private token: StoredToken | null = null;
  private deadlineAt = Number.POSITIVE_INFINITY;
  private readonly owner = randomUUID();
  private readonly doFetch: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly now: () => number;

  constructor(
    private readonly cfg: ParasutConfig,
    private readonly deps: ParasutDeps,
  ) {
    this.doFetch = deps.fetch ?? ((...a) => fetch(...a));
    this.sleep = deps.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.now = deps.now ?? (() => Date.now());
  }

  get companyId(): string {
    return this.cfg.companyId;
  }

  /** No request starts after this instant (epoch ms). */
  setDeadline(at: number): void {
    this.deadlineAt = at;
  }

  /** Time left before the deadline, ms. */
  timeLeft(): number {
    return this.deadlineAt - this.now();
  }

  private ensureTime(waitMs = 0): void {
    if (this.now() + waitMs + REQUEST_TIMEOUT_MS > this.deadlineAt) {
      throw new ParasutDeadlineError();
    }
  }

  private async timed(
    label: string,
    url: string,
    init: RequestInit,
  ): Promise<Response> {
    try {
      return await this.doFetch(url, {
        ...init,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (e) {
      const name = (e as Error)?.name;
      const timeout = name === "TimeoutError" || name === "AbortError";
      throw new ParasutError(
        timeout
          ? `Paraşüt ${REQUEST_TIMEOUT_MS / 1000} saniye içinde yanıt vermedi (${label}).`
          : `Paraşüt'e bağlanılamadı (${label}).`,
        0,
        {
          ambiguous:
            init.method === "POST" ||
            init.method === "PUT" ||
            init.method === "DELETE",
        },
      );
    }
  }

  private async throttle(): Promise<void> {
    const wait = this.lastCall + MIN_GAP_MS - this.now();
    if (wait > 0) await this.sleep(wait);
    this.lastCall = this.now();
  }

  // ── token ───────────────────────────────────────────────────────────────

  private async loadStored(): Promise<StoredToken | null> {
    const sealed = await this.deps.tokens.read(TOKEN_KEY);
    return sealed ? openToken(this.cfg, sealed) : null;
  }

  private async requestToken(
    params: Record<string, string>,
  ): Promise<StoredToken> {
    this.ensureTime();
    await this.throttle();
    const res = await this.timed(
      params.grant_type === "refresh_token" ? "oturum yenileme" : "giriş",
      `${this.cfg.baseUrl}/oauth/token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: new URLSearchParams({
          client_id: this.cfg.clientId,
          client_secret: this.cfg.clientSecret,
          redirect_uri: "urn:ietf:wg:oauth:2.0:oob",
          ...params,
        }).toString(),
      },
    );
    const body = await res.text();
    if (!res.ok) {
      throw new ParasutAuthError(
        parasutErrorText(res.status === 400 ? 401 : res.status, body),
        res.status,
        { requestId: res.headers.get("x-request-id") ?? undefined },
      );
    }
    const j = JSON.parse(body) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      created_at?: number;
    };
    const created = j.created_at ? j.created_at * 1000 : this.now();
    const token: StoredToken = {
      access: j.access_token,
      refresh: j.refresh_token ?? null,
      expiresAt: created + (j.expires_in ?? 7200) * 1000,
      clientId: this.cfg.clientId,
      username: this.cfg.username,
    };
    // At once: the refresh token just spent is gone at Paraşüt.
    await this.deps.tokens.write(TOKEN_KEY, sealToken(this.cfg, token));
    return token;
  }

  private fresh(t: StoredToken | null): t is StoredToken {
    return Boolean(t && t.expiresAt - this.now() > 120_000);
  }

  /** The access token; `force` after a 401. */
  async accessToken(force = false): Promise<string> {
    if (!force) {
      this.token ??= await this.loadStored();
      if (this.fresh(this.token)) return this.token.access;
    }
    const stale = this.token?.access ?? null;
    // One refresh at a time across processes: wait briefly for the lease,
    // and take whatever another holder stored meanwhile.
    let held = false;
    for (let i = 0; i < 10; i += 1) {
      const now = this.now();
      held = await this.deps.tokens.lease(
        TOKEN_LEASE_KEY,
        this.owner,
        new Date(now).toISOString(),
        new Date(now + LEASE_MS).toISOString(),
      );
      if (held) break;
      await this.sleep(500);
      const current = await this.loadStored();
      if (this.fresh(current) && current.access !== stale) {
        this.token = current;
        return current.access;
      }
    }
    try {
      const current = await this.loadStored();
      if (this.fresh(current) && current.access !== stale) {
        this.token = current;
        return current.access;
      }
      const refresh = current?.refresh ?? this.token?.refresh;
      if (refresh) {
        try {
          this.token = await this.requestToken({
            grant_type: "refresh_token",
            refresh_token: refresh,
          });
          return this.token.access;
        } catch (e) {
          // A refresh refused (rotated away, revoked) or unanswered: sign in
          // with the password instead.
          if (!(e instanceof ParasutError) || e instanceof ParasutDeadlineError)
            throw e;
        }
      }
      this.token = await this.requestToken({
        grant_type: "password",
        username: this.cfg.username,
        password: this.cfg.password,
      });
      return this.token.access;
    } finally {
      if (held) {
        const now = new Date(this.now()).toISOString();
        // Released by expiring it now.
        await this.deps.tokens
          .lease(TOKEN_LEASE_KEY, this.owner, now, now)
          .catch(() => false);
      }
    }
  }

  // ── requests ────────────────────────────────────────────────────────────

  private url(path: string, query: Query): string {
    const url = new URL(
      `${this.cfg.baseUrl}/v4/${encodeURIComponent(this.cfg.companyId)}/${path.replace(/^\//, "")}`,
    );
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
    }
    return url.toString();
  }

  /**
   * One request with the retry rules above. Null for a 204 and for the
   * statuses in `nullOn`.
   */
  async request(
    method: Method,
    path: string,
    {
      query = {},
      body,
      nullOn = [],
    }: { query?: Query; body?: unknown; nullOn?: number[] } = {},
  ): Promise<Response | null> {
    const url = this.url(path, query);
    const label = `${method} ${path.split("/")[0]}`;
    let refreshed = false;
    let tooMany = 0;
    let serverErrors = 0;
    for (;;) {
      this.ensureTime();
      const token = await this.accessToken();
      await this.throttle();
      const res = await this.timed(label, url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
      if (res.status === 204 || nullOn.includes(res.status)) return null;
      if (res.ok) return res;
      const text = await res.text();
      const requestId = res.headers.get("x-request-id") ?? undefined;
      if (res.status === 401 && !refreshed) {
        refreshed = true;
        await this.accessToken(true);
        continue;
      }
      if (res.status === 429 && tooMany < MAX_429_RETRIES) {
        tooMany += 1;
        const after = Number(res.headers.get("retry-after"));
        const wait = Math.min(
          MAX_RETRY_AFTER_MS,
          Number.isFinite(after) && after > 0 ? after * 1000 : 10_000,
        );
        this.ensureTime(wait);
        await this.sleep(wait);
        continue;
      }
      if (
        res.status >= 500 &&
        method !== "POST" &&
        serverErrors < BACKOFF_MS.length
      ) {
        const wait = BACKOFF_MS[serverErrors];
        serverErrors += 1;
        this.ensureTime(wait);
        await this.sleep(wait);
        continue;
      }
      const details = parasutErrorDetails(text);
      if (requestId) {
        console.warn(
          `[earsiv] Paraşüt ${label} HTTP ${res.status} x-request-id=${requestId} ${maskText(details.join("; "))}`,
        );
      }
      throw new ParasutError(parasutErrorText(res.status, text), res.status, {
        requestId,
        details,
        ambiguous: res.status >= 500 && method === "POST",
      });
    }
  }

  private async json<T>(res: Response | null): Promise<T | null> {
    if (!res) return null;
    const text = await res.text();
    if (!text.trim()) return null;
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new ParasutError(
        "Paraşüt'ün yanıtı okunamadı (JSON değil).",
        res.status,
      );
    }
  }

  async get<T>(
    path: string,
    query: Query = {},
    nullOn: number[] = [],
  ): Promise<T | null> {
    return this.json<T>(await this.request("GET", path, { query, nullOn }));
  }

  async post<T>(
    path: string,
    body: unknown,
    query: Query = {},
  ): Promise<T | null> {
    return this.json<T>(await this.request("POST", path, { query, body }));
  }

  async put<T>(
    path: string,
    body: unknown,
    query: Query = {},
  ): Promise<T | null> {
    return this.json<T>(await this.request("PUT", path, { query, body }));
  }

  /** DELETE; a 404 (already gone) is not an error. */
  async del(path: string): Promise<void> {
    await this.request("DELETE", path, { nullOn: [404] });
  }

  /**
   * The e-Arşiv PDF: Paraşüt answers 204 while it renders, then a URL valid
   * for an hour. Asked up to `tries` times, 2 s apart; null when still not
   * ready. The URL is downloaded here and never handed to a browser.
   */
  async pdfUrl(
    eDocumentType: string,
    eDocumentId: string,
    tries = 4,
  ): Promise<string | null> {
    for (let i = 0; i < tries; i += 1) {
      const res = await this.get<{ data?: { attributes?: { url?: string } } }>(
        `${encodeURIComponent(eDocumentType)}/${encodeURIComponent(eDocumentId)}/pdf`,
      );
      const url = res?.data?.attributes?.url;
      if (typeof url === "string" && /^https:\/\//i.test(url)) return url;
      if (i < tries - 1) {
        this.ensureTime(2_000);
        await this.sleep(2_000);
      }
    }
    return null;
  }

  /** Downloads a PDF: https only, size-capped, `%PDF` header checked. */
  async downloadPdf(url: string): Promise<Buffer> {
    if (!/^https:\/\//i.test(url)) {
      throw new ParasutError("PDF adresi güvenli değil (https değil).", 0);
    }
    this.ensureTime();
    const res = await this.timed("PDF", url, { method: "GET" });
    if (!res.ok)
      throw new ParasutError(
        `PDF indirilemedi (HTTP ${res.status}).`,
        res.status,
      );
    const declared = Number(res.headers.get("content-length") ?? 0);
    if (declared > MAX_PDF_BYTES) throw new ParasutError("PDF çok büyük.", 413);
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length > MAX_PDF_BYTES)
      throw new ParasutError("PDF çok büyük.", 413);
    if (bytes.subarray(0, 4).toString("latin1") !== "%PDF") {
      throw new ParasutError("Paraşüt'ten gelen dosya PDF değil.", 0);
    }
    return bytes;
  }
}
