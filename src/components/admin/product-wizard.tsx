"use client";

import Link from "next/link";
import {
  useActionState,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { flushSync } from "react-dom";

import { type ProductActionState } from "@/app/admin/urunler/actions";
import { skuPrefix } from "@/lib/admin/sku";
import {
  readPostedStock,
  rebaseStockSnapshots,
  variantStockTotal,
} from "@/lib/admin/stock-delta";
import { photoKind } from "@/lib/backdrop/scene-core";
import { parseMoneyInput } from "@/lib/utils/format";
import {
  KDV_RATE_CHOICES,
  LEGAL_TAX_RATES,
  productTaxRate,
  type TaxRates,
} from "@/lib/utils/kdv";
import type {
  AdminCategory,
  AdminProduct,
  AdminProductVariant,
} from "@/lib/admin/store";

import {
  markFieldErrors,
  PANEL_ACTION_FAILED,
  useHandPost,
  withPanelCatch,
} from "./action-form";
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
import { BackdropField } from "./backdrop-field";
import { ImageUpload } from "./image-upload";
import { BUTTON } from "./ui/styles";

const HUE_OPTIONS = [
  ["cream", "Krem"],
  ["warm", "Sıcak"],
  ["stone", "Taş"],
  ["caramel", "Karamel"],
  ["espresso", "Espresso"],
  ["matcha", "Matcha"],
  ["pistachio", "Antep fıstığı"],
  ["rose", "Gül"],
  ["dawn", "Şafak"],
  ["gold", "Altın"],
  ["sky", "Gök"],
] as const;

/**
 * Allergens, as a closed list - the operator picks, never types.
 *
 * The values are the cafe menu's own tag vocabulary (`menu_items.tags`), and
 * the app filters every tag it receives against that same list and drops
 * anything else without a word. So a free-text box here could store "fıstık"
 * or "NUTS " and publish an allergen that no customer would ever see, which
 * is exactly the failure this list rules out. `nuts` is the only allergen the
 * vocabulary carries today; adding a second one means adding it to the app's
 * `ItemTag` union and `PRODUCT_TAG_VALUES` in the same release.
 */
const ALLERGEN_OPTIONS = [
  ["nuts", "Sert kabuklu yemiş (fındık · fıstık)"],
] as const;

/**
 * Which step holds each posted field, so a refusal can open the step with
 * the field in it and mark its pill. A key the server answers under that is
 * not here (a "form" error) belongs to the summary. Exported for tests.
 */
export const FIELD_STEP: Readonly<Record<string, number>> = {
  name: 1,
  slug: 1,
  tag: 1,
  desc: 1,
  brand: 1,
  notes: 1,
  cat: 1,
  isActive: 1,
  tags: 1,
  price: 2,
  compareAtPrice: 2,
  cost: 2,
  sku: 2,
  stock: 2,
  stockAtOpen: 2,
  saveToken: 2,
  stockFromVariants: 2,
  lowStockThreshold: 2,
  weightGrams: 2,
  taxRatePct: 2,
  variants: 3,
  img: 4,
  images: 4,
  backdrop: 4,
  vessel: 4,
  seoTitle: 4,
  seoDescription: 4,
  featured: 4,
  isNew: 4,
};

const SUMMARY_STEP = 5;

export function stepOfField(key: string): number {
  return FIELD_STEP[key.split(".")[0]] ?? SUMMARY_STEP;
}

/** The first step holding a refused field, or null when none is refused. */
export function firstErrorStep(
  fieldErrors?: Record<string, string>,
): number | null {
  const keys = Object.keys(fieldErrors ?? {});
  return keys.length > 0 ? Math.min(...keys.map(stepOfField)) : null;
}

type Validatable = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

/** The controls under `root` the browser would refuse, in document order. */
function invalidControls(root: ParentNode): Validatable[] {
  return Array.from(
    root.querySelectorAll<Validatable>("input, select, textarea"),
  ).filter((el) => el.willValidate && !el.validity.valid);
}

/** The wizard step a control sits in (its `data-step` wrapper), or 0. */
function stepOfControl(el: Element): number {
  return Number(el.closest("[data-step]")?.getAttribute("data-step") ?? 0);
}

/**
 * The browser-side check before a post: every step holding an invalid
 * control, and the step of the first one (0 when it sits outside the
 * steps). Exported for tests.
 */
export function checkSteps(
  root: ParentNode,
): { ok: true } | { ok: false; steps: number[]; first: number } {
  const bad = invalidControls(root);
  if (bad.length === 0) return { ok: true };
  return {
    ok: false,
    steps: [...new Set(bad.map(stepOfControl).filter((s) => s > 0))],
    first: stepOfControl(bad[0]),
  };
}

/**
 * Shows the browser's own message on the first invalid control under
 * `root` that is drawn. Variant rows are rendered twice (cards on a phone,
 * a table on a wide screen) and the browser cannot show its bubble on the
 * copy that is hidden. Exported for tests.
 */
export function reportFirstInvalid(root: ParentNode): boolean {
  const bad = invalidControls(root);
  const target = bad.find((el) => el.getClientRects().length > 0) ?? bad[0];
  target?.reportValidity();
  return Boolean(target);
}

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

interface VariantRow {
  id: string;
  name: string;
  priceDelta: string;
  stock: string;
  sku: string;
  isActive: boolean;
}

/** A token for one opened product form (see `saveToken` in the wizard). */
export function newSaveToken(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return uuid;
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
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
  /** KDV defaults from Ayarlar > Vergi, to name the category's rate. */
  taxRates?: TaxRates;
}

const initialState: ProductActionState = {};

/**
 * The product form: a five-step wizard for a new product, every section on
 * one page for an edit.
 *
 * It posts by hand (useHandPost), not through `<form action>`: React
 * resets an action form after every answer, so a refused save came back
 * with the category, the scene and the image tone on their first option and
 * the Aktif / Öne çıkan boxes flipped, and the next save stored them
 * (admin audit CAT-01). The browser's own validation is off (`noValidate`):
 * on step 5 the earlier steps are hidden, the browser cannot show its
 * message on a hidden field and silently dropped the submit (CAT-02). The
 * form checks itself instead, opens the step with the first problem and
 * shows the message there; a server refusal does the same and marks the
 * step pills that hold errors. A thrown save answers in place (CAT-17).
 */
export function ProductWizard({
  product,
  categories,
  action,
  submitLabel,
  mode,
  taxRates = LEGAL_TAX_RATES,
}: ProductWizardProps) {
  const [step, setStep] = useState(1);
  const totalSteps = 5;

  /* The stock the form was opened with (admin audit CAT-03). The save
     moves stock by what was typed since, so an order taken while the form
     is open keeps its decrement. A save refused for stock answers with the
     stored counts: a count whose change would still go below zero is
     measured from the stored one next time, every other keeps its own
     (rebaseStockSnapshots). */
  const [stockSnapshot, setStockSnapshot] = useState<number | null>(
    product ? product.stock : null,
  );
  const [variantSnapshots, setVariantSnapshots] = useState<
    Record<string, number>
  >(() =>
    Object.fromEntries((product?.variants ?? []).map((v) => [v.id, v.stock])),
  );

  /* One token for every save of this opened form: when an answer is lost
     after the write (a dropped connection) and the operator saves again,
     the stock moves once (product_form_saves). Made at the first save, not
     in render, so the server markup and the browser agree. */
  const saveToken = useRef<string | null>(null);

  const save = withPanelCatch<ProductActionState>(action, () => ({
    error: PANEL_ACTION_FAILED,
  }));
  const [state, formAction, pending] = useActionState(
    async (prev: ProductActionState, formData: FormData) => {
      saveToken.current ??= newSaveToken();
      formData.set("saveToken", saveToken.current);
      const next = await save(prev, formData);
      if (next.stockNow) {
        // Read back from what was posted, not from state that may have
        // moved on while the save was out.
        const rebased = rebaseStockSnapshots(
          readPostedStock({
            stock: formData.get("stock"),
            stockAtOpen: formData.get("stockAtOpen"),
            variants: formData.get("variants"),
          }),
          next.stockNow,
        );
        setStockSnapshot(rebased.stock);
        setVariantSnapshots((was) => ({ ...was, ...rebased.variants }));
      }
      // Open the step that holds the first refused field.
      const target = firstErrorStep(next.fieldErrors);
      if (target !== null) setStep(target);
      return next;
    },
    initialState,
  );

  const formRef = useRef<HTMLFormElement>(null);
  const baseId = useId();
  const errorId = (key: string) => `${baseId}-err-${key}`;
  // Steps the last check in the browser found a problem in.
  const [invalidSteps, setInvalidSteps] = useState<number[]>([]);

  const [name, setName] = useState(product?.name ?? "");
  /* A product saved without a slug starts with the one its name implies,
     exactly what the old mount-time effect filled in. */
  const [slug, setSlug] = useState(
    product?.slug || slugifyClient(product?.name ?? ""),
  );
  const [slugTouched, setSlugTouched] = useState(Boolean(product?.slug));
  const [tag, setTag] = useState(product?.tag ?? "");
  const [desc, setDesc] = useState(product?.desc ?? "");
  const [brand, setBrand] = useState(product?.brand ?? "");
  const [notes, setNotes] = useState((product?.notes ?? []).join(", "));
  const [cat, setCat] = useState(
    product?.cat ?? categories[0]?.slug ?? "beans",
  );
  const [isActive, setIsActive] = useState(product?.isActive ?? true);
  const [allergens, setAllergens] = useState<string[]>(
    (product?.tags ?? []).filter((t) =>
      ALLERGEN_OPTIONS.some(([v]) => v === t),
    ),
  );

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
  // Empty unless typed: the server then derives a code numbered by the
  // product's own sequence (CAT-18). A prefilled "-00001" was posted as is
  // and two products with the same first letters shared one SKU.
  const [sku, setSku] = useState(product?.sku ?? "");
  const [stock, setStock] = useState(String(product?.stock ?? 0));
  const [lowStockThreshold, setLowStockThreshold] = useState(
    String(product?.lowStockThreshold ?? 5),
  );
  // Empty (not shown) unless known: a default of 250 g was published on the
  // product page and to Google for a mug or an apron (CAT-M02, D20).
  const [weightGrams, setWeightGrams] = useState(
    product?.weightGrams ? String(product.weightGrams) : "",
  );
  // "" = the category's default; a number = the product's own rate.
  const [taxRate, setTaxRate] = useState(
    typeof product?.taxRatePct === "number" ? String(product.taxRatePct) : "",
  );
  const categoryTaxRate = productTaxRate({ cat }, taxRates);
  const effectiveTaxRate = taxRate === "" ? categoryTaxRate : Number(taxRate);
  // A stored rate the standard list does not have stays selectable.
  const taxRateChoices = KDV_RATE_CHOICES.includes(effectiveTaxRate)
    ? KDV_RATE_CHOICES
    : [...KDV_RATE_CHOICES, effectiveTaxRate].sort((a, b) => a - b);

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

  /* Auto-fill the slug as the operator types the name, until it has been
     edited by hand. Done in the change handler, not an effect, so both
     fields update in one render. */
  const onNameChange = (next: string) => {
    setName(next);
    if (!slugTouched) setSlug(slugifyClient(next));
  };

  // The preview reads the amounts the way the save does (parseMoneyInput):
  // "1.250,00" is 1.250 TL here too, not the 1,25 TL parseFloat made of it.
  const priceMinor = useMemo(() => parseMoneyInput(price) ?? 0, [price]);
  const compareMinor = useMemo(
    () => parseMoneyInput(compareAtPrice) ?? 0,
    [compareAtPrice],
  );
  const costMinor = useMemo(() => parseMoneyInput(cost) ?? 0, [cost]);

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
          // Null for a row added here: it starts at the stock typed.
          stockAtOpen: variantSnapshots[v.id] ?? null,
        })),
      ),
    [variants, variantSnapshots],
  );

  /* With variants the product's total is theirs, not typed (D16): what the
     save will make of it, the way save_product_variants counts it. */
  const hasVariants = variants.length > 0;
  const typedVariantSum = useMemo(
    () =>
      variantStockTotal(
        variants.map((v) => ({
          stock: Number.parseInt(v.stock, 10) || 0,
          isActive: v.isActive,
        })),
      ),
    [variants],
  );
  const variantTotal = useMemo(() => {
    const stored = (product?.variants ?? []).map((v) => ({
      stock: variantSnapshots[v.id] ?? v.stock,
      isActive: v.isActive,
    }));
    if (stored.length === 0 || stockSnapshot === null) return typedVariantSum;
    return Math.max(
      0,
      stockSnapshot + typedVariantSum - variantStockTotal(stored),
    );
  }, [typedVariantSum, product?.variants, variantSnapshots, stockSnapshot]);

  /* The total moves by deltas, so a unit sold without a variant (the shop
     card's quick add) and then corrected on a variant on Stok takes it down
     twice (admin audit CAT-14). When it stands apart from the active
     variants the operator can set it to them (`stockFromVariants`); nothing
     else sets it. */
  const [totalFromVariants, setTotalFromVariants] = useState(false);
  const totalApart = hasVariants && variantTotal !== typedVariantSum;
  const shownTotal =
    totalApart && totalFromVariants ? typedVariantSum : variantTotal;

  /**
   * What the `tags` field posts: the allergens ticked above, plus any tag the
   * row already carried that this form does not offer (`signature`, `new`,
   * `iced`). Dropping those on every save would make an edit to the price
   * quietly strip a badge nobody meant to touch.
   */
  const tagsValue = useMemo(() => {
    const kept = (product?.tags ?? []).filter(
      (t) => !ALLERGEN_OPTIONS.some(([v]) => v === t),
    );
    return [...new Set([...allergens, ...kept])].join(", ");
  }, [allergens, product?.tags]);

  const fieldError = (key: string) => state.fieldErrors?.[key];

  /** The refusal under a field: danger ink, announced, tied by its id. */
  const errorFor = (key: string) => {
    const message = fieldError(key);
    if (!message) return null;
    return (
      <p
        id={errorId(key)}
        role="alert"
        tabIndex={-1}
        className="text-xs text-[var(--admin-danger-ink)]"
      >
        {message}
      </p>
    );
  };

  // Steps holding a field the server refused, plus what the browser found.
  const flaggedSteps = new Set<number>([
    ...Object.keys(state.fieldErrors ?? {}).map(stepOfField),
    ...invalidSteps,
  ]);

  // After each answer: mark the refused controls for assistive tech and put
  // focus on the first one (its step is already open, see the action
  // above). A refusal with no control of its own (Varyantlar) focuses its
  // message instead.
  useEffect(() => {
    const form = formRef.current;
    if (!form || state === initialState) return;
    const errors = state.fieldErrors ?? {};
    const first = markFieldErrors(
      Array.from(form.elements),
      errors,
      (key) => `${baseId}-err-${key}`,
    );
    // A control on a step that is not open cannot take focus (Varyantlar
    // and a later field refused together): its step's message does.
    if (first instanceof HTMLElement && first.getClientRects().length > 0) {
      first.focus();
      return;
    }
    const [firstKey] = Object.keys(errors).sort(
      (a, b) => stepOfField(a) - stepOfField(b),
    );
    if (firstKey) document.getElementById(`${baseId}-err-${firstKey}`)?.focus();
  }, [state, baseId]);

  /**
   * The check the browser no longer runs on its own: before the post, find
   * every invalid field, mark its step, open the step of the first one and
   * show the browser's message there. Nothing is sent until all are fixed.
   */
  const beforeSubmit = (form: HTMLFormElement) => {
    const check = checkSteps(form);
    setInvalidSteps(check.ok ? [] : check.steps);
    if (check.ok) return true;
    const target = check.first || step;
    if (mode === "wizard" && target !== step) {
      // Render the step now, so its field can show the message.
      flushSync(() => setStep(target));
    }
    reportFirstInvalid(form.querySelector(`[data-step="${target}"]`) ?? form);
    return false;
  };

  const post = useHandPost(formAction, pending, { beforeSubmit });

  /** "Sonraki adım": only once this step's fields are fine. */
  const goNext = () => {
    const root = formRef.current?.querySelector(`[data-step="${step}"]`);
    if (root && reportFirstInvalid(root)) {
      setInvalidSteps((prev) => [...new Set([...prev, step])]);
      return;
    }
    setInvalidSteps((prev) => prev.filter((s) => s !== step));
    setStep((s) => Math.min(totalSteps, s + 1));
  };

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

  const categoryLabel = categories.find((c) => c.slug === cat)?.label ?? cat;
  // An emptied SKU field keeps the stored code on an edit (updateProduct);
  // only a product without one gets a new code. The hint and the summary
  // say which, so the CSV import's match key does not change unseen.
  const storedSku = product?.sku ?? "";
  const skuPlaceholder = storedSku
    ? storedSku
    : name
      ? `${skuPrefix(name)}-00042`
      : "SIRE-00042";

  const steps: Array<{ id: number; title: string; body: ReactNode }> = [
    {
      id: 1,
      title: "Temel bilgi",
      body: (
        <div className="grid gap-5">
          <div className="grid gap-1.5">
            <Field
              label="Ürün adı"
              hint="Müşterinin gördüğü ad: kısa ve açık."
            >
              <TextInput
                name="name"
                value={name}
                onChange={(e) => onNameChange(e.target.value)}
                required
                minLength={2}
                maxLength={120}
              />
            </Field>
            {errorFor("name")}
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <div className="grid gap-1.5">
              <Field
                label="Adres (slug)"
                hint="Ürün sayfasının adresinde görünür. Addan üretilir; istersen değiştir."
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
              {errorFor("slug")}
            </div>
            <div className="grid gap-1.5">
              <Field
                label="Etiket / alt başlık"
                hint="Kartta adın altında görünür."
              >
                <TextInput
                  name="tag"
                  value={tag}
                  onChange={(e) => setTag(e.target.value)}
                  placeholder="Çekirdek · 250 g"
                  required
                  maxLength={80}
                />
              </Field>
              {errorFor("tag")}
            </div>
          </div>
          <div className="grid gap-1.5">
            <Field label="Açıklama">
              <Textarea
                name="desc"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                required
                maxLength={2000}
                rows={4}
              />
            </Field>
            {errorFor("desc")}
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <div className="grid gap-1.5">
              <Field
                label="Marka (künye)"
                hint="Uygulamada ürün adının üstünde, yazdığın büyük/küçük harflerle görünür; otomatik büyütülmez. Boş bırakırsan gösterilmez."
              >
                <TextInput
                  name="brand"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  maxLength={40}
                  placeholder="Sirena"
                />
              </Field>
              {errorFor("brand")}
            </div>
            <div className="grid gap-1.5">
              <Field
                label="Tat notları"
                hint="Virgülle ayır; en fazla 5 not, her biri en fazla 24 karakter. Uygulamada başlığın altında çip olarak görünür; açıklama her durumda tamamen gösterilir."
              >
                <TextInput
                  name="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Kakao, Kuru incir, Esmer şeker"
                />
              </Field>
              {errorFor("notes")}
            </div>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <div className="grid gap-1.5">
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
              {errorFor("cat")}
            </div>
            <Field as="fieldset" label="Yayın durumu">
              <Checkbox
                name="isActive"
                label="Aktif (mağazada göster)"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
            </Field>
          </div>
          {/* A fieldset, not a label: inside a label a tap on the hint
              ticked or unticked the nut box, and with it the customer's
              allergen warning (admin audit SYS-M02). */}
          <Field
            as="fieldset"
            label="Alerjen"
            hint="Ürün içeriyorsa işaretle. Ürün sayfasında ve sepette uyarı olarak görünür - gizlenmez."
          >
            <div className="grid gap-1">
              {ALLERGEN_OPTIONS.map(([value, label]) => (
                <Checkbox
                  key={value}
                  label={label}
                  checked={allergens.includes(value)}
                  onChange={(e) =>
                    setAllergens((prev) =>
                      e.target.checked
                        ? [...new Set([...prev, value])]
                        : prev.filter((t) => t !== value),
                    )
                  }
                />
              ))}
            </div>
          </Field>
          <input type="hidden" name="tags" value={tagsValue} />
        </div>
      ),
    },
    {
      id: 2,
      title: "Fiyat ve stok",
      body: (
        <div className="grid gap-5">
          <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-3">
            <div className="grid gap-1.5">
              <Field
                label="Satış fiyatı (₺)"
                hint="KDV dahil, en az 0,01 TL."
              >
                <TextInput
                  name="price"
                  inputMode="decimal"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="320,00"
                  required
                />
              </Field>
              {errorFor("price")}
            </div>
            <div className="grid gap-1.5">
              <Field
                label="Eski fiyat (₺)"
                hint={
                  discountPct !== null
                    ? `−%${discountPct} indirim olarak görünür`
                    : "İsteğe bağlı. Satış fiyatından yüksekse üstü çizili görünür."
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
              {errorFor("compareAtPrice")}
            </div>
            <div className="grid gap-1.5">
              <Field
                label="Maliyet (₺)"
                hint={
                  marginPct !== null
                    ? `Marj: %${marginPct}`
                    : "Müşteri görmez; marj hesabı için."
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
              {errorFor("cost")}
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-3">
            <div className="grid gap-1.5">
              <Field
                label="SKU"
                hint={
                  storedSku
                    ? "Stok takip kodu, CSV içe aktarmada ürünü bulan anahtar. Boş bırakırsan kayıtlı kod kalır."
                    : "Stok takip kodu. Boş bırakırsan kayıtta addan üretilir, her ürüne ayrı numarayla."
                }
              >
                <TextInput
                  name="sku"
                  value={sku}
                  onChange={(e) => setSku(e.target.value.toUpperCase())}
                  maxLength={40}
                  placeholder={skuPlaceholder}
                />
              </Field>
              {errorFor("sku")}
            </div>
            <div className="grid gap-1.5">
              {hasVariants ? (
                <Field
                  label="Toplam stok (adet)"
                  hint={
                    totalApart
                      ? `Toplam aktif varyantlardan (${typedVariantSum} adet) farklı: varyant seçilmeden satılan adet yalnız toplamdan düşer. Varyant stokları raftakiyle aynıysa toplamı onlara eşitle.`
                      : "Aktif varyantların stoğundan gelir. Varyant stoğunu Varyantlar adımında ya da Stok ekranında değiştir."
                  }
                >
                  {/* Not a field: nothing to type. An output is labelable,
                      so the label still names it. */}
                  <output className="block w-full rounded-xl border border-dashed border-[var(--admin-border-strong)] px-3.5 py-2.5 text-base text-[var(--admin-text)] sm:text-sm">
                    {shownTotal} adet
                  </output>
                </Field>
              ) : (
                <Field
                  label="Stok (adet)"
                  hint={
                    product
                      ? "Form açıkken gelen siparişler kaybolmaz: kayıt yalnız senin yaptığın değişikliği uygular."
                      : undefined
                  }
                >
                  <TextInput
                    name="stock"
                    type="number"
                    min={0}
                    step={1}
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                  />
                </Field>
              )}
              {totalApart && (
                <Checkbox
                  name="stockFromVariants"
                  label={`Toplamı aktif varyantlara eşitle (${typedVariantSum} adet)`}
                  checked={totalFromVariants}
                  onChange={(e) => setTotalFromVariants(e.target.checked)}
                />
              )}
              {stockSnapshot !== null && (
                <input
                  type="hidden"
                  name="stockAtOpen"
                  value={String(stockSnapshot)}
                />
              )}
              {errorFor("stock")}
            </div>
            <div className="grid gap-1.5">
              <Field
                label="Düşük stok uyarısı"
                hint={
                  'Stok bu sayıya inince panelde turuncu görünür, mağazada "Son N adet" rozeti çıkar.'
                }
              >
                <TextInput
                  name="lowStockThreshold"
                  type="number"
                  min={0}
                  step={1}
                  value={lowStockThreshold}
                  onChange={(e) => setLowStockThreshold(e.target.value)}
                />
              </Field>
              {errorFor("lowStockThreshold")}
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Field
                label="Ağırlık (gram)"
                hint="Ürün sayfasında ve Google'da görünür. Boş bırakırsan gösterilmez; kargo ücretini değiştirmez."
              >
                <TextInput
                  name="weightGrams"
                  type="number"
                  min={0}
                  step={1}
                  value={weightGrams}
                  onChange={(e) => setWeightGrams(e.target.value)}
                  placeholder="Ör. 250"
                />
              </Field>
              {errorFor("weightGrams")}
            </div>
            <div className="grid gap-1.5">
              <Field
                label="KDV oranı"
                hint="Fiyat KDV dahil; oran fiyatı değiştirmez. Kahve ve gıda %1, ekipman ve hediye %20. Varsayılanlar Ayarlar > Vergi'de."
              >
                <Select
                  name="taxRatePct"
                  value={taxRate}
                  onChange={(e) => setTaxRate(e.target.value)}
                >
                  <option value="">Kategorinin oranı (%{categoryTaxRate})</option>
                  {taxRateChoices.map((r) => (
                    <option key={r} value={String(r)}>
                      %{r}
                    </option>
                  ))}
                </Select>
              </Field>
              {errorFor("taxRatePct")}
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 3,
      title: "Varyantlar",
      body: (
        <div className="grid gap-5">
          <p className="text-sm text-[var(--admin-text-soft)]">
            Boyut ya da lezzet seçenekleri, ör. &quot;250 g&quot;, &quot;1
            kg&quot;, &quot;Stracciatella&quot;. Her varyantın kendi stoğu ve
            satış fiyatına eklenen (ucuzsa düşülen) fiyat farkı olur; ürünün
            toplam stoğu aktif varyantların stoğundan gelir. Tek seçenekle
            satılan ürüne varyant eklemen gerekmez.
          </p>
          {errorFor("variants")}
          {variants.length === 0 ? (
            <Card className="bg-neutral-50 text-center">
              <p className="text-sm text-[var(--admin-text-soft)]">
                Henüz varyant yok. Bu ürün tek seçenekle satılır.
              </p>
              <button
                type="button"
                onClick={addVariant}
                className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-full border border-neutral-300 px-4 text-sm text-neutral-700 hover:border-[var(--admin-primary)] hover:text-[var(--admin-primary)]"
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
                          placeholder="250 g"
                          required
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
                      <Field
                        label="Fiyat farkı (₺)"
                        hint="Ucuzsa başına - koy: -10,50"
                      >
                        {/* No decimal keypad: on iOS it has no minus key. */}
                        <TextInput
                          value={v.priceDelta}
                          onChange={(e) =>
                            updateVariant(i, "priceDelta", e.target.value)
                          }
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
                          step={1}
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
                      <th className="pr-3">Fiyat farkı (₺)</th>
                      <th className="pr-3">Stok</th>
                      <th className="pr-3">SKU</th>
                      <th className="pr-3">Aktif</th>
                      <th className="text-right">
                        <span className="sr-only">Sil</span>
                      </th>
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
                            aria-label={`${i + 1}. varyantın adı`}
                            value={v.name}
                            onChange={(e) =>
                              updateVariant(i, "name", e.target.value)
                            }
                            placeholder="250 g"
                            required
                          />
                        </td>
                        <td className="pr-3">
                          <TextInput
                            aria-label={`${i + 1}. varyantın fiyat farkı`}
                            value={v.priceDelta}
                            onChange={(e) =>
                              updateVariant(i, "priceDelta", e.target.value)
                            }
                            placeholder="0,00"
                          />
                        </td>
                        <td className="pr-3">
                          <TextInput
                            aria-label={`${i + 1}. varyantın stoğu`}
                            value={v.stock}
                            onChange={(e) =>
                              updateVariant(i, "stock", e.target.value)
                            }
                            type="number"
                            min={0}
                            step={1}
                          />
                        </td>
                        <td className="pr-3">
                          <TextInput
                            aria-label={`${i + 1}. varyantın SKU'su`}
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
                            aria-label={`${i + 1}. varyant aktif`}
                            checked={v.isActive}
                            onChange={(e) =>
                              updateVariant(i, "isActive", e.target.checked)
                            }
                            className="h-5 w-5 rounded border-neutral-300 accent-[var(--admin-primary)]"
                          />
                        </td>
                        <td className="text-right">
                          <button
                            type="button"
                            onClick={() => removeVariant(i)}
                            aria-label={`Sil: ${v.name || `${i + 1}. varyant`}`}
                            className="min-h-[44px] text-xs text-red-600 underline-offset-4 hover:underline"
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
            label="Görsel tonu"
            hint="Fotoğraf yokken sitedeki kartın çizim rengi. Uygulamada sahne seçiminin ipucu; seçim yoksa sahne bu tondan gelir."
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
              className="text-[10px] tracking-[0.22em] text-[var(--admin-text-mute)] uppercase"
              style={{ fontFamily: "var(--mono), monospace" }}
            >
              Görseller
            </div>
            <ImageUpload name="images" initial={initialImages} />
            <span className="text-xs text-[var(--admin-text-mute)]">
              Sürükle bırak, tıkla ya da bağlantı yapıştır. İlk görsel kartta
              görünür, uygulamanın sahnesi de ondan seçilir. Dosyalar
              yüklenmeden önce küçültülür; arka planı saydam (dekupe) fotoğraf
              saydam kalır.
            </span>
          </div>

          <div className="border-t border-[var(--admin-border)] pt-5">
            <BackdropField
              stored={product}
              photo={photoKind(initialImages[0])}
              hue={img}
              category={cat}
            />
          </div>

          <div className="border-t border-[var(--admin-border)] pt-5">
            <div
              className="mb-3 text-[10px] tracking-[0.22em] text-[var(--admin-text-mute)] uppercase"
              style={{ fontFamily: "var(--mono), monospace" }}
            >
              SEO
            </div>
            <div className="grid gap-5">
              <div className="grid gap-1.5">
                <Field
                  label="Meta başlık"
                  hint={`${seoTitle.length}/80 karakter. Boşsa ürün adı kullanılır.`}
                >
                  <TextInput
                    name="seoTitle"
                    value={seoTitle}
                    onChange={(e) => setSeoTitle(e.target.value)}
                    maxLength={80}
                    placeholder="Sirena Espresso Blend · 250g · L’Affogato"
                  />
                </Field>
                {errorFor("seoTitle")}
              </div>
              <div className="grid gap-1.5">
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
                {errorFor("seoDescription")}
              </div>
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
          <p className="text-sm text-[var(--admin-text-soft)]">
            Kaydetmeden önce bir bak. Bir şeyi değiştirmek için üstteki adıma
            dokun.
          </p>
          <Card className="bg-neutral-50">
            <SummaryRow k="Ad" v={name || "-"} />
            <SummaryRow k="Adres" v={slug || "-"} mono />
            <SummaryRow k="Kategori" v={categoryLabel} />
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
                  "Yazılmadı"
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
            <SummaryRow
              k="KDV"
              v={`%${effectiveTaxRate} dahil${taxRate === "" ? " (kategorinin oranı)" : ""}`}
            />
            <SummaryRow
              k="Alerjen"
              v={
                allergens.length > 0
                  ? allergens
                      .map(
                        (t) =>
                          ALLERGEN_OPTIONS.find(([v]) => v === t)?.[1] ?? t,
                      )
                      .join(" · ")
                  : "Yok"
              }
            />
            <SummaryRow
              k="Stok"
              v={
                hasVariants
                  ? `${shownTotal} adet (varyantlardan)`
                  : `${stock || 0} adet`
              }
            />
            <SummaryRow
              k="SKU"
              v={
                sku ||
                (storedSku
                  ? `${storedSku} (kayıtlı kod kalır)`
                  : name
                    ? `Kayıtta üretilir (${skuPrefix(name)}-…)`
                    : "Kayıtta üretilir")
              }
              mono={Boolean(sku || storedSku)}
            />
            <SummaryRow
              k="Ağırlık"
              v={Number(weightGrams) > 0 ? `${weightGrams} g` : "Gösterilmez"}
              muted={!(Number(weightGrams) > 0)}
            />
            {variants.length > 0 && (
              <SummaryRow
                k="Varyant"
                v={`${variants.length} varyant: ${variants.map((v) => v.name || "(adsız)").join(", ")}`}
              />
            )}
            <SummaryRow
              k="Durum"
              v={
                [
                  isActive ? "Aktif" : "Pasif",
                  featured && "Öne çıkan",
                  isNew && "Yeni",
                ]
                  .filter(Boolean)
                  .join(" · ") || "-"
              }
              muted
            />
          </Card>
        </div>
      ),
    },
  ];

  return (
    <form
      ref={formRef}
      action={post.action}
      onSubmit={post.onSubmit}
      noValidate
      className="grid gap-6"
    >
      {mode === "wizard" && (
        <Card>
          <ol className="-mx-1 flex [scrollbar-width:none] items-center gap-2 overflow-x-auto px-1 [&::-webkit-scrollbar]:hidden">
            {steps.map((s) => {
              const flagged = flaggedSteps.has(s.id);
              const current = step === s.id;
              return (
                <li key={s.id} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => setStep(s.id)}
                    aria-current={current ? "step" : undefined}
                    aria-label={`${s.id}. ${s.title}${flagged ? ": düzeltilecek alan var" : ""}`}
                    className={`flex min-h-[44px] items-center gap-2 rounded-full px-3 py-2 text-xs transition-colors ${
                      current
                        ? "bg-[var(--admin-primary)] text-white"
                        : flagged
                          ? "border border-[var(--admin-danger)] text-[var(--admin-danger-ink)]"
                          : step > s.id
                            ? "bg-neutral-100 text-neutral-700"
                            : "border border-[var(--admin-border)] text-[var(--admin-text-soft)]"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className="inline-grid h-5 w-5 place-items-center rounded-full text-[10px]"
                      style={{
                        background:
                          step >= s.id ? "rgba(255,255,255,0.15)" : "transparent",
                        border: step >= s.id ? "none" : "1px solid currentColor",
                      }}
                    >
                      {flagged ? "!" : s.id}
                    </span>
                    <span className="whitespace-nowrap">{s.title}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </Card>
      )}

      {steps.map((s) => {
        const visible = mode === "tabs" || step === s.id;
        return (
          <div key={s.id} data-step={s.id} hidden={!visible}>
            <Card>
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
                  {flaggedSteps.has(s.id) ? (
                    <span className="ml-3 align-middle text-sm text-[var(--admin-danger-ink)] not-italic">
                      Düzeltilecek alan var
                    </span>
                  ) : null}
                </h2>
              )}
              {s.body}
            </Card>
          </div>
        );
      })}

      {state.error ? (
        <div
          role="alert"
          className="rounded-xl bg-[var(--admin-danger-soft)] px-3.5 py-2.5 text-sm text-[var(--admin-danger-ink)]"
        >
          {state.error}
        </div>
      ) : null}

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
                <PrimaryButton type="button" onClick={goNext}>
                  Sonraki adım →
                </PrimaryButton>
              )}
            </div>
            <div className="flex gap-2">
              <Link href="/admin/urunler" className={BUTTON.ghost}>
                Vazgeç
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
            <p className="text-xs text-[var(--admin-text-mute)]">
              Bütün bölümler birlikte kaydedilir.
            </p>
            <div className="flex gap-2">
              <Link href="/admin/urunler" className={BUTTON.ghost}>
                Vazgeç
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
        className="text-[10px] tracking-[0.22em] text-[var(--admin-text-mute)] uppercase"
        style={{ fontFamily: "var(--mono), monospace" }}
      >
        {k}
      </div>
      <div
        className={`text-sm ${muted ? "text-[var(--admin-text-soft)]" : "text-neutral-900"}`}
        style={mono ? { fontFamily: "var(--mono), monospace" } : undefined}
      >
        {v}
      </div>
    </div>
  );
}
