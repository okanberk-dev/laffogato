import { describe, expect, it, vi } from "vitest";

const updateCustomerAddress = vi.fn(async () => ({
  ok: true as const,
  customer: { addresses: [] },
}));
vi.mock("@/lib/customer/store", () => ({
  updateCustomerAddress,
  deleteCustomerAddress: vi.fn(),
}));
vi.mock("@/lib/mobile/auth", () => ({
  requireMobileCustomer: vi.fn(async () => ({
    ok: true,
    customer: {
      email: "eda@example.com",
      addresses: [
        { id: "adr-1", isDefault: false },
        { id: "adr-2", isDefault: true },
      ],
    },
  })),
}));

const { PATCH } = await import("@/app/api/mobile/v1/me/addresses/[id]/route");

const draft = {
  title: "Ev",
  fullName: "Eda Mancuso",
  phone: "+90 532 000 00 00",
  city: "İstanbul",
  district: "Tuzla",
  neighbourhood: "Postane Mah.",
  line: "Atatürk Cad. No: 28",
  note: "",
};

function patch(id: string, body: object) {
  return PATCH(
    new Request(`https://laffogato.net/api/mobile/v1/me/addresses/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    }),
    { params: Promise.resolve({ id }) },
  );
}

/**
 * Fixing a phone number on the default address, without mentioning
 * `isDefault`, used to write `false` - and the store then made the first
 * address in the list the default instead.
 */
describe("PATCH /me/addresses/{id}", () => {
  it("keeps the default when the body does not mention it", async () => {
    const res = await patch("adr-2", draft);
    expect(res.status).toBe(200);
    expect(updateCustomerAddress).toHaveBeenLastCalledWith(
      "eda@example.com",
      "adr-2",
      expect.objectContaining({ isDefault: true }),
    );
  });

  it("still lets the body change it", async () => {
    await patch("adr-2", { ...draft, isDefault: false });
    expect(updateCustomerAddress).toHaveBeenLastCalledWith(
      "eda@example.com",
      "adr-2",
      expect.objectContaining({ isDefault: false }),
    );
    await patch("adr-1", { ...draft, isDefault: true });
    expect(updateCustomerAddress).toHaveBeenLastCalledWith(
      "eda@example.com",
      "adr-1",
      expect.objectContaining({ isDefault: true }),
    );
  });
});
