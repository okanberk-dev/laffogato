// A stand-in for PayNkolay's card-storage and payment endpoints, for local
// end-to-end tests only. Hashes are checked with the real formula
// (SHA-512 base64 of the fields joined by "|" plus the merchant secret).
import http from "node:http";
import { createHash, randomBytes } from "node:crypto";

const PORT = Number(process.env.MOCK_PORT || 4010);
const SECRET = process.env.MOCK_SECRET || "merchant-secret-test";
const SX = process.env.MOCK_SX || "sx-test";

const state = { cards: {}, requests: [], down: false, seq: 1 };
const hash = (parts) =>
  createHash("sha512").update([...parts, SECRET].join("|"), "utf8").digest("base64");

async function readForm(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = Buffer.concat(chunks);
  const ct = req.headers["content-type"] || "";
  const r = new Request("http://x/", { method: "POST", headers: { "content-type": ct }, body });
  const fd = await r.formData();
  return Object.fromEntries([...fd.entries()].map(([k, v]) => [k, String(v)]));
}

function json(res, status, obj) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(obj));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  // ── control endpoints for the tests ──
  if (url.pathname === "/__state") return json(res, 200, state);
  if (url.pathname === "/__reset") { state.cards = {}; state.requests = []; state.down = false; return json(res, 200, { ok: true }); }
  if (url.pathname === "/__down") { state.down = url.searchParams.get("v") === "1"; return json(res, 200, { down: state.down }); }
  if (url.pathname === "/__seed" && req.method === "POST") {
    const chunks = []; for await (const c of req) chunks.push(c);
    const { member, cards } = JSON.parse(Buffer.concat(chunks).toString());
    state.cards[member] = cards; return json(res, 200, { ok: true });
  }
  if (req.method !== "POST") return json(res, 404, {});
  const f = await readForm(req);
  state.requests.push({ path: url.pathname, fields: f });
  if (state.down) return json(res, 503, { error: "down" });

  if (url.pathname === "/Vpos/Payment/CardStorageCardList") {
    if (f.sx !== SX || f.hashDatav2 !== hash([f.sx, f.customerKey])) {
      return json(res, 200, { result: { ProcReturnCode: "99", ErrMsg: "hashData error" } });
    }
    const list = state.cards[f.customerKey] || [];
    if (list.length === 0) return json(res, 200, { result: { ProcReturnCode: "02", ErrMsg: "Gecerli Kart Yok" } });
    return json(res, 200, { result: { ProcReturnCode: "00", Data: { totalcount: list.length, cards: { Card: { CardFileds: { Detail: list } } } } } });
  }
  if (url.pathname === "/Vpos/Payment/CardStorageCardDelete") {
    if (f.hashDatav2 !== hash([f.sx, f.customerKey, f.tranId, f.token])) {
      return json(res, 200, { result: { RESPONSE_CODE: "0", RESPONSE_DATA: "hash" } });
    }
    const list = state.cards[f.customerKey] || [];
    const left = list.filter((c) => c.Token !== f.token);
    if (left.length === list.length) return json(res, 200, { result: { RESPONSE_CODE: "0", RESPONSE_DATA: "Gecersiz Veri" } });
    state.cards[f.customerKey] = left;
    return json(res, 200, { result: { RESPONSE_CODE: "2", RESPONSE_DATA: "OK" } });
  }
  if (url.pathname === "/Vpos/v1/Payment") {
    const expected = hash([f.sx, f.clientRefCode, f.amount, f.successUrl, f.failUrl, f.rnd, f.csCustomerKey || ""]);
    if (f.hashDatav2 !== expected) return json(res, 200, { RESPONSE_CODE: "0", ERROR_MESSAGE: "hashData error" });
    if (f.csToken) {
      const card = (state.cards[f.csCustomerKey] || []).find((c) => c.Token === f.csToken);
      if (!card) return json(res, 200, { RESPONSE_CODE: "0", ERROR_MESSAGE: "Kart bulunamadi" });
    } else if (f.csAutoSave === "true" && f.csCustomerKey) {
      // Real PayNkolay stores after 3D; storing at once is enough here.
      const n = f.cardNumber;
      const id = String(state.seq++);
      (state.cards[f.csCustomerKey] ||= []).push({
        Token: "tok-" + randomBytes(6).toString("hex"), TranId: "tr-" + id,
        Maskedpan: n.slice(0, 8) + "****" + n.slice(-4), CARDISSUER: "Test Bank",
        CARDTYPE: "CREDIT", CARDBRAND: "VISA", CARD_ALIACE: f.csCardAlias || "", EXP_DATE: f.month + f.year.slice(-2),
      });
    }
    return json(res, 200, {
      RESPONSE_CODE: "2",
      REFERENCE_CODE: "REF" + state.seq,
      BANK_REQUEST_MESSAGE: '<html><body><form name="form" action="https://acs.example-bank.test/3d" method="post"><input type="hidden" name="PaReq" value="x"></form><script>document.forms["form"].submit()</script></body></html>',
    });
  }
  if (url.pathname === "/Vpos/Payment/PaymentList") return json(res, 200, { result: { LIST: [] } });
  return json(res, 404, { error: "unknown " + url.pathname });
});
server.listen(PORT, "127.0.0.1", () => console.log("mock paynkolay on " + PORT));
