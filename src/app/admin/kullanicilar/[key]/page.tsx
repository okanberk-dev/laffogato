import { BackLink } from "@/components/admin/back-link";
import { formatDateTime } from "@/components/admin/forms";
import {
  Badge,
  EmptyState,
  KeyValueGrid,
  Section,
  type KeyValueItem,
} from "@/components/admin/ui";
import { EYEBROW, MONO_STYLE } from "@/components/admin/ui/styles";
import {
  ADMIN_USERS_PATH,
  findAdminUserByKey,
} from "@/lib/admin/admin-users-list";
import { requireRole } from "@/lib/admin/auth";
import { roleSectionLabels } from "@/lib/admin/role-summary";
import { ROLE_LABELS } from "@/lib/admin/roles";
import { has2FA } from "@/lib/admin/twofa";
import {
  listAdminUsers,
  MIN_ADMIN_PASSWORD_LENGTH,
  normalizeAdminEmail,
} from "@/lib/admin/users";

import { AdminUserRow } from "../user-forms";

// No address in the title: the tab and the history keep it (D14).
export const metadata = { title: "Admin · Kullanıcı" };
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ key: string }>;
}

function when(iso: string): string {
  return iso ? formatDateTime(iso) : "";
}

/**
 * One panel account (Filament's view page, D37): who it is, what its role
 * opens, whether it has 2FA, and the account's own forms (name, role,
 * Aktif, password, 2FA reset, delete), which used to sit open on the list,
 * one card per account. Found by an opaque key, never the address.
 *
 * A key that matches nobody answers on the page rather than with a 404:
 * "Kullanıcıyı sil" here re-renders this page, and the operator should
 * land on a way back, not on the panel's not-found screen.
 */
export default async function AdminUserPage({ params }: PageProps) {
  const session = await requireRole("adminUsers");
  const { key } = await params;
  const user = findAdminUserByKey(await listAdminUsers(), key);

  if (!user) {
    return (
      <main className="w-full px-4 pt-5 pb-10 sm:px-5 [&>:not(header)]:max-w-4xl">
        <BackLink href={ADMIN_USERS_PATH}>Kullanıcılar</BackLink>
        <EmptyState
          title="Bu kullanıcı yok."
          description="Silinmiş olabilir. Listeden yeniden seç."
        />
      </main>
    );
  }

  const twoFA = await has2FA(user.email);
  const isSelf = user.email === normalizeAdminEmail(session.email);
  const role = ROLE_LABELS[user.role] ?? user.role;

  const details: KeyValueItem[] = [
    {
      label: "E-posta",
      value: <span className="break-all">{user.email}</span>,
    },
    { label: "Ad", value: user.name },
    { label: "Rol", value: role },
    {
      label: "Durum",
      value: user.isActive ? "Aktif" : "Pasif",
      hint: user.isActive
        ? "Panele girebilir."
        : "Panele giremez; açık oturumu bir sonraki istekte kapanır.",
    },
    {
      label: "2FA",
      value: twoFA ? "Açık" : "Kapalı",
      hint: twoFA
        ? "Girişte doğrulama uygulamasındaki kod istenir."
        : "Girişte yalnız parola istenir.",
    },
    { label: "Eklendi", value: when(user.createdAt) },
    { label: "Ekleyen", value: user.createdBy },
    { label: "Son güncelleme", value: when(user.updatedAt) },
  ];

  return (
    <main className="w-full px-4 pt-5 pb-10 sm:px-5 [&>:not(header)]:max-w-4xl">
      <BackLink href={ADMIN_USERS_PATH}>Kullanıcılar</BackLink>

      <header className="mb-6 flex flex-col gap-3">
        <div className={EYEBROW} style={MONO_STYLE}>
          Sistem · Kullanıcılar
        </div>
        <h1 className="text-2xl font-semibold tracking-tight break-all text-[var(--admin-text)] sm:text-3xl">
          {user.name || user.email}
        </h1>
        <p className="flex flex-wrap items-center gap-2">
          <Badge tone="primary">{role}</Badge>
          <Badge tone={user.isActive ? "success" : "neutral"} dot>
            {user.isActive ? "Aktif" : "Pasif"}
          </Badge>
          <Badge tone={twoFA ? "success" : "neutral"}>
            {twoFA ? "2FA açık" : "2FA kapalı"}
          </Badge>
          {isSelf ? <Badge tone="info">Sen</Badge> : null}
        </p>
      </header>

      <div className="grid gap-6">
        <Section title="Hesap">
          <KeyValueGrid items={details} />
        </Section>

        <Section
          title="Bu rol neyi açar"
          description="Sunucunun her sayfada ve işlemde okuduğu yetki tablosundan."
        >
          <p className="text-sm leading-relaxed text-[var(--admin-text)]">
            {roleSectionLabels(user.role).join(", ")}
          </p>
        </Section>

        <div className="grid gap-3">
          <h2 className="text-base font-semibold text-[var(--admin-text)]">
            Hesabı yönet
          </h2>
          <AdminUserRow
            minPasswordLength={MIN_ADMIN_PASSWORD_LENGTH}
            user={{
              email: user.email,
              name: user.name,
              role: user.role,
              isActive: user.isActive,
              updatedAt: user.updatedAt,
              has2FA: twoFA,
              isSelf,
            }}
          />
        </div>
      </div>
    </main>
  );
}
