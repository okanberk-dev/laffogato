import { Card, PageHeader } from "@/components/admin/forms";
import { requireRole } from "@/lib/admin/auth";
import { ROLE_LABELS } from "@/lib/admin/roles";
import { listStaffMembers } from "@/lib/admin/staff-members";
import { listAdminUsers, MIN_ADMIN_PASSWORD_LENGTH } from "@/lib/admin/users";

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
  await requireRole("adminUsers");
  const [users, baristas] = await Promise.all([
    listAdminUsers(),
    listStaffMembers(),
  ]);

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
