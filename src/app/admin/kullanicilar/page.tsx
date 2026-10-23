import { Card, PageHeader, formatDateTime } from "@/components/admin/forms";
import { CARD, CARD_TITLE } from "@/components/admin/ui/styles";
import {
  Badge,
  CardLink,
  DataTable,
  EmptyState,
  PageShell,
  StatusTabs,
} from "@/components/admin/ui";
import {
  ADMIN_USER_TAB_PARAM,
  ADMIN_USER_TABS,
  ADMIN_USERS_PATH,
  adminUserHref,
  adminUsersList,
  parseAdminUserTab,
} from "@/lib/admin/admin-users-list";
import { lastActivity } from "@/lib/admin/activity";
import { isActiveNow } from "@/lib/admin/activity-core";
import { lastSignIns } from "@/lib/admin/audit";
import { requireRole } from "@/lib/admin/auth";
import {
  roleMatrix,
  roleSectionLabels,
  sectionShortLabel,
} from "@/lib/admin/role-summary";
import {
  ADMIN_ROLES,
  ROLE_LABELS,
  sectionsFor,
  type AdminRole,
} from "@/lib/admin/roles";
import { listStaffMembers } from "@/lib/admin/staff-members";
import { timeAgo } from "@/lib/admin/time-ago";
import { has2FA } from "@/lib/admin/twofa";
import {
  listAdminUsers,
  MIN_ADMIN_PASSWORD_LENGTH,
  type PublicAdminUser,
} from "@/lib/admin/users";

import {
  BaristaRow,
  CreateAdminUserForm,
  GrantBaristaForm,
} from "./user-forms";

