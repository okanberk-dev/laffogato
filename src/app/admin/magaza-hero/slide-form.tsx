"use client";

import Link from "next/link";
import {
  useCallback,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";

import {
  ActionForm,
  FormFieldError,
  FormMessage,
  SubmitButton,
} from "@/components/admin/action-form";
import {
  Card,
  Checkbox,
  Field,
  Select,
  Textarea,
  TextInput,
} from "@/components/admin/forms";
import { BUTTON, type ModalAction } from "@/components/admin/ui";
import { MONO_STYLE } from "@/components/admin/ui/styles";
import { Slide } from "@/components/laffogato/shop-hero-slider";
import { SHOP_HERO_LIMITS as L } from "@/lib/admin/shop-hero-schema";

export interface SlideDefaults {
  title?: string;
  subtitle?: string;
  imageUrl?: string;
  ctaLabel?: string;
  ctaHref?: string;
  textTheme?: "light" | "dark";
  sortOrder?: number;
  isActive?: boolean;
}

/* Hero slider için 21:9 cinematic oran - long edge 1920px'e küçültülür. */
const MAX_DIMENSION = 1920;
const JPEG_QUALITY = 0.85;
const MAX_SOURCE_BYTES = 15 * 1024 * 1024;
const ACCEPTED_MIME = /^image\/(jpe?g|png|webp|avif|gif)$/i;

async function resizeImage(file: File): Promise<string> {
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error(`${file.name} 15 MB'ı aşıyor - daha küçük bir görsel seç.`);
  }
  if (!ACCEPTED_MIME.test(file.type)) {
    throw new Error(
      `${file.name} desteklenmeyen format (JPG, PNG, WebP, AVIF veya GIF).`,
    );
  }
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) throw new Error("Görsel okunamadı.");
  const longest = Math.max(bitmap.width, bitmap.height);
  const scale = longest > MAX_DIMENSION ? MAX_DIMENSION / longest : 1;
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close?.();
    throw new Error("Görsel işlenemedi: tarayıcı çizim alanı açamadı.");
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
}

function approxKB(value: string): number {
  if (!value.startsWith("data:")) return 0;
  const i = value.indexOf(",");
  if (i === -1) return 0;
  return Math.round(((value.length - i - 1) * 0.75) / 1024);
}

/** One stacked field with its refusal under it. */
function Row({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div className="grid content-start gap-1.5">
      {children}
      <FormFieldError name={name} />
    </div>
  );
}

/**
 * The shop hero slide editor (/admin/magaza-hero).
 *
 * An ActionForm: the action answers a refusal under its field and the form
 * keeps what was typed. It used to be a bare `<form action>`: a double click
 * created two slides, and a blank title came back with no word while
 * React's form reset wiped the button fields, the order, the theme and the
 * Aktif box (admin audit CAT-13). The field names are the ones
 * shop-hero-schema.ts reads.
 */
