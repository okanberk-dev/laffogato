"use server";

import { redirect } from "next/navigation";

import { isDbUnreachable } from "@/lib/db/health";
import { revalidatePath } from "next/cache";

import {
  clearCustomerSession,
  getActiveCustomer,
  setActiveCustomerSession,
} from "@/lib/customer/auth";
import {
  addCustomerAddress,
  changeCustomerPassword,
  createVerificationToken,
  deleteCustomerAddress,
  registerCustomer,
  setCustomerDefaultAddress,
  toggleWishlist,
  updateCustomerAddress,
  updateCustomerProfile,
  updateNotificationPrefs,
  verifyCustomerLogin,
  adoptSupabasePassword,
  checkSitePassword,
  supabaseHoldsLatestPassword,
  type AddressInput,
  type NotificationPrefs,
} from "@/lib/customer/store";
import {
  linkCustomerToSupabase,
  linkIdentityAfterReset,
} from "@/lib/customer/supabase-bridge";
import { deleteMe } from "@/lib/mobile/me";
import { accountClosureParam } from "@/lib/customer/account-closure";
import { ensureCustomerForSupabaseUser } from "@/lib/customer/supabase-bridge";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sendVerificationEmail } from "@/lib/email/send";
import {
  subscribeNewsletter,
  unsubscribeNewsletterByEmail,
} from "@/lib/newsletter/store";
import { SITE } from "@/lib/seo/site";
import { sameSitePath } from "@/lib/http/same-site-path";
import {
  checkLoginLimit,
  clearLoginLimit,
  reserveLoginAttempt,
  clientIp,
  recordLoginFailure,
} from "@/lib/admin/rate-limit";
import {
  createPasswordResetToken,
  resetPasswordWithToken,
} from "@/lib/customer/store";
import { sendPasswordResetEmail } from "@/lib/email/send";

function verifyUrl(token: string): string {
  return `${SITE.url}/uye/dogrula?token=${encodeURIComponent(token)}`;
}

function resetUrl(token: string): string {
  return `${SITE.url}/uye/sifre-sifirla?token=${encodeURIComponent(token)}`;
}

export type ForgotPasswordState = { error?: string; message?: string };

/**
 * Starts a password reset.
 *
 * Always answers the same way, whether or not the address has an account:
 * anything else turns the form into a membership oracle. Rate-limited on the
 * durable counter so it cannot be used to mail-bomb someone either.
 */
export async function requestPasswordResetAction(
  _prev: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const email = String(formData.get("email") ?? "").trim();
  const SAME_ANSWER =
    "Bu adrese kayıtlı bir hesap varsa, sıfırlama bağlantısını gönderdik. Gelen kutunu ve spam klasörünü kontrol et.";
  if (!email || !email.includes("@")) {
    return { error: "Geçerli bir e-posta adresi gir." };
  }

  const ip = await clientIp();
  const limit = await checkLoginLimit("password-reset", ip, email);
  if (limit.blocked) {
    return {
      error: `Çok fazla istek. ${limit.retryAfterSeconds} saniye sonra tekrar dene.`,
    };
  }
  await recordLoginFailure("password-reset", ip, email);

  try {
    const request = await createPasswordResetToken(email);
    if (request) {
      await sendPasswordResetEmail(
        request.email,
        request.name,
        resetUrl(request.token),
      );
    }
  } catch (err) {
    if (isDbUnreachable(err)) return { error: DB_DOWN_MESSAGE };
    // A mail failure must not reveal that the address exists either.
    console.error("[uye] password reset request failed", err);
  }
  return { message: SAME_ANSWER };
}

export type ResetPasswordState = { error?: string; message?: string };

