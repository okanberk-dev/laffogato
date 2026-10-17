"use client";

import { useActionState, useEffect, useRef, type RefObject } from "react";

import {
  PANEL_ACTION_FAILED,
  useNoResetSubmit,
  withPanelCatch,
} from "@/components/admin/action-form";
import { FormError, FormSuccess } from "@/components/admin/form-feedback";
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
import { Badge, ConfirmButton } from "@/components/admin/ui";
import { ADMIN_ROLES, ROLE_LABELS } from "@/lib/admin/roles";

import {
  createAdminUserAction,
  deleteAdminUserAction,
  grantBaristaAction,
  reset2FAAction,
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
  if (state.error) return <FormError message={state.error} />;
  return <FormSuccess message={state.message} />;
}

type UserAction = (
  prev: AdminUserState,
  formData: FormData,
) => Promise<AdminUserState>;

/**
 * `useActionState` + onSubmit for these forms, posted by hand
 * (useNoResetSubmit). A refused save used to reset the form: "Bu e-posta
 * zaten kayıtlı" or a short password cleared the address, the name and the
 * password and put Rol back on Kasiyer, so the retry could create the wrong
 * role. `resetOnSuccess` empties a form whose success stays on the page and
 * leaves nothing worth keeping (a new account, a password, a grant). A
 * throw becomes an answer, not the error screen.
 */
function useUserForm(
  action: UserAction,
  formRef: RefObject<HTMLFormElement | null>,
  resetOnSuccess: boolean,
) {
  const [state, formAction, pending] = useActionState(
    withPanelCatch(action, () => ({ error: PANEL_ACTION_FAILED })),
    initialState,
  );
  const onSubmit = useNoResetSubmit(formAction, pending);
  useEffect(() => {
    if (resetOnSuccess && state.message && !state.error) {
      formRef.current?.reset();
    }
  }, [state, formRef, resetOnSuccess]);
  return { state, pending, onSubmit };
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
  const formRef = useRef<HTMLFormElement>(null);
  const { state, pending, onSubmit } = useUserForm(
    createAdminUserAction,
    formRef,
    true,
  );

  return (
    <Card>
      <form ref={formRef} onSubmit={onSubmit} className="grid gap-4">
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
  /** Whether the account has an authenticator enrolled. */
  has2FA?: boolean;
  /** The signed-in owner's own account (2FA is managed on its own page). */
  isSelf?: boolean;
}

export function AdminUserRow({
  user,
  minPasswordLength,
}: { user: AdminUserRowProps } & PasswordPolicy) {
  const saveRef = useRef<HTMLFormElement>(null);
  const passwordRef = useRef<HTMLFormElement>(null);
  const save = useUserForm(saveAdminUserAction, saveRef, false);
  const password = useUserForm(resetAdminPasswordAction, passwordRef, true);

  return (
    <Card>
      <div className="grid gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <p
              className="text-sm font-medium break-all"
              style={{ fontFamily: "var(--mono), monospace" }}
            >
              {user.email}
            </p>
            {user.has2FA === undefined ? null : (
              <Badge tone={user.has2FA ? "success" : "neutral"}>
                {user.has2FA ? "2FA açık" : "2FA kapalı"}
              </Badge>
            )}
          </div>
          <p className="text-xs text-[var(--admin-text-mute)]">
            {user.updatedAt
              ? `Son güncelleme: ${formatDateTime(user.updatedAt)}`
              : "Hiç güncellenmedi"}
          </p>
        </div>

        <form
          ref={saveRef}
          onSubmit={save.onSubmit}
          className="grid gap-3 sm:grid-cols-3"
        >
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
            <PrimaryButton type="submit" disabled={save.pending}>
              {save.pending ? "Kaydediliyor…" : "Kaydet"}
            </PrimaryButton>
          </div>
          <div className="sm:col-span-3">
            <Notice state={save.state} />
          </div>
        </form>

        <div className="grid gap-3 border-t border-[var(--admin-border)] pt-4 sm:grid-cols-2">
          <form
            ref={passwordRef}
            onSubmit={password.onSubmit}
            className="grid gap-3"
          >
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
              <GhostButton type="submit" disabled={password.pending}>
                {password.pending ? "Değiştiriliyor…" : "Parolayı sıfırla"}
              </GhostButton>
            </div>
            <Notice state={password.state} />
          </form>

          {/* Asks first: the account and its sign-in go at once. The last
              owner is refused on the server (lib/admin/users.ts). */}
          <div className="grid content-end gap-3">
            {user.has2FA ? (
              <div>
                {/* A lost or replaced phone: without this, only a SQL
                    console let the user back in. */}
                <ConfirmButton
                  action={reset2FAAction}
                  hidden={{ email: user.email }}
                  label="2FA'yı sıfırla"
                  variant="ghost"
                  title={`${user.email} için 2FA sıfırlansın mı?`}
                  description="Telefonunu kaybeden ya da değiştiren kullanıcı için. Hesaba bir sonraki girişte yalnız parolayla girilir; kullanıcı 2FA'yı yeniden kurmalı."
                  confirmPhrase={user.email}
                  confirmLabel="Sıfırla"
                  disabledReason={
                    user.isSelf
                      ? "Kendi 2FA'nı 2FA kurulumu sayfasından kapatırsın."
                      : undefined
                  }
                />
              </div>
            ) : null}
            <div>
              <ConfirmButton
                action={deleteAdminUserAction}
                hidden={{ email: user.email }}
                label="Kullanıcıyı sil"
                title={`${user.email} silinsin mi?`}
                description="Panel hesabı ve 2FA kaydı kalıcı olarak silinir, oturumu hemen kapanır. Yalnız erişimi durdurmak istiyorsan Aktif kutusunu kaldırıp kaydet."
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
  const formRef = useRef<HTMLFormElement>(null);
  const { state, pending, onSubmit } = useUserForm(
    grantBaristaAction,
    formRef,
    true,
  );

  return (
    <form ref={formRef} onSubmit={onSubmit} className="grid gap-3">
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
