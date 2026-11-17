"use client";

import { useEffect, useRef } from "react";

import { CURSOR_SMOOTHING } from "./config";
import styles from "./journey.module.css";
import { damp } from "./motion";

const inStage = (target: EventTarget | null) =>
  target instanceof Element && target.closest("[data-journey-stage]") !== null;

/**
 * The journey's cursor: a ring and a dot that trail the pointer over the
 * picture, grow over a link or a button, and say what the button does
 * (`data-cursor-label`).
 *
 * Fine pointers only (the stylesheet hides it elsewhere), and only while
 * the pointer is over the stage: the top bar, its panels and the page below
 * keep the system cursor. It shows once the intro has started. That flag
 * travels as a data attribute, because the classes below are set with
 * `classList` and a re-rendered `className` would wipe them.
 */
export function JourneyCursor({ intro }: { intro: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    const label = labelRef.current;
    if (!el || !label) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;

    // It starts from the middle of the window and eases to the pointer.
    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;
    let aimX = x;
    let aimY = y;
    let frame = 0;
    let last = 0;

    const step = (now: number) => {
      const dt = Math.max(0, now - last);
      last = now;
      x = damp(x, aimX, CURSOR_SMOOTHING, dt);
      y = damp(y, aimY, CURSOR_SMOOTHING, dt);
      const rest = Math.abs(aimX - x) < 0.05 && Math.abs(aimY - y) < 0.05;
      if (rest) {
        x = aimX;
        y = aimY;
      }
      el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      frame = rest ? 0 : requestAnimationFrame(step);
    };
    const wake = () => {
      if (frame) return;
      last = performance.now();
      frame = requestAnimationFrame(step);
    };

    const onMove = (event: PointerEvent) => {
      aimX = event.clientX;
      aimY = event.clientY;
      el.classList.toggle(styles.cursorVisible, inStage(event.target));
      wake();
    };
    const onLeave = () => el.classList.remove(styles.cursorVisible);
    // The page can move under a pointer that does not: when the stage has
    // scrolled away from under it, the ring goes too.
    const onScroll = () => {
      if (!el.classList.contains(styles.cursorVisible)) return;
      if (!inStage(document.elementFromPoint(aimX, aimY)))
        el.classList.remove(styles.cursorVisible);
    };
    const onOver = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const hit =
        target && inStage(target)
          ? target.closest("a, button, [data-cursor-label]")
          : null;
      el.classList.toggle(styles.cursorHover, hit !== null);
      const text = hit
        ?.closest("[data-cursor-label]")
        ?.getAttribute("data-cursor-label");
      // The label keeps its last text while it fades out.
      if (text) label.textContent = text;
      el.classList.toggle(styles.cursorLabelled, !!text);
    };

    el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    document.documentElement.addEventListener("mouseleave", onLeave);
    document.addEventListener("pointerover", onOver);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("scroll", onScroll);
      document.documentElement.removeEventListener("mouseleave", onLeave);
      document.removeEventListener("pointerover", onOver);
    };
  }, []);

  return (
    <div
      ref={ref}
      className={styles.cursor}
      data-intro={intro ? "1" : undefined}
      aria-hidden="true"
    >
      <span className={styles.ring} />
      <span className={styles.dot} />
      <span ref={labelRef} className={styles.label} />
    </div>
  );
}
