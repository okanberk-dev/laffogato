import { Card, PageHeader } from "@/components/admin/forms";
import { requireRole } from "@/lib/admin/auth";
import { roleSectionLabels } from "@/lib/admin/role-summary";
import { ADMIN_ROLES, ROLE_LABELS } from "@/lib/admin/roles";
import { listStaffMembers } from "@/lib/admin/staff-members";
import { has2FA } from "@/lib/admin/twofa";
import {
  listAdminUsers,
  MIN_ADMIN_PASSWORD_LENGTH,
  normalizeAdminEmail,
} from "@/lib/admin/users";

import {
  AdminUserRow,
  BaristaRow,
  CreateAdminUserForm,
  GrantBaristaForm,
} from "./user-forms";

export const metadata = { title: "Admin · Kullanıcılar" };
export const dynamic = "force-dynamic";

/**
 * Panel access, managed from the panel.
 *
 * The accounts listed here live in the database. The ones in the ADMIN_USERS
 * environment variable are NOT listed and cannot be edited from here on
 * purpose: they are the break-glass path back in when this page is what went
 * wrong.
 */
export default async function AdminUsersPage() {
  const session = await requireRole("adminUsers");
  const [users, baristas] = await Promise.all([
    listAdminUsers(),
    listStaffMembers(),
  ]);
  // Who has an authenticator, so the owner can see who a lost phone locks
  // out. A handful of accounts: one small read each.
  const twoFA = await Promise.all(users.map((u) => has2FA(u.email)));
  const me = normalizeAdminEmail(session.email);

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Sistem"
        title="Kullanıcılar"
        description="Panele kimin gireceği ve neyi göreceği. Kasiyer rolü yalnız Kasa · damga sayfasını açar."
      />

      <div className="grid gap-4">
        <CreateAdminUserForm minPasswordLength={MIN_ADMIN_PASSWORD_LENGTH} />

        {users.length === 0 ? (
          <Card>
            <p className="text-sm text-[var(--admin-text-mute)]">
              Henüz panelden eklenmiş kullanıcı yok. Şu an yalnız ortam
              değişkenindeki hesaplar girebiliyor.
            </p>
          </Card>
        ) : (
          users.map((u, i) => (
            <AdminUserRow
              key={u.email}
              minPasswordLength={MIN_ADMIN_PASSWORD_LENGTH}
              user={{
                email: u.email,
                name: u.name,
                role: u.role,
                isActive: u.isActive,
                updatedAt: u.updatedAt,
                has2FA: twoFA[i],
                isSelf: u.email === me,
              }}
            />
          ))
        )}

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
                  {roleSectionLabels(role).join(" · ")}
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
    </main>
  );
}
