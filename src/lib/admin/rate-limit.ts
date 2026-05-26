import "server-only";

/**
 * Tiny sliding-window rate limiter for the admin login form.
 *
 * Why: brute-force shielding without pulling in Redis. The map is
 * module-scoped, so each Node process has its own counter — fine for the
 * single-VM Vercel layout we're on. When Supabase comes online, we'll
 * swap this for a Postgres-backed table (or move to Upstash) with the
 * same interface.
 *
 * Defaults: 5 failures inside 5 minutes triggers a 1-minute lockout.
 */

const WINDOW_MS = 5 * 60 * 1000;
const MAX_FAILS = 5;
const LOCKOUT_MS = 60 * 1000;

interface Entry {
  fails: number[];
  lockedUntil: number;
}

const entries = new Map<string, Entry>();
let lastSweep = 0;
const SWEEP_INTERVAL = 60 * 1000;

function sweepIfDue(now: number) {
  if (now - lastSweep < SWEEP_INTERVAL) return;
  lastSweep = now;
  for (const [key, entry] of entries) {
    const recent = entry.fails.filter((t) => now - t < WINDOW_MS);
    if (recent.length === 0 && entry.lockedUntil <= now) {
      entries.delete(key);
    } else {
      entry.fails = recent;
    }
  }
}

function bucketKey(ip: string, email: string): string {
  return `${ip || "unknown"}::${email.trim().toLowerCase()}`;
}

export interface RateLimitStatus {
  blocked: boolean;
  retryAfterSeconds: number;
  remaining: number;
}

export function checkLoginLimit(ip: string, email: string): RateLimitStatus {
  const now = Date.now();
  sweepIfDue(now);
  const key = bucketKey(ip, email);
  const entry = entries.get(key);
  if (!entry) return { blocked: false, retryAfterSeconds: 0, remaining: MAX_FAILS };

  if (entry.lockedUntil > now) {
    return {
      blocked: true,
      retryAfterSeconds: Math.ceil((entry.lockedUntil - now) / 1000),
      remaining: 0,
    };
  }
  const recent = entry.fails.filter((t) => now - t < WINDOW_MS);
  return {
    blocked: false,
    retryAfterSeconds: 0,
    remaining: Math.max(0, MAX_FAILS - recent.length),
  };
}

export function recordLoginFailure(ip: string, email: string): RateLimitStatus {
  const now = Date.now();
  const key = bucketKey(ip, email);
  const entry = entries.get(key) ?? { fails: [], lockedUntil: 0 };
  entry.fails.push(now);
  entry.fails = entry.fails.filter((t) => now - t < WINDOW_MS);
  if (entry.fails.length >= MAX_FAILS) {
    entry.lockedUntil = now + LOCKOUT_MS;
    entry.fails = []; // reset window so the count starts fresh post-lockout
  }
  entries.set(key, entry);
  return checkLoginLimit(ip, email);
}

export function clearLoginLimit(ip: string, email: string): void {
  entries.delete(bucketKey(ip, email));
}
