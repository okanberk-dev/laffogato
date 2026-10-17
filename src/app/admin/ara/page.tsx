import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminSearchField } from "@/components/admin/admin-search";
import {
  Card,
  PageHeader,
  formatDateTime,
  formatTRY,
} from "@/components/admin/forms";
import { EmptyState } from "@/components/admin/ui/detail";
import { NUMERIC_STYLE } from "@/components/admin/ui/styles";
import { getAdminSession } from "@/lib/admin/auth";
import { landingPathFor } from "@/lib/admin/roles";
import {
  SEARCH_LIMIT,
  SEARCH_MIN_LENGTH,
  parseSearch,
  searchAdmin,
  searchSectionsFor,
  type SearchGroup,
  type SearchSection,
} from "@/lib/admin/search";

export const metadata = { title: "Admin · Arama" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ q?: string | string[] }>;
}

/** What the box looks for, said for this role's sections only. */
const SECTION_HINTS: Record<SearchSection, string> = {
  orders: "sipariş numarası, müşterinin adı, e-postası ya da telefonu",
  customers: "üyenin adı, e-postası ya da telefonu",
  karaoke: "karaoke kodu (KRK-00042)",
  products: "ürün adı ya da SKU",
  menu: "menü ürünü",
};

function ResultGroup({ group }: { group: SearchGroup }) {
  const headingId = `ara-${group.section}`;
  return (
    <Card className="p-0 sm:p-0">
      <section aria-labelledby={headingId}>
        <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--admin-border)] px-4 py-3 sm:px-6">
          <h2
            id={headingId}
            className="text-base font-semibold text-[var(--admin-text)]"
          >
            {group.label}
          </h2>
          {group.more && group.listHref ? (
            <Link
              href={group.listHref}
              className="inline-flex min-h-8 items-center text-sm text-[var(--admin-primary)] underline-offset-4 hover:underline"
            >
              İlk {SEARCH_LIMIT} sonuç · listede ara
            </Link>
          ) : group.more ? (
            <span className="text-sm text-[var(--admin-text-mute)]">
              İlk {SEARCH_LIMIT} sonuç
            </span>
          ) : null}
        </header>
        {group.hits.length === 0 ? (
          <p className="px-4 py-4 text-sm text-[var(--admin-text-soft)] sm:px-6">
            Sonuç yok.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--admin-border)]">
            {group.hits.map((hit) => (
              <li key={hit.href}>
                <Link
                  href={hit.href}
                  className="flex min-h-[44px] flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 hover:bg-[var(--admin-surface-2)] sm:px-6"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-[var(--admin-text)]">
                      {hit.title}
                    </span>
                    {hit.meta.length > 0 && (
                      <span className="block truncate text-xs text-[var(--admin-text-soft)]">
                        {hit.meta.join(" · ")}
                      </span>
                    )}
                  </span>
                  {(hit.amountMinor !== undefined || hit.at) && (
                    <span className="shrink-0 text-right text-xs text-[var(--admin-text-soft)]">
                      {hit.amountMinor !== undefined && (
                        <span
                          className="block text-sm text-[var(--admin-text)]"
                          style={NUMERIC_STYLE}
                        >
                          {formatTRY(hit.amountMinor)}
                        </span>
                      )}
                      {hit.at && (
                        <span className="block">{formatDateTime(hit.at)}</span>
                      )}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Card>
  );
}

/**
 * The panel's search results (P2b, decision D36). Each section is shown
 * only to a role that may open it (lib/admin/search.ts); a role with none
 * (Kasiyer) is sent back to its own page.
 */
export default async function AdminSearchPage({ searchParams }: PageProps) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/giris");
  const sections = searchSectionsFor(session.role);
  if (sections.length === 0) {
    redirect(`${landingPathFor(session.role)}?denied=1`);
  }

  const sp = await searchParams;
  const raw = typeof sp.q === "string" ? sp.q : "";
  const parsed = parseSearch(raw);
  const groups = parsed ? await searchAdmin(parsed, session.role) : null;
  const found = groups?.some((g) => g.hits.length > 0) ?? false;
  const hints = sections.map((s) => SECTION_HINTS[s]).join("; ");

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Panel"
        title="Arama"
        description={`Ara: ${hints}.`}
      />
      <AdminSearchField
        id="admin-search-page"
        defaultValue={raw}
        large
        autoFocus={!raw}
        className="mb-6 flex"
      />

      {raw.trim() && !parsed && (
        <p className="text-sm text-[var(--admin-text-soft)]">
          En az {SEARCH_MIN_LENGTH} karakter yaz.
        </p>
      )}

      {groups && !found && (
        <EmptyState
          title={`"${parsed?.text}" için sonuç yok.`}
          description="Sipariş numarasını yalnız rakamla, e-postayı tamamıyla ya da adın bir kısmıyla dene."
        />
      )}

      {groups && found && (
        <div className="grid gap-4">
          {groups.map((g) => (
            <ResultGroup key={g.section} group={g} />
          ))}
        </div>
      )}
    </main>
  );
}
