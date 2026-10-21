// The folded group is always open from md up: CSS shows a closed
// <details>' content there (::details-content), and this opens it as well
// for a browser without that pseudo-element, also when the window grows
// past md later (a tablet turned sideways): the summary is hidden there,
// so a group still closed could not be opened at all. A <details>' ref:
// the FilterBar's folded filters and Stok's correction form use it.
export const openFromMd = (el: HTMLDetailsElement | null) => {
  if (!el) return;
  const md = window.matchMedia("(min-width: 48rem)");
  const sync = () => {
    if (md.matches) el.open = true;
  };
  sync();
  md.addEventListener("change", sync);
  return () => md.removeEventListener("change", sync);
};
