"use client";

import { useActionState } from "react";

import {
  Card,
  Checkbox,
  Field,
  GhostButton,
  PrimaryButton,
  Select,
  TextInput,
  formatDateTime,
} from "@/components/admin/forms";
import { ConfirmButton } from "@/components/admin/ui";
import { ADMIN_ROLES, ROLE_LABELS } from "@/lib/admin/roles";

import {
  createAdminUserAction,
  deleteAdminUserAction,
  grantBaristaAction,
  resetAdminPasswordAction,
  revokeBaristaAction,
  saveAdminUserAction,
  type AdminUserState,
} from "./actions";

const initialState: AdminUserState = {};

/**
 * The minimum comes from the server module that enforces it
 * (src/lib/admin/users.ts), handed down as a prop: that module is
 * `server-only`, so a client component cannot import it, and a second literal
 * here would be a policy number that can drift out of agreement with the one
 * that actually rejects the password.
 */
interface PasswordPolicy {
  minPasswordLength: number;
}

function Notice({ state }: { state: AdminUserState }) {
  if (state.error) {
    return (
      <p
        role="alert"
        className="rounded-lg border border-[var(--admin-danger)]/35 bg-[var(--admin-danger)]/8 px-3 py-2 text-xs text-[var(--admin-danger)]"
      >
        {state.error}
      </p>
    );
  }
  if (state.message) {
    return (
      <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
        {state.message}
      </p>
    );
  }
  return null;
}

function RoleSelect({ defaultValue }: { defaultValue: string }) {
  return (
    <Select name="role" defaultValue={defaultValue}>
      {ADMIN_ROLES.map((role) => (
        <option key={role} value={role}>
          {ROLE_LABELS[role]}
        </option>
      ))}
    </Select>
  );
}

export function CreateAdminUserForm({ minPasswordLength }: PasswordPolicy) {
  const [state, formAction, pending] = useActionState(
    createAdminUserAction,
    initialState,
  );

  return (
    <Card>
      <form action={formAction} className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="E-posta">
            <TextInput
              type="email"
              name="email"
              required
              autoComplete="off"
              placeholder="kasiyer@laffogato.net"
            />
          </Field>
          <Field label="Ad">
            <TextInput name="name" required minLength={2} placeholder="Eda" />
          </Field>
          <Field
            label="Rol"
            hint="Kasiyer yalnız Kasa · damga sayfasını görür."
          >
            <RoleSelect defaultValue="cashier" />
          </Field>
          <Field
            label="Parola"
            hint={`En az ${minPasswordLength} karakter. Kullanıcıya elden ver; burada bir daha görünmez.`}
          >
            <TextInput
              type="password"
              name="password"
              required
              minLength={minPasswordLength}
              autoComplete="new-password"
            />
          </Field>
        </div>
        <Notice state={state} />
        <div>
          <PrimaryButton type="submit" disabled={pending}>
            {pending ? "Ekleniyor…" : "Kullanıcı ekle"}
          </PrimaryButton>
        </div>
      </form>
    </Card>
  );
}

export interface AdminUserRowProps {
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  updatedAt: string;
}

