"use server";

import { redirect } from "next/navigation";

import { getAdminSession } from "@/lib/admin/auth";
import {
  listSearchHref,
  readListSearchPost,
  saveListSearch,
} from "@/lib/admin/list-search";
import { canAccess, deniedPathFor, landingPathFor } from "@/lib/admin/roles";

/**
 * A list's filter bar, posted (lib/admin/list-search-core.ts): the search
 * box's text goes into the list's own short-lived cookie, everything else
 * (tab, dropdowns, dates, sort) into the address, and the operator lands on
 * the list. The text is never in the redirect, nor in a log line: nothing
 * here writes one. Without JavaScript the browser posts the form to the
 * page it is on and follows the 303.
 *
 * Its own session and section check, as every export of a "use server" file
 * is a public endpoint (CLAUDE.md rule 27): signed out goes to the sign-in;
 * a list the role may not open (the section its page's requireRole names)
 * to the role's landing page with the notice, before any cookie is touched.
 */
export async function listSearchAction(formData: FormData): Promise<void> {
  const session = await getAdminSession();
  if (!session) redirect("/admin/giris");
  const post = readListSearchPost(formData);
  // A post the panel never draws (no list at that path): nothing to keep.
  if (!post) redirect(landingPathFor(session.role));
  if (!canAccess(post.list.section, session.role)) {
    redirect(deniedPathFor(session.role));
  }
  await saveListSearch(post);
  redirect(listSearchHref(post));
}