export async function resetPasswordAction(
  _prev: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("passwordConfirm") ?? "");
  if (password !== confirm) return { error: "Şifreler eşleşmiyor." };

  let result;
  try {
    result = await resetPasswordWithToken(token, password);
  } catch (err) {
    if (!isDbUnreachable(err)) throw err;
    return { error: DB_DOWN_MESSAGE };
  }
  if (!result.ok) return { error: result.error };

  // The reset above mirrors the new password only to an identity the row is
  // already linked to. A row the one-time link attempt never managed to link
  // would otherwise keep the OLD password opening the app, so find that
  // identity by the address the member has just proved they read, link it and
  // write the password there as well. Inert without the service-role key, and
  // never allowed to undo a reset that has already happened.
  try {
    await linkIdentityAfterReset(result.email, password);
  } catch (err) {
    console.error("[uye] identity link after reset failed", err);
  }

  // Signed in straight away: they have just proved control of the address and
  // chosen a new password, so a second login form would be busywork.
  await setActiveCustomerSession(result.email);
  redirect("/uye/hesap");
}

export type RegisterFormState = {
  error?: string;
  values?: {
    email?: string;
    name?: string;
    phone?: string;
    acceptedTerms?: boolean;
    marketing?: boolean;
    newsletter?: boolean;
  };
};

const DB_DOWN_MESSAGE =
  "Hesap servisimize şu an ulaşamıyoruz. Kısa süre içinde tekrar dener misin?";

export async function registerAction(
  _prev: RegisterFormState,
  formData: FormData,
): Promise<RegisterFormState> {
  const email = String(formData.get("email") ?? "");
  const name = String(formData.get("name") ?? "");
  const phone = String(formData.get("phone") ?? "");
  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("passwordConfirm") ?? "");
  const acceptedTerms = formData.get("acceptedTerms") === "on";
  const marketing = formData.get("marketing") === "on";
  const newsletter = formData.get("newsletter") === "on";
  const values = { email, name, phone, acceptedTerms, marketing, newsletter };

  if (password !== passwordConfirm) {
    return { error: "Şifreler eşleşmiyor.", values };
  }
  if (!acceptedTerms) {
    return {
      error:
        "Devam etmek için kullanım şartları ve gizlilik politikasını kabul etmelisin.",
      values,
    };
  }

  let result;
  try {
    result = await registerCustomer({
      email,
      name,
      phone,
      password,
      acceptedTerms,
      marketing,
      newsletter,
    });
  } catch (err) {
    if (!isDbUnreachable(err)) throw err;
    return { error: DB_DOWN_MESSAGE, values };
  }
  if (!result.ok) {
    return { error: result.error, values };
  }
  // Newsletter opt-in also lands in the subscriber list (best-effort).
  if (newsletter) {
    try {
      // The signup form's own opt-in checkbox is the consent; the record
      // names the moment and the origin, which is what has to be provable.
      // The address is not proven yet, so the request is stored PENDING
      // (double opt-in) and becomes a subscription when the member verifies
      // it with the link sent below - no second mail.
      await subscribeNewsletter(
        result.customer.email,
        result.customer.name,
        "register",
        { at: new Date().toISOString(), ip: await clientIp() },
        { confirmed: false },
      );
    } catch {
      // non-fatal - the account + notificationPrefs already captured the intent
    }
  }
  // Send the verification e-mail (best-effort; link is logged if no provider).
  await sendVerificationEmail(
    result.customer.email,
    result.customer.name,
    verifyUrl(result.verifyToken),
  );
  // Shared membership: the same e-mail + password also opens the app. A
  // Supabase refusal is logged and never blocks the site sign-up; the site's
  // own verification e-mail above keeps going out regardless.
  try {
    await linkCustomerToSupabase({
      email: result.customer.email,
      password,
      name: result.customer.name,
    });
  } catch (err) {
    console.error("[uye] supabase link after register failed", err);
  }
  await setActiveCustomerSession(result.customer.email);
  redirect("/uye/hesap?verify=sent");
}

export type ResendState = { error?: string; message?: string };

/** Re-sends the verification e-mail to the logged-in (unverified) customer. */
export async function resendVerificationAction(
  _prev: ResendState,
  _formData: FormData,
): Promise<ResendState> {
  const current = await getActiveCustomer();
  if (!current) return { error: "Önce giriş yap." };
  if (current.emailVerified) return { message: "E-postan zaten doğrulanmış." };
  const result = await createVerificationToken(current.email);
  if (!result.ok) {
    return result.alreadyVerified
      ? { message: "E-postan zaten doğrulanmış." }
      : { error: result.error };
  }
  const sent = await sendVerificationEmail(
    result.email,
    result.name,
    verifyUrl(result.token),
  );
  // Saying "gönderildi" when it was not is how a member ends up refreshing an
  // inbox for an hour. Unlike the sign-up and reset paths there is no reason
  // to be vague here: they are signed in, so the answer reveals nothing.
  return sent
    ? { message: "Doğrulama bağlantısı e-postana gönderildi." }
    : {
        error:
          "E-posta şu an gönderilemiyor. Kısa süre içinde tekrar dener misin?",
      };
}