export function SlideForm({
  defaults,
  action,
  submitLabel,
}: {
  defaults?: SlideDefaults;
  action: ModalAction;
  submitLabel: string;
}) {
  const d = defaults ?? {};
  const [title, setTitle] = useState(d.title ?? "");
  const [subtitle, setSubtitle] = useState(d.subtitle ?? "");
  const [imageUrl, setImageUrl] = useState(d.imageUrl ?? "");
  const [ctaLabel, setCtaLabel] = useState(d.ctaLabel ?? "");
  const [ctaHref, setCtaHref] = useState(d.ctaHref ?? "");
  const [textTheme, setTextTheme] = useState<"light" | "dark">(
    d.textTheme ?? "light",
  );
  const [dragOver, setDragOver] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const ingestFile = useCallback(async (file: File) => {
    setProcessing(true);
    setError(null);
    try {
      const url = await resizeImage(file);
      setImageUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Görsel işlenemedi.");
    } finally {
      setProcessing(false);
    }
  }, []);

  const onFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void ingestFile(file);
    e.target.value = "";
  };
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) void ingestFile(file);
  };
  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!dragOver) setDragOver(true);
  };
  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
  };

  const isDataUrl = imageUrl.startsWith("data:");

  return (
    <ActionForm action={action} className="grid gap-4">
      <Card className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
          <Row name="title">
            <Field
              label="Başlık"
              hint="Mağazanın en üstündeki büyük yazı. Son kelime ayrı renkte yazılır."
            >
              <TextInput
                name="title"
                required
                maxLength={L.title}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </Field>
          </Row>
          <Row name="sortOrder">
            <Field label="Sıra" hint="Küçük sayı önce gelir.">
              <TextInput
                type="number"
                name="sortOrder"
                defaultValue={String(d.sortOrder ?? 0)}
                min={0}
                max={L.sortOrder}
              />
            </Field>
          </Row>
        </div>
        <Row name="subtitle">
          <Field
            label="Alt yazı"
            hint="Başlığın altına gelen bir iki cümle. Boş bırakabilirsin."
          >
            <Textarea
              name="subtitle"
              rows={2}
              maxLength={L.subtitle}
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
            />
          </Field>
        </Row>

        {/* Görsel: dosya yükle ya da https bağlantısı. A fieldset, not a
            Field label: inside a label every click on the caption or the
            hint opened the file picker. */}
        <fieldset className="grid min-w-0 gap-2">
          <legend
            className="mb-2 text-[10px] tracking-[0.22em] text-[var(--admin-text-mute)] uppercase"
            style={MONO_STYLE}
          >
            Görsel
          </legend>

          {imageUrl ? (
            <div className="relative overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-2)]">
              {/* An <img>, not a CSS url(): the address is the operator's
                  free text and must not end up inside a style attribute. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt="Slayt görseli"
                className="block aspect-[21/9] w-full object-cover"
              />
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--admin-border)] bg-white px-3 py-2">
                <span
                  className="text-[10px] tracking-[0.18em] text-[var(--admin-text-mute)] uppercase"
                  style={MONO_STYLE}
                >
                  {isDataUrl
                    ? `Yüklenen dosya · ${approxKB(imageUrl)} KB`
                    : "Bağlantı"}
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className={BUTTON.ghost}
                  >
                    Değiştir
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageUrl("")}
                    className={BUTTON.danger}
                  >
                    Kaldır
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onClick={() => fileRef.current?.click()}
              role="button"
              tabIndex={0}
              aria-label="Slayt görseli yükle"
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  fileRef.current?.click();
                }
              }}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-5 py-12 text-center transition-colors ${
                dragOver
                  ? "border-neutral-900 bg-neutral-50"
                  : "border-neutral-300 bg-neutral-50/50 hover:border-neutral-500"
              }`}
            >
              <div
                className="text-[10px] tracking-[0.22em] text-[var(--admin-text-mute)] uppercase"
                style={MONO_STYLE}
              >
                {processing ? "İşleniyor…" : "Sürükle bırak veya tıkla"}
              </div>
              <div className="mt-2 text-sm text-[var(--admin-text-soft)]">
                Geniş bir fotoğraf seç:{" "}
                <span className="font-medium">21:9</span> (örn. 1920×823 px)
              </div>
              <div className="mt-1 text-xs text-[var(--admin-text-mute)]">
                JPG, PNG, WebP, AVIF ya da GIF, en çok 15 MB. Uzun kenarı 1920
                px&apos;e küçültülür ve JPEG olarak saklanır.
              </div>
            </div>
          )}

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={onFileInputChange}
            className="hidden"
          />
          {error && (
            <div
              role="alert"
              className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-[var(--admin-danger-ink)]"
            >
              {error}
            </div>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-3">
            <span
              className="text-[10px] tracking-[0.22em] text-[var(--admin-text-mute)] uppercase"
              style={MONO_STYLE}
              aria-hidden="true"
            >
              ya da bağlantı
            </span>
            {/* The link field carries the name itself unless a file was
                uploaded: ActionForm marks and focuses the control a refusal
                names, and it skips hidden inputs, so a refused link came
                back unmarked with the focus left on the submit button. */}
            <input
              type="url"
              name={isDataUrl ? undefined : "imageUrl"}
              inputMode="url"
              autoComplete="off"
              aria-label="Görsel bağlantısı (https)"
              value={isDataUrl ? "" : imageUrl}
              placeholder="https://images.example.com/hero.jpg"
              onChange={(e) => setImageUrl(e.target.value)}
              className="min-w-0 flex-1 rounded-md border border-[var(--admin-border-field)] bg-[var(--admin-surface)] px-3 py-2 text-xs outline-none focus:border-[var(--admin-primary)] focus:bg-white"
            />
          </div>
          <FormFieldError name="imageUrl" />

          {isDataUrl ? (
            <input type="hidden" name="imageUrl" value={imageUrl} />
          ) : null}
        </fieldset>
      </Card>

      <Card className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_220px]">
          <Row name="ctaLabel">
            <Field
              label="Düğme yazısı"
              hint="Örn: Mağazaya git. Boşsa düğme çizilmez."
            >
              <TextInput
                name="ctaLabel"
                value={ctaLabel}
                onChange={(e) => setCtaLabel(e.target.value)}
                maxLength={L.ctaLabel}
              />
            </Field>
          </Row>
          <Row name="ctaHref">
            <Field
              label="Düğme bağlantısı"
              hint="Sitedeki bir yol (/magaza), sayfadaki bir bölüm (#products) ya da https:// ile başlayan bir adres."
            >
              <TextInput
                name="ctaHref"
                value={ctaHref}
                onChange={(e) => setCtaHref(e.target.value)}
                maxLength={L.ctaHref}
                inputMode="url"
                autoComplete="off"
              />
            </Field>
          </Row>
          <Row name="textTheme">
            <Field
              label="Yazı rengi"
              hint="Görsel koyuysa açık yazı, açıksa koyu yazı seç."
            >
              <Select
                name="textTheme"
                value={textTheme}
                onChange={(e) =>
                  setTextTheme(e.target.value === "dark" ? "dark" : "light")
                }
              >
                <option value="light">Açık yazı (koyu görsel)</option>
                <option value="dark">Koyu yazı (açık görsel)</option>
              </Select>
            </Field>
          </Row>
        </div>
        <Checkbox
          name="isActive"
          defaultChecked={d.isActive ?? true}
          label="Aktif (mağaza sayfasında görünür)"
        />
      </Card>

      <Card className="min-w-0">
        <div
          className="mb-3 text-xs tracking-widest text-[var(--admin-text-mute)] uppercase"
          style={MONO_STYLE}
        >
          Önizleme
        </div>
        <SlidePreview
          title={title}
          subtitle={subtitle}
          imageUrl={imageUrl}
          ctaLabel={ctaLabel}
          ctaHref={ctaHref}
          textTheme={textTheme}
        />
        <p className="mt-2 text-xs text-[var(--admin-text-mute)]">
          Mağazadaki slaytın kendisi; telefonda daha dar ve uzun çizilir.
        </p>
      </Card>

      <FormMessage />
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton>{submitLabel}</SubmitButton>
        <Link href="/admin/magaza-hero" className={BUTTON.ghost}>
          Vazgeç
        </Link>
      </div>
    </ActionForm>
  );
}

