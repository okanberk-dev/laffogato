import type { AppPostKind } from "@/lib/admin/app-content-schema";

/**
 * Whether the "Üyelere e-posta" box on the post form starts ticked.
 *
 * Only when a campaign post is being CREATED. On an edit the box starts off,
 * whatever the kind: every post that existed before the mail hook has an
 * empty `emailCampaignId`, and a ticked default there would have a routine
 * fix - a typo, the sort order - mail the whole member base a months-old
 * campaign with no more ceremony than "Değişiklikleri kaydet". Mailing an
 * existing post is a deliberate tick, and the label says it goes out once.
 * A post that already has its campaign never starts ticked.
 *
 * Client-safe: no store, no `server-only` - the form imports this.
 */
export function defaultEmailMembers(args: {
  mode: "create" | "edit";
  kind: AppPostKind;
  alreadyMailed: boolean;
}): boolean {
  if (args.alreadyMailed) return false;
  return args.mode === "create" && args.kind === "campaign";
}
