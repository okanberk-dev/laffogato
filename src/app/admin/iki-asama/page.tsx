import { redirect } from "next/navigation";

import { TwoFAVerifyForm } from "@/components/admin/twofa-verify-form";
import { getPendingSession } from "@/lib/admin/auth";
import { adminNextPath } from "@/lib/admin/next-path";

export const metadata = { title: "Admin · 2FA" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ next?: string }>;
}

export default async function TwoFAPage({ searchParams }: PageProps) {
  const session = await getPendingSession();
  if (!session) redirect("/admin/giris");
  // Empty, not "/admin": the action then picks the page the role can open.
  const next = adminNextPath((await searchParams).next) ?? "";

  return (
    <main className="mx-auto grid min-h-[70vh] max-w-md place-items-center px-4 py-10 sm:px-6">
      <div className="w-full rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 shadow-[0_1px_3px_rgba(68,48,28,0.06)] sm:p-8">
        <h1
          className="text-2xl text-[var(--admin-text)] sm:text-3xl"
          style={{
            fontFamily: "var(--font-poppins), var(--sans)",
            fontWeight: 600,
            letterSpacing: "-0.02em",
          }}
        >
          İki adımlı doğrulama
        </h1>
        <p className="mt-2 text-sm break-words text-[var(--admin-text-soft)]">
          {session.email} için doğrulama uygulamandaki 6 haneli kodu gir. Kod
          30 saniyede bir yenilenir.
        </p>
        <div className="mt-6">
          <TwoFAVerifyForm next={next} />
        </div>
      </div>
    </main>
  );
}
