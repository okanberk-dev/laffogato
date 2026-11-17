/**
 * The glass behind the cards: each `canvas[data-blur]` in the stage is a
 * blurred copy of the part of the journey's canvas that lies behind its
 * parent.
 *
 * A copy, not `backdrop-filter`: the copy shows the picture alone, without
 * the shade laid over it, and keeps working inside the cards' container
 * while that container fades in. `ctx.filter` is what blurs it (Chrome,
 * Firefox, Safari 18+); where a browser has no `ctx.filter` this reports it
 * and the stylesheet falls back to `backdrop-filter` (`data-glass="css"`).
 */
export const canBlurCopies = () =>
  typeof CanvasRenderingContext2D !== "undefined" &&
  "filter" in CanvasRenderingContext2D.prototype;

export function drawGlass(stage: HTMLElement, source: HTMLCanvasElement) {
  const src = source.getBoundingClientRect();
  if (!src.width || !source.width) return;
  const scale = source.width / src.width; // device px per CSS px
  for (const canvas of stage.querySelectorAll<HTMLCanvasElement>(
    "canvas[data-blur]",
  )) {
    const host = canvas.parentElement;
    if (!host) continue;
    const r = host.getBoundingClientRect();
    if (!r.width || !r.height || getComputedStyle(host).visibility === "hidden")
      continue;
    const blur = Number(canvas.dataset.blur);
    // Reach past the element so its edges blur in what is around it.
    const pad = blur * 2;
    const cssW = r.width + pad * 2;
    const cssH = r.height + pad * 2;
    const w = Math.max(1, Math.round(cssW * scale));
    const h = Math.max(1, Math.round(cssH * scale));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    Object.assign(canvas.style, {
      left: `${-pad}px`,
      top: `${-pad}px`,
      width: `${cssW}px`,
      height: `${cssH}px`,
    });
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.filter = `blur(${blur * scale}px)`;
    ctx.drawImage(
      source,
      -(r.left - src.left - pad) * scale,
      -(r.top - src.top - pad) * scale,
    );
    ctx.filter = "none";
  }
}
