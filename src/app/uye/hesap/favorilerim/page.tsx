import Link from "@/components/link";
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
            title="Henüz favori eklemedin"
            hint="Mağazadaki ürünlerin köşesindeki kalp ikonuna dokun, sonra burada bir araya getirelim."
            cta={
              <Link href="/magaza" className="btn btn-primary btn-sm">
                Mağazaya git
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
                  ) : null}
                </div>
                <div>
                  {p.tag ? <div className="eyebrow muted">{p.tag}</div> : null}
                  <h3 className="t-title">{p.name}</h3>
                  <div className="t-price">{formatTRY(p.priceMinor)}</div>
                </div>
                <div className="account-wishlist-actions">
                  <Link
                    href={productPath(p.slug)}
                    className="btn btn-primary btn-sm"
                  >
                    Ürüne git
                  </Link>
                  <form action={toggleWishlistAction}>
                    <input type="hidden" name="productId" value={p.id} />
                    <input
                      type="hidden"
                      name="back"
                      value="/uye/hesap/favorilerim"
                    />
                    <button type="submit" className="link-u account-quiet-btn">
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