/**
 * The live shop slide (shop-hero-slider.tsx's own `Slide`, active and
 * loaded) in the same frame the shop draws it in. It used to be a look-alike
 * with its own overlay, an italic title in another face and no eyebrow or
 * button, so the text theme was picked against a ground customers never
 * saw (admin audit CAT-25).
 *
 * `data-site-preview` lets the site's own button styles through the panel's
 * resets (globals.css); `inert` keeps the slide's link out of the tab order
 * and unclickable, since following it would leave the unsaved form.
 */
export function SlidePreview({
  title,
  subtitle,
  imageUrl,
  ctaLabel,
  ctaHref,
  textTheme,
}: {
  title: string;
  subtitle: string;
  imageUrl: string;
  ctaLabel: string;
  ctaHref: string;
  textTheme: "light" | "dark";
}) {
  return (
    <div
      data-site-preview=""
      aria-hidden="true"
      inert
      className="shop-hero-slider"
      // The shop's frame keeps its min-height of 380 px; with its aspect
      // ratio that meant a 997 px minimum width, wider than the panel's form
      // at 1024 and 1280. min-width 0 lets it take the card's width.
      style={{ width: "100%", minWidth: 0, maxWidth: "none", margin: 0 }}
    >
      <div className="shop-hero-track">
        <Slide
          slide={{
            id: "preview",
            title,
            subtitle,
            imageUrl,
            ctaLabel,
            ctaHref,
            textTheme,
          }}
          active
          loaded
        />
      </div>
    </div>
  );
}
