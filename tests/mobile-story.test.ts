import { describe, expect, it } from "vitest";

import type { AdminPress, AdminStoryEvent } from "@/lib/admin/store";

import { CONTENT_FIELDS, contentDefaults } from "@/lib/admin/content-fields";
import { STORY } from "@/components/laffogato/data";
import {
  buildStory,
  STORY_FOUNDER_KEYS,
  toStoryFounder,
} from "@/lib/mobile/story";

/**
 * The app's Hikâye screen reads this instead of its bundled copy, so the
 * shape has to be exactly what docs/API-MOBILE.md §16 promises and nothing a
 * store row happens to carry.
 */

function event(
  over: Partial<AdminStoryEvent> & Pick<AdminStoryEvent, "id">,
): AdminStoryEvent {
  return {
    year: "2026",
    title: "İstanbul · Tuzla",
    body: "İlk yurt dışı şube.",
    sortOrder: 0,
    isActive: true,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...over,
  };
}

function press(over: Partial<AdminPress> & Pick<AdminPress, "id">): AdminPress {
  return {
    name: "Monocle",
    quote: "Bir kupa, bir ritüel.",
    sortOrder: 0,
    isActive: true,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...over,
  };
}

describe("story founder", () => {
  it("has an editable name and role next to the bio (group Hikaye)", () => {
    for (const key of Object.values(STORY_FOUNDER_KEYS)) {
      const field = CONTENT_FIELDS.find((f) => f.key === key);
      expect(field, key).toBeDefined();
      expect(field?.group).toBe("Hikaye");
    }
  });

  it("defaults to the bundled STORY founder name and role", () => {
    const founder = toStoryFounder(contentDefaults());
    expect(founder.name).toBe(STORY.founder.name);
    expect(founder.role).toBe(STORY.founder.role);
    expect(founder.bio).toBeTruthy();
  });

  it("reads the edited value and trims it", () => {
    const founder = toStoryFounder({
      ...contentDefaults(),
      [STORY_FOUNDER_KEYS.name]: "  Eda M.  ",
    });
    expect(founder.name).toBe("Eda M.");
  });

  it("never yields undefined when a key is missing", () => {
    expect(toStoryFounder({})).toEqual({ name: "", role: "", bio: "" });
  });
});

describe("buildStory", () => {
  it("maps rows through an allow-list — no ids, flags or timestamps", () => {
    const story = buildStory(
      contentDefaults(),
      [event({ id: "story-001" })],
      [press({ id: "press-001" })],
    );
    expect(Object.keys(story).sort()).toEqual(
      ["founder", "milestones", "press"].sort(),
    );
    expect(Object.keys(story.founder).sort()).toEqual(["bio", "name", "role"]);
    expect(story.milestones[0]).toEqual({
      year: "2026",
      title: "İstanbul · Tuzla",
      body: "İlk yurt dışı şube.",
    });
    expect(story.press[0]).toEqual({
      name: "Monocle",
      quote: "Bir kupa, bir ritüel.",
    });
    const raw = JSON.stringify(story);
    for (const leak of [
      "id",
      "isActive",
      "sortOrder",
      "createdAt",
      "updatedAt",
    ]) {
      expect(raw, leak).not.toContain(`"${leak}"`);
    }
  });

  it("orders milestones by sortOrder, whatever order the rows arrive in", () => {
    const story = buildStory(
      contentDefaults(),
      [
        event({ id: "c", year: "2026", sortOrder: 3 }),
        event({ id: "a", year: "1987", sortOrder: 0 }),
        event({ id: "b", year: "1994", sortOrder: 1 }),
      ],
      [],
    );
    expect(story.milestones.map((m) => m.year)).toEqual([
      "1987",
      "1994",
      "2026",
    ]);
  });

  it("drops inactive rows even if a caller forgets to filter", () => {
    const story = buildStory(
      contentDefaults(),
      [event({ id: "on" }), event({ id: "off", isActive: false })],
      [press({ id: "on" }), press({ id: "off", isActive: false })],
    );
    expect(story.milestones).toHaveLength(1);
    expect(story.press).toHaveLength(1);
  });

  it("returns empty lists, not nulls, when nothing is published", () => {
    const story = buildStory(contentDefaults(), [], []);
    expect(story.milestones).toEqual([]);
    expect(story.press).toEqual([]);
  });
});