export type LoginFormState = {
  error?: string;
  values?: { email?: string };
};

/** The refusal text for a failed login whose attempt was already counted. */
function loginFailureMessage(
  limit: { remaining: number },
  base: string,
): string {
  return limit.remaining === 0
    ? `${base} Çok fazla başarısız deneme - bir süre sonra tekrar dene.`
    : base;
}

export async function loginAction(
  _prev: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  // Customer login had no limit at all: an attacker could try passwords
  // against a member's address as fast as the server would answer, and the
  // account holds their order history, addresses and phone number.
  const ip = await clientIp();
  let sessionEmail: string;
  try {
    // Counted BEFORE the password is checked (reserveLoginAttempt), so a
    // burst sent in parallel cannot get more guesses than the cap.
    const limit = await reserveLoginAttempt("customer-login", ip, email);
    if (limit.blocked) {
      return {
        error: `Çok fazla başarısız deneme. ${limit.retryAfterSeconds} saniye sonra tekrar dene.`,
        values: { email },
      };
    }

    // Supabase first (docs/AUTH-BRIDGE.md): the same credentials the app uses.
    // On success the server client has already written the session cookies;
    // the site's own signed cookie is set below exactly as before.
    const viaSupabase = await signInWithSupabase(email, password);
    let supabaseSession = "";
    if (viaSupabase.ok) {
      const linked = await ensureCustomerForSupabaseUser(viaSupabase.user);
      if (linked.ok) {
        // Which copy of the password is the newer one?
        //
        // Not answerable from the two values, so the row carries the answer:
        // `passwordMirroredAt` is stamped when a password written HERE was
        // confirmed written to Supabase, and emptied when it was not. Set, it
        // means Supabase cannot be holding anything older than this row - so a
        // disagreement can only be the APP having moved, and taking Supabase's
        // word is right. Unset, this site's copy may be the newer one and
        // adopting would hand the account back to a password the member has
        // already replaced.
        const agree = await checkSitePassword(linked.customer.email, password);
        if (agree === "mismatch") {
          if (await supabaseHoldsLatestPassword(linked.customer.email)) {
            await adoptSupabasePassword(linked.customer.email, password);
          } else {
            await signOutSupabase();
            return {
              error: loginFailureMessage(limit, "E-posta veya şifre hatalı."),
              values: { email },
            };
          }
        }
        supabaseSession = linked.customer.email;
      } else {
        await signOutSupabase();
        if (linked.reason === "account_disabled") {
          return {
            error:
              "Hesabın devre dışı bırakılmış. Lütfen bizimle iletişime geç.",
            values: { email },
          };
        }
        // Unconfirmed at Supabase (or no e-mail there): the bcrypt path below
        // decides, exactly as it did before the bridge existed.
      }
    }
    // A refusal from Supabase is FINAL for a member whose latest password is
    // known to be there. Falling through to bcrypt would otherwise accept a
    // password Supabase has just replaced - which is the whole of what an
    // app-side reset is supposed to have destroyed. An unreachable auth server
    // is not a refusal and still falls through: locking every member out of
    // the site during a Supabase outage is the worse failure.
    if (
      !viaSupabase.ok &&
      viaSupabase.answered &&
      (await supabaseHoldsLatestPassword(email))
    ) {
      return {
        error: loginFailureMessage(limit, "E-posta veya şifre hatalı."),
        values: { email },
      };
    }

    if (supabaseSession) {
      sessionEmail = supabaseSession;
    } else {
      // Not a Supabase member (yet), wrong password there, or the address is
      // unconfirmed there: the bcrypt path is unchanged.
      const result = await verifyCustomerLogin({ email, password });
      if (!result.ok) {
        return {
          error: loginFailureMessage(limit, result.error),
          values: { email },
        };
      }
      sessionEmail = result.customer.email;
      // The password was just proven: give this legacy member a Supabase
      // account with it, once. Never blocks the login.
      try {
        await linkCustomerToSupabase({
          email: sessionEmail,
          password,
          name: result.customer.name,
        });
      } catch (err) {
        if (isDbUnreachable(err)) throw err;
        console.error("[uye] supabase link after login failed", err);
      }
    }
    await clearLoginLimit("customer-login", ip, email);
  } catch (err) {
    // Only the redirect below may throw past this point; a database outage
    // becomes a message on the form rather than an error page.
    if (!isDbUnreachable(err)) throw err;
    return { error: DB_DOWN_MESSAGE, values: { email } };
  }
  await setActiveCustomerSession(sessionEmail);
  // The checkout and the karaoke page send a signed-out visitor here with
  // `?next=`; landing them on the account page instead dropped them out of
  // the purchase they had started.
  redirect(sameSitePath(formData.get("next")) ?? "/uye/hesap");
}

