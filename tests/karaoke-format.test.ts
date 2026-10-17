import { describe, expect, it } from "vitest";

import { hourFromLabel } from "@/lib/mobile/karaoke-format";

describe("hourFromLabel", () => {
  it("takes the ending of the hour's last spoken word", () => {
    // The booking form used to print "20:00’dan" for every evening hour.
    expect(hourFromLabel(12)).toBe("12:00’den"); // on iki
    expect(hourFromLabel(13)).toBe("13:00’ten"); // on üç
    expect(hourFromLabel(14)).toBe("14:00’ten"); // on dört
    expect(hourFromLabel(15)).toBe("15:00’ten"); // on beş
    expect(hourFromLabel(16)).toBe("16:00’dan"); // on altı
    expect(hourFromLabel(17)).toBe("17:00’den"); // on yedi
    expect(hourFromLabel(18)).toBe("18:00’den"); // on sekiz
    expect(hourFromLabel(19)).toBe("19:00’dan"); // on dokuz
    expect(hourFromLabel(20)).toBe("20:00’den"); // yirmi
    expect(hourFromLabel(21)).toBe("21:00’den"); // yirmi bir
    expect(hourFromLabel(22)).toBe("22:00’den"); // yirmi iki
    expect(hourFromLabel(23)).toBe("23:00’ten"); // yirmi üç
  });

  it("reads a round hour by its tens, and midnight as sıfır", () => {
    expect(hourFromLabel(10)).toBe("10:00’dan"); // on
    expect(hourFromLabel(0)).toBe("00:00’dan"); // sıfır
    expect(hourFromLabel(9)).toBe("09:00’dan"); // dokuz
  });
});
