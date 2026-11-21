import { notFound } from "next/navigation";

import { BackLink } from "@/components/admin/back-link";
import { PageHeader } from "@/components/admin/forms";
import { requireRole } from "@/lib/admin/auth";
import { cafeTableIdSchema } from "@/lib/admin/cafe-table-schema";
import { getCafeTable } from "@/lib/admin/cafe-tables";
import { cafeTableHref } from "@/lib/admin/cafe-tables-panel";
import { branchLabel, siteBranches } from "@/lib/panel/branches";

import { updateCafeTableAction } from "../../actions";
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
    <main className="w-full px-4 pt-5 pb-10 sm:px-5 [&>:not(header)]:max-w-3xl">
      <BackLink href={back}>{table.name}</BackLink>
      <PageHeader
        title={`${table.name} - düzenle`}
        description="Adı ve sırayı değiştirmek QR kodunu değiştirmez; basılı kart çalışmaya devam eder."
      />
      <CafeTableForm
        action={updateCafeTableAction}
        table={{
          id: table.id,
          name: table.name,
          sortOrder: table.sortOrder,
          branch: table.branch,
        }}
        branches={siteBranches(process.env).map((id) => ({
          id,
          label: branchLabel(id),
        }))}
        submitLabel="Kaydet"
        back={back}
      />
    </main>
  );
}
