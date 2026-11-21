import Link from "@/components/link";

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
 * `/kampanyalar`. The house programmes (stamps, invites) as the reference's
 * ruled feature rows, then whatever the panel is running as a card grid.
 * Everything is operator-controlled: the programmes answer to
 * `campaignCards` switches and the cards are `/app-content` posts, the same
 * two sources the app's Kampanyalar screen reads.
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
  const programmes = [
    cards.loyalty
      ? {
          key: "loyalty",
          label: "Ödül programı",
          title: `${stampTarget} damgada 1 ${rewardTitle.toLocaleLowerCase("tr-TR")}`,
          body: "Uygulamadan verdiğin 140 TL ve üzeri kafe siparişi damga kazandırır: 320 TL'ye kadar bir, 640 TL'ye kadar iki damga. Kart dolduğunda ödülün kuponlarına düşer.",
          href: "/uye/hesap",
          cta: "Kartımı gör",
        }
      : null,
    cards.invite
      ? {
          key: "invite",
          label: "Davet",
          title: "Arkadaşını çağır, ikiniz de kazanın",
          body: "Davet kodunu paylaş; arkadaşın ilk siparişini verdiğinde ikinizin de hesabına ödül düşer.",
          href: "/uye/hesap/promosyonlar",
          cta: "Davet kodum",
        }
      : null,
  ].filter((p): p is NonNullable<typeof p> => p !== null);

  return (
    <>
      <PageHero
        title="Kampanyalar ve etkinlikler"
        lede="Sezon kampanyaları, iş birlikleri ve köşkte olan biten. Damga programı ve davet ödülü de burada: ikisi de uygulamada ve web'de aynı hesaba işler."
        image={{ src: "/rehber/tiramisu-tarifi.webp" }}
      />

      {programmes.length > 0 && (
        <section className="section section--band" aria-label="Programlar">
          <div className="wrap programme-row">
            {programmes.map((p) => (
              <article key={p.key} className="programme">
                <p className="t-label">{p.label}</p>
                <h2 className="t-display">{p.title}</h2>
                <p className="t-body">{p.body}</p>
                <a className="btn btn-wide" href={p.href}>
                  {p.cta}
                </a>
              </article>
            ))}
          </div>
        </section>
      )}

      {campaigns.length > 0 && (
        <CardGrid title="Şu an geçerli" posts={campaigns} />
      )}
      {others.length > 0 && (
        <CardGrid title="İş birlikleri ve etkinlikler" posts={others} />
      )}

      {posts.length === 0 && programmes.length === 0 && (
        <section className="section">
          <div className="wrap">
            <p className="t-body">
              Şu an yayında bir kampanya yok. Yeni sezon menüsü için menüye göz
              atabilirsin.
            </p>
            <Link className="btn btn-wide campaign-empty-cta" href="/menu">
              Menüyü gör
            </Link>
          </div>
        </section>
      )}
    </>
  );
}

function CardGrid({ title, posts }: { title: string; posts: CampaignPost[] }) {
  return (
    <section className="section">
      <div className="wrap">
        <div className="section-head">
          <h2 className="t-display">{title}</h2>
        </div>
        <ul className="post-grid" role="list">
          {posts.map((p) => (
            <li key={p.id} className="post-card">
              <div className="media ratio-4-3">
                {p.image ? (
                  // A panel URL whose host is not known at build time.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image} alt="" loading="lazy" />
                ) : (
                  <span className="media-empty" aria-hidden="true" />
                )}
                <span className="badge">{KIND_LABEL[p.kind]}</span>
              </div>
              <h3 className="t-title">{p.title}</h3>
              <p className="t-small">{p.body}</p>
              {p.linkUrl ? (
                <a
                  className="link-u"
                  href={p.linkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {p.linkLabel || "Ayrıntılar"}
                  <span className="sr-only"> (yeni sekme)</span>
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
