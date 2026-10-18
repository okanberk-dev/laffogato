import { redirect } from "next/navigation";

import { PageHeader } from "@/components/admin/forms";
import { getAdminSession } from "@/lib/admin/auth";
import { withDenied } from "@/lib/admin/nav-match";
import { landingPathFor } from "@/lib/admin/roles";
import { searchSectionsFor, type SearchSection } from "@/lib/admin/search-core";

import { AdminSearchResults } from "./search-results";

export const metadata = { title: "Admin · Arama" };
export const dynamic = "force-dynamic";

/** What the box looks for, said for this role's sections only. */
const SECTION_HINTS: Record<SearchSection, string> = {
  orders: "sipariş numarası, müşterinin adı, e-postası ya da telefonu",
  customers: "üyenin adı, e-postası ya da telefonu",
  karaoke: "karaoke kodu (KRK-00042)",
  products: "ürün adı ya da SKU",
  menu: "menü ürünü",
};

/**
 * The panel's search results (P2b, decision D36). The page reads no query
 * from its address: the box posts (app/admin/ara/actions.ts) and the
 * answer is drawn from that post, here or in the browser. Each section is
 * shown only to a role that may open it (lib/admin/search.ts); a role with
 * none (Kasiyer) is sent back to its own page.
 */
export default async function AdminSearchPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/giris");
  const sections = searchSectionsFor(session.role);
  if (sections.length === 0) {
    redirect(withDenied(landingPathFor(session.role)));
  }
  const hints = sections.map((s) => SECTION_HINTS[s]).join("; ");

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Panel"
        title="Arama"
        description={`Ara: ${hints}.`}
      />
      <AdminSearchResults />
    </main>
  );
}
