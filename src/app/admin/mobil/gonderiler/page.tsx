import { PageHeader } from "@/components/admin/forms";
import {
  ActionMenu,
  ActionMenuLink,
  ActionMenuSeparator,
  Badge,
  BUTTON,
  ConfirmButton,
  DataTable,
  EmptyState,
  PageShell,
  StatusTabs,
} from "@/components/admin/ui";
import Link from "@/components/link";
import { appPublishStatus } from "@/lib/admin/app-content-schema";
import { requireRole } from "@/lib/admin/auth";
import { canAccess } from "@/lib/admin/roles";
import {
  APP_POST_KIND_LABELS,
  listAppPosts,
  type AdminAppPost,
} from "@/lib/admin/store";
import type { AdminTone } from "@/lib/admin/tone";
import {
  CAMPAIGN_STATUS_LABELS,
  getCampaignEmail,
  type CampaignEmail,
} from "@/lib/email/campaigns";

import {
  DELETE_TEXT,
  OrderCell,
  parsePublishFilter,
  PublishCell,
  PublishToggle,
  PUBLISH_STATUS_PARAM,
  publishTabs,
} from "../app-content-list";
import {
  deletePostAction,
  movePostAction,
  setPostActiveAction,
} from "./actions";

export const metadata = { title: "Admin · Uygulama Gönderileri" };
export const dynamic = "force-dynamic";

const PANEL = "/admin/mobil/gonderiler";

/**
 * The campaigns the posts were mailed with, by id. Only the marked posts
 * are looked up (a handful); a list with none reads nothing.
 */
async function campaignsFor(
  posts: readonly AdminAppPost[],
): Promise<Map<string, CampaignEmail | null>> {
  const ids = [
    ...new Set(posts.map((p) => p.emailCampaignId ?? "").filter(Boolean)),
  ];
  const found = await Promise.all(ids.map((id) => getCampaignEmail(id)));
  return new Map(ids.map((id, i) => [id, found[i]]));
}

/**
 * The post's mail as its campaign says it is. The list used to print
 * "e-posta gönderildi" for any marked post, also when the queue refused the
 * draft or the audience was empty; the mark stays (it is what keeps a later
 * save from mailing again), the words come from the campaign.
 */
function mailState(campaign: CampaignEmail | null | undefined): {
  label: string;
  tone: AdminTone;
} {
  if (!campaign) return { label: "Kampanya kaydı yok", tone: "neutral" };
  switch (campaign.status) {
    case "draft":
      return { label: "Taslak, gönderilmedi", tone: "warning" };
    case "queued":
    case "sending":
      return {
        label: `${CAMPAIGN_STATUS_LABELS[campaign.status]} · ${campaign.total} alıcı`,
        tone: "info",
      };
    case "sent":
      return campaign.total > 0
        ? { label: `Gönderildi · ${campaign.total} alıcı`, tone: "success" }
        : { label: "Gönderildi · 0 alıcı", tone: "warning" };
    case "failed":
      return { label: "Gönderilemedi", tone: "danger" };
    default:
      return {
        label: CAMPAIGN_STATUS_LABELS[campaign.status] ?? campaign.status,
        tone: "neutral",
      };
  }
}

