"use server";

import { redirect, unstable_rethrow } from "next/navigation";

import { getAdminSession } from "@/lib/admin/auth";
import { withDenied } from "@/lib/admin/nav-match";
import { landingPathFor } from "@/lib/admin/roles";
import { parseSearch, searchAdmin } from "@/lib/admin/search";
import {
  searchSectionsFor,
  searchText,
  type AdminSearchState,
} from "@/lib/admin/search-core";

/**
 * The panel's search (P2b, decision D36), posted: the box's text travels
 * in the request body, never in an address (lib/admin/search-core.ts
 * ADMIN_SEARCH_PATH). The results page is this action's permalink, so
 * without JavaScript the browser posts to /admin/ara and the page is drawn
 * with the answer.
 *
 * Its own session and role check, as every export of a "use server" file
 * is a public endpoint (CLAUDE.md rule 27): signed out goes to the sign-in,
 * a role no section of the search covers (Kasiyer) to its own page, and
 * searchAdmin asks only the sections the role may open. Nothing is logged
 * of what was typed. A database that does not answer is said as such and
 * the box keeps the text; it is never "no results".
 */
export async function adminSearchAction(
  _prev: AdminSearchState,
  formData: FormData,
): Promise<AdminSearchState> {
  const text = searchText(formData.get("q"));
  try {
    const session = await getAdminSession();
    if (!session) redirect("/admin/giris");
    if (searchSectionsFor(session.role).length === 0) {
      redirect(withDenied(landingPathFor(session.role)));
    }
    const parsed = parseSearch(text);
    if (!parsed) {
      return { text, groups: null, tooShort: text.length > 0, failed: false };
    }
    return {
      text: parsed.text,
      groups: await searchAdmin(parsed, session.role),
      tooShort: false,
      failed: false,
    };
  } catch (err) {
    unstable_rethrow(err);
    console.error(
      `[admin] arama yapılamadı: ${err instanceof Error ? err.name : "hata"}`,
    );
    return { text, groups: null, tooShort: false, failed: true };
  }
}
