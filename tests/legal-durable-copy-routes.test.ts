import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The two downloads of the confirmed contract (decision ASK-DURABLE): the
 * member's order page and the karaoke booking's signed link. Only the
 * owner gets the file - the signed-in member who owns the order (by the
 * order page's own rule: a verified address, a paid order), the holder of
 * the booking's person-specific link (the existing HMAC scheme,
 * karaoke-link.ts). Everyone else gets one and the same 404: no session,
 * another member's order, an unknown or malformed number, a forged or
 * expired link, an unpaid booking. The file goes out as an attachment,
 * private and never cached, and can run nothing if rendered.
 */

const h = vi.hoisted(() => ({
  customer: null as null | { email: string; emailVerified: boolean },
  orders: [] as Record<string, unknown>[],
  reservation: null as null | Record<string, unknown>,
  orderDurableCopy: vi.fn(),
  karaokeDurableCopy: vi.fn(),
  getActiveCustomer: vi.fn(),
  customerOrdersByEmail: vi.fn(),
  getReservation: vi.fn(),
}));

vi.mock("@/lib/customer/auth", () => ({
  getActiveCustomer: h.getActiveCustomer,
}));
// The real member rule (memberOrders + memberMaySeeOrder) over these rows.
vi.mock("@/lib/admin/store", () => ({
  customerOrdersByEmail: h.customerOrdersByEmail,
}));
vi.mock("@/lib/legal/durable-copy-load", () => ({
  orderDurableCopy: h.orderDurableCopy,
  karaokeDurableCopy: h.karaokeDurableCopy,
}));
vi.mock("@/lib/mobile/karaoke", async () => {
  const core = await vi.importActual<typeof import("@/lib/mobile/karaoke-core")>(
    "@/lib/mobile/karaoke-core",
  );
  return {
    getReservation: h.getReservation,
    paymentStatusOf: core.paymentStatusOf,
  };
});
process.env.KARAOKE_LINK_SECRET = "k".repeat(40);

const orderRoute = await import(
  "@/app/uye/hesap/siparislerim/[orderNo]/sozlesme/route"
);
const karaokeRoute = await import("@/app/rezervasyon/sozlesme/route");
const { signKaraokeLink } = await import("@/lib/mobile/karaoke-link");
const { ownsReservation } = await import("@/lib/mobile/karaoke-payment");

const OWNER = "eda@example.com";
const COPY = {
  filename: "siparis-10042-on-bilgilendirme-ve-sozlesme.html",
  html: "<!DOCTYPE html><p>kopya</p>",
  links: [],
};

function paidOrder(patch: Record<string, unknown> = {}) {
  return {
    id: "ord-1",
    orderNo: 10042,
    status: "paid",
    paidAt: "2026-10-21T10:00:00.000Z",
    refunds: [],
    customerEmail: OWNER,
    ...patch,
  };
}

const getOrder = (orderNo: string) =>
  orderRoute.GET(new Request(`https://laffogato.net/uye/hesap/siparislerim/${orderNo}/sozlesme`), {
    params: Promise.resolve({ orderNo }),
  });

async function snapshot(res: Response) {
  return {
    status: res.status,
    body: await res.text(),
    type: res.headers.get("content-type"),
    cache: res.headers.get("cache-control"),
    sniff: res.headers.get("x-content-type-options"),
    disposition: res.headers.get("content-disposition"),
  };
}

const NOT_FOUND = {
  status: 404,
  body: "Bulunamadı.",
  type: "text/plain; charset=utf-8",
  cache: "private, no-store",
  sniff: "nosniff",
  disposition: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  h.getActiveCustomer.mockImplementation(async () => h.customer);
  h.customerOrdersByEmail.mockImplementation(async (email: string) =>
    h.orders.filter((o) => o.customerEmail === email),
  );
  h.orderDurableCopy.mockResolvedValue(COPY);
  h.karaokeDurableCopy.mockResolvedValue({
    ...COPY,
    filename: "karaoke-sozlesme-KRK-00042.html",
  });
  h.getReservation.mockImplementation(async () => h.reservation);
  h.customer = { email: OWNER, emailVerified: true };
  h.orders = [paidOrder()];
});

