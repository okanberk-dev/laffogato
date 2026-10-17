import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/admin/forms";
import { requireRole } from "@/lib/admin/auth";
import { cafeTableIdSchema } from "@/lib/admin/cafe-table-schema";
import { getCafeTable } from "@/lib/admin/cafe-tables";
import { cafeTableHref } from "@/lib/admin/cafe-tables-panel";

import { updateCafeTableAction } from "../../actions";
import { BACK_LINK } from "../../back-link";
import { CafeTableForm } from "../../table-form";

export const metadata = { title: "Admin · Masayı düzenle" };
export const dynamic = "force-dynamic";

export default async function EditCafeTablePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("tables");
  const { id } = await params;
  const parsed = cafeTableIdSchema.safeParse(id);
  const table = parsed.success ? await getCafeTable(parsed.data) : null;
  if (!table) notFound();
  const back = cafeTableHref(table.id);
  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      <Link href={back} className={BACK_LINK}>
        ← {table.name}
      </Link>
      <PageHeader
        eyebrow="Satış · Masalar"
        title={`${table.name} - düzenle`}
        description="Adı ve sırayı değiştirmek QR kodunu değiştirmez; basılı kart çalışmaya devam eder."
      />
      <CafeTableForm
        action={updateCafeTableAction}
        table={{ id: table.id, name: table.name, sortOrder: table.sortOrder }}
        submitLabel="Kaydet"
        back={back}
      />
    </main>
  );
}
