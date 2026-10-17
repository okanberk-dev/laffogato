import { redirect } from "next/navigation";
import QRCode from "qrcode";

import {
  Card,
  DangerButton,
  PageHeader,
  TextInput,
} from "@/components/admin/forms";
import { TwoFAEnrollForm } from "@/components/admin/twofa-enroll-form";
import { NUMERIC_STYLE } from "@/components/admin/ui/styles";
import { getAdminSession } from "@/lib/admin/auth";
import { has2FA, startEnrollment } from "@/lib/admin/twofa";

import { disable2FAAction } from "./actions";

export const metadata = { title: "Admin · İki adımlı doğrulama" };
export const dynamic = "force-dynamic";

export default async function TwoFAEnrollPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/giris");

  const enabled = await has2FA(session.email);

  if (enabled) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
        <PageHeader
          eyebrow="Güvenlik"
          title="İki adımlı doğrulama açık"
          description={`${session.email} için doğrulama uygulaması kayıtlı.`}
        />
        <Card className="grid gap-4">
          <div className="grid gap-2 text-sm text-[var(--admin-text-soft)]">
            <p>
              Her girişte şifrenden sonra doğrulama uygulamandaki 6 haneli kod
              istenir.
            </p>
            {/* The old advice ("telefonunu kaybedersen önce buradan kapat")
                could not be followed: turning it off takes a code from that
                very phone. */}
            <p>
              Telefonunu değiştireceksen önce eski telefondaki kodla burada
              kapat, sonra yenisinde yeniden kur. Telefonu kaybettiysen işletme
              sahibinden Kullanıcılar sayfasında 2FA&apos;nı sıfırlamasını iste.
            </p>
            {session.role === "owner" && (
              <p>
                Başka sahip hesabı yoksa senin 2FA&apos;n yalnız veritabanından
                sıfırlanır (docs/DATABASE.md); ikinci bir sahip hesabı bu yolu
                açık tutar.
              </p>
            )}
          </div>
          <form
            action={disable2FAAction}
            className="flex flex-wrap items-center gap-3"
          >
            {/* Turning 2FA off takes a current code, not just the session. */}
            <div className="w-40">
              <TextInput
                name="token"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                placeholder="123456"
                aria-label="6 haneli doğrulama kodu"
                style={{ ...NUMERIC_STYLE, textAlign: "center" }}
              />
            </div>
            <DangerButton type="submit">2FA&apos;yı kapat</DangerButton>
          </form>
        </Card>
      </main>
    );
  }

  // Called here, in the page, and NOT through a "use server" wrapper: every
  // export of an actions file is a public POST endpoint, and the old
  // `freshEnrollment` export let anyone holding a session cookie overwrite an
  // ENABLED enrollment with a fresh draft - 2FA silently off, no audit row.
  // A draft younger than 15 minutes comes back as it is, so a reload shows
  // the QR the phone already scanned.
  const draft = await startEnrollment(session.email, "L'Affogato Admin");
  const qrDataUrl = draft
    ? await QRCode.toDataURL(draft.otpauthUrl, { margin: 1, width: 240 })
    : "";

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Güvenlik"
        title="İki adımlı doğrulamayı kur"
        description="Doğrulama uygulamasıyla (1Password, Google Authenticator, Authy…) aşağıdaki QR kodu tarat, sonra çıkan 6 haneli kodu gir."
      />
      <div className="grid gap-4 md:grid-cols-[auto_1fr]">
        <Card>
          {qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrDataUrl}
              alt="2FA QR kodu"
              width={240}
              height={240}
              className="mx-auto"
              style={{ display: "block", borderRadius: 8 }}
            />
          ) : (
            <div className="grid h-[240px] w-[240px] place-items-center text-xs text-[var(--admin-text-mute)]">
              QR oluşturulamadı.
            </div>
          )}
          {draft?.secret && (
            <div className="mt-3 text-center">
              <div
                className="text-[10px] tracking-[0.22em] text-[var(--admin-text-mute)] uppercase"
                style={{ fontFamily: "var(--mono), monospace" }}
              >
                Manuel anahtar
              </div>
              <div
                className="mt-1 text-xs break-all text-[var(--admin-text-soft)]"
                style={NUMERIC_STYLE}
              >
                {draft.secret}
              </div>
            </div>
          )}
        </Card>
        <Card>
          <TwoFAEnrollForm />
        </Card>
      </div>
    </main>
  );
}
