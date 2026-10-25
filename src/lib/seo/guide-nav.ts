/**
 * Rehber links for the footer - slug + title only.
 *
 * Deliberately separate from `guides.ts`: the footer is a client component, and
 * importing the guide registry there would ship every guide's full body to the
 * browser. `tests/guides.test.ts` asserts these slugs and titles still match the
 * real guides, so the duplication cannot drift.
 */
export const GUIDE_LINKS = [
  { slug: "affogato-nedir", title: "Affogato nedir?" },
  { slug: "yenilebilir-kahve-fincani", title: "Yenilebilir bardakta kahve" },
  { slug: "tiramisu-tarifi", title: "Tiramisu tarifi" },
  { slug: "espresso-cesitleri", title: "Espresso bazlı kahveler" },
  { slug: "matcha-nedir", title: "Matcha nedir?" },
  { slug: "cold-brew-nedir", title: "Cold brew nedir?" },
  { slug: "frappe-nedir", title: "Frappe nedir?" },
  { slug: "san-sebastian-cheesecake", title: "San Sebastian cheesecake" },
  { slug: "spanish-latte-nedir", title: "Spanish latte nedir?" },
  { slug: "chai-tea-latte", title: "Chai tea latte nedir?" },
] as const;
