import { Card, PageHeader, formatDateTime } from "@/components/admin/forms";
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
import { requireRole } from "@/lib/admin/auth";
import { roleSectionLabels } from "@/lib/admin/role-summary";
import { ADMIN_ROLES, ROLE_LABELS } from "@/lib/admin/roles";
import { listStaffMembers } from "@/lib/admin/staff-members";
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

type ListedUser = PublicAdminUser & { has2FA: boolean };

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
  // out. A handful of accounts: one small read each, all at once.
  const twoFA = await Promise.all(users.map((u) => has2FA(u.email)));
  const listed: ListedUser[] = users.map((u, i) => ({
    ...u,
    has2FA: twoFA[i],
  }));
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
                  header: "Rol",
                  cell: (u) => ROLE_LABELS[u.role] ?? u.role,
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
                  key: "guncelleme",
                  header: "Son güncelleme",
                  hideBelow: "xl",
                  cell: (u) => (
                    <span className="text-xs whitespace-nowrap text-[var(--admin-text-soft)]">
                      {u.updatedAt ? formatDateTime(u.updatedAt) : "-"}
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
                  </span>
                  <UserBadges user={u} />
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

        <Card>
          {/* From the matrix the server gates read (roles.ts), not a
              sentence of its own: the old one hid refunds, member deletion
              and mass e-mail behind "Yönetici". */}
          <h2 className="mb-3 text-base font-semibold">Roller neyi açar</h2>
          <dl className="grid gap-3 text-sm">
            {ADMIN_ROLES.map((role) => (
              <div key={role} className="grid gap-0.5">
                <dt className="font-medium text-[var(--admin-text)]">
                  {ROLE_LABELS[role]}
                </dt>
                <dd className="text-xs leading-relaxed text-[var(--admin-text-soft)]">
                  {roleSectionLabels(role).join(", ")}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs leading-relaxed text-[var(--admin-text-mute)]">
            Son aktif sahip hesabı kapatılamaz; ortam değişkenindeki hesaplar bu
            listede görünmez ve acil giriş için durur.
          </p>
        </Card>

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
