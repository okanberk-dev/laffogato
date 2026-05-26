import { redirect } from "next/navigation";

import { TwoFAVerifyForm } from "@/components/admin/twofa-verify-form";
import { getPendingSession } from "@/lib/admin/auth";

export const metadata = { title: "Admin · 2FA" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ next?: string }>;
}

export default async function TwoFAPage({ searchParams }: PageProps) {
  const session = await getPendingSession();
  if (!session) redirect("/admin/giris");
  const sp = await searchParams;
  const next = sp.next ?? "/admin";

  return (
    <main className="mx-auto grid min-h-[70vh] max-w-md place-items-center px-6 py-10">
      <div className="w-full rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
        <h1
          className="text-3xl"
          style={{
            fontFamily: "var(--serif), 'Playfair Display', serif",
            fontStyle: "italic",
            fontWeight: 500,
          }}
        >
          İki adımlı doğrulama
        </h1>
        <p className="mt-2 text-sm text-neutral-600">
          {session.email} için authenticator uygulamasındaki 6 haneli kodu gir.
          Kod 30 saniyede bir yenilenir.
        </p>
        <div className="mt-6">
          <TwoFAVerifyForm next={next} />
        </div>
      </div>
    </main>
  );
}