type SupabaseSignIn =
  | {
      ok: true;
      user: {
        id: string;
        email?: string;
        email_confirmed_at?: string;
        user_metadata: Record<string, unknown>;
      };
    }
  /**
   * `answered` distinguishes "Supabase said no" from "Supabase said nothing".
   * They used to collapse into the same `{ok:false}`, which is fine while the
   * bcrypt path is a free second opinion - and wrong once a refusal from
   * Supabase has to be final for members whose identity lives there.
   */
  | { ok: false; answered: boolean };

/**
 * `signInWithPassword` against the shared Supabase project. A refused
 * credential and an unreachable auth server are both failures here, but they
 * are not the same failure: only the first is an answer. Only the second is
 * logged - a wrong password is not an incident.
 */
async function signInWithSupabase(
  email: string,
  password: string,
): Promise<SupabaseSignIn> {
  if (!email.trim() || !password) return { ok: false, answered: false };
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error || !data.user) {
      const status = error?.status;
      if (status === undefined || status === 0 || status >= 500) {
        console.error(
          `[uye] supabase sign-in unavailable: ${error?.message ?? "no user"}`,
        );
      }
      // 4xx is Supabase answering: wrong password, unconfirmed address, no
      // such user. Anything else - no status, 0, 5xx - is it not answering.
      const answered = status !== undefined && status !== 0 && status < 500;
      return { ok: false, answered };
    }
    return { ok: true, user: data.user };
  } catch (err) {
    console.error("[uye] supabase sign-in threw", err);
    return { ok: false, answered: false };
  }
}

/**
 * Best-effort: clears the Supabase cookies THIS browser holds; never throws.
 *
 * `scope: "local"` is the whole of it. supabase-js defaults to `global`, which
 * revokes every refresh token the member has anywhere - so signing out of the
 * website also signed them out of their phone, and the two calls on the failed
 * login path did it to someone who had not signed in at all. A stale password
 * that Supabase still accepts (the app-reset case) reaches that branch, which
 * makes it a way to knock a member off their phone by failing a login.
 *
 * The app has always scoped its own sign-outs (`lafmobil ·
 * src/lib/supabase/session.ts`); this side had not, and the comment above it
 * described local behaviour the code did not have.
 */
async function signOutSupabase(): Promise<void> {
  try {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut({ scope: "local" });
  } catch (err) {
    console.error("[uye] supabase sign-out failed", err);
  }
}

/**
 * Who the header's account menu is talking to. Reads only the caller's own
 * session and returns only whether there is one and its first name - the
 * menu needs nothing else, and this is a public POST endpoint (rule 27).
 */
export async function accountMenuStateAction(): Promise<{
  signedIn: boolean;
  firstName: string;
}> {
  const c = await getActiveCustomer();
  if (!c) return { signedIn: false, firstName: "" };
  return {
    signedIn: true,
    firstName: (c.name || "").trim().split(/\s+/)[0] ?? "",
  };
}

