import "server-only";

import { getDb } from "./index";

/**
 * Atomic counter — generates id sequences and order numbers. Backed by the
 * Postgres `next_seq(counter_key)` function:
 *   INSERT INTO counters (id, seq) VALUES (key, 1)
 *   ON CONFLICT (id) DO UPDATE SET seq = counters.seq + 1 RETURNING seq;
 * which is race-free across concurrent serverless invocations.
 */
export async function nextSeq(key: string): Promise<number> {
  const db = getDb();
  const { data, error } = await db.rpc("next_seq", { counter_key: key });
  if (error) {
    throw new Error(`next_seq(${key}) failed: ${error.message}`);
  }
  // bigint arrives as a string over the wire.
  const seq = typeof data === "number" ? data : Number(data);
  return Number.isFinite(seq) && seq > 0 ? seq : 1;
}
