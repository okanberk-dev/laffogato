import { readFileSync } from "node:fs";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  BackdropField,
  storedSceneStatus,
  type BackdropFieldProps,
} from "@/components/admin/backdrop-field";
import { NO_BACKDROP } from "@/lib/admin/store";

/**
 * The panel's "Sahne" and "Kap biçimi" fields (glass round G5, lafmobil
 * docs/DESIGN-GLASS.md §6.5 "Panel"): the line that says what is stored, the
 * select values the save actions read, and where the fields sit.
 */

describe("the panel's Sahne line", () => {
  const base = { hue: "caramel", category: "ice-coffee" };

  it("names the automatic pick and the hand choice", () => {
    expect(
      storedSceneStatus({
        ...base,
        photo: "upload",
        stored: { ...NO_BACKDROP, backdrop: "caramel", backdropHex: "#B87333" },
      }),
    ).toMatchObject({
      tone: "ok",
      text: "Otomatik: Karamel",
      swatch: "#B87333",
      measured: "#B87333",
    });
    expect(
      storedSceneStatus({
        ...base,
        photo: "upload",
        stored: { ...NO_BACKDROP, backdrop: "ice", backdropSource: "manual" },
      }).text,
    ).toBe("Elle seçildi: Buz mavisi");
  });

  it("says when no scene could be picked, and why", () => {
    const none = { ...NO_BACKDROP };
    expect(
      storedSceneStatus({ ...base, photo: "upload", stored: none }),
    ).toMatchObject({ tone: "warn", text: "Sahne seçilemedi, elle seç." });
    expect(storedSceneStatus({ ...base, photo: "link", stored: none }).text).toBe(
      "Adresle eklenen fotoğrafın rengi panelde okunmaz, elle seç.",
    );
    expect(
      storedSceneStatus({
        hue: "dark",
        category: "gear",
        photo: "upload",
        stored: none,
      }).text,
    ).toContain("Bu kategoride otomatik seçim yapılmaz");
    expect(storedSceneStatus({ ...base, photo: "none", stored: none }).text).toBe(
      "Fotoğraf yok. Uygulama tondan Karamel sahnesini çizer.",
    );
    expect(storedSceneStatus({ ...base, photo: "none" }).text).toBe(
      "Fotoğraf yükleyip kaydedince sahne otomatik seçilir.",
    );
  });

  it("never names a screen scene or an unknown value as a pick", () => {
    expect(
      storedSceneStatus({
        ...base,
        photo: "upload",
        stored: { ...NO_BACKDROP, backdrop: "house" },
      }).text,
    ).toBe("Sahne seçilemedi, elle seç.");
  });
});

describe("BackdropField markup", () => {
  const render = (props: BackdropFieldProps) =>
    renderToStaticMarkup(createElement(BackdropField, props));

  it("opens on Otomatik and Kategoriden for a new item", () => {
    const html = render({ photo: "none", hue: "cream", category: "hot" });
    expect(html).toContain('name="backdrop"');
    expect(html).toContain('name="vessel"');
    expect(html).toMatch(/<option value="auto" selected="">Otomatik \(fotoğraftan\)<\/option>/);
    expect(html).toMatch(/<option value="" selected="">Kategoriden<\/option>/);
    // The twelve families and six shapes, nothing else.
    expect(html.match(/<option /g)).toHaveLength(1 + 12 + 1 + 6);
    expect(html).not.toContain('value="house"');
    expect(html).not.toContain('value="velvet"');
  });

  it("opens on the stored hand choice and vessel", () => {
    const html = render({
      photo: "upload",
      hue: "cream",
      category: "dessert",
      stored: {
        backdrop: "gelato",
        backdropSource: "manual",
        backdropHex: "#F0C8D4",
        vessel: "cloche",
      },
    });
    expect(html).toMatch(/<option value="gelato" selected="">/);
    expect(html).toMatch(/<option value="cloche" selected="">Cam fanus<\/option>/);
    expect(html).toContain("Elle seçildi: Gelato pasteli");
  });

  it("opens on Otomatik for an automatic pick and names it", () => {
    const html = render({
      photo: "upload",
      hue: "caramel",
      category: "ice-coffee",
      stored: {
        backdrop: "caramel",
        backdropSource: "auto",
        backdropHex: "#B5773A",
        vessel: null,
      },
    });
    expect(html).toMatch(/<option value="auto" selected="">/);
    expect(html).toContain("Otomatik: Karamel");
    expect(html).toContain("#B5773A");
  });
});

describe("form wiring", () => {
  const field = readFileSync("src/components/admin/backdrop-field.tsx", "utf8");
  const menu = readFileSync("src/components/admin/menu-item-form.tsx", "utf8");
  const wizard = readFileSync("src/components/admin/product-wizard.tsx", "utf8");

  it("posts the two fields under the names the actions read", () => {
    expect(field).toContain("name={BACKDROP_FIELD}");
    expect(field).toContain("name={VESSEL_FIELD}");
    expect(field).toContain("Otomatik (fotoğraftan)");
    expect(field).toContain("Kategoriden");
  });

  it("shows the field in the menu item form and in step 4 of the wizard", () => {
    expect(menu).toContain("<BackdropField");
    expect(wizard).toContain("<BackdropField");
    const step4 = wizard.slice(
      wizard.indexOf('title: "Görsel & SEO"'),
      wizard.indexOf('title: "Özet & onayla"'),
    );
    expect(step4).toContain("<BackdropField");
  });

  it("hands the field the photo's kind, never the photo itself", () => {
    // A stored upload is a data URL of up to 2 MB; the uploader already
    // carries it once in the page's payload.
    expect(menu).toContain("photo={photoKind(item?.image)}");
    expect(menu).not.toMatch(/stored=\{item\}/);
    expect(wizard).toContain("photo={photoKind(initialImages[0])}");
  });

  it("no longer names a component in the operator's hint", () => {
    expect(menu).not.toContain("MenuPlate");
    expect(wizard).not.toContain("gradient zemin");
  });
});
