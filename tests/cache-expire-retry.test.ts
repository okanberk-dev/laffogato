import { AsyncLocalStorage } from "node:async_hooks";

import { describe, expect, it, vi } from "vitest";

/**
 * Why `expireTags` (src/lib/cache/tags.ts) expires every tag twice, checked
 * against the Next this repo runs, not a mock of it.
 *
 * `revalidateTag` only queues; Next sends the queue when the request ends.
 * A route handler sends it only when it returns a Response or redirects
 * (app-route/module.js `do`): a handler that throws after a write (the
 * payment return, an app endpoint, a cron) never sends it, and the bell's
 * marker would stand still until its hourly full answer. `after()` runs in
 * that case too and Next sends what its callbacks revalidated
 * (`withExecuteRevalidates`), but only what is NEW there: a tag already
 * queued with the same profile is folded into the queue that was never
 * sent. `SECOND_EXPIRY` is the same immediate expiry under a different
 * profile, so it goes out on its own.
 */

// Next's server puts AsyncLocalStorage on globalThis before its request
// storage is created; do the same before importing it.
(globalThis as { AsyncLocalStorage?: unknown }).AsyncLocalStorage ??=
  AsyncLocalStorage;

vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));
vi.mock("next/server", () => ({ after: vi.fn() }));

const { workAsyncStorage } =
  await import("next/dist/server/app-render/work-async-storage.external");
const { executeRevalidates, withExecuteRevalidates } =
  await import("next/dist/server/revalidation-utils");
const { revalidateTag } =
  await import("next/dist/server/web/spec-extension/revalidate");
const { SECOND_EXPIRY } = await import("@/lib/cache/tags");

/** What reached the cache: one entry per batch Next sent. */
type Sent = Array<{ tags: string[]; durations: unknown }>;

/** The slice of Next's per-request store that revalidation reads. */
function requestStore(sent: Sent) {
  return {
    route: "/odeme/donus",
    page: "/odeme/donus/route",
    incrementalCache: {
      revalidateTag: async (tags: string[], durations: unknown) => {
        sent.push({ tags: [...tags], durations });
      },
    },
    pendingRevalidatedTags: [] as unknown[],
    pendingRevalidates: {},
    pendingRevalidateWrites: [] as unknown[],
    cacheLifeProfiles: {},
  };
}

/** One request: the handler's own calls, then the `after()` callbacks. */
async function request(
  handler: () => void,
  opts: { returned: boolean; afterTask: () => void },
): Promise<Sent> {
  const sent: Sent = [];
  const store = requestStore(sent);
  await workAsyncStorage.run(store as never, async () => {
    handler();
    // A handler that returned: Next sends the queue (resolvePendingRevalidations).
    if (opts.returned) await executeRevalidates(store as never);
    // after(): Next runs the callbacks inside withExecuteRevalidates.
    await withExecuteRevalidates(store as never, async () => opts.afterTask());
  });
  return sent;
}

const expireNow = (tag: string) => revalidateTag(tag, { expire: 0 });

describe("the second expiry, against Next's own revalidation code", () => {
  it("a handler that threw after a write: the same profile again is never sent", async () => {
    const sent = await request(() => expireNow("live:orders"), {
      returned: false,
      afterTask: () => expireNow("live:orders"),
    });
    expect(sent).toEqual([]);
  });

  it("a handler that threw after a write: SECOND_EXPIRY is sent, as an immediate expiry", async () => {
    const sent = await request(() => expireNow("live:orders"), {
      returned: false,
      afterTask: () => revalidateTag("live:orders", SECOND_EXPIRY),
    });
    expect(sent).toEqual([{ tags: ["live:orders"], durations: { expire: 0 } }]);
  });

  it("a handler that returned: both go out, the second as a call of its own", async () => {
    const sent = await request(
      () => {
        expireNow("live:orders");
        expireNow("pub:catalog");
      },
      {
        returned: true,
        afterTask: () => {
          revalidateTag("live:orders", SECOND_EXPIRY);
          revalidateTag("pub:catalog", SECOND_EXPIRY);
        },
      },
    );
    expect(sent).toEqual([
      { tags: ["live:orders", "pub:catalog"], durations: { expire: 0 } },
      { tags: ["live:orders", "pub:catalog"], durations: { expire: 0 } },
    ]);
  });

  it("many writes in one request still send one batch each time", async () => {
    const sent = await request(
      () => {
        for (let i = 0; i < 50; i += 1) expireNow("pub:catalog");
      },
      {
        returned: true,
        afterTask: () => {
          for (let i = 0; i < 50; i += 1) {
            revalidateTag("pub:catalog", SECOND_EXPIRY);
          }
        },
      },
    );
    expect(sent).toHaveLength(2);
  });
});
