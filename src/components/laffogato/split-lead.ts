/**
 * "First sentence. The rest." → ["First sentence.", "The rest."].
 *
 * The home hero shows only the first sentence on a phone (so its buttons
 * stay above the tab bar), and the statement band under it sets the first
 * sentence in ExtraBold and the rest in Light. Text with one sentence comes
 * back whole, with an empty rest. No lookbehind in the pattern: Safari before
 * 16.4 rejects a whole chunk over one.
 */
export function splitLead(text: string): [string, string] {
  const m = /^(.+?[.!?])\s+([\s\S]+)$/.exec(text.trim());
  return m ? [m[1], m[2]] : [text.trim(), ""];
}
