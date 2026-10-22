import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  SIGNATURE_HEADER,
  signedHeaders,
  TIMESTAMP_HEADER,
} from "@/lib/panel/karaoke-sync-core";
import {
  isBarScreenOrder,
  PANEL_STAGE_MAX_BODY_BYTES,
  panelStageActor,
  panelStageMove,
  parsePanelStageChange,
} from "@/lib/panel/orders-stage-core";

/**
 * The bar screen's one-tap stages (`POST /api/panel/orders/stage`,
 * docs/PANEL-ORDERS.md "Aşama"): the panel says what was tapped and from
 * which stage, the site moves the order through its own `transitionOrder`,
 * conditional on that stage. Every way of failing the signature is refused
 * before the store is asked; a stale or impossible tap is a 409, never a
 * second move.
 */

const store = vi.hoisted(() => ({
  getOrder: vi.fn(),
  transitionOrder: vi.fn(),
}));
const safeAudit = vi.hoisted(() => vi.fn());
vi.mock("@/lib/admin/store", () => store);
vi.mock("@/lib/admin/audit", () => ({ safeAudit }));

const { POST } = await import("@/app/api/panel/orders/stage/route");

const SECRET = "s".repeat(40);
const URL_ = "https://laffogato.net/api/panel/orders/stage";

function order(over: Record<string, unknown> = {}) {
  return {
    id: "ord-0042",
    orderNo: 10234,
    status: "paid",
    kind: "cafe",
    fulfillment: "pickup",
    source: "",
    customerName: "Ayşe Yılmaz",
    customerEmail: "ayse@example.com",
    customerPhone: "05550000000",
    paidAt: new Date(Date.now() - 5 * 60_000).toISOString(),
    scheduledFor: "",
    shippedAt: "",
    totalMinor: 18000,
    items: [{ productName: "Latte", qty: 1, status: "pending", menuItemId: "mnu-1", size: "M", detail: "" }],
    ...over,
  };
}

function signed(body: string, opts: { secret?: string; url?: string; at?: number } = {}) {
  const at = opts.at ?? Date.now();
  const headers = signedHeaders(opts.secret ?? SECRET, "POST", new URL(opts.url ?? URL_), body, at);
  return new Request(URL_, { method: "POST", body, headers });
}

const tap = (over: Record<string, unknown> = {}) =>
  JSON.stringify({ id: "ord-0042", action: "ready", from: "new", actor: "Selin", ...over });

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("KARAOKE_SYNC_SECRET", SECRET);
  store.getOrder.mockReset();
  store.transitionOrder.mockReset();
  safeAudit.mockReset();
});

describe("the tap's rules", () => {
  it("allows three forward steps and nothing else", () => {
    expect(panelStageMove("preparing", "new", "pickup")).toEqual({
      transition: "start_preparing",
      expectStatus: "paid",
    });
    expect(panelStageMove("ready", "new", "table")).toEqual({
      transition: "mark_shipped",
      expectStatus: "paid",
    });
    expect(panelStageMove("ready", "preparing", "delivery")).toEqual({
      transition: "mark_shipped",
      expectStatus: "preparing",
    });
    expect(panelStageMove("delivered", "ready", "pickup")).toEqual({
      transition: "complete",
      expectStatus: "shipped",
    });
    // Impossible pairs.
    expect(panelStageMove("preparing", "preparing", "pickup")).toBeNull();
    expect(panelStageMove("ready", "ready", "pickup")).toBeNull();
    expect(panelStageMove("delivered", "ready", "table")).toBeNull();
    expect(panelStageMove("delivered", "new", "pickup")).toBeNull();
  });

  it("parses a strict body: four fields, a sane id, an actor", () => {
    expect(parsePanelStageChange(JSON.parse(tap())).ok).toBe(true);
    expect(parsePanelStageChange({ ...JSON.parse(tap()), extra: 1 })).toEqual({ ok: false, field: "body" });
    expect(parsePanelStageChange(JSON.parse(tap({ id: "../x" })))).toEqual({ ok: false, field: "id" });
    expect(parsePanelStageChange(JSON.parse(tap({ action: "cancel" })))).toEqual({ ok: false, field: "action" });
    expect(parsePanelStageChange(JSON.parse(tap({ actor: "  " })))).toEqual({ ok: false, field: "actor" });
  });

  it("deals only with café orders not typed in at the till and not parcels", () => {
    expect(isBarScreenOrder({ kind: "cafe", fulfillment: "pickup" })).toBe(true);
    expect(isBarScreenOrder({ kind: "cafe", fulfillment: "table", source: "manual" })).toBe(false);
    expect(isBarScreenOrder({ kind: "shop", fulfillment: "shipping" })).toBe(false);
  });

  it("names the panel user in the audit log the menu link's way", () => {
    expect(panelStageActor("  Selin  ")).toBe("panel:Selin");
    expect(panelStageActor("x".repeat(200))).toHaveLength("panel:".length + 80);
  });
});

