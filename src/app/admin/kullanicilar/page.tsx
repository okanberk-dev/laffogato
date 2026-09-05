import { Card, PageHeader } from "@/components/admin/forms";
import { requireRole } from "@/lib/admin/auth";
import { ROLE_LABELS } from "@/lib/admin/roles";
import { listAdminUsers, MIN_ADMIN_PASSWORD_LENGTH } from "@/lib/admin/users";

import { AdminUserRow, CreateAdminUserForm } from "./user-forms";

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
  await requireRole("adminUsers");
  const users = await listAdminUsers();

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
          users.map((u) => (
            <AdminUserRow
              key={u.email}
              minPasswordLength={MIN_ADMIN_PASSWORD_LENGTH}
              user={{
                email: u.email,
                name: u.name,
                role: u.role,
                isActive: u.isActive,
                updatedAt: u.updatedAt,
              }}
            />
          ))
        )}

        <Card>
          <p className="text-xs leading-relaxed text-[var(--admin-text-mute)]">
            Roller: {ROLE_LABELS.owner} her şeyi görür ve kullanıcı yönetir ·{" "}
            {ROLE_LABELS.manager} katalog, içerik ve siparişleri yönetir ·{" "}
            {ROLE_LABELS.staff} sipariş, stok ve kasayı görür ·{" "}
            {ROLE_LABELS.cashier} yalnız kasada damga düşer. Son aktif sahip
            hesabı kapatılamaz; ortam değişkenindeki hesaplar bu listede
            görünmez ve acil giriş için durur.
          </p>
        </Card>
      </div>
    </main>
  );
}
