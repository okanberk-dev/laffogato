"use server";

import { redirect } from "next/navigation";
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
import { SITE } from "@/lib/seo/site";

function verifyUrl(token: string): string {
  return `${SITE.url}/uye/dogrula?token=${encodeURIComponent(token)}`;
}

export type RegisterFormState = {
  error?: string;
  values?: { email?: string; name?: string; phone?: string };
};

export async function registerAction(
  _prev: RegisterFormState,
  formData: FormData,
): Promise<RegisterFormState> {
  const email = String(formData.get("email") ?? "");
  const name = String(formData.get("name") ?? "");
  const phone = String(formData.get("phone") ?? "");
  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("passwordConfirm") ?? "");

  if (password !== passwordConfirm) {
    return {
      error: "Şifreler eşleşmiyor.",
      values: { email, name, phone },
    };
  }

  const result = await registerCustomer({ email, name, phone, password });
  if (!result.ok) {
    return { error: result.error, values: { email, name, phone } };
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
  await sendVerificationEmail(result.email, result.name, verifyUrl(result.token));
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

  const result = await verifyCustomerLogin({ email, password });
  if (!result.ok) {
    return { error: result.error, values: { email } };
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
  const updated = await updateCustomerProfile(current.email, { name, phone, birthday });
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
    isDefault: formData.get("isDefault") === "on" || formData.get("isDefault") === "true",
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
  const result = await updateCustomerAddress(current.email, addressId, readAddress(formData));
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

export async function setDefaultAddressAction(formData: FormData): Promise<void> {
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
  revalidatePath("/uye/hesap", "layout");
  return { message: "Tercihlerin kaydedildi." };
}