describe("GET /uye/hesap/siparislerim/{orderNo}/sozlesme", () => {
  it("gives the owner the file: attachment, private, never cached, nothing runs", async () => {
    const res = await getOrder("10042");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe(COPY.html);
    expect(res.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(res.headers.get("content-disposition")).toBe(
      'attachment; filename="siparis-10042-on-bilgilendirme-ve-sozlesme.html"',
    );
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("content-security-policy")).toContain("default-src 'none'");
    expect(res.headers.get("content-security-policy")).toContain("sandbox");
    expect(h.orderDurableCopy).toHaveBeenCalledWith(
      expect.objectContaining({ id: "ord-1", orderNo: 10042 }),
    );
  });

  it("answers a guest with the plain 404, and reads no order", async () => {
    h.customer = null;
    expect(await snapshot(await getOrder("10042"))).toEqual(NOT_FOUND);
    expect(h.customerOrdersByEmail).not.toHaveBeenCalled();
    expect(h.orderDurableCopy).not.toHaveBeenCalled();
  });

  it("answers another member exactly as an unknown order", async () => {
    h.customer = { email: "baska@example.com", emailVerified: true };
    const other = await snapshot(await getOrder("10042"));
    h.customer = { email: OWNER, emailVerified: true };
    const unknown = await snapshot(await getOrder("99999"));
    expect(other).toEqual(NOT_FOUND);
    expect(unknown).toEqual(NOT_FOUND);
    expect(h.orderDurableCopy).not.toHaveBeenCalled();
  });

  it("follows the order page's rule: an unverified address, an unpaid attempt get nothing", async () => {
    h.customer = { email: OWNER, emailVerified: false };
    expect(await snapshot(await getOrder("10042"))).toEqual(NOT_FOUND);
    h.customer = { email: OWNER, emailVerified: true };
    h.orders = [paidOrder({ status: "pending_payment", paidAt: "" })];
    expect(await snapshot(await getOrder("10042"))).toEqual(NOT_FOUND);
    expect(h.orderDurableCopy).not.toHaveBeenCalled();
  });

  it("answers a malformed number before it reads the session", async () => {
    for (const no of ["0", "010042", "10042abc", "-1", "1e5", "..%2Fx", "123456789012345"]) {
      expect(await snapshot(await getOrder(no)), no).toEqual(NOT_FOUND);
    }
    expect(h.getActiveCustomer).not.toHaveBeenCalled();
  });

  it("answers an order with no stored copy (placed before, or manual) with the same 404", async () => {
    h.orderDurableCopy.mockResolvedValue(null);
    expect(await snapshot(await getOrder("10042"))).toEqual(NOT_FOUND);
  });
});

function booking(patch: Record<string, unknown> = {}) {
  return {
    id: "krk-00042",
    customerEmail: OWNER,
    contactEmail: "",
    customerName: "Eda Yılmaz",
    // Far ahead, so the link has not expired.
    date: "2099-10-30",
    startHour: 20,
    hours: 2,
    guests: 4,
    status: "confirmed",
    paymentStatus: "paid",
    totalMinor: 90_000,
    paidMinor: 90_000,
    ...patch,
  };
}

const getKaraoke = (token: string | null) =>
  karaokeRoute.GET(
    new Request(
      token === null
        ? "https://laffogato.net/rezervasyon/sozlesme"
        : `https://laffogato.net/rezervasyon/sozlesme?t=${encodeURIComponent(token)}`,
    ),
  );

describe("GET /rezervasyon/sozlesme?t=<signed link>", () => {
  it("gives the holder of the booking's own link the file", async () => {
    h.reservation = booking();
    const token = signKaraokeLink(booking() as never);
    // The very check the booking's page makes.
    expect(ownsReservation({ kind: "link", token }, booking() as never)).toBe(true);
    const res = await getKaraoke(token);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toBe(
      'attachment; filename="karaoke-sozlesme-KRK-00042.html"',
    );
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(h.karaokeDurableCopy).toHaveBeenCalledWith(
      expect.objectContaining({ id: "krk-00042" }),
    );
  });

  it("answers no token, a malformed one and a forged one with the same 404", async () => {
    h.reservation = booking();
    const good = signKaraokeLink(booking() as never);
    const [id, exp, sig] = good.split(".");
    const forged = [
      `${id}.${exp}.${sig.slice(0, -2)}AA`,
      `krk-00043.${exp}.${sig}`,
      `${id}.${Number(exp) + 3600}.${sig}`,
      "krk-00042",
      "<script>",
    ];
    const answers = [
      await snapshot(await getKaraoke(null)),
      ...(await Promise.all(forged.map(async (t) => snapshot(await getKaraoke(t))))),
    ];
    for (const a of answers) expect(a).toEqual(NOT_FOUND);
    expect(h.karaokeDurableCopy).not.toHaveBeenCalled();
  });

  it("answers a link signed for another address (the booking moved on) with the 404", async () => {
    const token = signKaraokeLink(booking({ contactEmail: "eski@example.com" }) as never);
    h.reservation = booking({ contactEmail: "yeni@example.com" });
    expect(await snapshot(await getKaraoke(token))).toEqual(NOT_FOUND);
  });

  it("answers an expired link with the 404", async () => {
    const past = booking({ date: "2020-01-01" });
    h.reservation = past;
    const token = signKaraokeLink(past as never);
    expect(await snapshot(await getKaraoke(token))).toEqual(NOT_FOUND);
  });

  it("gives nothing for a booking whose payment never made it a contract", async () => {
    for (const paymentStatus of ["none", "pending", "expired"]) {
      h.reservation = booking({ paymentStatus, status: "requested" });
      const token = signKaraokeLink(h.reservation as never);
      expect(await snapshot(await getKaraoke(token)), paymentStatus).toEqual(
        NOT_FOUND,
      );
    }
    expect(h.karaokeDurableCopy).not.toHaveBeenCalled();
  });

  it("answers a booking with no stored copy with the same 404", async () => {
    h.reservation = booking();
    h.karaokeDurableCopy.mockResolvedValue(null);
    const token = signKaraokeLink(booking() as never);
    expect(await snapshot(await getKaraoke(token))).toEqual(NOT_FOUND);
  });
});
