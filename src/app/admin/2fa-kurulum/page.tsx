import { redirect } from "next/navigation";
import QRCode from "qrcode";

import { Card, PageHeader } from "@/components/admin/forms";
import { TwoFAEnrollForm } from "@/components/admin/twofa-enroll-form";
import { getAdminSession } from "@/lib/admin/auth";
import { has2FA, startEnrollment } from "@/lib/admin/twofa";

import { disable2FAAction } from "./actions";

export const metadata = { title: "Admin · İki adımlı doğrulama" };
export const dynamic = "force-dynamic";

const DISABLE_ERRORS: Record<string, string> = {
  kod: "Kod doğrulanmadı. Authenticator uygulamasındaki güncel 6 haneli kodu gir.",
  kilit: "Çok fazla hatalı kod. Bir süre sonra tekrar dene.",
};

export default async function TwoFAEnrollPage({
  searchParams,
}: {
  searchParams: Promise<{ hata?: string }>;
}) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/giris");
  const { hata } = await searchParams;
  const disableError = hata ? DISABLE_ERRORS[hata] : undefined;

  const enabled = await has2FA(session.email);

  if (enabled) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <PageHeader
          eyebrow="Güvenlik"
          title="İki adımlı doğrulama aktif"
          description={`${session.email} için authenticator uygulaması kayıtlı.`}
        />
        <Card>
          <p className="text-sm text-neutral-700">
            Bir sonraki girişte şifrenden sonra 6 haneli kodu istediğimizi
            unutma. Telefonunu kaybedersen önce bu sekmeden 2FA&apos;yı kapat,
            sonra yeniden kur.
          </p>
          <form
            action={disable2FAAction}
            className="mt-4 flex flex-wrap items-center gap-3"
          >
            {/* Turning 2FA off takes a current code, not just the session. */}
            <input
              name="token"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              placeholder="6 haneli kod"
              aria-label="Authenticator kodu"
              className="w-36 rounded-full border border-[var(--admin-border)] px-4 py-1.5 text-sm"
            />
            <button
              type="submit"
              className="rounded-full border border-red-200 px-4 py-1.5 text-xs text-red-700 hover:border-red-600 hover:bg-red-600 hover:text-white"
            >
              2FA&apos;yı kapat
            </button>
          </form>
          {disableError ? (
            <p
              role="alert"
              className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700"
            >
              {disableError}
            </p>
          ) : null}
        </Card>
      </main>
    );
  }

  // Called here, in the page, and NOT through a "use server" wrapper: every
  // export of an actions file is a public POST endpoint, and the old
  // `freshEnrollment` export let anyone holding a session cookie overwrite an
  // ENABLED enrollment with a fresh draft - 2FA silently off, no audit row.
  const draft = await startEnrollment(session.email, "L'Affogato Admin");
  const qrDataUrl = draft
    ? await QRCode.toDataURL(draft.otpauthUrl, { margin: 1, width: 240 })
    : "";

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <PageHeader
        eyebrow="Güvenlik"
        title="İki adımlı doğrulamayı kur"
        description="Authenticator uygulaması (1Password, Google Authenticator, Authy…) ile aşağıdaki QR kodu tarat, sonra çıkan 6 haneli kodu gir."
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
              style={{ display: "block", borderRadius: 8 }}
            />
          ) : (
            <div className="grid h-[240px] w-[240px] place-items-center text-xs text-neutral-500">
              QR oluşturulamadı.
            </div>
          )}
          {draft?.secret && (
            <div className="mt-3 text-center">
              <div
                className="text-[10px] tracking-[0.22em] text-neutral-500 uppercase"
                style={{ fontFamily: "var(--mono), monospace" }}
              >
                Manuel anahtar
              </div>
              <div
                className="mt-1 text-xs break-all text-neutral-700"
                style={{ fontFamily: "var(--mono), monospace" }}
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
