import Link from "@/components/link";
import {
  AccountShell,
  AccountCard,
  EmptyState,
} from "@/components/uye/account-shell";
import { requireCustomer } from "@/lib/customer/auth";
import { MAX_SAVED_CARDS } from "@/lib/payment/paynkolay-card";
import { accountSavedCards } from "@/lib/payment/saved-cards";

import { SavedCardList } from "./saved-card-list";

export const metadata = {
  title: "Kayıtlı kartlarım · L'Affogato",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

/**
 * Hesabım › Kayıtlı kartlarım (docs/PAYNKOLAY.md §16.3): the cards the
 * member saved at checkout, as PayNkolay lists them - masked to the last
 * four digits, with the bank, the scheme and the name the member gave. A
 * card is added only while paying ("Bu kartı sonraki ödemeler için
 * kaydet"), so it goes through the bank's 3D Secure once; there is no "add
 * a card" form here, because that would take a card number with no payment
 * and no 3D (PayNkolay's `CardStorageCardRegister`, which this site never
 * calls).
 */
export default async function KartlarimPage() {
  const customer = await requireCustomer();
  const saved = await accountSavedCards(customer.email);
  const count = saved.status === "ok" ? saved.cards.length : 0;

  return (
    <AccountShell customer={customer} active="kartlarim">
      <AccountCard
        title="Kayıtlı kartlarım"
        hint={
          saved.status === "ok"
            ? `${count}/${MAX_SAVED_CARDS} kart kayıtlı`
            : undefined
        }
      >
        {saved.status === "off" ? (
          <EmptyState
            title="Kart kaydetme şu an kapalı"
            hint="Ödemeni her seferinde kartını yazarak yapabilirsin."
          />
        ) : saved.status === "unavailable" ? (
          <EmptyState
            title="Kayıtlı kartların şu an gösterilemiyor"
            hint="Ödeme kuruluşuna ulaşamadık. Birazdan sayfayı yenileyip yeniden dene."
          />
        ) : count === 0 ? (
          <EmptyState
            title="Kayıtlı kartın yok"
            hint="Bir sonraki ödemende kart bilgilerini yazdıktan sonra “Bu kartı sonraki ödemeler için kaydet”i işaretle; kartın burada görünür."
            cta={
              <Link href="/magaza" className="btn btn-primary btn-sm">
                Mağazaya git →
              </Link>
            }
          />
        ) : (
          <SavedCardList cards={saved.cards} />
        )}
      </AccountCard>

      <AccountCard title="Kartların nerede duruyor?">
        <ul className="account-cards-facts">
          <li>
            Kartın, ödeme kuruluşu PayNkolay&apos;ın (N Kolay Ödeme ve
            Elektronik Para Kuruluşu A.Ş.) kart saklama hizmetinde durur. Kart
            numarasını, son kullanma tarihini ve güvenlik kodunu biz tutmayız;
            burada yalnız son dört haneyi görürsün.
          </li>
          <li>
            Bizde yalnız seni PayNkolay&apos;daki kartlarınla eşleştiren
            rastgele bir anahtar durur; o da şifrelenmiş olarak saklanır.
          </li>
          <li>
            Kayıtlı kartla ödediğinde de ödemeyi bankanın 3D Secure ekranında
            onaylarsın.
          </li>
          <li>
            Yeni bir kartı ödeme sırasında kaydedersin. Sildiğin kart
            PayNkolay&apos;dan da silinir; hesabını kapattığında bütün kayıtlı
            kartların silinir.
          </li>
        </ul>
      </AccountCard>
    </AccountShell>
  );
}