describe("POST /api/panel/orders/stage", () => {
  it("is off without the shared secret", async () => {
    vi.stubEnv("KARAOKE_SYNC_SECRET", "");
    const res = await POST(signed(tap()));
    expect(res.status).toBe(503);
    expect(store.getOrder).not.toHaveBeenCalled();
  });

  it("refuses an unsigned, forged, retargeted or stale request before reading anything", async () => {
    const body = tap();
    const bare = new Request(URL_, { method: "POST", body });
    expect((await POST(bare)).status).toBe(401);
    expect((await POST(signed(body, { secret: "x".repeat(40) }))).status).toBe(401);
    expect((await POST(signed(body, { url: "https://laffogato.net/api/panel/menu" }))).status).toBe(401);
    expect((await POST(signed(body, { at: Date.now() - 10 * 60_000 }))).status).toBe(401);
    // The body is part of the signature.
    const req = signed(body);
    const tampered = new Request(URL_, {
      method: "POST",
      body: tap({ action: "delivered" }),
      headers: {
        [TIMESTAMP_HEADER]: req.headers.get(TIMESTAMP_HEADER)!,
        [SIGNATURE_HEADER]: req.headers.get(SIGNATURE_HEADER)!,
      },
    });
    expect((await POST(tampered)).status).toBe(401);
    expect(store.getOrder).not.toHaveBeenCalled();
  });

  it("refuses an oversized body and a malformed one", async () => {
    const big = JSON.stringify({ pad: "x".repeat(PANEL_STAGE_MAX_BODY_BYTES) });
    expect((await POST(signed(big))).status).toBe(413);
    const bad = await POST(signed("{nope"));
    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual({ error: "invalid", field: "body" });
  });

  it("is not_found for an unknown order and for one the bar screen never shows", async () => {
    store.getOrder.mockResolvedValueOnce(null);
    expect((await POST(signed(tap()))).status).toBe(404);
    store.getOrder.mockResolvedValueOnce(order({ kind: "shop", fulfillment: "shipping" }));
    expect((await POST(signed(tap()))).status).toBe(404);
    expect(store.transitionOrder).not.toHaveBeenCalled();
  });

  it("moves a new pickup order to ready, records the panel user, answers the screen's shape", async () => {
    store.getOrder.mockResolvedValueOnce(order());
    store.transitionOrder.mockResolvedValueOnce({
      ok: true,
      order: order({ status: "shipped", shippedAt: new Date().toISOString() }),
    });
    const res = await POST(signed(tap()));
    expect(res.status).toBe(200);
    expect(store.transitionOrder).toHaveBeenCalledWith("ord-0042", "mark_shipped", {
      actor: "panel:Selin",
      expectStatus: "paid",
    });
    expect(safeAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "transition",
        entity: "order",
        entityId: "ord-0042",
        actor: "panel:Selin",
        payload: expect.objectContaining({ transition: "mark_shipped", from: "paid", to: "shipped", via: "panel" }),
      }),
    );
    const body = await res.json();
    expect(body.order).toMatchObject({ id: "ord-0042", stage: "ready", firstName: "Ayşe" });
    // The panel never sees more than the feed gives it.
    expect(JSON.stringify(body)).not.toMatch(/Yılmaz|ayse@example|0555/);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("answers 409 with where the order is now when the card was stale", async () => {
    store.getOrder.mockResolvedValueOnce(order({ status: "preparing" }));
    const res = await POST(signed(tap({ from: "new" })));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("stale");
    expect(body.order).toMatchObject({ stage: "preparing" });
    expect(store.transitionOrder).not.toHaveBeenCalled();
  });

  it("answers 409 for a tap that does not fit the stage (a table order is never 'delivered')", async () => {
    store.getOrder.mockResolvedValueOnce(order({ fulfillment: "table", status: "shipped" }));
    const res = await POST(signed(tap({ action: "delivered", from: "ready" })));
    expect(res.status).toBe(409);
    expect(store.transitionOrder).not.toHaveBeenCalled();
  });

  it("answers 409 when the conditional move lost a race, and writes no audit row", async () => {
    store.getOrder
      .mockResolvedValueOnce(order())
      .mockResolvedValueOnce(order({ status: "cancelled" }));
    store.transitionOrder.mockResolvedValueOnce({ ok: false, error: "Sipariş bu arada değişti." });
    const res = await POST(signed(tap()));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "stale", order: null });
    expect(safeAudit).not.toHaveBeenCalled();
  });

  it("is unavailable, not an error page, when the database fails", async () => {
    store.getOrder.mockRejectedValueOnce(new Error("db down"));
    const res = await POST(signed(tap()));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "unavailable" });
  });
});
