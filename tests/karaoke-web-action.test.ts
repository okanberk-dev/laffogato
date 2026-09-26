import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The web `/karaoke` form tells the köşk about a request exactly as the app's
 * POST does. It used to write the row and stay silent, so a web booking waited
 * unread in the panel.
 */

const createReservation = vi.fn();
const notifyOperatorOfReservation = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/customer/auth", () => ({
  requireCustomer: vi.fn(async () => ({
    email: "eda@ornek.com",
    name: "Eda Mancuso",
    emailVerified: true,
  })),
}));
vi.mock("@/lib/db/health", () => ({ isDbUnreachable: () => false }));
vi.mock("@/lib/mobile/karaoke", () => ({ createReservation }));
vi.mock("@/lib/mobile/karaoke-notify", () => ({
  notifyOperatorOfReservation,
}));

const { bookKaraokeAction } = await import("@/app/karaoke/actions");

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const FIELDS = {
  date: "2026-09-27",
  startHour: "20",
  hours: "2",
  guests: "6",
  note: "",
};

const RESERVATION = {
  id: "krk-00042",
  date: "2026-09-27",
  startHour: 20,
  hours: 2,
  guests: 6,
};

beforeEach(() => {
  createReservation.mockReset();
  notifyOperatorOfReservation.mockReset();
  notifyOperatorOfReservation.mockResolvedValue(undefined);
});

describe("bookKaraokeAction", () => {
  it("notifies the operator, marked as a web booking, once the row is written", async () => {
    createReservation.mockResolvedValue({ ok: true, reservation: RESERVATION });
    const state = await bookKaraokeAction({}, form(FIELDS));
    expect(state.booked).toMatchObject({ date: "2026-09-27", startHour: 20 });
    expect(notifyOperatorOfReservation).toHaveBeenCalledWith(
      RESERVATION,
      "web",
    );
  });

  it("sends nothing when the booking is refused", async () => {
    createReservation.mockResolvedValue({
      ok: false,
      status: 409,
      error: "slot_taken",
      message: "Seçtiğin saatler dolu. Başka bir saat dene.",
    });
    const state = await bookKaraokeAction({}, form(FIELDS));
    expect(state.error).toBeTruthy();
    expect(notifyOperatorOfReservation).not.toHaveBeenCalled();
  });
});
