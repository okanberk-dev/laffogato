import Link from "next/link";

import { Card, Field, PageHeader, TextInput } from "@/components/admin/forms";
import { CustomerStamps } from "@/components/admin/customer-stamps";
import { requireRole } from "@/lib/admin/auth";
import { getLoyalty, listStamps } from "@/lib/mobile/loyalty";

export const metadata = { title: "Admin · Kasa · Damga" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ e?: string }>;
}

/**
 * Counter stamp desk.
 *
 * `addCounterStampAction` is gated on `orders` precisely so the shift staff
 * can press it, but its only surface used to be `/admin/musteriler/[email]`,
 * which requires `customers` (owner + manager) and is not even in a staff
 * member's nav. The button existed for people who were locked out of it. This
 * page is the same form behind the same `orders` gate, reachable by the people
 * standing at the till.
 */
export default async function AdminCounterStampPage({
  searchParams,
}: PageProps) {
  await requireRole("orders");
  const { e } = await searchParams;
  const email = (e ?? "").trim().toLowerCase();

  const [loyalty, stamps] = email
    ? await Promise.all([getLoyalty(email), listStamps(email)])
    : [null, []];

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Satış · Kasa"
        title="Damga ekle"
        description="Üye kasada ödedi ve QR'ını gösterdi: e-postasını gir, +1 damga ver. Uygulama siparişleri damgayı kendisi kazanır; burası yalnızca kasa içindir."
      />

      <Card className="mb-4">
        <form
          method="get"
          className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"
        >
          <Field label="Üye e-postası">
            <TextInput
              name="e"
              type="email"
              defaultValue={email}
              placeholder="uye@ornek.com"
              autoComplete="off"
            />
          </Field>
          <button
            type="submit"
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[var(--admin-primary)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--admin-primary-hover)]"
          >
            Bul
          </button>
        </form>
      </Card>

      {email && loyalty ? (
        <>
          <p className="mb-2 text-sm text-neutral-600">{email}</p>
          <CustomerStamps email={email} loyalty={loyalty} history={stamps} />
          <p className="mt-3 text-xs text-neutral-400">
            Yanlış damga verdiysen bir yöneticiye söyle: düzeltme yetkisi
            personelde değil.
          </p>
        </>
      ) : (
        <Card>
          <p className="text-sm text-neutral-500">
            Damga vermek için üyenin e-postasını gir.{" "}
            <Link href="/admin/siparisler" className="underline">
              Siparişlere dön
            </Link>
          </p>
        </Card>
      )}
    </main>
  );
}
