import type { AdminOrderStatus } from "@/lib/admin/store";

export const STATUS_LABEL: Record<AdminOrderStatus, string> = {
  pending_payment: "Ödeme bekleniyor",
  paid: "Ödendi",
  preparing: "Hazırlanıyor",
  shipped: "Kargoda",
  completed: "Tamamlandı",
  cancelled: "İptal",
  refunded: "İade",
};

export const STATUS_TIMELINE: { status: AdminOrderStatus; label: string }[] = [
  { status: "pending_payment", label: "Ödeme bekleniyor" },
  { status: "paid", label: "Ödendi" },
  { status: "preparing", label: "Hazırlanıyor" },
  { status: "shipped", label: "Kargoda" },
  { status: "completed", label: "Teslim edildi" },
];

const STATUS_ORDER: Record<AdminOrderStatus, number> = {
  pending_payment: 0,
  paid: 1,
  preparing: 2,
  shipped: 3,
  completed: 4,
  cancelled: -1,
  refunded: -1,
};

export function statusReached(
  current: AdminOrderStatus,
  step: AdminOrderStatus,
): boolean {
  if (current === "cancelled" || current === "refunded") return false;
  return STATUS_ORDER[current] >= STATUS_ORDER[step];
}

export function formatTRY(minor: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
  }).format(minor / 100);
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Istanbul",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}
