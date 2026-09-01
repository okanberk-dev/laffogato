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
  type AddressInput,
  type NotificationPrefs,
} from "@/lib/customer/store";
import { sendVerificationEmail } from "@/lib/email/send";
import {
  subscribeNewsletter,
  unsubscribeNewsletterByEmail,
} from "@/lib/newsletter/store";
import { SITE } from "@/lib/seo/site";
import {
  checkLoginLimit,
  clearLoginLimit,
  clientIp,
  recordLoginFailure,
} from "@/lib/admin/rate-limit";

function verifyUrl(token: string): string {
  return `${SITE.url}/uye/dogrula?token=${encodeURIComponent(token)}`;
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
      await subscribeNewsletter(
        result.customer.email,
        result.customer.name,
        "register",
      );
    } catch {
      // non-fatal — the account + notificationPrefs already captured the intent
    }
  }
  // Send the verification e-mail (best-effort; link is logged if no provider).
  await sendVerificationEmail(
    result.customer.email,
    result.customer.name,
    verifyUrl(result.verifyToken),
  );
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
  await sendVerificationEmail(
    result.email,
    result.name,
    verifyUrl(result.token),
  );
  return { message: "Doğrulama bağlantısı e-postana gönderildi." };
}

export type LoginFormState = {
  error?: string;
  values?: { email?: string };
};

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
  let result;
  try {
    const limit = await checkLoginLimit("customer-login", ip, email);
    if (limit.blocked) {
      return {
        error: `Çok fazla başarısız deneme. ${limit.retryAfterSeconds} saniye sonra tekrar dene.`,
        values: { email },
      };
    }
    result = await verifyCustomerLogin({ email, password });
    if (!result.ok) {
      const after = await recordLoginFailure("customer-login", ip, email);
      return {
        error: after.blocked
          ? `Çok fazla başarısız deneme. ${after.retryAfterSeconds} saniye sonra tekrar dene.`
          : result.error,
        values: { email },
      };
    }
    await clearLoginLimit("customer-login", ip, email);
  } catch (err) {
    // Only the redirect below may throw past this point; a database outage
    // becomes a message on the form rather than an error page.
    if (!isDbUnreachable(err)) throw err;
    return { error: DB_DOWN_MESSAGE, values: { email } };
  }
  await setActiveCustomerSession(result.customer.email);
  redirect("/uye/hesap");
}

export async function logoutAction(): Promise<void> {
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
  return { message: "Şifren güncellendi." };
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
  const back = String(formData.get("back") ?? "/uye/hesap/favorilerim");
  revalidatePath("/uye/hesap", "layout");
  revalidatePath("/", "layout");
  redirect(back);
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
      await subscribeNewsletter(current.email, current.name, "account");
    } else {
      await unsubscribeNewsletterByEmail(current.email);
    }
  } catch {
    // non-fatal
  }
  revalidatePath("/uye/hesap", "layout");
  return { message: "Tercihlerin kaydedildi." };
}