export async function logoutAction(): Promise<void> {
  // Both sessions go: the site's signed cookie and the Supabase one, so the
  // next visit does not silently sign the member back in through the proxy.
  await signOutSupabase();
  await clearCustomerSession();
  redirect("/");
}

export type UpdateProfileState = {
  error?: string;
  message?: string;
};

export async function updateProfileAction(
  _prev: UpdateProfileState,
  formData: FormData,
): Promise<UpdateProfileState> {
  const current = await getActiveCustomer();
  if (!current) return { error: "Oturumun süresi dolmuş." };
  const name = String(formData.get("name") ?? "");
  const phone = String(formData.get("phone") ?? "");
  const birthday = String(formData.get("birthday") ?? "");
  const updated = await updateCustomerProfile(current.email, {
    name,
    phone,
    birthday,
  });
  if (!updated) return { error: "Güncellenemedi." };
  revalidatePath("/uye/hesap", "layout");
  return { message: "Bilgilerin güncellendi." };
}

export type PasswordFormState = { error?: string; message?: string };

export async function changePasswordAction(
  _prev: PasswordFormState,
  formData: FormData,
): Promise<PasswordFormState> {
  const current = await getActiveCustomer();
  if (!current) return { error: "Oturumun süresi dolmuş." };
  const currentPw = String(formData.get("currentPassword") ?? "");
  const newPw = String(formData.get("newPassword") ?? "");
  const confirm = String(formData.get("newPasswordConfirm") ?? "");
  if (newPw !== confirm) return { error: "Yeni şifreler eşleşmiyor." };
  const result = await changeCustomerPassword(current.email, currentPw, newPw);
  if (!result.ok) return { error: result.error };
  // The mirror lives in `changeCustomerPassword` now, with the service role
  // and a record of whether it landed. It used to be here, conditional on this
  // browser holding a Supabase session - so the same change mirrored or not
  // depending on how the member happened to have signed in, and nothing wrote
  // down which had happened.
  // The change invalidates every cookie issued against the old password,
  // including this browser's - so re-issue one for the person who just did it.
  await setActiveCustomerSession(current.email);
  return {
    message: "Şifren güncellendi. Diğer cihazlardaki oturumların kapatıldı.",
  };
}

// ─── Address actions ──────────────────────────────────────────────────────

