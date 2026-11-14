import { LafMark } from "@/components/laffogato/brand-mark";
import Link from "@/components/link";
import { AccountCard, AccountShell } from "@/components/uye/account-shell";
import { DeletionRequestNotice } from "@/components/uye/deletion-request-notice";
import { getActiveCustomer } from "@/lib/customer/auth";
import { getDeletionRequest } from "@/lib/customer/deletion-request";
import {
  deletionDayLabel,
  deletionDeadline,
  type DeletionRequest,
} from "@/lib/customer/deletion-request-core";
import { isDbUnreachable } from "@/lib/db/health";
import { LEGAL_ADDRESS_LINE, LEGAL_ENTITY } from "@/lib/legal/entity";

import { DeletionRequestForm } from "./deletion-request-form";

export const metadata = { title: "Hesap silme · L'Affogato" };
export const dynamic = "force-dynamic";

/**
 * Account deletion on the web is a request to the team (operator, 18 Eki
 * 2026): a signed-in member sends it from here, the team closes the
 * account from the panel within the thirty days KVKK m.13/2 allows and
 * mails the member. The app's "Hesabımı sil" stays immediate (Apple
 * 5.1.1(v)).
 *
 * The address is linked from mails, the legal texts and the store listings
 * (Google Play's web deletion page), so it is not renamed, and a
 * signed-out visitor is not sent to the login: they get the channels to
 * apply through instead. Nothing on that view looks an address up - an
 * account is never confirmed or denied to a stranger.
 */
export default async function HesapSilPage() {
  const customer = await getActiveCustomer();
  if (!customer) return <SignedOutDeletion />;

  let request: DeletionRequest | null = null;
  try {
    request = await getDeletionRequest(customer.email);
  } catch (err) {
    // The form is safe to show either way: a second request is a no-op.
    if (!isDbUnreachable(err)) {
      console.error("[uye/hesap/sil] deletion request unreadable", err);
    }
  }

  return (
    <AccountShell customer={customer} active="sil">
      <AccountCard title="Hesabını sil" hint="Silme işlemini biz yaparız">
        {request ? (
          <DeletionRequestNotice
            requestedOn={deletionDayLabel(request.requestedAt)}
            deadline={deletionDayLabel(deletionDeadline(request.requestedAt))}
          />
        ) : (
          <>
            <p className="deletion-lede">
              Hesabını silmemizi buradan iste; en geç 30 gün içinde, çoğunlukla
              3 iş günü içinde siler ve bittiğinde sana e-posta göndeririz.
            </p>
            <p className="deletion-lede">
              Damgaların ve kullanılmamış kuponların hesabınla birlikte sona
              erer; siparişlerin ve fatura bilgilerin yasal saklama süresi
              boyunca saklanır. Uygulamadaki &quot;Hesabımı sil&quot; düğmesi
              ise hesabını hemen siler.
            </p>
            <DeletionRequestForm />
          </>
        )}
        <p className="deletion-more">
          Nelerin silindiğini, nelerin saklandığını ve neden saklandığını{" "}
          <Link href="/hukuk/hesap-silme">hesap silme prosedürü</Link>{" "}
          sayfasında yazdık.
        </p>
      </AccountCard>
    </AccountShell>
  );
}

/** The KVKK application channels, for a visitor who is not signed in. */
function SignedOutDeletion() {
  const mailto = `mailto:${LEGAL_ENTITY.email}?subject=${encodeURIComponent("Hesap silme talebi")}`;
  return (
    <div className="auth-page">
      <div className="auth-card auth-card--wide">
        <div className="auth-head">
          <Link href="/" className="auth-back">
            ← Anasayfa
          </Link>
          <LafMark tone="duo" />
        </div>
        <h1 className="auth-title">
          Hesap <span className="script">silme</span>
        </h1>
        <p className="auth-lede">
          L&apos;Affogato hesabını biz sileriz: talebini gönder, en geç 30 gün
          içinde siler ve bittiğinde sana e-posta göndeririz.
        </p>
        <Link
          href="/uye/giris?next=/uye/hesap/sil"
          className="btn btn-primary auth-submit"
        >
          Giriş yap ve talep gönder
        </Link>
        <h2 className="deletion-channels-title">Giriş yapamıyorsan</h2>
        <ul className="deletion-channels">
          <li>
            <strong>E-posta:</strong> üyeliğindeki adresten{" "}
            <a href={mailto}>{LEGAL_ENTITY.email}</a> adresine, konusu
            &quot;Hesap silme talebi&quot; olan bir ileti.
          </li>
          {LEGAL_ENTITY.kep && (
            <li>
              <strong>KEP:</strong> {LEGAL_ENTITY.kep}
            </li>
          )}
          <li>
            <strong>Posta:</strong> {LEGAL_ENTITY.legalName},{" "}
            {LEGAL_ADDRESS_LINE} adresine imzalı bir dilekçe.
          </li>
          <li>
            <strong>Uygulama:</strong> Profil &gt; &quot;Hesabımı sil&quot;
            hesabını hemen siler.
          </li>
        </ul>
        <div className="auth-foot">
          <Link href="/hukuk/hesap-silme" className="auth-link">
            Hesap silme prosedürü
          </Link>
          <Link href="/hukuk/kvkk-basvuru-formu" className="auth-link">
            KVKK başvuru formu
          </Link>
        </div>
      </div>
    </div>
  );
}
