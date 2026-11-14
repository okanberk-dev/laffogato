"use client";

import NextLink from "next/link";
import { useState, type ComponentProps } from "react";

/**
 * The only `<Link>` in this codebase: `next/link` that does not prefetch a
 * route just because the link scrolled into view.
 *
 * Why (14 Kas 2026): Vercel paused every project of the account for going
 * over the Hobby plan's usage. Nearly every page here is dynamic (`ƒ`: a CSP
 * nonce and a session per request), and next/link's default prefetch asks
 * the server for each visible link's route: one visit to the home page made
 * 11-12 extra server renders (the nav's /menu and /magaza, the footer's
 * /rehber and two legal pages, the home page itself, each twice), every one
 * a function invocation plus a proxy invocation, before the visitor clicked
 * anything. The panel's sidebar did the same with its own pages.
 *
 * Here a link prefetches only once someone shows they mean it: the pointer
 * rests on it or a finger touches it. Then the prop goes back to Next's
 * default ("auto"), Next registers the link and prefetches it while it is on
 * screen, as it would have; the click that usually follows is as quick as
 * before. A link that sets `prefetch` itself keeps its own choice.
 *
 * `useLinkStatus` still comes from `next/link`: it reads the context the
 * NextLink below provides. tests/link-prefetch.test.ts keeps every other
 * file on this component.
 */
export type LinkProps = ComponentProps<typeof NextLink>;

export default function Link({
  prefetch,
  onMouseEnter,
  onTouchStart,
  ...rest
}: LinkProps) {
  const [intent, setIntent] = useState(false);
  const chosen = prefetch !== undefined;
  return (
    <NextLink
      {...rest}
      prefetch={chosen ? prefetch : intent ? null : false}
      onMouseEnter={(e) => {
        if (!chosen && !intent) setIntent(true);
        onMouseEnter?.(e);
      }}
      onTouchStart={(e) => {
        if (!chosen && !intent) setIntent(true);
        onTouchStart?.(e);
      }}
    />
  );
}
