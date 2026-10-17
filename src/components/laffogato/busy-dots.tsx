/**
 * The site's wait mark: three dots in the label's own ink, lighting in turn
 * (`.lf-dots` in globals.css). It stands beside a busy button's "Gönderiliyor…"
 * and is decorative - the words already say what is happening, so assistive
 * technology hears them and the button's `aria-busy`, never three dots.
 *
 * The same language as the app's loading button (lafmobil
 * `src/components/ui/button.tsx`, which keeps the live fill): a request that
 * is out is shown by a moving mark in the button's own colour, not by fading
 * the button to the 45 % of a control that is switched off.
 */
export function BusyDots() {
  return (
    <span className="lf-dots" aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}
