"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";

import type { ManualOrderActionState } from "@/app/admin/siparisler/actions";

import {
  Card,
  Field,
  GhostButton,
  PrimaryButton,
  Select,
  TextInput,
  formatTRY,
} from "./forms";

export interface ManualProductVariant {
  id: string;
  name: string;
  priceDeltaMinor: number;
  stock: number;
}

export interface ManualProduct {
  id: string;
  name: string;
  priceMinor: number;
  stock: number;
  variants: ManualProductVariant[];
}

interface Line {
  key: number;
  productId: string;
  variantId: string;
  qty: number;
}

const initial: ManualOrderActionState = {};

interface Props {
  products: ManualProduct[];
  action: (
    prev: ManualOrderActionState,
    formData: FormData,
  ) => Promise<ManualOrderActionState>;
}

export function ManualOrderForm({ products, action }: Props) {
  const [state, formAction, pending] = useActionState(action, initial);
  const [lines, setLines] = useState<Line[]>([
    { key: 1, productId: "", variantId: "", qty: 1 },
  ]);
  const [nextKey, setNextKey] = useState(2);

  const byId = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products],
  );

  const fe = (k: string) => state.fieldErrors?.[k];

  function addLine() {
    setLines((ls) => [
      ...ls,
      { key: nextKey, productId: "", variantId: "", qty: 1 },
    ]);
    setNextKey((k) => k + 1);
  }

  function removeLine(key: number) {
    setLines((ls) => (ls.length > 1 ? ls.filter((l) => l.key !== key) : ls));
  }

  function patchLine(key: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function unitPrice(line: Line): number {
    const p = byId.get(line.productId);
    if (!p) return 0;
    const v = p.variants.find((x) => x.id === line.variantId);
    return Math.max(0, p.priceMinor + (v ? v.priceDeltaMinor : 0));
  }

  const subtotal = lines.reduce(
    (s, l) => s + (l.productId ? unitPrice(l) * l.qty : 0),
    0,
  );

  // Serialized payload the server resolves prices against.
  const itemsPayload = JSON.stringify(
    lines
      .filter((l) => l.productId && l.qty > 0)
      .map((l) => ({
        productId: l.productId,
        variantId: l.variantId || undefined,
        qty: l.qty,
      })),
  );

  return (
    <form action={formAction} className="grid gap-5">
      <input type="hidden" name="items" value={itemsPayload} readOnly />

      <Card className="grid gap-4">
        <div className="flex items-center justify-between">
          <h2
            className="text-[10px] tracking-[0.22em] text-neutral-500 uppercase"
            style={{ fontFamily: "var(--mono), monospace" }}
          >
            Ürünler
          </h2>
          {fe("items") && (
            <span className="text-xs text-red-600">{fe("items")}</span>
          )}
        </div>

        <div className="grid gap-3">
          {lines.map((line) => {
            const product = byId.get(line.productId);
            const variants = product?.variants ?? [];
            return (
              <div
                key={line.key}
                className="grid gap-2 rounded-lg border border-[var(--admin-border)] p-3 sm:grid-cols-[1fr_1fr_auto_auto_auto] sm:items-end"
              >
                <label className="grid gap-1">
                  <span className="text-[10px] tracking-[0.18em] text-neutral-500 uppercase">
                    Ürün
                  </span>
                  <Select
                    value={line.productId}
                    onChange={(e) =>
                      patchLine(line.key, {
                        productId: e.target.value,
                        variantId: "",
                      })
                    }
                  >
                    <option value="">Seç…</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — {formatTRY(p.priceMinor)}
                      </option>
                    ))}
                  </Select>
                </label>

                <label className="grid gap-1">
                  <span className="text-[10px] tracking-[0.18em] text-neutral-500 uppercase">
                    Varyant
                  </span>
                  <Select
                    value={line.variantId}
                    disabled={variants.length === 0}
                    onChange={(e) =>
                      patchLine(line.key, { variantId: e.target.value })
                    }
                  >
                    <option value="">
                      {variants.length === 0 ? "—" : "Varsayılan"}
                    </option>
                    {variants.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                        {v.priceDeltaMinor !== 0
                          ? ` (${v.priceDeltaMinor > 0 ? "+" : ""}${formatTRY(v.priceDeltaMinor)})`
                          : ""}
                      </option>
                    ))}
                  </Select>
                </label>

                <label className="grid gap-1">
                  <span className="text-[10px] tracking-[0.18em] text-neutral-500 uppercase">
                    Adet
                  </span>
                  <TextInput
                    type="number"
                    min={1}
                    max={99}
                    value={String(line.qty)}
                    onChange={(e) =>
                      patchLine(line.key, {
                        qty: Math.max(
                          1,
                          Math.min(99, Number(e.target.value) || 1),
                        ),
                      })
                    }
                    className="w-20"
                  />
                </label>

                <div className="grid gap-1">
                  <span className="text-[10px] tracking-[0.18em] text-neutral-500 uppercase">
                    Tutar
                  </span>
                  <span
                    className="py-2.5 text-sm text-neutral-900"
                    style={{ fontFamily: "var(--mono), monospace" }}
                  >
                    {line.productId
                      ? formatTRY(unitPrice(line) * line.qty)
                      : "—"}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => removeLine(line.key)}
                  disabled={lines.length === 1}
                  aria-label="Satırı kaldır"
                  className="min-h-[44px] rounded-full border border-[var(--admin-border)] px-3 text-xs text-neutral-600 hover:border-red-500 hover:text-red-600 disabled:opacity-30"
                >
                  Kaldır
                </button>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between">
          <GhostButton type="button" onClick={addLine}>
            + Ürün ekle
          </GhostButton>
          <div
            className="text-sm text-neutral-700"
            style={{ fontFamily: "var(--mono), monospace" }}
          >
            Ara toplam:{" "}
            <span className="text-neutral-900">{formatTRY(subtotal)}</span>
          </div>
        </div>
        <p className="text-xs text-neutral-400">
          Kargo ve vergi ayarlardan, nihai tutar kaydederken sunucuda
          hesaplanır.
        </p>
      </Card>

      <Card className="grid gap-5">
        <h2
          className="text-[10px] tracking-[0.22em] text-neutral-500 uppercase"
          style={{ fontFamily: "var(--mono), monospace" }}
        >
          Müşteri & teslimat
        </h2>
        <Field label="Ad Soyad" hint={fe("customerName")}>
          <TextInput
            name="customerName"
            required
            placeholder="Müşteri adı"
            aria-invalid={Boolean(fe("customerName"))}
          />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="E-posta (opsiyonel)" hint={fe("customerEmail")}>
            <TextInput
              name="customerEmail"
              type="email"
              placeholder="ornek@eposta.com"
              aria-invalid={Boolean(fe("customerEmail"))}
            />
          </Field>
          <Field label="Telefon (opsiyonel)">
            <TextInput name="customerPhone" placeholder="+90 5xx xxx xx xx" />
          </Field>
        </div>
        <Field label="Teslimat adresi (opsiyonel)">
          <textarea
            name="shippingAddress"
            rows={3}
            placeholder="Mahalle, cadde, no, daire — ilçe / il"
            className="w-full rounded-md border border-[var(--admin-border)] bg-neutral-50 px-3 py-2.5 text-base transition-colors outline-none focus:border-[var(--admin-primary)] focus:bg-white sm:text-sm"
          />
        </Field>
      </Card>

      <Card className="grid gap-5">
        <h2
          className="text-[10px] tracking-[0.22em] text-neutral-500 uppercase"
          style={{ fontFamily: "var(--mono), monospace" }}
        >
          Sipariş ayarları
        </h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Başlangıç durumu">
            <Select name="status" defaultValue="paid">
              <option value="paid">Ödendi</option>
              <option value="pending_payment">Ödeme bekleniyor</option>
              <option value="preparing">Hazırlanıyor</option>
            </Select>
          </Field>
          <Field label="Promosyon kodu (opsiyonel)">
            <TextInput name="promoCode" placeholder="SUMMER25" />
          </Field>
        </div>
        <Field label="İçsel not (opsiyonel)">
          <textarea
            name="internalNote"
            rows={2}
            placeholder="Ekip için not — müşteri görmez."
            className="w-full rounded-md border border-[var(--admin-border)] bg-neutral-50 px-3 py-2.5 text-base transition-colors outline-none focus:border-[var(--admin-primary)] focus:bg-white sm:text-sm"
          />
        </Field>

        {state.error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
          </div>
        )}
      </Card>

      <Card className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/admin/siparisler">
          <GhostButton type="button">Vazgeç</GhostButton>
        </Link>
        <PrimaryButton type="submit" disabled={pending}>
          {pending ? "Sipariş oluşturuluyor…" : "Siparişi oluştur"}
        </PrimaryButton>
      </Card>
    </form>
  );
}
