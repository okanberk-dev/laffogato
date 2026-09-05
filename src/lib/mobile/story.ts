import "server-only";

import {
  listActivePress,
  listActiveStoryEvents,
  type AdminPress,
  type AdminStoryEvent,
} from "@/lib/admin/store";
import { getSiteContent } from "@/lib/admin/site-content";

/**
 * The brand story, for the app (docs/API-MOBILE.md §16).
 *
 * The app's Hikâye screen used to ship its own copy of the founder line, the
 * timeline and the press quotes. Every one of those is edited on the site —
 * Site Metinleri, /admin/hikaye, /admin/basin — so the two surfaces drifted
 * the first time someone touched a year. Serving them from here makes the
 * site the single source; the app keeps its bundled copy only as an offline
 * fallback.
 *
 * Like the other public reads this is an explicit allow-list, never a spread:
 * a store row carries `isActive`, `sortOrder` and timestamps the phone has no
 * use for.
 */

export interface MobileStoryFounder {
  name: string;
  role: string;
  bio: string;
}

export interface MobileStoryMilestone {
  year: string;
  title: string;
  body: string;
}

export interface MobileStoryPress {
  name: string;
  quote: string;
}

export interface MobileStory {
  founder: MobileStoryFounder;
  milestones: MobileStoryMilestone[];
  press: MobileStoryPress[];
}

/** Site-content keys the founder block reads (see content-fields.ts). */
export const STORY_FOUNDER_KEYS = {
  name: "story.founder.name",
  role: "story.founder.role",
  bio: "story.founder.bio",
} as const;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function toStoryFounder(
  content: Record<string, string>,
): MobileStoryFounder {
  return {
    name: text(content[STORY_FOUNDER_KEYS.name]),
    role: text(content[STORY_FOUNDER_KEYS.role]),
    bio: text(content[STORY_FOUNDER_KEYS.bio]),
  };
}

export function toStoryMilestone(
  event: Pick<AdminStoryEvent, "year" | "title" | "body">,
): MobileStoryMilestone {
  return {
    year: text(event.year),
    title: text(event.title),
    body: text(event.body),
  };
}

export function toStoryPress(
  press: Pick<AdminPress, "name" | "quote">,
): MobileStoryPress {
  return { name: text(press.name), quote: text(press.quote) };
}

/**
 * Pure assembly, so the wire shape is testable without a database. The
 * timeline is re-sorted here even though the list query orders it: the seed
 * fallback and a future caller may not, and a milestone out of order reads
 * as a wrong date on the phone.
 */
export function buildStory(
  content: Record<string, string>,
  events: readonly AdminStoryEvent[],
  press: readonly AdminPress[],
): MobileStory {
  const milestones = events
    .filter((e) => e.isActive)
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(toStoryMilestone);
  return {
    founder: toStoryFounder(content),
    milestones,
    press: press
      .filter((p) => p.isActive)
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(toStoryPress),
  };
}

export async function getStory(): Promise<MobileStory> {
  const [content, events, press] = await Promise.all([
    getSiteContent(),
    listActiveStoryEvents(),
    listActivePress(),
  ]);
  return buildStory(content, events, press);
}
