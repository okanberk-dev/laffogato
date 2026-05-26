"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { placeOrder } from "@/lib/admin/store";

interface ClientCartItem {
  name: string;
  /** Major units (₺) as the design's `Product.price` stores them. */
  price: number;
  qty: number;
}

function parseItems(raw: string): ClientCartItem[] {
  try {
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data
      .map((it: unknown) => {
        if (typeof it !== "object" || it === null) return null;
        const o = it as Record<string, unknown>;
        const name = typeof o.name === "string" ? o.name : null;
        const price = typeof o.price === "number" ? o.price : Number(o.price);
        const qty = typeof o.qty === "number" ? o.qty : Number(o.qty ?? 1);
        if (!name || !Number.isFinite(price) || !Number.isFinite(qty)) {
          return null;
        }
        return { name, price, qty };
      })
      .filter((it): it is ClientCartItem => it !== null && it.qty > 0);
  } catch {
    return [];
  }
}

export async function placeOrderAction(formData: FormData) {
  const items = parseItems(String(formData.get("items") ?? "[]"));

  if (items.length === 0) {
    redirect("/?cart=empty");
  }

  const order = await placeOrder({
    items: items.map((it) => ({
      name: it.name,
      priceMinor: Math.round(it.price * 100),
      qty: it.qty,
    })),
    customerName: String(formData.get("customerName") ?? "") || undefined,
    customerEmail: String(formData.get("customerEmail") ?? "") || undefined,
    customerPhone: String(formData.get("customerPhone") ?? "") || undefined,
  });

  revalidatePath("/admin/siparisler");
  revalidatePath("/admin");
  redirect(`/odeme/basarili?ref=${order.id}`);
}
