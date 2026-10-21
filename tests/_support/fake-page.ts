import { vi } from "vitest";

/**
 * A page for the node tests of the panel's DOM glue (no DOM environment in
 * this repo, tests/admin-unsaved-guard*.test.ts): `window`, `document` and a
 * `<form>` as real EventTargets that remember which listeners were added
 * and which were taken away, so a test can see a page with nothing left
 * attached.
 */

export interface Attached {
  type: string;
  listener: unknown;
  capture: boolean;
}

const captureOf = (options?: boolean | AddEventListenerOptions): boolean =>
  options === true ||
  (typeof options === "object" && options !== null && !!options.capture);

/** An EventTarget with a log of its addEventListener and removeEventListener. */
export class Recorded extends EventTarget {
  added: Attached[] = [];
  removed: Attached[] = [];

  override addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ): void {
    this.added.push({ type, listener, capture: captureOf(options) });
    super.addEventListener(type, listener, options);
  }

  override removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | EventListenerOptions,
  ): void {
    this.removed.push({ type, listener, capture: captureOf(options) });
    super.removeEventListener(type, listener, options);
  }

  /** How many listeners of `type` were added, or taken away. */
  count(log: "added" | "removed", type: string): number {
    return this[log].filter((a) => a.type === type).length;
  }

  /** The listeners of `type` added and not removed since, oldest first. */
  live(type: string): Array<(event: unknown) => void> {
    const left = this.added.filter((a) => a.type === type);
    for (const gone of this.removed) {
      const at = left.findIndex(
        (a) => a.type === gone.type && a.listener === gone.listener,
      );
      if (at >= 0) left.splice(at, 1);
    }
    return left.map((a) => a.listener as (event: unknown) => void);
  }
}

export class FakeWindow extends Recorded {
  location: { href: string };
  confirm = vi.fn((_message: string) => true);
  constructor(href: string) {
    super();
    this.location = { href };
  }
}

export class FakeDocument extends Recorded {}

/** A `<form>`: the events the guard hears, and what FormData would read. */
export class FakeForm extends EventTarget {
  entries: Array<[string, string]>;
  constructor(entries: Array<[string, string]> = []) {
    super();
    this.entries = entries.map((e): [string, string] => [...e]);
  }
  set(name: string, value: string) {
    const hit = this.entries.find(([n]) => n === name);
    if (hit) hit[1] = value;
    else this.entries.push([name, value]);
  }
  /** The operator types: the field changes and its `input` event follows. */
  type(name: string, value: string) {
    this.set(name, value);
    this.input(name);
  }
  /** An `input` event from a control with this name (null: a nameless one). */
  input(name: string | null) {
    const event = new Event("input", { bubbles: true });
    Object.defineProperty(event, "target", { value: { name: name ?? "" } });
    this.dispatchEvent(event);
  }
  submit() {
    const event = new Event("submit", { bubbles: true, cancelable: true });
    this.dispatchEvent(event);
    return event;
  }
}
