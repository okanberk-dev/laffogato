import "server-only";

import { getDb } from "./client";
import { COLLECTIONS } from "./collections";

/**
 * Atomik sayaç. ID dizilerini ve sipariş numaralarını oluşturmak için.
 * MongoDB'de `findOneAndUpdate({_id}, {$inc: {seq: 1}}, {upsert: true, returnDocument:"after"})`
 * pattern'i kullanılır — race-free.
 */
export async function nextSeq(key: string): Promise<number> {
  const db = await getDb();
  const res = await db.collection(COLLECTIONS.counters).findOneAndUpdate(
    { _id: key } as never,
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after" },
  );
  const seq = (res as unknown as { seq?: number } | null)?.seq;
  if (typeof seq === "number") return seq;
  // Driver bazı sürümlerde { value: { seq } } döndürür.
  const wrapped = (res as unknown as { value?: { seq?: number } } | null)?.value;
  if (wrapped && typeof wrapped.seq === "number") return wrapped.seq;
  // En kötü senaryo: doc yoksa 1'den başla.
  return 1;
}
