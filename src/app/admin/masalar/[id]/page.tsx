import Link from "next/link";
import { notFound } from "next/navigation";

import { formatDateTime } from "@/components/admin/forms";
import {
  Badge,
  KeyValueGrid,
  NUMERIC_STYLE,
  Section,
  type KeyValueItem,
} from "@/components/admin/ui";
import { MONO_STYLE } from "@/components/admin/ui/styles";
import { requireRole } from "@/lib/admin/auth";
import { tableQrSvg } from "@/lib/admin/cafe-table-qr";
import { cafeTableIdSchema } from "@/lib/admin/cafe-table-schema";
import { getCafeTable } from "@/lib/admin/cafe-tables";
import { tableUrl } from "@/lib/admin/cafe-tables-core";
import { CAFE_TABLES_PATH } from "@/lib/admin/cafe-tables-panel";

import { BACK_LINK } from "../back-link";
import { CafeTablePageActions } from "../table-actions";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

async function readTable(raw: string) {
  const parsed = cafeTableIdSchema.safeParse(raw);
  return parsed.success ? getCafeTable(parsed.data) : null;
}

export async function generateMetadata({ params }: PageProps) {
  const parsed = cafeTableIdSchema.safeParse((await params).id);
  return {
    title: parsed.success ? `Admin · Masa ${parsed.data}` : "Admin · Masalar",
  };
}

function when(iso: string): string {
  return iso ? formatDateTime(iso) : "";
}

/**
 * One table (Filament's view page): its QR as printed, the link inside it,
 * and every action the list's ⋯ menu offers, as buttons of one size. The
 * list had no page per table, so a single card could not be printed alone
 * nor its details read in one place (admin audit P2b, KAR-24).
 */
export default async function CafeTablePage({ params }: PageProps) {
  await requireRole("tables");
  const table = await readTable((await params).id);
  if (!table) notFound();
  const url = tableUrl(table.code);
  const svg = await tableQrSvg(table.code);

  const details: KeyValueItem[] = [
    {
      label: "Kod",
      value: <span style={NUMERIC_STYLE}>{table.code}</span>,
      hint: "QR'ın içindeki bağlantının sonu. Kodu yenilemek eski kartı geçersiz kılar.",
    },
    {
      label: "Durum",
      value: table.isActive ? "Aktif" : "Pasif",
      hint: table.isActive
        ? "Bu masaya uygulamadan sipariş verilebilir."
        : "QR menüyü açar ama bu masaya sipariş verilemez.",
    },
    {
      label: "Sıra",
      value: <span style={NUMERIC_STYLE}>{table.sortOrder}</span>,
      hint: "Listede ve baskı sayfasında küçükten büyüğe.",
    },
    { label: "Eklendi", value: when(table.createdAt) },
    { label: "Son değişiklik", value: when(table.updatedAt) },
    {
      label: "Kod yenilendi",
      value: table.rotatedAt ? when(table.rotatedAt) : "Yenilenmedi",
    },
  ];

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <Link href={CAFE_TABLES_PATH} className={BACK_LINK}>
        ← Masalar
      </Link>

      <header className="mb-6 flex flex-col gap-3">
        <div
          className="text-[10px] tracking-[0.22em] text-[var(--admin-text-mute)] uppercase"
          style={MONO_STYLE}
        >
          Satış · Masalar
        </div>
        <h1 className="text-2xl font-semibold tracking-tight break-words text-[var(--admin-text)] sm:text-3xl">
          {table.name}
        </h1>
        <span>
          <Badge tone={table.isActive ? "success" : "neutral"} dot>
            {table.isActive ? "Aktif" : "Pasif"}
          </Badge>
        </span>
        <CafeTablePageActions table={table} />
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <Section title="QR kartı" description="Masadaki kartın kodu.">
          <div className="flex flex-col items-center gap-3">
            {/* The SVG is the qrcode library's output for our own URL - no
                user text reaches it (the code is server-drawn base32). */}
            <div
              className={`aspect-square w-full max-w-[16rem] rounded-xl border border-[var(--admin-border)] bg-white p-2 [&_svg]:h-full [&_svg]:w-full ${table.isActive ? "" : "opacity-40"}`}
              role="img"
              aria-label={`${table.name} QR kodu`}
              dangerouslySetInnerHTML={{ __html: svg }}
            />
            <p
              className="max-w-full text-center text-xs break-all text-[var(--admin-text-soft)]"
              style={NUMERIC_STYLE}
            >
              {url}
            </p>
          </div>
        </Section>

        <Section title="Bilgiler">
          <KeyValueGrid items={details} />
        </Section>
      </div>
    </main>
  );
}
