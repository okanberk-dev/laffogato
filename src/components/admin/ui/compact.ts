// The kit's compact density classes (admin UI v2, UI-9). Its own file: the
// tab strip the shell draws on every page takes them, and must not bring
// the buttons of styles.ts (which re-exports this) along.

/**
 * Compact density (admin UI v2, UI-9, "Sıkı görünüm"). The kit's defaults
 * stay as they are: 44 px targets on a touch screen, 36 px controls where
 * the pointer can aim (Innex, 22 Eki 2026), 20 px cards. When the admin root
 * carries `data-admin-density="compact"` (view-prefs.tsx writes it) AND the
 * pointer can aim (a mouse or a trackpad), these classes tighten them:
 * table cells `py-3` to `py-2`, cards and sections `p-5` to `p-4`, controls
 * to 32 px, Innex's own size (above WCAG 2.2's 24 px minimum). A touch
 * screen matches none of them, so the switch does nothing there and its
 * menu row says so. Each class says `pointer-fine:` first
 * (tests/admin-rail-density.test.ts scans for a compact class without it)
 * and is written out whole for Tailwind's scanner, which cannot read a name
 * built from parts. No rule in the site's globals.css.
 */
export const COMPACT = {
  /** Table cells and a section's header: from py-3. */
  py2: "pointer-fine:[[data-admin-density=compact]_&]:py-2",
  /** A section's header: from sm:px-5, to the body's own padding. */
  px4: "pointer-fine:[[data-admin-density=compact]_&]:px-4",
  /** A card or a section's body: from p-4 sm:p-5. */
  p4: "pointer-fine:[[data-admin-density=compact]_&]:p-4",
  /** A text field: from py-2. */
  fieldPy: "pointer-fine:[[data-admin-density=compact]_&]:py-1.5",
  /** A control's height: from 36 px where the pointer can aim. */
  minH8: "pointer-fine:[[data-admin-density=compact]_&]:min-h-8",
  minW8: "pointer-fine:[[data-admin-density=compact]_&]:min-w-8",
  /** A fixed-size control (an icon button, a page cell). */
  h8: "pointer-fine:[[data-admin-density=compact]_&]:h-8",
  w8: "pointer-fine:[[data-admin-density=compact]_&]:w-8",
} as const;
