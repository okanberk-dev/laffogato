/**
 * An in-memory stand-in for the slice of the query builder the campaign
 * e-mail module uses: four tables, the filters/order/limit/head-count the
 * module chains, and the four plpgsql functions it calls through `rpc()`,
 * re-implemented over the same rows with the same rules as
 * db/migrations/20260908150000_campaign_emails.sql as amended by
 * 20260908170000_campaign_email_reconsent.sql (consent re-read at claim,
 * `postedAt`, the bulletin consent register, fresh batch numbers for rows
 * that come back, a mark scoped to its own claim). What it cannot model is
 * the claim's per-campaign row lock: two claims here never overlap.
 *
 * Mutations return rows only when `.select()` is chained, exactly like
 * src/lib/db/client.ts - the single-use unsubscribe and the draft-only edit
 * both read their outcome off that row count.
 */

import { randomBytes } from "node:crypto";

export type FakeRow = Record<string, unknown>;

export const FAKE_TABLES = {
  customers: "customers",
  newsletterSubscribers: "newsletter_subscribers",
  campaignEmails: "campaign_emails",
  campaignEmailSends: "campaign_email_sends",
} as const;

/** What the two skip/fail pre-passes of the claim function write. */
export const CONSENT_WITHDRAWN = "onay geri çekildi ya da kitle dışına çıktı";
export const POST_UNCONFIRMED = "sağlayıcı yanıtı teyit edilemedi";

let store: Record<string, FakeRow[]> = {};
let nextSendId = 1;
let rpcFaults: Record<string, { code: string; message: string }> = {};

export function resetFakeDb(): void {
  store = {};
  for (const table of Object.values(FAKE_TABLES)) store[table] = [];
  nextSendId = 1;
  rpcFaults = {};
}

/**
 * Makes the NEXT call of a plpgsql function fail with a query error - the
 * transient database failure a max:1 pool produces between a provider's
 * "accepted" and the runner's mark.
 */
export function failNextRpc(
  fn: string,
  error: { code: string; message: string } = {
    code: "57P01",
    message: "terminating connection due to administrator command",
  },
): void {
  rpcFaults[fn] = error;
}

export function seedRows(table: string, rows: FakeRow[]): void {
  store[table] = rows.map((r) => ({ ...r }));
}

export function rowsOf(table: string): FakeRow[] {
  return (store[table] ?? []).map((r) => ({ ...r }));
}

resetFakeDb();

type Op = "select" | "insert" | "update" | "delete";
type FilterOp = "eq" | "neq" | "in" | "gte" | "lt" | "ilike" | "any";
type Filter = [string, FilterOp, unknown];

/** One alternative of `.anyOf()` (src/lib/db/sql.ts AnyOfCondition). */
interface AnyOf {
  column: string;
  op: "eq" | "ieq" | "ilike" | "foldLike";
  value: unknown;
}

