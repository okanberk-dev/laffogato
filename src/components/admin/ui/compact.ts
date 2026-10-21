// The kit's compact density classes (admin UI v2, UI-9). Its own file: the
// tab strip the shell draws on every page takes them, and must not bring
// the buttons of styles.ts (which re-exports this) along.

/**
 * Compact density (admin UI v2, UI-9, "Sıkı görünüm"). The kit's defaults
 * stay as they were: 44 px targets, 24 px cards. When the admin root carries
 * `data-admin-density="compact"` (view-prefs.tsx writes it) AND the pointer
 * can aim (a mouse or a trackpad), these classes tighten them: table cells
 * `py-3` to `py-2`, cards and sections `p-6` to `p-4`, controls to 36 px
 * (above WCAG 2.2's 24 px minimum). A touch screen matches none of them, so
 * the switch does nothing there and its menu row says so. Each class says
 * `pointer-fine:` first (tests/admin-rail-density.test.ts scans for a
 * compact class without it) and is written out whole for Tailwind's
 * scanner, which cannot read a name built from parts. No rule in the site's
 * globals.css.
 */
export const COMPACT = {
  /** Table cells and a section's header: from py-3. */
  py2: "pointer-fine:[[data-admin-density=compact]_&]:py-2",
  /** A section's header: from sm:px-6, to the body's own padding. */
  px4: "pointer-fine:[[data-admin-density=compact]_&]:px-4",
  /** A card or a section's body: from p-4 sm:p-6. */
  p4: "pointer-fine:[[data-admin-density=compact]_&]:p-4",
  /** A text field: from py-2.5. */
  fieldPy: "pointer-fine:[[data-admin-density=compact]_&]:py-1.5",
  /** A control's height: from 44 px (40 px for the status tabs). */
  minH9: "pointer-fine:[[data-admin-density=compact]_&]:min-h-9",
  minW9: "pointer-fine:[[data-admin-density=compact]_&]:min-w-9",
  /** A fixed-size control (an icon button, a page cell). */
  h9: "pointer-fine:[[data-admin-density=compact]_&]:h-9",
  w9: "pointer-fine:[[data-admin-density=compact]_&]:w-9",
} as const;
