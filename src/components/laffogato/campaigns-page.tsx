import { PageHero } from "./page-hero";

export interface CampaignPost {
  id: string;
  kind: "campaign" | "collab" | "event";
  title: string;
  body: string;
  image: string;
  linkUrl: string;
  linkLabel: string;
}

const KIND_LABEL: Record<CampaignPost["kind"], string> = {
  campaign: "Kampanya",
  collab: "İş birliği",
  event: "Etkinlik",
};

/**
 * `/kampanyalar` — the offers page, in the reference's language.
 *
 * A cream page hero with the green disc behind a display headline, then the
 * two house programmes as full-width green banners, then whatever the panel
 * is running as a card grid.
 *
 * Everything here is operator-controlled: the banners answer to
 * `campaignCards` switches and the cards are `/app-content` posts — the same
 * two sources the app's Kampanyalar screen reads, so publishing once moves
 * both.
 */
export function CampaignsPage({
  posts,
  cards,
  stampTarget,
  rewardTitle,
}: {
  posts: CampaignPost[];
  cards: { loyalty: boolean; invite: boolean; subscription: boolean };
  stampTarget: number;
  rewardTitle: string;
}) {
  const campaigns = posts.filter((p) => p.kind === "campaign");
  const others = posts.filter((p) => p.kind !== "campaign");

  return (
    <>
      <PageHero
        eyebrow="Köşkte bu ay"
        title={["Kampanyalar", "ve etkinlikler"]}
        lede="Sezon kampanyaları, iş birlikleri ve köşkte olan biten. Damga programı ve davet ödülü de burada - ikisi de uygulamada ve web'de aynı hesaba işler."
      />

      <section className="home-section">
        <div className="wrap">
          <div className="promo-stack">
            {cards.loyalty && (
              <PromoBanner
                eyebrow="Ödül programı"
                title={`${stampTarget} damgada 1 ${rewardTitle.toLocaleLowerCase("tr-TR")}`}
                body="Uygulamadan verdiğin her kafe siparişi bir damga kazandırır. Kart dolduğunda ödülün kuponlarına düşer."
                href="/uye/hesap"
                cta="Kartımı gör"
              />
            )}
            {cards.invite && (
              <PromoBanner
                eyebrow="Davet"
                title="Arkadaşını çağır, ikiniz de kazanın"
                body="Davet kodunu paylaş; arkadaşın ilk siparişini verdiğinde ikinizin de hesabına ödül düşer."
                href="/uye/hesap/promosyonlar"
                cta="Davet kodum"
                tone="gold"
              />
            )}
          </div>
        </div>
      </section>

      {campaigns.length > 0 && (
        <CardGrid title="Şu an geçerli" posts={campaigns} />
      )}
      {others.length > 0 && (
        <CardGrid title="İş birlikleri ve etkinlikler" posts={others} />
      )}

      {posts.length === 0 && !cards.loyalty && !cards.invite && (
        <section className="home-section home-section-last">
          <div className="wrap">
            <p className="campaign-empty">
              Şu an yayında bir kampanya yok. Yeni sezon menüsü için menüye göz
              atabilirsin.
            </p>
          </div>
        </section>
      )}
    </>
  );
}

/**
 * The reference's banner: a deep-green board with a soft wave across it and a
 * single pill on the right.
 */
function PromoBanner({
  eyebrow,
  title,
  body,
  href,
  cta,
  tone = "green",
}: {
  eyebrow: string;
  title: string;
  body: string;
  href: string;
  cta: string;
  tone?: "green" | "gold";
}) {
  return (
    <a className={`promo-banner ${tone}`} href={href}>
      {/* The wave is the reference's, drawn rather than shipped as an image so
          it takes the band's own colours. */}
      <svg
        className="promo-banner-wave"
        viewBox="0 0 1200 220"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path d="M0 150 C 220 60, 420 210, 660 130 S 1000 40, 1200 96 L1200 220 L0 220 Z" />
      </svg>
      <span className="promo-banner-copy">
        <span className="promo-banner-eyebrow">{eyebrow}</span>
        <span className="promo-banner-title">{title}</span>
        <span className="promo-banner-body">{body}</span>
      </span>
      <span className="promo-banner-cta">{cta}</span>
    </a>
  );
}

function CardGrid({ title, posts }: { title: string; posts: CampaignPost[] }) {
  return (
    <section className="home-section">
      <div className="wrap">
        <h2 className="section-title">{title}</h2>
        <div className="campaign-grid">
          {posts.map((p, i) => (
            /* The site's own scroll-reveal driver (RevealMotion), not a
               second one: it is already mounted in the layout, it is already
               safe for SSR, no-JS and reduced motion, and `r1..r4` are the
               stagger it ships. A bespoke observer here would have hidden
               cards that were already on screen and flashed them. */
            <article
              key={p.id}
              className={`campaign-card reveal r${(i % 4) + 1}`}
            >
              {p.image ? (
                <div className="campaign-card-photo">
                  {/* The campaign photo is a panel URL whose host is not
                      known at build time; next/image would need a wildcard
                      remotePattern to load it. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.image} alt="" loading="lazy" />
                </div>
              ) : (
                <div className="campaign-card-photo empty" aria-hidden="true">
                  <span className="brand-mark" />
                </div>
              )}
              <div className="campaign-card-body">
                <span className="campaign-card-kind">{KIND_LABEL[p.kind]}</span>
                <h3 className="campaign-card-title">{p.title}</h3>
                <p className="campaign-card-text">{p.body}</p>
                {p.linkUrl ? (
                  <a
                    className="campaign-card-link"
                    href={p.linkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {p.linkLabel || "Ayrıntılar"}
                    <span aria-hidden="true"> ↗</span>
                  </a>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
