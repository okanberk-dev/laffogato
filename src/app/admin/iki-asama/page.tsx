import { redirect } from "next/navigation";

import { AuthCard } from "@/components/admin/auth-card";
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
    <AuthCard
      title="İki adımlı doğrulama"
      description={
        <>
          <span className="font-medium text-[var(--admin-text)]">
            {session.email}
          </span>{" "}
          için doğrulama uygulamandaki 6 haneli kodu gir. Kod 30 saniyede bir
          yenilenir.
        </>
      }
    >
      <TwoFAVerifyForm next={next} />
    </AuthCard>
  );
}
