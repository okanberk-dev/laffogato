"use server";

import { revalidatePath } from "next/cache";

import { updateSettings } from "@/lib/admin/store";

export interface SettingsState {
  message?: string;
}

export async function updateSettingsAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const input = {
    name: String(formData.get("name") ?? "").trim(),
    tagline: String(formData.get("tagline") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
    address: String(formData.get("address") ?? "").trim(),
    openingHours: String(formData.get("openingHours") ?? "").trim(),
    heroImageUrl: String(formData.get("heroImageUrl") ?? "").trim(),
    isShopOpen: formData.get("isShopOpen") === "on",
  };
  await updateSettings(input);
  revalidatePath("/admin/ayarlar");
  revalidatePath("/admin");
  return { message: "Ayarlar kaydedildi." };
}
