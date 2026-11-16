import { Fragment } from "react";

/**
 * An e-mail address that breaks before "@" and at the domain's dots, never
 * mid-word: in a phone card's narrow column a long address ending in ".com"
 * broke as "….co" and "m" (21 Oct 2026). Any other text is drawn as
 * it is. Keep `[overflow-wrap:anywhere]` (or `break-words`) on the parent
 * for a part too long for a line. Server-safe.
 */
export function EmailText({ value }: { value: string }) {
  const at = value.lastIndexOf("@");
  if (at <= 0 || /\s/.test(value)) return <>{value}</>;
  const parts = value.slice(at + 1).split(".");
  return (
    <>
      {value.slice(0, at)}
      <wbr />@
      {parts.map((part, i) => (
        <Fragment key={i}>
          {i > 0 ? (
            <>
              <wbr />.
            </>
          ) : null}
          {part}
        </Fragment>
      ))}
    </>
  );
}
