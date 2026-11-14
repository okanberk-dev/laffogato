import Image from "next/image";

import Link from "@/components/link";
import { priceLabel } from "@/lib/utils/format";

import type { Product } from "./data";
import { productDiscount } from "./product-facts";
import { productPath } from "./route-paths";
import { ProductSurface } from "./visuals";

/**
 * "Evde L'Affogato" - one bag of coffee from the shop, put forward on the
 * home page (owner's brief, 6 Kas 2026: a split product feature, the photo
 * on the left, the details on a white card on the right).
 *
 * Everything on it is the product row's: name, price, photo and stock come
 * from the live shop list the page already has (`products`, read through
 * the Data Cache like the rest of the page), never typed here. Which bag:
 * the one the panel marks "Öne çıkan", else the espresso blend, else the
 * first coffee in stock. A product with no slug (the bundled seed) or none
 * in stock means no section at all.
 */
export function pickTakeHomeProduct(
  products: readonly Product[] | undefined,
): Product | null {
  const ready = (products ?? []).filter(
    (p) =>
      p.cat === "beans" &&
      Boolean(p.slug) &&
      (p.stock === undefined || p.stock > 0),
  );
  return (
    ready.find((p) => p.featured) ??
    ready.find((p) => /espresso/i.test(`${p.name} ${p.slug ?? ""}`)) ??
    ready[0] ??
    null
  );
}

/**
 * The card's detail lines, each from a field the product carries: the
 * sentences of its description, its tasting notes and origin when the panel
 * has them. The last line is the shop's own standing claim about every bag
 * of coffee (shop-page.tsx's "Bologna kavurma" tile, public/llms.txt).
 */
export function takeHomeDetails(p: Product): string[] {
  const lines = (p.desc ?? "")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim().replace(/\.$/, ""))
    .filter(Boolean)
    .slice(0, 2);
  if (p.notes?.length) lines.push(`Notlar: ${p.notes.join(", ")}`);
  if (p.origin?.trim()) lines.push(`Menşei: ${p.origin.trim()}`);
  if (p.cat === "beans") lines.push("Bologna'da haftalık kavrulur");
  return [...new Set(lines)].slice(0, 4);
}

export function HomeTakeHome({ product: p }: { product: Product }) {
  const price =
    typeof p.priceMinor === "number" ? priceLabel(p.priceMinor) : p.price;
  const discount = productDiscount(p);
  const details = takeHomeDetails(p);
  const second = p.images?.filter((u) => typeof u === "string" && u)[1];
  const href = productPath(p.slug!);
  return (
    <section className="home-section" aria-labelledby="take-home-title">
      <div className="wrap take-home">
        <div className="take-home-photo reveal">
          <ProductSurface
            cat={p.cat}
            tone={p.img}
            label={p.name}
            sub={p.tag}
            images={p.images}
          />
        </div>

        <div className="take-home-card reveal r1">
          <p className="take-home-eyebrow">Evde L&apos;Affogato</p>
          <h2 id="take-home-title" className="take-home-name">
            {p.name}
          </h2>
          {p.tag ? <p className="take-home-tag">{p.tag}</p> : null}

          <div className="take-home-price">
            <span className="take-home-now tabular">{price}</span>
            {discount ? (
              <span className="take-home-was tabular">{discount.was}</span>
            ) : null}
          </div>
          {/* The discount's days beside the struck price (Ticari Reklam
              Yön. m.14/1), as on the shop's own cards. */}
          {discount ? (
            <p className="pdp-discount-note">{discount.notice}</p>
          ) : null}

          {details.length > 0 ? (
            <ul className="take-home-list">
              {details.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          ) : null}

          <figure className="take-home-extra">
            <div className="take-home-extra-photo">
              {second ? (
                // A panel photo: its host is not known at build time, so
                // next/image cannot whitelist it (as ProductSurface).
                // eslint-disable-next-line @next/next/no-img-element
                <img src={second} alt="" loading="lazy" decoding="async" />
              ) : (
                <Image
                  src="/menu/espresso.webp"
                  alt=""
                  fill
                  sizes="(max-width: 900px) 40vw, 200px"
                />
              )}
            </div>
            <figcaption>
              {second
                ? "Paketten fincana: evde kendi ritüelin."
                : "Köşkün barından bir espresso."}
            </figcaption>
          </figure>

          <div className="take-home-actions">
            <Link className="btn btn-primary" href={href}>
              Mağazada gör
              <span className="arrow" aria-hidden="true">
                →
              </span>
            </Link>
            <Link className="btn btn-ghost" href="/magaza/cekirdek">
              Tüm kahveler
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
