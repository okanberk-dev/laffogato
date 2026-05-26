"use server";

import { redirect } from "next/navigation";

import {
  clearCustomerSession,
  getActiveCustomer,
  setActiveCustomerSession,
} from "@/lib/customer/auth";
import {
  registerCustomer,
  updateCustomerProfile,
  verifyCustomerLogin,
} from "@/lib/customer/store";

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
  await setActiveCustomerSession(result.customer.email);
  redirect("/uye/hesap");
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
  const updated = await updateCustomerProfile(current.email, { name, phone });
  if (!updated) return { error: "Güncellenemedi." };
  return { message: "Bilgilerin güncellendi." };
}