export function AdminUserRow({
  user,
  minPasswordLength,
}: { user: AdminUserRowProps } & PasswordPolicy) {
  const [saveState, saveAction, saving] = useActionState(
    saveAdminUserAction,
    initialState,
  );
  const [passwordState, passwordAction, resetting] = useActionState(
    resetAdminPasswordAction,
    initialState,
  );

  return (
    <Card>
      <div className="grid gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p
            className="text-sm font-medium break-all"
            style={{ fontFamily: "var(--mono), monospace" }}
          >
            {user.email}
          </p>
          <p className="text-xs text-[var(--admin-text-mute)]">
            {user.updatedAt
              ? `Son güncelleme: ${formatDateTime(user.updatedAt)}`
              : "Hiç güncellenmedi"}
          </p>
        </div>

        <form action={saveAction} className="grid gap-3 sm:grid-cols-3">
          <input type="hidden" name="email" value={user.email} />
          <Field label="Ad">
            <TextInput name="name" defaultValue={user.name} minLength={2} />
          </Field>
          <Field label="Rol">
            <RoleSelect defaultValue={user.role} />
          </Field>
          <div className="flex items-end justify-between gap-3">
            <Checkbox
              name="isActive"
              label="Aktif"
              defaultChecked={user.isActive}
            />
            <PrimaryButton type="submit" disabled={saving}>
              {saving ? "Kaydediliyor…" : "Kaydet"}
            </PrimaryButton>
          </div>
          <div className="sm:col-span-3">
            <Notice state={saveState} />
          </div>
        </form>

        <div className="grid gap-3 border-t border-[var(--admin-border)] pt-4 sm:grid-cols-2">
          <form action={passwordAction} className="grid gap-3">
            <input type="hidden" name="email" value={user.email} />
            <Field label="Yeni parola">
              <TextInput
                type="password"
                name="password"
                minLength={minPasswordLength}
                autoComplete="new-password"
                placeholder="••••••••••"
              />
            </Field>
            <div>
              <GhostButton type="submit" disabled={resetting}>
                {resetting ? "Değiştiriliyor…" : "Parolayı sıfırla"}
              </GhostButton>
            </div>
            <Notice state={passwordState} />
          </form>

          {/* Asks first: the account and its sign-in go at once. The last
              owner is refused on the server (lib/admin/users.ts). */}
          <div className="grid content-end gap-3">
            <div>
              <ConfirmButton
                action={deleteAdminUserAction}
                hidden={{ email: user.email }}
                label="Kullanıcıyı sil"
                title={`${user.email} silinsin mi?`}
                description="Panel hesabı kalıcı olarak silinir, oturumu hemen kapanır. Yalnız erişimi durdurmak istiyorsan Aktif kutusunu kaldırıp kaydet."
                confirmLabel="Sil"
              />
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ─── Uygulamadan kasa (barista) ─────────────────────────────────────────

export interface BaristaRowProps {
  email: string;
  name: string;
  isActive: boolean;
  grantedBy: string;
  grantedAt: string;
  updatedAt: string;
}

/**
 * Grants the till to an APP member account. The address must already be a
 * member: the server refuses anything else rather than leave a grant waiting
 * for whoever signs up with it first.
 */
export function GrantBaristaForm() {
  const [state, formAction, pending] = useActionState(
    grantBaristaAction,
    initialState,
  );

  return (
    <form action={formAction} className="grid gap-3">
      <Field
        label="Üye e-postası"
        hint="Baristanın uygulamaya giriş yaptığı adres. Hesap önceden açılmış olmalı."
      >
        <TextInput
          type="email"
          name="email"
          required
          autoComplete="off"
          placeholder="barista@ornek.com"
        />
      </Field>
      <Notice state={state} />
      <div>
        <PrimaryButton type="submit" disabled={pending}>
          {pending ? "Veriliyor…" : "Kasa yetkisi ver"}
        </PrimaryButton>
      </div>
    </form>
  );
}

export function BaristaRow({ barista }: { barista: BaristaRowProps }) {
  return (
    <div className="grid gap-2 border-t border-[var(--admin-border)] pt-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p
          className="text-sm font-medium break-all"
          style={{ fontFamily: "var(--mono), monospace" }}
        >
          {barista.email}
          {barista.name ? (
            <span className="ml-2 font-sans text-xs text-[var(--admin-text-mute)]">
              {barista.name}
            </span>
          ) : null}
        </p>
        <p className="text-xs text-[var(--admin-text-mute)]">
          {barista.isActive
            ? `Veren: ${barista.grantedBy || "-"} · ${
                barista.grantedAt ? formatDateTime(barista.grantedAt) : "-"
              }`
            : `Kaldırıldı · ${
                barista.updatedAt ? formatDateTime(barista.updatedAt) : "-"
              }`}
        </p>
      </div>
      {barista.isActive ? (
        <div>
          <ConfirmButton
            action={revokeBaristaAction}
            hidden={{ email: barista.email }}
            label="Yetkiyi kaldır"
            title="Kasa yetkisi kaldırılsın mı?"
            description={`${barista.email} uygulamadan damga veremez. Yetkiyi sonra yeniden verebilirsin.`}
            confirmLabel="Kaldır"
          />
        </div>
      ) : null}
    </div>
  );
}
