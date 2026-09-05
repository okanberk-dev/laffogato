import {
  listActiveAppAnnouncements,
  listActiveAppPosts,
  listActiveAppSlides,
} from "@/lib/admin/store";
import { apiJson } from "@/lib/mobile/respond";
import { routeFailure } from "@/lib/mobile/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

/**
 * Home-screen content for the mobile app.
 *
 * Public and unauthenticated on purpose: this is the same editorial copy a
 * passer-by sees on the shop window, and gating it would mean the app opens on
 * an empty screen for anyone not signed in.
 *
 * The response is an explicit allow-list rather than a spread of the row. A
 * store row carries `createdAt`, `updatedAt` and `isActive`, none of which the
 * app needs; shipping them would leak the editing history of the cafe's
 * marketing and would tie the wire format to the table shape.
 */
export async function GET() {
  try {
    const [slides, announcements, posts] = await Promise.all([
      listActiveAppSlides(),
      listActiveAppAnnouncements(),
      listActiveAppPosts(),
    ]);

    return apiJson(
      {
        slides: slides.map((s) => ({
          id: s.id,
          eyebrow: s.eyebrow,
          title: s.title,
          body: s.body,
          ctaLabel: s.ctaLabel || null,
          ctaRoute: s.ctaRoute || null,
          tone: s.tone,
          image: s.image || null,
          sortOrder: s.sortOrder,
        })),
        announcements: announcements.map((a) => ({
          id: a.id,
          kind: a.kind,
          title: a.title,
          body: a.body,
          sortOrder: a.sortOrder,
        })),
        posts: posts.map((p) => ({
          id: p.id,
          kind: p.kind,
          title: p.title,
          body: p.body,
          image: p.image || null,
          // Already https-validated on write. Sent as null rather than "" so
          // the app can test for a link without also testing for emptiness.
          linkUrl: p.linkUrl || null,
          linkLabel: p.linkLabel || null,
          sortOrder: p.sortOrder,
        })),
      },
      {
        headers: {
          // Editorial content changes on a human timescale. A minute of shared
          // cache absorbs a launch spike; stale-while-revalidate means nobody
          // ever waits on the database for a home screen.
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=600",
        },
      },
    );
  } catch (err) {
    // Only an unreachable database is a 503 the app retries into its bundled
    // seed; a mapper that throws on an unexpected row is a bug, and reporting
    // it as an outage sent the on-call looking at the database instead.
    return routeFailure("api/mobile/v1/app-content", err);
  }
}
