import Link from "next/link";

import {
  AccountShell,
  AccountCard,
  EmptyState,
} from "@/components/uye/account-shell";
import { listProducts } from "@/lib/admin/store";
import { productPath } from "@/components/laffogato/route-paths";
import { requireCustomer } from "@/lib/customer/auth";

import { toggleWishlistAction } from "../../actions";
import { formatTRY } from "../shared";

export const metadata = { title: "Favorilerim · L'Affogato" };
export const dynamic = "force-dynamic";

export default async function FavorilerimPage() {
  const customer = await requireCustomer();
  const ids = new Set(customer.wishlist);
  const allProducts = await listProducts();
  const favs = allProducts.filter((p) => ids.has(p.id));

  return (
    <AccountShell customer={customer} active="favorilerim">
      <AccountCard title="Favorilerim" hint={`${favs.length} ürün`}>
        {favs.length === 0 ? (
          <EmptyState
            art="spot-favori"
            title="Henüz favori eklemedin"
            hint="Mağazadaki ürünlerin köşesindeki kalp ikonuna dokun, sonra burada bir araya getirelim."
            cta={
              <Link href="/magaza" className="btn btn-primary btn-sm">
                Mağazaya git →
              </Link>
            }
          />
        ) : (
          <div className="account-wishlist-grid">
            {favs.map((p) => (
              <article key={p.id} className="account-wishlist-item">
                <div className="account-wishlist-thumb">
                  {p.images?.[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.images[0]} alt={p.name} loading="lazy" />
                  ) : (
                    <div
                      style={{
                        width: "100%",
                        height: "100%",
                        background:
                          "linear-gradient(135deg, var(--bg-cream), var(--gold-soft))",
                      }}
                    />
                  )}
                </div>
                <div>
                  <div className="eyebrow">{p.tag}</div>
                  <h3
                    style={{
                      fontFamily: "var(--serif-display)",
                      fontSize: 17,
                      margin: "6px 0 4px",
                    }}
                  >
                    {p.name}
                  </h3>
                  <div
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: 13,
                      color: "var(--gold-deep)",
                    }}
                  >
                    {formatTRY(p.priceMinor)}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Link
                    href={productPath(p.slug)}
                    className="btn btn-primary btn-sm"
                  >
                    Ürüne git →
                  </Link>
                  <form action={toggleWishlistAction}>
                    <input type="hidden" name="productId" value={p.id} />
                    <input
                      type="hidden"
                      name="back"
                      value="/uye/hesap/favorilerim"
                    />
                    <button
                      type="submit"
                      className="btn btn-ghost btn-sm"
                      style={{ color: "var(--rose)" }}
                    >
                      Favoriden çıkar
                    </button>
                  </form>
                </div>
              </article>
            ))}
          </div>
        )}
      </AccountCard>
    </AccountShell>
  );
}
