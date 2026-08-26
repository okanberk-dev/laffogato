"use client";

import Link from "next/link";
import {
  useActionState,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { type ProductActionState } from "@/app/admin/urunler/actions";
import type {
  AdminCategory,
  AdminProduct,
  AdminProductVariant,
} from "@/lib/admin/store";

import {
  Card,
  Checkbox,
  Field,
  formatTRY,
  GhostButton,
  PrimaryButton,
  Select,
  TextInput,
  Textarea,
} from "./forms";
import { ImageUpload } from "./image-upload";

const HUE_OPTIONS = [
  ["cream", "Krem"],
  ["warm", "Sıcak"],
  ["stone", "Taş"],
  ["caramel", "Karamel"],
  ["espresso", "Espresso"],
  ["matcha", "Matcha"],
  ["pistachio", "Pistachio"],
  ["rose", "Rose"],
  ["dawn", "Şafak"],
  ["gold", "Altın"],
  ["sky", "Gök"],
] as const;

function slugifyClient(input: string): string {
  const map: Record<string, string> = {
    ç: "c",
    Ç: "c",
    ğ: "g",
    Ğ: "g",
    ı: "i",
    I: "i",
    İ: "i",
    ö: "o",
    Ö: "o",
    ş: "s",
    Ş: "s",
    ü: "u",
    Ü: "u",
  };
  return input
    .trim()
    .toLowerCase()
    .replace(/[çÇğĞıIİöÖşŞüÜ]/g, (c) => map[c] ?? c)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function skuFromName(name: string, n = 1): string {
  const prefix = name
    .replace(/[^A-Za-z0-9]+/g, "")
    .slice(0, 4)
    .toUpperCase()
    .padEnd(4, "X");
  return `${prefix}-${String(n).padStart(5, "0")}`;
}

interface VariantRow {
  id: string;
  name: string;
  priceDelta: string;
  stock: string;
  sku: string;
  isActive: boolean;
}

function variantToRow(v: AdminProductVariant): VariantRow {
  return {
    id: v.id,
    name: v.name,
    priceDelta: (v.priceDeltaMinor / 100).toFixed(2),
    stock: String(v.stock),
    sku: v.sku,
    isActive: v.isActive,
  };
}

export interface ProductWizardProps {
  product?: AdminProduct;
  categories: AdminCategory[];
  action: (
    prev: ProductActionState,
    formData: FormData,
  ) => Promise<ProductActionState>;
  submitLabel: string;
  /** "wizard" walks step-by-step, "tabs" shows all sections at once. */
  mode: "wizard" | "tabs";
}

const initialState: ProductActionState = {};

export function ProductWizard({
  product,
  categories,
  action,
  submitLabel,
  mode,
}: ProductWizardProps) {
  const [state, formAction, pending] = useActionState(action, initialState);

  const [step, setStep] = useState(1);
  const totalSteps = 5;

  const [name, setName] = useState(product?.name ?? "");
  const [slug, setSlug] = useState(product?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(product?.slug));
  const [tag, setTag] = useState(product?.tag ?? "");
  const [desc, setDesc] = useState(product?.desc ?? "");
  const [cat, setCat] = useState(product?.cat ?? "beans");
  const [isActive, setIsActive] = useState(product?.isActive ?? true);

  const [price, setPrice] = useState(
    product ? (product.priceMinor / 100).toFixed(2) : "",
  );
  const [compareAtPrice, setCompareAtPrice] = useState(
    product && product.compareAtPriceMinor > 0
      ? (product.compareAtPriceMinor / 100).toFixed(2)
      : "",
  );
  const [cost, setCost] = useState(
    product && product.costMinor > 0
      ? (product.costMinor / 100).toFixed(2)
      : "",
  );
  const [sku, setSku] = useState(product?.sku ?? "");
  const [skuTouched, setSkuTouched] = useState(Boolean(product?.sku));
  const [stock, setStock] = useState(String(product?.stock ?? 0));
  const [lowStockThreshold, setLowStockThreshold] = useState(
    String(product?.lowStockThreshold ?? 5),
  );
  const [weightGrams, setWeightGrams] = useState(
    String(product?.weightGrams ?? 250),
  );

  const [variants, setVariants] = useState<VariantRow[]>(
    product?.variants?.map(variantToRow) ?? [],
  );

  const [img, setImg] = useState(product?.img ?? "cream");
  const initialImages = useMemo(() => product?.images ?? [], [product?.images]);
  const [seoTitle, setSeoTitle] = useState(product?.seoTitle ?? "");
  const [seoDescription, setSeoDescription] = useState(
    product?.seoDescription ?? "",
  );
  const [featured, setFeatured] = useState(product?.featured ?? false);
  const [isNew, setIsNew] = useState(product?.isNew ?? false);

  // Auto-fill slug + sku as the user types name (only if they haven't touched).
  useEffect(() => {
    if (!slugTouched) setSlug(slugifyClient(name));
    if (!skuTouched && name) setSku(skuFromName(name));
  }, [name, slugTouched, skuTouched]);

  const priceMinor = useMemo(() => {
    const v = parseFloat(price.replace(",", "."));
    return Number.isFinite(v) ? Math.round(v * 100) : 0;
  }, [price]);
  const compareMinor = useMemo(() => {
    const v = parseFloat(compareAtPrice.replace(",", "."));
    return Number.isFinite(v) ? Math.round(v * 100) : 0;
  }, [compareAtPrice]);
  const costMinor = useMemo(() => {
    const v = parseFloat(cost.replace(",", "."));
    return Number.isFinite(v) ? Math.round(v * 100) : 0;
  }, [cost]);

  const marginPct = useMemo(() => {
    if (priceMinor <= 0 || costMinor <= 0) return null;
    return Math.round(((priceMinor - costMinor) / priceMinor) * 100);
  }, [priceMinor, costMinor]);

  const discountPct = useMemo(() => {
    if (compareMinor <= 0 || priceMinor <= 0 || compareMinor <= priceMinor) {
      return null;
    }
    return Math.round(((compareMinor - priceMinor) / compareMinor) * 100);
  }, [compareMinor, priceMinor]);

  const variantsJson = useMemo(
    () =>
      JSON.stringify(
        variants.map((v) => ({
          id: v.id,
          name: v.name,
          priceDelta: v.priceDelta,
          stock: v.stock,
          sku: v.sku,
          isActive: v.isActive,
        })),
      ),
    [variants],
  );

  const fieldError = (key: string) => state.fieldErrors?.[key];

  const addVariant = () => {
    setVariants((vs) => [
      ...vs,
      {
        id: `var-${vs.length + 1}-${Date.now()}`,
        name: "",
        priceDelta: "0,00",
        stock: "0",
        sku: "",
        isActive: true,
      },
    ]);
  };
  const removeVariant = (i: number) => {
    setVariants((vs) => vs.filter((_, idx) => idx !== i));
  };
  const updateVariant = <K extends keyof VariantRow>(
    i: number,
    key: K,
    value: VariantRow[K],
  ) => {
    setVariants((vs) =>
      vs.map((v, idx) => (idx === i ? { ...v, [key]: value } : v)),
    );
  };

  const steps: Array<{ id: number; title: string; body: ReactNode }> = [
    {
      id: 1,
      title: "Temel bilgi",
      body: (
        <div className="grid gap-5">
          <Field
            label="Ürün adı"
            hint={fieldError("name") ?? "Müşterinin gördüğü ad — kısa, çekici."}
          >
            <TextInput
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              aria-invalid={Boolean(fieldError("name"))}
            />
          </Field>
          <div className="grid gap-5 md:grid-cols-2">
            <Field
              label="Slug"
              hint={
                fieldError("slug") ??
                "URL'de görünecek. Ad'dan otomatik üretilir; gerekirse override et."
              }
            >
              <TextInput
                name="slug"
                value={slug}
                onChange={(e) => {
                  setSlug(slugifyClient(e.target.value));
                  setSlugTouched(true);
                }}
                placeholder="sirena-espresso-blend"
              />
            </Field>
            <Field label="Etiket / alt başlık" hint={fieldError("tag")}>
              <TextInput
                name="tag"
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                placeholder="Whole Bean · 250g"
                required
              />
            </Field>
          </div>
          <Field label="Açıklama" hint={fieldError("desc")}>
            <Textarea
              name="desc"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              required
              rows={4}
            />
          </Field>
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Kategori">
              <Select
                name="cat"
                value={cat}
                onChange={(e) => setCat(e.target.value as typeof cat)}
              >
                {categories.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Yayın durumu">
              <Checkbox
                name="isActive"
                label="Aktif (vitrinde göster)"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
            </Field>
          </div>
        </div>
      ),
    },
    {
      id: 2,
      title: "Fiyatlandırma & stok",
      body: (
        <div className="grid gap-5">
          <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-3">
            <Field label="Satış fiyatı (₺)" hint={fieldError("price")}>
              <TextInput
                name="price"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="320,00"
                required
              />
            </Field>
            <Field
              label="Eski fiyat (was, ₺)"
              hint={
                discountPct !== null
                  ? `−%${discountPct} indirim olarak görünür`
                  : "Opsiyonel — boşsa indirim gösterilmez."
              }
            >
              <TextInput
                name="compareAtPrice"
                inputMode="decimal"
                value={compareAtPrice}
                onChange={(e) => setCompareAtPrice(e.target.value)}
                placeholder="360,00"
              />
            </Field>
            <Field
              label="Maliyet (₺)"
              hint={
                marginPct !== null
                  ? `Marj: %${marginPct}`
                  : "Müşteriye gizli; raporlama için."
              }
            >
              <TextInput
                name="cost"
                inputMode="decimal"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                placeholder="180,00"
              />
            </Field>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-3">
            <Field
              label="SKU"
              hint={
                fieldError("sku") ??
                "Stok-takip kodu. Ad'dan otomatik; override edebilirsin."
              }
            >
              <TextInput
                name="sku"
                value={sku}
                onChange={(e) => {
                  setSku(e.target.value.toUpperCase());
                  setSkuTouched(true);
                }}
                placeholder="SIRE-00001"
              />
            </Field>
            <Field label="Stok adet">
              <TextInput
                name="stock"
                type="number"
                min={0}
                value={stock}
                onChange={(e) => setStock(e.target.value)}
              />
            </Field>
            <Field
              label="Düşük stok uyarısı"
              hint="Bu seviyenin altına düşince admin tabloda turuncu görünür."
            >
              <TextInput
                name="lowStockThreshold"
                type="number"
                min={0}
                value={lowStockThreshold}
                onChange={(e) => setLowStockThreshold(e.target.value)}
              />
            </Field>
          </div>

          <Field label="Ağırlık (gram)" hint="Kargo hesabı için.">
            <TextInput
              name="weightGrams"
              type="number"
              min={0}
              value={weightGrams}
              onChange={(e) => setWeightGrams(e.target.value)}
            />
          </Field>
        </div>
      ),
    },
    {
      id: 3,
      title: "Varyantlar",
      body: (
        <div className="grid gap-5">
          <p className="text-sm text-neutral-600">
            Boyut, lezzet veya seçenek varyantları — örn. "Küçük", "250g",
            "Stracciatella". Her varyantın kendi stoğu ve fiyat delta'sı olur.
          </p>
          {variants.length === 0 ? (
            <Card className="bg-neutral-50 text-center">
              <p className="text-sm text-neutral-500">
                Henüz varyant eklenmedi. Bu ürün tek seçenekle satılır.
              </p>
              <button
                type="button"
                onClick={addVariant}
                className="mt-4 inline-flex items-center justify-center rounded-full border border-neutral-300 px-4 py-2 text-sm text-neutral-700 hover:border-[var(--admin-primary)] hover:text-[var(--admin-primary)]"
              >
                + Varyant ekle
              </button>
            </Card>
          ) : (
            <div>
              {/* Mobile cards */}
              <ul className="flex flex-col gap-3 md:hidden">
                {variants.map((v, i) => (
                  <li
                    key={v.id}
                    className="rounded-lg border border-[var(--admin-border)] p-3"
                  >
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Ad">
                        <TextInput
                          value={v.name}
                          onChange={(e) =>
                            updateVariant(i, "name", e.target.value)
                          }
                          placeholder="250g"
                        />
                      </Field>
                      <Field label="SKU">
                        <TextInput
                          value={v.sku}
                          onChange={(e) =>
                            updateVariant(
                              i,
                              "sku",
                              e.target.value.toUpperCase(),
                            )
                          }
                          placeholder="SIRE-V1"
                        />
                      </Field>
                      <Field label="Fiyat Δ (₺)">
                        <TextInput
                          value={v.priceDelta}
                          onChange={(e) =>
                            updateVariant(i, "priceDelta", e.target.value)
                          }
                          inputMode="decimal"
                          placeholder="0,00"
                        />
                      </Field>
                      <Field label="Stok">
                        <TextInput
                          value={v.stock}
                          onChange={(e) =>
                            updateVariant(i, "stock", e.target.value)
                          }
                          type="number"
                          min={0}
                        />
                      </Field>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <label className="flex min-h-[44px] items-center gap-2 text-sm text-neutral-700">
                        <input
                          type="checkbox"
                          checked={v.isActive}
                          onChange={(e) =>
                            updateVariant(i, "isActive", e.target.checked)
                          }
                          className="h-5 w-5 rounded border-neutral-300"
                        />
                        Aktif
                      </label>
                      <button
                        type="button"
                        onClick={() => removeVariant(i)}
                        className="min-h-[44px] text-xs text-red-600 underline-offset-4 hover:underline"
                      >
                        Bu varyantı sil
                      </button>
                    </div>
                  </li>
                ))}
              </ul>

              {/* Desktop table */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr
                      className="border-b border-[var(--admin-border)] text-left text-[10px] tracking-[0.22em] text-neutral-500 uppercase"
                      style={{ fontFamily: "var(--mono), monospace" }}
                    >
                      <th className="py-2 pr-3">Ad</th>
                      <th className="pr-3">Fiyat Δ (₺)</th>
                      <th className="pr-3">Stok</th>
                      <th className="pr-3">SKU</th>
                      <th className="pr-3">Aktif</th>
                      <th className="text-right">—</th>
                    </tr>
                  </thead>
                  <tbody>
                    {variants.map((v, i) => (
                      <tr
                        key={v.id}
                        className="border-b border-neutral-100 last:border-b-0"
                      >
                        <td className="py-2 pr-3">
                          <TextInput
                            value={v.name}
                            onChange={(e) =>
                              updateVariant(i, "name", e.target.value)
                            }
                            placeholder="250g"
                          />
                        </td>
                        <td className="pr-3">
                          <TextInput
                            value={v.priceDelta}
                            onChange={(e) =>
                              updateVariant(i, "priceDelta", e.target.value)
                            }
                            inputMode="decimal"
                            placeholder="0,00"
                          />
                        </td>
                        <td className="pr-3">
                          <TextInput
                            value={v.stock}
                            onChange={(e) =>
                              updateVariant(i, "stock", e.target.value)
                            }
                            type="number"
                            min={0}
                          />
                        </td>
                        <td className="pr-3">
                          <TextInput
                            value={v.sku}
                            onChange={(e) =>
                              updateVariant(
                                i,
                                "sku",
                                e.target.value.toUpperCase(),
                              )
                            }
                            placeholder="SIRE-V1"
                          />
                        </td>
                        <td className="pr-3">
                          <input
                            type="checkbox"
                            checked={v.isActive}
                            onChange={(e) =>
                              updateVariant(i, "isActive", e.target.checked)
                            }
                            className="h-4 w-4 rounded border-neutral-300"
                          />
                        </td>
                        <td className="text-right">
                          <button
                            type="button"
                            onClick={() => removeVariant(i)}
                            className="text-xs text-red-600 underline-offset-4 hover:underline"
                          >
                            Sil
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                type="button"
                onClick={addVariant}
                className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-full border border-neutral-300 px-4 text-sm text-neutral-700 hover:border-[var(--admin-primary)] hover:text-[var(--admin-primary)]"
              >
                + Varyant ekle
              </button>
            </div>
          )}
          <input type="hidden" name="variants" value={variantsJson} />
        </div>
      ),
    },
    {
      id: 4,
      title: "Görsel & SEO",
      body: (
        <div className="grid gap-5">
          <Field
            label="Görsel ton (placeholder)"
            hint="Gerçek fotoğraf yokken kullanılan gradient zemin."
          >
            <Select
              name="img"
              value={img}
              onChange={(e) => setImg(e.target.value)}
            >
              {HUE_OPTIONS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </Field>

          <div className="flex flex-col gap-2">
            <div
              className="text-[10px] tracking-[0.22em] text-neutral-500 uppercase"
              style={{ fontFamily: "var(--mono), monospace" }}
            >
              Görseller
            </div>
            <ImageUpload name="images" initial={initialImages} />
            <span className="text-xs text-neutral-500">
              Sürükle bırak, tıkla veya URL yapıştır. İlk görsel kart görseli
              olur. Yüklenen dosyalar tarayıcıda küçültülüp base64 olarak
              saklanır (nesne depolama gelene kadar).
            </span>
          </div>

          <div className="border-t border-[var(--admin-border)] pt-5">
            <div
              className="mb-3 text-[10px] tracking-[0.22em] text-neutral-500 uppercase"
              style={{ fontFamily: "var(--mono), monospace" }}
            >
              SEO
            </div>
            <div className="grid gap-5">
              <Field
                label="Meta başlık"
                hint={`${seoTitle.length}/80 karakter`}
              >
                <TextInput
                  name="seoTitle"
                  value={seoTitle}
                  onChange={(e) => setSeoTitle(e.target.value)}
                  maxLength={80}
                  placeholder="Sirena Espresso Blend · 250g · L’Affogato"
                />
              </Field>
              <Field
                label="Meta açıklama"
                hint={`${seoDescription.length}/220 karakter`}
              >
                <Textarea
                  name="seoDescription"
                  value={seoDescription}
                  onChange={(e) => setSeoDescription(e.target.value)}
                  maxLength={220}
                  rows={3}
                />
              </Field>
            </div>
          </div>

          <div className="grid gap-3 border-t border-[var(--admin-border)] pt-5 md:grid-cols-2">
            <Checkbox
              name="featured"
              label="Öne çıkan ürün"
              checked={featured}
              onChange={(e) => setFeatured(e.target.checked)}
            />
            <Checkbox
              name="isNew"
              label="Yeni rozeti"
              checked={isNew}
              onChange={(e) => setIsNew(e.target.checked)}
            />
          </div>
        </div>
      ),
    },
    {
      id: 5,
      title: "Özet & onayla",
      body: (
        <div className="grid gap-4">
          <Card className="bg-neutral-50">
            <SummaryRow k="Ad" v={name || "—"} />
            <SummaryRow k="Slug" v={slug || "—"} mono />
            <SummaryRow k="Kategori" v={cat} />
            <SummaryRow
              k="Fiyat"
              v={
                priceMinor > 0 ? (
                  <span>
                    {formatTRY(priceMinor)}
                    {compareMinor > priceMinor && (
                      <span className="ml-2 text-xs text-neutral-500 line-through">
                        {formatTRY(compareMinor)}
                      </span>
                    )}
                    {discountPct !== null && (
                      <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] tracking-[0.18em] text-amber-700 uppercase">
                        −%{discountPct}
                      </span>
                    )}
                  </span>
                ) : (
                  "—"
                )
              }
            />
            {costMinor > 0 && (
              <SummaryRow
                k="Maliyet · marj"
                v={`${formatTRY(costMinor)} · marj %${marginPct ?? 0}`}
                muted
              />
            )}
            <SummaryRow k="Stok" v={`${stock} adet`} />
            <SummaryRow k="SKU" v={sku || "—"} mono />
            {variants.length > 0 && (
              <SummaryRow
                k="Varyant"
                v={`${variants.length} varyant: ${variants.map((v) => v.name || "?").join(", ")}`}
              />
            )}
            <SummaryRow
              k="Bayraklar"
              v={
                [
                  isActive ? "Aktif" : "Pasif",
                  featured && "Öne çıkan",
                  isNew && "Yeni",
                ]
                  .filter(Boolean)
                  .join(" · ") || "—"
              }
              muted
            />
          </Card>

          {state.error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {state.error}
            </div>
          )}
        </div>
      ),
    },
  ];

  return (
    <form action={formAction} className="grid gap-6">
      {mode === "wizard" && (
        <Card>
          <div className="-mx-1 flex [scrollbar-width:none] items-center gap-2 overflow-x-auto px-1 [&::-webkit-scrollbar]:hidden">
            {steps.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStep(s.id)}
                className={`flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-xs transition-colors ${
                  step === s.id
                    ? "bg-[var(--admin-primary)] text-white"
                    : step > s.id
                      ? "bg-neutral-100 text-neutral-700"
                      : "border border-[var(--admin-border)] text-neutral-500"
                }`}
              >
                <span
                  className="inline-grid h-5 w-5 place-items-center rounded-full text-[10px]"
                  style={{
                    background:
                      step >= s.id ? "rgba(255,255,255,0.15)" : "transparent",
                    border: step >= s.id ? "none" : "1px solid currentColor",
                  }}
                >
                  {s.id}
                </span>
                <span className="whitespace-nowrap">{s.title}</span>
              </button>
            ))}
          </div>
        </Card>
      )}

      {steps.map((s) => {
        const visible = mode === "tabs" || step === s.id;
        return (
          <Card
            key={s.id}
            style={
              visible ? undefined : ({ display: "none" } as React.CSSProperties)
            }
          >
            {mode === "tabs" && (
              <h2
                className="mb-5 text-xl"
                style={{
                  fontFamily: "var(--serif), 'Playfair Display', serif",
                  fontStyle: "italic",
                  fontWeight: 500,
                }}
              >
                {s.id}. {s.title}
              </h2>
            )}
            {s.body}
          </Card>
        );
      })}

      <Card className="flex flex-wrap items-center justify-between gap-4">
        {mode === "wizard" ? (
          <>
            <div className="flex gap-2">
              <GhostButton
                type="button"
                onClick={() => setStep((s) => Math.max(1, s - 1))}
                disabled={step === 1}
              >
                ← Geri
              </GhostButton>
              {step < totalSteps && (
                <PrimaryButton
                  type="button"
                  onClick={() => setStep((s) => Math.min(totalSteps, s + 1))}
                >
                  Sonraki adım →
                </PrimaryButton>
              )}
            </div>
            <div className="flex gap-2">
              <Link href="/admin/urunler">
                <GhostButton type="button">Vazgeç</GhostButton>
              </Link>
              {step === totalSteps && (
                <PrimaryButton type="submit" disabled={pending}>
                  {pending ? "Kaydediliyor…" : submitLabel}
                </PrimaryButton>
              )}
            </div>
          </>
        ) : (
          <>
            <div
              className="text-[10px] tracking-[0.22em] text-neutral-500 uppercase"
              style={{ fontFamily: "var(--mono), monospace" }}
            >
              {state.error
                ? state.error
                : "Tüm sekmeler tek formda kaydedilir."}
            </div>
            <div className="flex gap-2">
              <Link href="/admin/urunler">
                <GhostButton type="button">Vazgeç</GhostButton>
              </Link>
              <PrimaryButton type="submit" disabled={pending}>
                {pending ? "Kaydediliyor…" : submitLabel}
              </PrimaryButton>
            </div>
          </>
        )}
      </Card>
    </form>
  );
}

function SummaryRow({
  k,
  v,
  mono,
  muted,
}: {
  k: string;
  v: ReactNode;
  mono?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="grid gap-1 border-b border-[var(--admin-border)] py-2 last:border-b-0 sm:grid-cols-[150px_1fr] sm:gap-3">
      <div
        className="text-[10px] tracking-[0.22em] text-neutral-500 uppercase"
        style={{ fontFamily: "var(--mono), monospace" }}
      >
        {k}
      </div>
      <div
        className={`text-sm ${muted ? "text-neutral-500" : "text-neutral-900"}`}
        style={mono ? { fontFamily: "var(--mono), monospace" } : undefined}
      >
        {v}
      </div>
    </div>
  );
}
