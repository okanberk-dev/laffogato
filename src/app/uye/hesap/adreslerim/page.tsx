import Link from "@/components/link";
import {
  AccountShell,
  AccountCard,
  EmptyState,
} from "@/components/uye/account-shell";
import { requireCustomer } from "@/lib/customer/auth";

import { deleteAddressAction, setDefaultAddressAction } from "../../actions";

export const metadata = { title: "Adreslerim · L'Affogato" };
export const dynamic = "force-dynamic";

export default async function AdreslerimPage() {
  const customer = await requireCustomer();
  const addresses = customer.addresses;

  return (
    <AccountShell customer={customer} active="adreslerim">
      <AccountCard
        title="Adreslerim"
        hint={`${addresses.length}/20 adres kayıtlı`}
        action={
          <Link
            href="/uye/hesap/adreslerim/yeni"
            className="btn btn-primary btn-sm"
          >
            + Yeni adres
          </Link>
        }
      >
        {addresses.length === 0 ? (
          <EmptyState
            title="Henüz adres eklemedin"
            hint="Hızlı teslimat için yeni bir adres ekle. İlk eklediğin adres varsayılan olur."
            cta={
              <Link
                href="/uye/hesap/adreslerim/yeni"
                className="btn btn-primary btn-sm"
              >
                + Adres ekle
              </Link>
            }
          />
        ) : (
          <div className="account-address-grid">
            {addresses.map((a) => (
              <article
                key={a.id}
                className="account-address-card"
                data-default={a.isDefault ? "true" : undefined}
              >
                <div className="account-address-label">
                  <span>{a.label || a.city || "Adres"}</span>
                  {a.isDefault && (
                    <span className="account-address-default-badge">
                      Varsayılan
                    </span>
                  )}
                </div>
                <div className="account-address-body">
                  {a.recipientName && <div>{a.recipientName}</div>}
                  {a.phone && <div>{a.phone}</div>}
                  <div>
                    {a.line1}
                    {a.line2 ? `, ${a.line2}` : ""}
                  </div>
                  <div>
                    {a.district && `${a.district}, `}
                    {a.city} {a.zip}
                  </div>
                </div>
                <div className="account-address-actions">
                  <Link
                    href={`/uye/hesap/adreslerim/${a.id}/duzenle`}
                    className="btn btn-ghost btn-sm"
                  >
                    Düzenle
                  </Link>
                  {!a.isDefault && (
                    <form action={setDefaultAddressAction}>
                      <input type="hidden" name="addressId" value={a.id} />
                      <button
                        type="submit"
                        className="link-u account-quiet-btn"
                      >
                        Varsayılan yap
                      </button>
                    </form>
                  )}
                  <form action={deleteAddressAction}>
                    <input type="hidden" name="addressId" value={a.id} />
                    <button
                      type="submit"
                      className="link-u account-quiet-btn account-quiet-btn--danger"
                    >
                      Sil
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
