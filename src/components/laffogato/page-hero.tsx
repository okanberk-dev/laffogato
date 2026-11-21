import Image from "next/image";

/**
 * The opener every page but home shares (21 Kas 2026): the reference's
 * inner-page template. A wide photograph under the top bar (3.2:1 on a wide
 * screen, 4:3 on a phone), then the title in tracked capitals and one
 * paragraph on white. A page with no photograph (the legal texts) opens on
 * the title alone.
 *
 * A server component. The photograph is the page's largest paint, so it is
 * fetched with priority.
 */
export function PageHero({
  eyebrow,
  title,
  lede,
  image,
  children,
}: {
  /** A short label over the title ("Menü · Espresso"); optional. */
  eyebrow?: string;
  /** A tuple reads as one line; the array was the old hand-set break. */
  title: string | [string, string];
  lede?: string;
  /** A wide photograph: public path and alt (empty for a mood picture). */
  image?: { src: string; alt?: string; position?: string };
  children?: React.ReactNode;
}) {
  const text = Array.isArray(title) ? title.join(" ") : title;
  return (
    <section className="page-hero">
      {image ? (
        <div className="page-hero-media media">
          <Image
            src={image.src}
            alt={image.alt ?? ""}
            fill
            priority
            sizes="100vw"
            style={image.position ? { objectPosition: image.position } : undefined}
          />
        </div>
      ) : null}
      <div className="wrap page-hero-copy">
        {eyebrow ? <p className="t-label t-muted">{eyebrow}</p> : null}
        <h1 className="t-display">{text}</h1>
        {lede ? <p className="t-body page-hero-lede">{lede}</p> : null}
        {children != null ? (
          <div className="page-hero-extra">{children}</div>
        ) : null}
      </div>
    </section>
  );
}
