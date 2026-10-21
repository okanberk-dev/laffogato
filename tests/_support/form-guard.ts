import { expect } from "vitest";

/** The opening tag of every `<form>` in server-rendered `html`. */
export const formOpenTags = (html: string): string[] =>
  html.match(/<form\b[^>]*>/g) ?? [];

/**
 * A form posted from its onSubmit, as the server draws it: its action is
 * React's guard, the javascript: URL drawn for a function action that is
 * not a Server Action. An Enter before hydration then sends nothing; a form
 * with neither action nor method would GET the page with every field in
 * the address (tests/form-native-submit.test.ts). No progressive-enhancement
 * post ($ACTION_ID) rides along either.
 */
export function expectReactGuard(tag: string): void {
  expect(tag).toMatch(/\baction="javascript:/);
  expect(tag).not.toMatch(/\bmethod="get"/i);
  expect(tag).not.toContain("$ACTION");
}