function readAddress(formData: FormData): AddressInput {
  return {
    label: String(formData.get("label") ?? ""),
    recipientName: String(formData.get("recipientName") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    line1: String(formData.get("line1") ?? ""),
    line2: String(formData.get("line2") ?? ""),
    district: String(formData.get("district") ?? ""),
    city: String(formData.get("city") ?? ""),
    zip: String(formData.get("zip") ?? ""),
    isDefault:
      formData.get("isDefault") === "on" ||
      formData.get("isDefault") === "true",
  };
}

export type AddressFormState = { error?: string; message?: string };

export async function createAddressAction(
  _prev: AddressFormState,
  formData: FormData,
): Promise<AddressFormState> {
  const current = await getActiveCustomer();
  if (!current) return { error: "Oturumun süresi dolmuş." };
  const result = await addCustomerAddress(current.email, readAddress(formData));
  if (!result.ok) return { error: result.error };
  revalidatePath("/uye/hesap", "layout");
  redirect("/uye/hesap/adreslerim");
}

export async function updateAddressAction(
  addressId: string,
  _prev: AddressFormState,
  formData: FormData,
): Promise<AddressFormState> {
  const current = await getActiveCustomer();
  if (!current) return { error: "Oturumun süresi dolmuş." };
  const result = await updateCustomerAddress(
    current.email,
    addressId,
    readAddress(formData),
  );
  if (!result.ok) return { error: result.error };
  revalidatePath("/uye/hesap", "layout");
  redirect("/uye/hesap/adreslerim");
}

export async function deleteAddressAction(formData: FormData): Promise<void> {
  const current = await getActiveCustomer();
  if (!current) return;
  const addressId = String(formData.get("addressId") ?? "");
  if (!addressId) return;
  await deleteCustomerAddress(current.email, addressId);
  revalidatePath("/uye/hesap", "layout");
}

export async function setDefaultAddressAction(
  formData: FormData,
): Promise<void> {
  const current = await getActiveCustomer();
  if (!current) return;
  const addressId = String(formData.get("addressId") ?? "");
  if (!addressId) return;
  await setCustomerDefaultAddress(current.email, addressId);
  revalidatePath("/uye/hesap", "layout");
}

// ─── Wishlist actions ─────────────────────────────────────────────────────

export async function toggleWishlistAction(formData: FormData): Promise<void> {
  const current = await getActiveCustomer();
  if (!current) {
    redirect("/uye/giris");
  }
  const productId = String(formData.get("productId") ?? "");
  if (!productId) return;
  await toggleWishlist(current.email, productId);
  revalidatePath("/uye/hesap", "layout");
  revalidatePath("/", "layout");
  // `back` is a form field - only a path on this site is followed.
  redirect(sameSitePath(formData.get("back")) ?? "/uye/hesap/favorilerim");
}

// ─── Notification preferences ─────────────────────────────────────────────

export type NotificationFormState = { error?: string; message?: string };

export async function updateNotificationsAction(
  _prev: NotificationFormState,
  formData: FormData,
): Promise<NotificationFormState> {
  const current = await getActiveCustomer();
  if (!current) return { error: "Oturumun süresi dolmuş." };
  const prefs: NotificationPrefs = {
    orderUpdates: formData.get("orderUpdates") === "on",
    marketing: formData.get("marketing") === "on",
    newsletter: formData.get("newsletter") === "on",
  };
  const updated = await updateNotificationPrefs(current.email, prefs);
  if (!updated) return { error: "Güncellenemedi." };
  // Keep the marketing newsletter list in sync with the member's toggle.
  try {
    if (prefs.newsletter) {
      // A verified member subscribes on the spot; an unverified one is
      // stored pending until they verify (double opt-in).
      await subscribeNewsletter(
        current.email,
        current.name,
        "account",
        { at: new Date().toISOString(), ip: await clientIp() },
        { confirmed: current.emailVerified },
      );
    } else {
      await unsubscribeNewsletterByEmail(current.email);
    }
  } catch {
    // non-fatal
  }
  revalidatePath("/uye/hesap", "layout");
  return { message: "Tercihlerin kaydedildi." };
}

// ─── Account closure ──────────────────────────────────────────────────────

export interface DeleteAccountState {
  error?: string;
}

/**
 * Closes the member's own account from the site (`/uye/hesap/sil`).
 *
 * The membership agreement §14 offers exactly two routes - the app's account
 * settings and an e-mail to support - and until now the site, which is where
 * most members signed up, had neither. `deleteMe` is the same anonymisation
 * the app's `DELETE /me` runs, so both routes leave the account in one state.
 *
 * Irreversible, so it asks for two things: the account's own e-mail typed out,
 * and the password when the account has one. A Supabase-only account (social
 * login, `checkSitePassword` → "none") is confirmed by the e-mail alone -
 * there is no password to ask for.
 */
export async function deleteAccountAction(
  _prev: DeleteAccountState,
  formData: FormData,
): Promise<DeleteAccountState> {
  const current = await getActiveCustomer();
  if (!current) return { error: "Oturumun süresi dolmuş." };

  const typed = String(formData.get("confirmEmail") ?? "")
    .trim()
    .toLowerCase();
  if (typed !== current.email.toLowerCase()) {
    return { error: "Onay için hesabının e-posta adresini birebir yaz." };
  }

  const password = String(formData.get("password") ?? "");
  const check = await checkSitePassword(current.email, password);
  if (check === "mismatch") return { error: "Şifre hatalı." };

  const result = await deleteMe(current);
  if (!result.ok) {
    // Üyelik Sözleşmesi §14: the closure waits for an order in flight. Same
    // rule, same wording as the app's DELETE /me.
    return {
      error:
        "Devam eden siparişin var. Sipariş tamamlandıktan sonra hesabını silebilirsin.",
    };
  }
  await clearCustomerSession();
  // "Kişisel verilerin silindi" only when the Supabase identity (e-mail and
  // name) went too; otherwise the short sentence (docs/API-MOBILE.md §4).
  redirect(`/?hesap=${accountClosureParam(result.identity)}`);
}
