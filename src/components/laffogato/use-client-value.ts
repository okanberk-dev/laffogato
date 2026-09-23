"use client";

import { useSyncExternalStore } from "react";

const subscribeNever = () => () => {};

/**
 * A value only the browser can answer (a cookie, the connection type,
 * "has hydration finished"), read without a mount effect.
 *
 * The server render and the hydration render both see `serverValue`, so the
 * HTML matches; React then re-renders once with `read()`. That is the same
 * two-pass shape a `useEffect(() => setX(read()), [])` produced, minus the
 * cascading render the React Compiler lint flags.
 *
 * `read` runs on every render and must return a primitive (or a cached
 * object): a fresh object each time would never compare equal. Nothing is
 * subscribed, so a change in the underlying value shows on the next render,
 * not on its own.
 */
export function useClientValue<T>(read: () => T, serverValue: T): T {
  return useSyncExternalStore(subscribeNever, read, () => serverValue);
}