export default async function AdminAppPostsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireRole("mobileApp");
  const [all, sp] = await Promise.all([
    listAppPosts(),
    searchParams ?? Promise.resolve({}),
  ]);
  const campaigns = await campaignsFor(all);
  // The campaign page is the newsletter section's: link only where it opens.
  const linkCampaigns = Boolean(
    session.role && canAccess("newsletter", session.role),
  );
  // One reading of the clock for the whole list, tabs and badges alike.
  const now = new Date().getTime();
  const filter = parsePublishFilter(
    (sp as Record<string, unknown>)[PUBLISH_STATUS_PARAM],
  );
  const rows = filter
    ? all.filter((p) => appPublishStatus(p, now) === filter)
    : all;

  return (
    <PageShell width="list">
      <PageHeader
        title="Gönderiler"
        description="Ana sayfada yatay kayan kampanya, iş birliği ve etkinlik kartları."
        help={
          <p>
            Tarih aralığı verirsen gönderi süresi dolunca kendiliğinden düşer.
          </p>
        }
        primary={{ href: `${PANEL}/yeni`, label: "Yeni gönderi" }}
      />

      {all.length > 0 ? (
        <StatusTabs
          tabs={publishTabs(all, now, filter)}
          current={filter}
          searchParams={sp}
          pathname={PANEL}
          param={PUBLISH_STATUS_PARAM}
          label="Yayın durumu"
        />
      ) : null}

      <DataTable<AdminAppPost>
        caption="Uygulama gönderileri"
        rows={rows}
        rowKey={(p) => p.id}
        rowHref={(p) => `${PANEL}/${encodeURIComponent(p.id)}`}
        empty={
          all.length === 0 ? (
            <EmptyState
              title="Henüz gönderi yok."
              action={
                <Link href={`${PANEL}/yeni`} className={BUTTON.ghost}>
                  Yeni gönderi
                </Link>
              }
            />
          ) : (
            <EmptyState
              title="Bu durumda gönderi yok."
              action={
                <Link href={PANEL} className={BUTTON.ghost}>
                  Filtreyi temizle
                </Link>
              }
            />
          )
        }
        columns={[
          {
            key: "post",
            header: "Gönderi",
            cell: (p) => (
              <span className="block min-w-0 md:max-w-[13rem] xl:max-w-[22rem]">
                <span className="block truncate text-xs text-[var(--admin-text-soft)]">
                  {APP_POST_KIND_LABELS[p.kind]}
                </span>
                <span className="block truncate font-medium">{p.title}</span>
                <span className="block truncate text-xs text-[var(--admin-text-soft)]">
                  {p.image ? "Görselli" : "Marka zemini"}
                  {p.linkUrl ? " · bağlantılı" : ""}
                </span>
              </span>
            ),
          },
          {
            key: "status",
            header: "Durum",
            cell: (p) => <PublishCell row={p} now={now} />,
          },
          {
            key: "mail",
            header: "E-posta",
            cell: (p) => {
              if (!p.emailCampaignId) {
                return (
                  <span className="text-xs text-[var(--admin-text-soft)]">
                    Yok
                  </span>
                );
              }
              const state = mailState(campaigns.get(p.emailCampaignId));
              return (
                <span className="grid justify-items-start gap-1">
                  <Badge tone={state.tone}>{state.label}</Badge>
                  {linkCampaigns && campaigns.get(p.emailCampaignId) ? (
                    <Link
                      href={`/admin/bulten/kampanya/${encodeURIComponent(p.emailCampaignId)}`}
                      className="text-xs text-[var(--admin-primary)] underline-offset-4 hover:underline"
                    >
                      Kampanyayı aç
                    </Link>
                  ) : null}
                </span>
              );
            },
          },
          {
            key: "order",
            header: "Sıra",
            align: "right",
            cell: (p) => (
              <OrderCell
                action={movePostAction}
                row={p}
                all={all}
                filtered={filter !== null}
                label={p.title}
              />
            ),
          },
        ]}
        rowActions={(p) => (
          <ActionMenu label={`${p.title} işlemleri`}>
            <ActionMenuLink href={`${PANEL}/${encodeURIComponent(p.id)}`}>
              Düzenle
            </ActionMenuLink>
            <PublishToggle
              action={setPostActiveAction}
              id={p.id}
              isActive={p.isActive}
              label={p.title}
            />
            <ActionMenuSeparator />
            <ConfirmButton
              action={deletePostAction}
              hidden={{ id: p.id }}
              label="Sil"
              variant="menuDanger"
              ariaLabel={`Sil: ${p.title}`}
              title={`"${p.title}" silinsin mi?`}
              description={DELETE_TEXT.post}
            />
          </ActionMenu>
        )}
      />
    </PageShell>
  );
}
