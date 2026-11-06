import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  SIGNATURE_HEADER,
  signedHeaders,
  TIMESTAMP_HEADER,
} from "@/lib/panel/karaoke-sync-core";
import {
  PANEL_CALL_ACK_MAX_BODY_BYTES,
  panelCallAckedBy,
  parsePanelCallAck,
} from "@/lib/panel/calls-ack-core";

/**
 * The bar screen's "Gördüm" on a table call (`POST /api/panel/calls/ack`,
 * docs/PANEL-ORDERS.md "Masa çağrıları"): signed exactly like the stage
 * tap, body `{id, actor}`, idempotent, `ackedBy` "panel:<actor>".
 */

const calls = vi.hoisted(() => ({ ackTableCall: vi.fn() }));
vi.mock("@/lib/admin/table-calls", () => calls);

const { POST } = await import("@/app/api/panel/calls/ack/route");

const SECRET = "s".repeat(40);
const LAFPOS = "l".repeat(40);
const URL_ = "https://laffogato.net/api/panel/calls/ack";
const ID = "tcl-3f9a0c4b7d2e1a68";

function signed(
  body: string,
  opts: { secret?: string; url?: string; at?: number } = {},
) {
  const at = opts.at ?? Date.now();
  const headers = signedHeaders(
    opts.secret ?? SECRET,
    "POST",
    new URL(opts.url ?? URL_),
    body,
    at,
  );
  return new Request(URL_, { method: "POST", body, headers });
}

const ack = (over: Record<string, unknown> = {}) =>
  JSON.stringify({ id: ID, actor: "Selin", ...over });

function callRow(over: Record<string, unknown> = {}) {
  return {
    id: ID,
    tableCode: "K7Q2M9X4TB",
    tableName: "4",
    reason: "water",
    customerEmail: "ayse@example.com",
    createdAt: new Date(Date.now() - 60_000).toISOString(),
    ackedAt: new Date().toISOString(),
    ackedBy: "panel:Selin",
    ...over,
  };
}

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("KARAOKE_SYNC_SECRET", SECRET);
  calls.ackTableCall.mockReset();
});

describe("the body", () => {
  it("is exactly {id, actor}", () => {
    expect(parsePanelCallAck({ id: ID, actor: " Selin " })).toEqual({
      ok: true,
      ack: { id: ID, actor: "Selin" },
    });
    expect(parsePanelCallAck({ id: ID })).toEqual({
      ok: false,
      field: "actor",
    });
    expect(parsePanelCallAck({ id: "", actor: "S" })).toEqual({
      ok: false,
      field: "id",
    });
    expect(parsePanelCallAck({ id: ID, actor: "S", extra: 1 }).ok).toBe(false);
    expect(panelCallAckedBy("Selin")).toBe("panel:Selin");
    expect(panelCallAckedBy("Kasa 1", "lafpos")).toBe("lafpos:Kasa 1");
    expect(PANEL_CALL_ACK_MAX_BODY_BYTES).toBe(1024);
  });
});

describe("POST /api/panel/calls/ack", () => {
  it("answers the call and says so, writing panel:<actor>", async () => {
    calls.ackTableCall.mockResolvedValue({
      ok: true,
      call: callRow(),
      already: false,
    });
    const res = await POST(signed(ack()));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({
      ok: true,
      call: { id: ID, status: "acked" },
    });
    expect(calls.ackTableCall).toHaveBeenCalledWith(ID, "panel:Selin");
  });

  it("answers an already answered call the same way", async () => {
    calls.ackTableCall.mockResolvedValue({
      ok: true,
      call: callRow({ ackedBy: "admin:Okan" }),
      already: true,
    });
    const res = await POST(signed(ack()));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      call: { id: ID, status: "acked" },
    });
  });

  it("answers 404 not_found for an unknown call", async () => {
    calls.ackTableCall.mockResolvedValue({ ok: false, reason: "not_found" });
    const res = await POST(signed(ack({ id: "tcl-zzzzzzzzzzzzzzzz" })));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_found" });
  });

  it("refuses an unsigned, wrongly signed, retargeted or stale request before the store", async () => {
    const plain = new Request(URL_, { method: "POST", body: ack() });
    expect((await POST(plain)).status).toBe(401);
    expect((await POST(signed(ack(), { secret: "x".repeat(40) }))).status).toBe(
      401,
    );
    expect(
      (
        await POST(
          signed(ack(), {
            url: "https://laffogato.net/api/panel/orders/stage",
          }),
        )
      ).status,
    ).toBe(401);
    expect(
      (await POST(signed(ack(), { at: Date.now() - 10 * 60_000 }))).status,
    ).toBe(401);
    // A body changed after signing.
    const good = signed(ack());
    const forged = new Request(URL_, {
      method: "POST",
      body: ack({ actor: "Mallory" }),
      headers: {
        [TIMESTAMP_HEADER]: good.headers.get(TIMESTAMP_HEADER)!,
        [SIGNATURE_HEADER]: good.headers.get(SIGNATURE_HEADER)!,
      },
    });
    expect((await POST(forged)).status).toBe(401);
    expect(calls.ackTableCall).not.toHaveBeenCalled();
  });

  it("refuses a body that is not exactly {id, actor} with 400", async () => {
    const res = await POST(signed(ack({ reason: "water" })));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid");
    expect((await POST(signed("not json"))).status).toBe(400);
    expect(calls.ackTableCall).not.toHaveBeenCalled();
  });

  it("refuses more than a kilobyte with 413", async () => {
    const res = await POST(signed(ack({ actor: "x".repeat(1100) })));
    expect(res.status).toBe(413);
  });

  it("is off while no key is set (503), and says so when the store is down", async () => {
    vi.stubEnv("KARAOKE_SYNC_SECRET", "");
    expect((await POST(signed(ack()))).status).toBe(503);
    vi.stubEnv("KARAOKE_SYNC_SECRET", SECRET);
    calls.ackTableCall.mockRejectedValue(new Error("down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await POST(signed(ack()));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "unavailable" });
  });

  it("takes LafPOS with its own key and writes lafpos:<actor>", async () => {
    vi.stubEnv("LAFPOS_SYNC_SECRET", LAFPOS);
    calls.ackTableCall.mockResolvedValue({
      ok: true,
      call: callRow(),
      already: false,
    });
    const res = await POST(signed(ack({ actor: "Kasa 1" }), { secret: LAFPOS }));
    expect(res.status).toBe(200);
    expect(calls.ackTableCall).toHaveBeenCalledWith(ID, "lafpos:Kasa 1");
  });
});