export const metadata = { title: "Admin · Kullanıcılar" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

type ListedUser = PublicAdminUser & {
  has2FA: boolean;
  /** The last sign-in on record, ISO; "" for none; null: log unread. */
  lastSignIn: string | null;
  /** The last answered request, ISO; "" for none; null: record unread. */
  lastSeen: string | null;
};

/**
 * Innex's "Şu an aktif / 3 saat önce" (recipe §3.9): a request answered in
 * the last five minutes reads "Şu an aktif", an older one says when, the
 * exact time on hover; the sign-in under it. An address seen before the
 * record existed (23 Eki 2026) has its sign-in only. "Hiç girmedi" only
 * when both were read and both are empty: an unread log is not a never
 * (it read so for every account, and the owner may remove the "unused").
 */
function Activity({ user, now }: { user: ListedUser; now: Date }) {
  const seen = user.lastSeen;
  const signIn = user.lastSignIn ? (
    <time dateTime={user.lastSignIn} title={formatDateTime(user.lastSignIn)}>
      {timeAgo(user.lastSignIn, now)}
    </time>
  ) : null;
  if (!seen && !signIn) {
    return seen === "" && user.lastSignIn === "" ? (
      <span className="text-[var(--admin-text-mute)]">Hiç girmedi</span>
    ) : (
      <span className="text-[var(--admin-text-mute)]" title="Kayıt okunamadı">
        -<span className="sr-only">Kayıt okunamadı</span>
      </span>
    );
  }
  return (
    <span className="flex flex-col gap-0.5">
      {seen && isActiveNow(seen, now) ? (
        <span className="inline-flex items-center gap-1.5 font-medium text-[var(--admin-success)]">
          <span
            aria-hidden
            className="size-2 shrink-0 rounded-full bg-[var(--admin-success)]"
          />
          <time dateTime={seen} title={formatDateTime(seen)}>
            Şu an aktif
          </time>
        </span>
      ) : seen ? (
        <time dateTime={seen} title={formatDateTime(seen)}>
          {timeAgo(seen, now)}
        </time>
      ) : null}
      {signIn ? (
        <span className="text-[var(--admin-text-mute)]">Giriş: {signIn}</span>
      ) : null}
    </span>
  );
}

/**
 * A read the page can do without: an unreadable log or activity record is
 * null (its column says so, never "Hiç girmedi"). The page is how the
 * owner fixes access; it must not fall over with either.
 */
async function readOrNull(
  read: () => Promise<Map<string, string>>,
  what: string,
): Promise<Map<string, string> | null> {
  try {
    return await read();
  } catch (err) {
    console.error(`[admin/kullanicilar] ${what} okunamadı`, err);
    return null;
  }
}

/** How many of a role's sections its row names before "+n". */
const ROLE_CHIPS = 3;

/**
 * What a role opens, in its row (Innex's permission chips): the owner's
 * "Tüm bölümler", else its first sections and "+n" for the rest, the whole
 * list in the title.
 */
function RoleChips({ role }: { role: AdminRole }) {
  const all = roleSectionLabels(role);
  const sections = sectionsFor(role).filter((s) => sectionShortLabel(s));
  const chip =
    "inline-flex items-center rounded-full border border-[var(--admin-border-strong)] px-2 py-px text-[11px] leading-4 font-medium whitespace-nowrap text-[var(--admin-text-soft)]";
  if (role === "owner") {
    return (
      <span className="mt-1 flex flex-wrap gap-1" title={all.join(", ")}>
        <span className={chip}>Tüm bölümler</span>
      </span>
    );
  }
  const shown = sections.slice(0, ROLE_CHIPS);
  const rest = sections.length - shown.length;
  return (
    <span className="mt-1 flex flex-wrap gap-1" title={all.join(", ")}>
      {shown.map((s) => (
        <span key={s} className={chip}>
          {sectionShortLabel(s)}
        </span>
      ))}
      {rest > 0 ? <span className={chip}>+{rest}</span> : null}
    </span>
  );
}

function UserBadges({ user }: { user: ListedUser }) {
  return (
    <span className="flex flex-wrap items-center gap-2">
      <Badge tone={user.isActive ? "success" : "neutral"} dot>
        {user.isActive ? "Aktif" : "Pasif"}
      </Badge>
      <Badge tone={user.has2FA ? "success" : "neutral"}>
        {user.has2FA ? "2FA açık" : "2FA kapalı"}
      </Badge>
    </span>
  );
}

/**
 * Panel access, managed from the panel.
 *
 * The accounts listed here live in the database. The ones in the ADMIN_USERS
 * environment variable are NOT listed and cannot be edited from here on
 * purpose: they are the break-glass path back in when this page is what went
 * wrong.
 *
 * A table with tabs and a page per account (admin audit P2b, D37): the
 * page used to be one full edit card per account, so the owner scrolled
 * past every password box to see who had which role.
 */
export default async function AdminUsersPage({ searchParams }: PageProps) {
  await requireRole("adminUsers");
  const sp = (await searchParams) ?? {};
  const [users, baristas] = await Promise.all([
    listAdminUsers(),
    listStaffMembers(),
  ]);
  // Who has an authenticator, so the owner can see who a lost phone locks
  // out, who is in the panel now and who has not signed in for a while
  // (Innex: activity in the row). A handful of accounts, all at once.
  const emails = users.map((u) => u.email);
  const [twoFA, signIns, seen] = await Promise.all([
    Promise.all(users.map((u) => has2FA(u.email))),
    readOrNull(() => lastSignIns(emails), "son girişler"),
    readOrNull(() => lastActivity(emails), "son etkinlikler"),
  ]);
  const listed: ListedUser[] = users.map((u, i) => ({
    ...u,
    has2FA: twoFA[i],
    lastSignIn: signIns ? (signIns.get(u.email) ?? "") : null,
    lastSeen: seen ? (seen.get(u.email.toLowerCase()) ?? "") : null,
  }));
  const now = new Date();
  const tab = parseAdminUserTab(sp);
  const list = adminUsersList(listed, tab);
  const tabValue = ADMIN_USER_TABS.find((t) => t.tab === tab)?.value ?? null;

  return (
    <PageShell width="detail">
      <PageHeader
        title="Kullanıcılar"
        description="Panele kimin gireceği ve neyi göreceği."
        help={
          <p>
            Kasiyer rolü yalnız Kasa sayfasını açar. Roller neyi açar listesi
            aşağıda.
          </p>
        }
        primary={{ href: "#yeni-kullanici", label: "Yeni kullanıcı" }}
      />

      <div className="grid gap-4">
        {users.length === 0 ? (
          // No "Yeni kullanıcı" of its own: the header's goes to the form,
          // which is right below (three of the same button on a phone).
          <EmptyState
            title="Henüz panelden eklenmiş kullanıcı yok."
            description="Şu an yalnız ortam değişkenindeki hesaplar girebiliyor. İlkini aşağıdaki formla ekle."
          />
        ) : (
          // min-w-0: the grid's track otherwise grows to the table's width
          // and pushes every card on the page past the right margin.
          <div className="min-w-0">
            <StatusTabs
              tabs={ADMIN_USER_TABS.map((t) => ({
                value: t.value,
                label: t.label,
                count: list.counts[t.tab],
              }))}
              current={tabValue}
              searchParams={sp}
              pathname={ADMIN_USERS_PATH}
              param={ADMIN_USER_TAB_PARAM}
              label="Kullanıcı sekmeleri"
            />
            <DataTable<ListedUser>
              caption="Panel kullanıcıları"
              rows={list.rows}
              rowKey={(u) => u.email}
              rowHref={(u) => adminUserHref(u.email)}
              rowClassName={(u) => !u.isActive && "opacity-70"}
              empty={<EmptyState title="Bu sekmede kullanıcı yok." />}
              columns={[
                {
                  key: "kullanici",
                  header: "Kullanıcı",
                  className: "min-w-[12rem] max-w-[20rem]",
                  cell: (u) => (
                    <span className="block min-w-0 [overflow-wrap:anywhere]">
                      {u.name || u.email}
                      {u.name ? (
                        <span className="block text-xs font-normal text-[var(--admin-text-soft)]">
                          {u.email}
                        </span>
                      ) : null}
                    </span>
                  ),
                },
                {
                  key: "rol",
                  header: "Rol ve erişim",
                  cell: (u) => (
                    <span className="block min-w-0">
                      <span className="font-medium">
                        {ROLE_LABELS[u.role] ?? u.role}
                      </span>
                      <RoleChips role={u.role} />
                    </span>
                  ),
                },
                {
                  key: "durum",
                  header: "Durum",
                  cell: (u) => (
                    <Badge tone={u.isActive ? "success" : "neutral"} dot>
                      {u.isActive ? "Aktif" : "Pasif"}
                    </Badge>
                  ),
                },
                {
                  key: "2fa",
                  header: "2FA",
                  cell: (u) => (
                    <Badge tone={u.has2FA ? "success" : "neutral"}>
                      {u.has2FA ? "Açık" : "Kapalı"}
                    </Badge>
                  ),
                },
                {
                  key: "etkinlik",
                  header: "Son etkinlik",
                  cell: (u) => (
                    <span className="block text-xs whitespace-nowrap text-[var(--admin-text-soft)]">
                      <Activity user={u} now={now} />
                    </span>
                  ),
                },
              ]}
              mobileCard={(u) => (
                <div className="flex min-w-0 flex-col gap-1.5">
                  <CardLink
                    href={adminUserHref(u.email)}
                    className="font-medium break-all text-[var(--admin-text)] underline-offset-4 hover:text-[var(--admin-primary)] hover:underline"
                  >
                    {u.name || u.email}
                  </CardLink>
                  {u.name ? (
                    <span className="text-xs break-all text-[var(--admin-text-soft)]">
                      {u.email}
                    </span>
                  ) : null}
                  <span className="text-sm text-[var(--admin-text-soft)]">
                    {ROLE_LABELS[u.role] ?? u.role}
                    <RoleChips role={u.role} />
                  </span>
                  <UserBadges user={u} />
                  <span className="text-xs text-[var(--admin-text-soft)]">
                    <Activity user={u} now={now} />
                  </span>
                </div>
              )}
            />
          </div>
        )}

        <section
          id="yeni-kullanici"
          aria-labelledby="yeni-kullanici-baslik"
          className="grid scroll-mt-20 gap-3"
        >
          <h2
            id="yeni-kullanici-baslik"
            className="text-base font-semibold text-[var(--admin-text)]"
          >
            Yeni kullanıcı
          </h2>
          <CreateAdminUserForm minPasswordLength={MIN_ADMIN_PASSWORD_LENGTH} />
        </section>

        <section
          aria-label="Roller neyi açar"
          className={`${CARD} min-w-0 overflow-hidden`}
        >
          {/* From the matrix the server gates read (roles.ts), not a
              sentence of its own: the old one hid refunds, member deletion
              and mass e-mail behind "Yönetici". Innex shows the permissions
              instead of describing them: one row per section, a tick per
              role that opens it. */}
          <div className="border-b border-[var(--admin-border)] px-4 py-3 sm:px-5">
            <h2 className={CARD_TITLE}>Roller neyi açar</h2>
            <p className="mt-0.5 text-[13px] text-[var(--admin-text-mute)]">
              Son aktif sahip hesabı kapatılamaz; ortam değişkenindeki hesaplar
              bu listede görünmez ve acil giriş için durur.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">
                Roller neyi açar: bölümler ve onları açan roller
              </caption>
              <thead>
                <tr className="bg-[var(--admin-surface-2)] text-left text-[13px] font-medium text-[var(--admin-text-mute)]">
                  <th scope="col" className="px-4 py-2.5 sm:px-5">
                    Bölüm
                  </th>
                  {ADMIN_ROLES.map((role) => (
                    <th
                      key={role}
                      scope="col"
                      className="px-3 py-2.5 text-center whitespace-nowrap"
                    >
                      {ROLE_LABELS[role]}
                      <span className="block text-[11px] font-normal">
                        {roleSectionLabels(role).length} bölüm
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {roleMatrix().map((row) => (
                  <tr
                    key={row.section}
                    className="border-t border-[var(--admin-divider)]"
                  >
                    <th
                      scope="row"
                      className="px-4 py-2 text-left font-normal text-[var(--admin-text)] sm:px-5"
                    >
                      {row.label}
                    </th>
                    {ADMIN_ROLES.map((role) => (
                      <td key={role} className="px-3 py-2 text-center">
                        {row.roles[role] ? (
                          <span className="inline-flex size-5 items-center justify-center rounded-full bg-[var(--admin-success-soft)] text-[var(--admin-success)]">
                            <svg
                              aria-hidden="true"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={2.5}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="size-3"
                            >
                              <path d="M5 12.5 10 17 19 7" />
                            </svg>
                            <span className="sr-only">açar</span>
                          </span>
                        ) : (
                          <span className="text-[var(--admin-text-mute)]">
                            <span aria-hidden="true">-</span>
                            <span className="sr-only">açmaz</span>
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <Card>
          <div className="grid gap-4">
            <div className="grid gap-1">
              <h2 className="text-base font-semibold">
                Uygulamadan kasa (barista)
              </h2>
              <p className="text-xs leading-relaxed text-[var(--admin-text-mute)]">
                Barista panele girmez: kendi üye hesabıyla açtığı uygulamadan
                üyenin QR&apos;ını okutur ve damga verir. Kasadakiyle aynı
                kurallar geçerli: kod 2 dakika yaşar, bir kod bir kez damga
                verir, barista kendi koduna damga veremez. Yetki kaldırıldığında
                bir sonraki okutma reddedilir.
              </p>
            </div>
            <GrantBaristaForm />
            {baristas.length === 0 ? (
              <p className="text-sm text-[var(--admin-text-mute)]">
                Henüz uygulamadan kasa yetkisi verilmiş üye yok.
              </p>
            ) : (
              baristas.map((b) => (
                <BaristaRow
                  key={b.email}
                  barista={{
                    email: b.email,
                    name: b.name,
                    isActive: b.isActive,
                    grantedBy: b.grantedBy,
                    grantedAt: b.grantedAt,
                    updatedAt: b.updatedAt,
                  }}
                />
              ))
            )}
          </div>
        </Card>
      </div>
    </PageShell>
  );
}
