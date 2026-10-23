import { notFound } from "next/navigation";

import { BackLink } from "@/components/admin/back-link";
import { CustomerForm } from "@/components/admin/customer-form";
import { PageHeader } from "@/components/admin/forms";
import { requireRole } from "@/lib/admin/auth";
import { getAdminCustomerByEmail } from "@/lib/customer/store";

import { updateCustomerAction } from "../../actions";

export const metadata = { title: "Admin · Üye Düzenle" };
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ email: string }>;
}

export default async function EditCustomerPage({ params }: PageProps) {
  await requireRole("customers");
  const { email: raw } = await params;
  const email = decodeURIComponent(raw);
  const customer = await getAdminCustomerByEmail(email);
  if (!customer) notFound();

  // Next 16: pass a properly-bound server action (NOT a plain arrow closure).
  const boundUpdate = updateCustomerAction.bind(null, customer.email);

  return (
    <main className="w-full px-4 pt-5 pb-10 sm:px-5 [&>:not(header)]:max-w-3xl">
      <BackLink
        href={`/admin/musteriler/${encodeURIComponent(customer.email)}`}
      >
        Üye sayfası
      </BackLink>
      <PageHeader
        eyebrow="Üye hesabı"
        title={`Düzenle · ${customer.name || customer.email}`}
        description="Ad, telefon, doğum tarihi ve bildirim tercihlerini güncelle. E-posta ve şifre buradan değiştirilemez."
      />
      <CustomerForm customer={customer} action={boundUpdate} />
    </main>
  );
}