/** A LIKE pattern as a RegExp: `%`, `_`, and `\` escaping either. */
function likeRegex(pattern: string, flags: string): RegExp {
  let out = "";
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === "\\" && i + 1 < pattern.length) {
      out += pattern[++i].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    } else if (c === "%") out += ".*";
    else if (c === "_") out += ".";
    else out += c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${out}$`, flags);
}

/** Postgres translate(): each `from` letter becomes its `to` partner or goes. */
function translate(text: string, from: string, to: string): string {
  const fromChars = [...from];
  const toChars = [...to];
  return [...text]
    .map((ch) => {
      const at = fromChars.indexOf(ch);
      if (at < 0) return ch;
      return at < toChars.length ? toChars[at] : "";
    })
    .join("");
}

function matchesAny(row: FakeRow, c: AnyOf): boolean {
  const cell = String(row[c.column] ?? "");
  switch (c.op) {
    case "eq":
      return row[c.column] === c.value;
    case "ieq":
      return cell.toLowerCase() === String(c.value).toLowerCase();
    case "ilike":
      return likeRegex(String(c.value), "i").test(cell);
    case "foldLike": {
      const v = c.value as { pattern: string; from: string; to: string };
      const fold = (x: string) => translate(x, v.from, v.to).toLowerCase();
      return likeRegex(fold(v.pattern), "").test(fold(cell));
    }
  }
}

interface FakeResult {
  data: unknown;
  error: { code: string; message: string } | null;
  status: number;
  count: number | null;
}

function compare(a: unknown, b: unknown): number {
  const left = String(a ?? "");
  const right = String(b ?? "");
  return left < right ? -1 : left > right ? 1 : 0;
}

function matches(row: FakeRow, [column, op, value]: Filter): boolean {
  const cell = row[column];
  switch (op) {
    case "eq":
      return cell === value;
    case "neq":
      return cell !== value;
    case "in":
      return (value as unknown[]).includes(cell);
    case "gte":
      return compare(cell, value) >= 0;
    case "lt":
      return compare(cell, value) < 0;
    case "ilike": {
      const pattern = String(value)
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        .replace(/%/g, ".*")
        .replace(/_/g, ".");
      return new RegExp(`^${pattern}$`, "i").test(String(cell ?? ""));
    }
    case "any":
      return (value as AnyOf[]).some((c) => matchesAny(row, c));
  }
}

/** The unique indexes the module relies on for its 23505 branches. */
function duplicateOf(table: string, row: FakeRow, rows: FakeRow[]): string {
  const lower = (v: unknown) => String(v ?? "").toLowerCase();
  if (table === FAKE_TABLES.campaignEmailSends) {
    return rows.some(
      (r) => r.campaignId === row.campaignId && r.email === row.email,
    )
      ? "campaign_email_sends_recipient_key"
      : "";
  }
  if (table === FAKE_TABLES.customers) {
    if (rows.some((r) => lower(r.email) === lower(row.email)))
      return "customers_email_key";
    if (row.unsubToken && rows.some((r) => r.unsubToken === row.unsubToken))
      return "customers_unsub_token_idx";
    return "";
  }
  if (table === FAKE_TABLES.newsletterSubscribers) {
    if (rows.some((r) => lower(r.email) === lower(row.email)))
      return "newsletter_subscribers_email_key";
    return "";
  }
  if (table === FAKE_TABLES.campaignEmails) {
    return rows.some((r) => r.id === row.id) ? "campaign_emails_pkey" : "";
  }
  return "";
}

class FakeQuery implements PromiseLike<unknown> {
  private readonly filters: Filter[] = [];
  private readonly orders: Array<{ column: string; ascending: boolean }> = [];
  private limitValue: number | null = null;
  private offsetValue = 0;
  private single = false;
  private returning = false;
  private head = false;

  constructor(
    private readonly op: Op,
    private readonly table: string,
    private readonly payload?: FakeRow | FakeRow[],
    options?: { count?: "exact"; head?: boolean },
  ) {
    if (op === "select") {
      this.returning = true;
      this.head = options?.head === true && options.count === "exact";
    }
  }

  select() {
    this.returning = true;
    return this;
  }
  eq(column: string, value: unknown) {
    this.filters.push([column, "eq", value]);
    return this;
  }
  neq(column: string, value: unknown) {
    this.filters.push([column, "neq", value]);
    return this;
  }
  in(column: string, values: readonly unknown[]) {
    this.filters.push([column, "in", [...values]]);
    return this;
  }
  gte(column: string, value: unknown) {
    this.filters.push([column, "gte", value]);
    return this;
  }
  lt(column: string, value: unknown) {
    this.filters.push([column, "lt", value]);
    return this;
  }
  ilike(column: string, value: string) {
    this.filters.push([column, "ilike", value]);
    return this;
  }
  order(column: string, options?: { ascending?: boolean }) {
    this.orders.push({ column, ascending: options?.ascending !== false });
    return this;
  }
  limit(count: number) {
    this.limitValue = count;
    return this;
  }
  offset(count: number) {
    this.offsetValue = count;
    return this;
  }
  anyOf(conditions: readonly AnyOf[]) {
    this.filters.push(["", "any", [...conditions]]);
    return this;
  }
  maybeSingle() {
    this.single = true;
    return this;
  }

  /** Live references into the store, so an update mutates in place. */
  private matched(): FakeRow[] {
    let found = (store[this.table] ?? []).filter((row) =>
      this.filters.every((f) => matches(row, f)),
    );
    if (this.orders.length > 0) {
      found = [...found].sort((a, b) => {
        for (const o of this.orders) {
          const c = compare(a[o.column], b[o.column]);
          if (c !== 0) return o.ascending ? c : -c;
        }
        return 0;
      });
    }
    if (this.offsetValue > 0 || this.limitValue !== null) {
      found = found.slice(
        this.offsetValue,
        this.limitValue === null
          ? undefined
          : this.offsetValue + this.limitValue,
      );
    }
    return found;
  }

  private run(): FakeResult {
    if (this.op === "select") {
      const found = this.matched();
      if (this.head) {
        return { data: null, error: null, status: 200, count: found.length };
      }
      return {
        data: this.single
          ? found[0]
            ? { ...found[0] }
            : null
          : found.map((r) => ({ ...r })),
        error: null,
        status: 200,
        count: null,
      };
    }
    if (this.op === "insert") {
      const incoming = (
        Array.isArray(this.payload) ? this.payload : [this.payload ?? {}]
      ) as FakeRow[];
      const rows = (store[this.table] ??= []);
      const added: FakeRow[] = [];
      for (const raw of incoming) {
        const row = { ...raw };
        const dup = duplicateOf(this.table, row, rows);
        if (dup) {
          return {
            data: null,
            error: { code: "23505", message: `duplicate key: ${dup}` },
            status: 400,
            count: null,
          };
        }
        if (
          this.table === FAKE_TABLES.campaignEmailSends &&
          row.id === undefined
        ) {
          row.id = nextSendId++;
        }
        rows.push(row);
        added.push({ ...row });
      }
      return {
        data: this.returning ? added : null,
        error: null,
        status: 201,
        count: null,
      };
    }
    if (this.op === "update") {
      const touched = this.matched();
      for (const row of touched) Object.assign(row, this.payload);
      return {
        data: this.returning ? touched.map((r) => ({ ...r })) : null,
        error: null,
        status: 200,
        count: null,
      };
    }
    const doomed = new Set(this.matched());
    store[this.table] = (store[this.table] ?? []).filter(
      (row) => !doomed.has(row),
    );
    return {
      data: this.returning ? [...doomed].map((r) => ({ ...r })) : null,
      error: null,
      status: 200,
      count: null,
    };
  }

  then<R1, R2 = never>(
    onOk?: ((v: unknown) => R1 | PromiseLike<R1>) | null,
    onErr?: ((e: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return Promise.resolve(this.run()).then(onOk, onErr);
  }
}

// ── The plpgsql functions, in JavaScript ───────────────────────────────────

interface AudienceRow {
  email: string;
  name: string;
  kind: "customer" | "subscriber";
  token: string;
}

function prefsOf(row: FakeRow): Record<string, unknown> {
  const p = row.notificationPrefs;
  return p && typeof p === "object" ? (p as Record<string, unknown>) : {};
}

/**
 * The bulletin's consent register: an active newsletter_subscribers row with
 * a consent stamp for the address. `customers` has no stamp of its own for
 * the `newsletter` preference.
 */
function hasNewsletterConsent(email: string): boolean {
  const needle = email.toLowerCase();
  return (store[FAKE_TABLES.newsletterSubscribers] ?? []).some(
    (s) =>
      String(s.email ?? "").toLowerCase() === needle &&
      s.isActive === true &&
      String(s.consentAt ?? "") !== "",
  );
}

function memberInAudience(c: FakeRow, pref: string): boolean {
  const email = String(c.email ?? "");
  const consented =
    pref === "marketing"
      ? String(c.marketingConsentAt ?? "") !== ""
      : hasNewsletterConsent(email);
  return (
    c.isActive === true &&
    c.emailVerified === true &&
    prefsOf(c)[pref] === true &&
    consented &&
    !email.toLowerCase().endsWith("@laffogato.local") &&
    !email.toLowerCase().endsWith("@anon.local")
  );
}

/** `campaign_email_audience(p_audience, p_pref)` - the rule, mirrored. */
export function fakeAudience(audience: string, pref: string): AudienceRow[] {
  const out = new Map<string, AudienceRow>();
  if (audience === "marketing" || audience === "both") {
    for (const c of store[FAKE_TABLES.customers] ?? []) {
      if (!memberInAudience(c, pref)) continue;
      const email = String(c.email).toLowerCase();
      out.set(email, {
        email,
        name: String(c.name ?? ""),
        kind: "customer",
        token: String(c.unsubToken ?? ""),
      });
    }
  }
  if (audience === "newsletter" || audience === "both") {
    for (const s of store[FAKE_TABLES.newsletterSubscribers] ?? []) {
      if (
        s.isActive !== true ||
        String(s.consentAt ?? "") === "" ||
        String(s.unsubToken ?? "") === ""
      ) {
        continue;
      }
      const email = String(s.email).toLowerCase();
      // distinct on (email) … order by (kind = 'customer') desc
      if (out.has(email)) continue;
      out.set(email, {
        email,
        name: String(s.name ?? ""),
        kind: "subscriber",
        token: String(s.unsubToken),
      });
    }
  }
  return [...out.values()].sort((a, b) => compare(a.email, b.email));
}

function ok(data: unknown): FakeResult {
  return { data, error: null, status: 200, count: null };
}

function enqueue(args: FakeRow): FakeResult {
  const campaignId = String(args.p_campaign);
  const audience = String(args.p_audience);
  const pref = String(args.p_pref);
  const now = String(args.p_now);
  const base = String(args.p_unsub_base);
  if (!["marketing", "newsletter", "both"].includes(audience)) {
    return {
      data: null,
      error: {
        code: "P0001",
        message: `campaign_email_enqueue: unknown audience ${audience}`,
      },
      status: 400,
      count: null,
    };
  }
  if (audience !== "newsletter") {
    for (const c of store[FAKE_TABLES.customers] ?? []) {
      if (String(c.unsubToken ?? "") === "" && memberInAudience(c, pref)) {
        c.unsubToken = randomBytes(32).toString("hex");
      }
    }
  }
  const sends = (store[FAKE_TABLES.campaignEmailSends] ??= []);
  const lastBatch = () =>
    sends
      .filter((s) => s.campaignId === campaignId)
      .reduce((m, s) => Math.max(m, Number(s.batchNo)), -1);
  // Skipped rows go back only for a recipient the rule still names, re-read
  // as the rule names them now - and under a FRESH batch number after the
  // last in use, a hundred to a batch in e-mail order: their old batch may
  // have been posted for the others, and its key is spent for that set.
  // The rest stay skipped and say why.
  const current = new Map(
    fakeAudience(audience, pref).map((a) => [a.email, a]),
  );
  const backBase = lastBatch() + 1;
  const back = sends
    .filter(
      (s) =>
        s.campaignId === campaignId &&
        s.status === "skipped" &&
        current.get(String(s.email))?.token,
    )
    .sort((a, b) => compare(a.email, b.email));
  back.forEach((s, i) => {
    const a = current.get(String(s.email))!;
    Object.assign(s, {
      status: "queued",
      error: "",
      claimedAt: "",
      postedAt: "",
      recipientKind: a.kind,
      name: a.name,
      unsubUrl: base + a.token,
      batchNo: backBase + Math.floor(i / 100),
    });
  });
  for (const s of sends) {
    if (s.campaignId === campaignId && s.status === "skipped") {
      s.error = CONSENT_WITHDRAWN;
    }
  }
  const existing = sends.filter((s) => s.campaignId === campaignId);
  // Newcomers continue after the rows that came back.
  const nextBatch = lastBatch() + 1;
  const have = new Set(existing.map((s) => s.email));
  const newcomers = [...current.values()].filter(
    (a) => a.token !== "" && !have.has(a.email),
  );
  newcomers.forEach((a, i) => {
    sends.push({
      id: nextSendId++,
      campaignId,
      email: a.email,
      recipientKind: a.kind,
      name: a.name,
      unsubUrl: base + a.token,
      batchNo: nextBatch + Math.floor(i / 100),
      status: "queued",
      providerId: "",
      error: "",
      claimedAt: "",
      postedAt: "",
      createdAt: now,
      sentAt: "",
    });
  });
  const total = sends.filter((s) => s.campaignId === campaignId).length;
  const campaign = (store[FAKE_TABLES.campaignEmails] ?? []).find(
    (c) => c.id === campaignId,
  );
  if (campaign) {
    Object.assign(campaign, {
      status: "queued",
      total,
      queuedAt: now,
      lastError: "",
    });
  }
  return ok(newcomers.length);
}

function claim(args: FakeRow): FakeResult {
  const campaignId = String(args.p_campaign);
  const staleBefore = String(args.p_stale_before);
  const postedBefore = String(args.p_posted_before ?? "");
  const now = String(args.p_now);
  const campaign = (store[FAKE_TABLES.campaignEmails] ?? []).find(
    (c) => c.id === campaignId,
  );
  if (!campaign) return ok([]);
  const pref =
    campaign.template === "bulten-kampanya" ? "newsletter" : "marketing";
  const stale = (s: FakeRow) =>
    s.status === "sending" && String(s.claimedAt ?? "") < staleBefore;
  const eligible = (s: FakeRow) =>
    s.campaignId === campaignId && (s.status === "queued" || stale(s));
  const rows = store[FAKE_TABLES.campaignEmailSends] ?? [];

  // 1. Posted, never settled, window closed → failed, never re-posted.
  let touched = 0;
  for (const s of rows) {
    if (
      s.campaignId === campaignId &&
      stale(s) &&
      String(s.postedAt ?? "") !== "" &&
      String(s.postedAt) < postedBefore
    ) {
      Object.assign(s, { status: "failed", error: POST_UNCONFIRMED });
      touched += 1;
    }
  }
  // 2. Consent re-read now: each row against its own store, with the
  //    campaign's preference; the stored link must carry the current token.
  const okKeys = new Set(
    [...fakeAudience("marketing", pref), ...fakeAudience("newsletter", pref)]
      .filter((a) => a.token !== "")
      .map((a) => `${a.kind}:${a.email}:${a.token}`),
  );
  for (const s of rows) {
    if (!eligible(s) || String(s.postedAt ?? "") !== "") continue;
    const url = String(s.unsubUrl ?? "");
    const token = url.slice(url.lastIndexOf("=") + 1);
    if (!okKeys.has(`${s.recipientKind}:${s.email}:${token}`)) {
      Object.assign(s, {
        status: "skipped",
        error: CONSENT_WITHDRAWN,
        claimedAt: "",
      });
      touched += 1;
    }
  }
  if (touched > 0) refreshCounters(campaignId);

  const candidates = rows.filter(eligible);
  if (candidates.length === 0) return ok([]);
  const target = Math.min(...candidates.map((s) => Number(s.batchNo)));
  const picked = candidates
    .filter((s) => Number(s.batchNo) === target)
    .sort((a, b) => compare(a.email, b.email));
  for (const s of picked)
    Object.assign(s, { status: "sending", claimedAt: now });
  return ok(picked.map((s) => ({ ...s })));
}

function refreshCounters(campaignId: string): void {
  const all = (store[FAKE_TABLES.campaignEmailSends] ?? []).filter(
    (s) => s.campaignId === campaignId,
  );
  const campaign = (store[FAKE_TABLES.campaignEmails] ?? []).find(
    (c) => c.id === campaignId,
  );
  if (!campaign) return;
  campaign.sentCount = all.filter((s) => s.status === "sent").length;
  campaign.failedCount = all.filter(
    (s) => s.status === "failed" || s.status === "skipped",
  ).length;
}

/** `campaign_email_mark(…, p_claimed_at)` - only the rows of the caller's own claim. */
function mark(args: FakeRow): FakeResult {
  const campaignId = String(args.p_campaign);
  const batchNo = Number(args.p_batch);
  const status = String(args.p_status);
  const ids = Array.isArray(args.p_ids) ? (args.p_ids as unknown[]) : [];
  const errorText = String(args.p_error ?? "");
  const now = String(args.p_now);
  const claimedAt = String(args.p_claimed_at ?? "");
  const rows = (store[FAKE_TABLES.campaignEmailSends] ?? [])
    .filter(
      (s) =>
        s.campaignId === campaignId &&
        Number(s.batchNo) === batchNo &&
        s.status === "sending" &&
        String(s.claimedAt ?? "") === claimedAt,
    )
    .sort((a, b) => compare(a.email, b.email));
  rows.forEach((s, idx) => {
    Object.assign(s, {
      status,
      providerId: String(ids[idx] ?? ""),
      error: errorText,
      sentAt: status === "sent" ? now : "",
    });
  });
  refreshCounters(campaignId);
  return ok(null);
}

function rpcCall(fn: string, args: FakeRow): FakeResult {
  const fault = rpcFaults[fn];
  if (fault) {
    delete rpcFaults[fn];
    return { data: null, error: fault, status: 500, count: null };
  }
  switch (fn) {
    case "campaign_email_audience_count":
      return ok(
        fakeAudience(String(args.p_audience), String(args.p_pref)).length,
      );
    case "campaign_email_enqueue":
      return enqueue(args);
    case "campaign_email_claim":
      return claim(args);
    case "campaign_email_mark":
      return mark(args);
    default:
      return {
        data: null,
        error: { code: "42883", message: `function ${fn} does not exist` },
        status: 400,
        count: null,
      };
  }
}

export function fakeCampaignDb() {
  return {
    TABLES: FAKE_TABLES,
    getDb: () => ({
      from: (table: string) => ({
        select: (
          _columns?: string,
          options?: { count?: "exact"; head?: boolean },
        ) => new FakeQuery("select", table, undefined, options),
        insert: (values: FakeRow | FakeRow[]) =>
          new FakeQuery("insert", table, values),
        update: (patch: FakeRow) => new FakeQuery("update", table, patch),
        delete: () => new FakeQuery("delete", table),
      }),
      rpc: (fn: string, args: FakeRow = {}) =>
        Promise.resolve(rpcCall(fn, args)),
    }),
  };
}
