import { redirect } from "next/navigation";
import QRCode from "qrcode";

import { Card, PageHeader } from "@/components/admin/forms";
import { TwoFAEnrollForm } from "@/components/admin/twofa-enroll-form";
import { getAdminSession } from "@/lib/admin/auth";
import { has2FA } from "@/lib/admin/twofa";

import { disable2FAAction, freshEnrollment } from "./actions";

export const metadata = { title: "Admin · İki adımlı doğrulama" };
export const dynamic = "force-dynamic";

export default async function TwoFAEnrollPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/giris");

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
            unutma. Telefonunu kaybedersen önce bu sekmeden 2FA'yı kapat, sonra
            yeniden kur.
          </p>
          <form action={disable2FAAction} className="mt-4">
            <button
              type="submit"
              className="rounded-full border border-red-200 px-4 py-1.5 text-xs text-red-700 hover:border-red-600 hover:bg-red-600 hover:text-white"
            >
              2FA'yı kapat
            </button>
          </form>
        </Card>
      </main>
    );
  }

  const draft = await freshEnrollment();
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
