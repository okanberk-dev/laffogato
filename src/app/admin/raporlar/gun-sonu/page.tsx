import Link from "next/link";

import { PageHeader, formatDateTime } from "@/components/admin/forms";
import { BUTTON, PageShell } from "@/components/admin/ui";
import { cx } from "@/components/laffogato/cx";
import { requireRole } from "@/lib/admin/auth";
import { stockLinks } from "@/lib/admin/dashboard-core";
import { loadDayClose } from "@/lib/admin/day-close";
import {
  DAY_CLOSE_MAX_DAYS_BACK,
  DAY_CLOSE_PARAM,
  DAY_CLOSE_PATH,
  dayCloseHref,
  dayCloseLabel,
  istanbulToday,
  parseDayCloseDay,
  shiftDay,
} from "@/lib/admin/day-close-core";
import { firstParam } from "@/lib/admin/list-params";

import { DayCloseSheet } from "./day-close-sheet";
import { PrintButton } from "./print-button";

export const metadata = { title: "Admin · Gün sonu" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Gün sonu (admin UI v2, UI-18): the day closed on one printable page,
 * instead of five screens. Owner and manager only, as Raporlar: it carries
 * the day's revenue. Read-only: nothing on it changes anything.
 *
 * The day is the köşk's (CLAUDE.md rule 22); `?gun=` opens an earlier one,
 * for a closing after midnight.
 */
export default async function DayClosePage({ searchParams }: PageProps) {
  const session = await requireRole("reports");
  const now = new Date();
  const today = istanbulToday(now);
  const day = parseDayCloseDay(
    firstParam(await searchParams, DAY_CLOSE_PARAM),
    now,
  );
  const summary = await loadDayClose(day, now);
  const label = dayCloseLabel(day);
  const earliest = shiftDay(today, -DAY_CLOSE_MAX_DAYS_BACK);
  const links = stockLinks(session.role);

  return (
    <PageShell width="detail">
      <PageHeader
        title="Gün sonu"
        meta={<span>{label}</span>}
        description="Günün siparişleri, iadeleri, karaokesi, damgaları ve stoğu tek sayfada."
        primary={<PrintButton />}
        help={
          <>
            <p>
              Gün, köşkün saatiyle 00:00 ile 24:00 arasıdır. Gece yarısından
              sonra kapanıyorsan önceki güne geç.
            </p>
            <p>
              Ciro Raporlar&apos;daki gibi sayılır: ödemesi alınmış siparişler.
              Ödeme bekleyen ve iptal edilen sipariş ciroya girmez; iade,
              siparişin verildiği günden düşülür.
            </p>
            <p>
              İadeler bölümü bu gün yapılan iadeleri gösterir, sipariş başka gün
              verilmiş olsa da. &quot;Kayıt: para hareket etmez&quot; satırında
              parayı POS değil, sen verdin (nakit ya da havale).
            </p>
            <p>
              Karaokede &quot;Gelmedi&quot;, saati geçtikten sonra iptal edilen,
              köşkte ödenecek rezervasyondur. Kasa damgaları kasadan ve üye
              sayfasından verilenlerdir.
            </p>
          </>
        }
      />

      <nav aria-label="Gün" className="mb-5 flex flex-wrap gap-2 print:hidden">
        {day > earliest ? (
          <Link
            href={dayCloseHref(shiftDay(day, -1), now)}
            className={cx(BUTTON.ghost, "whitespace-nowrap")}
          >
            Önceki gün
          </Link>
        ) : null}
        {day !== today ? (
          <>
            <Link
              href={DAY_CLOSE_PATH}
              className={cx(BUTTON.ghost, "whitespace-nowrap")}
            >
              Bugün
            </Link>
            <Link
              href={dayCloseHref(shiftDay(day, 1), now)}
              className={cx(BUTTON.ghost, "whitespace-nowrap")}
            >
              Sonraki gün
            </Link>
          </>
        ) : null}
      </nav>

      <DayCloseSheet
        summary={summary}
        dayLabel={label}
        printedAt={formatDateTime(now.toISOString())}
        productHref={links.product}
      />
    </PageShell>
  );
}
