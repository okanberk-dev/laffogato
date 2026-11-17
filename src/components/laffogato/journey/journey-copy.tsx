import { Fragment, type CSSProperties, type ReactNode, type Ref } from "react";

import { cx } from "../cx";
import styles from "./journey.module.css";

/**
 * One block of the journey's copy: a two-line headline (the first line in
 * the sans, the second in the italic serif) bottom left, and whatever stands
 * beside it bottom right. Three of them lie in the same place and the
 * scroll shows one at a time (home-journey.tsx).
 *
 * Every word is its own span, numbered across both lines, so it can come up
 * out of its blur on its own: by the intro's keyframes in the first block
 * (`intro`), by `--reveal` written from the scroll in the others (`late`,
 * which also starts them hidden).
 */
export function JourneyCopy({
  blockRef,
  line1,
  line2,
  late = false,
  last = false,
  intro = false,
  children,
}: {
  blockRef: Ref<HTMLElement>;
  line1: string;
  line2: string;
  /** The second and third blocks: hidden until the scroll brings them. */
  late?: boolean;
  /** The third block sits a little lower on a phone. */
  last?: boolean;
  /** The first block: play the intro. */
  intro?: boolean;
  children: ReactNode;
}) {
  const first = line1.split(" ");
  const second = line2.split(" ");
  return (
    <section
      ref={blockRef}
      className={cx(
        styles.copy,
        late && styles.copyLate,
        last && styles.copyFinal,
        intro && styles.intro,
      )}
    >
      <h2 className={styles.headline}>
        <span className={cx(styles.trim, styles.sans, styles.line1)}>
          {words(first, 0)}
        </span>
        <span className={cx(styles.trim, styles.serif, styles.line2)}>
          {words(second, first.length)}
        </span>
      </h2>
      <div data-detail className={styles.detail}>
        {children}
      </div>
    </section>
  );
}

function words(list: string[], from: number) {
  return list.map((word, i) => (
    <Fragment key={`${word}-${i}`}>
      {i > 0 && " "}
      <span
        data-word
        className={styles.word}
        style={{ "--i": from + i } as CSSProperties}
      >
        {word}
      </span>
    </Fragment>
  ));
}
