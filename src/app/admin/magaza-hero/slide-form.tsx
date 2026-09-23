"use client";

import {
  useCallback,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";

import {
  Card,
  Checkbox,
  Field,
  GhostButton,
  PrimaryButton,
  Select,
  Textarea,
  TextInput,
} from "@/components/admin/forms";

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
    throw new Error("Canvas context açılamadı.");
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

export function SlideForm({
  defaults,
  action,
  submitLabel,
}: {
  defaults?: SlideDefaults;
  action: (formData: FormData) => Promise<void>;
  submitLabel: string;
}) {
  const d = defaults ?? {};
  const [title, setTitle] = useState(d.title ?? "");
  const [subtitle, setSubtitle] = useState(d.subtitle ?? "");
  const [imageUrl, setImageUrl] = useState(d.imageUrl ?? "");
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
    <form action={action} className="grid gap-4">
      <Card>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Başlık (H1)"
            hint="Mağaza üstünde görünen ana başlık. Son kelime altın script ile vurgulanır."
          >
            <TextInput
              name="title"
              required
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>
          <Field label="Sıralama" hint="Küçük sayı önce çıkar.">
            <TextInput
              type="number"
              name="sortOrder"
              defaultValue={String(d.sortOrder ?? 0)}
              min={0}
              max={999}
            />
          </Field>
        </div>
        <Field
          label="Küçük yazı / alt başlık"
          hint="Başlığın altına gelen tek-iki cümlelik açıklama."
        >
          <Textarea
            name="subtitle"
            rows={2}
            maxLength={300}
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
          />
        </Field>

        {/* Görsel - file upload + URL */}
        <div className="grid gap-2">
          <span
            className="text-[10px] tracking-[0.22em] text-neutral-500 uppercase"
            style={{ fontFamily: "var(--mono), monospace" }}
          >
            Görsel
          </span>

          {imageUrl ? (
            <div className="relative overflow-hidden rounded-xl border border-[var(--admin-border)] bg-neutral-50">
              <div
                style={{
                  aspectRatio: "21 / 9",
                  width: "100%",
                  backgroundImage: `url(${imageUrl})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              />
              <div className="flex items-center justify-between gap-2 border-t border-[var(--admin-border)] bg-white px-3 py-2">
                <span className="font-mono text-[10px] tracking-[0.18em] text-neutral-500 uppercase">
                  {isDataUrl ? `Yüklenmiş · ${approxKB(imageUrl)} KB` : "URL"}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="rounded-full border border-neutral-300 px-3 py-1 text-xs hover:border-[var(--admin-primary)]"
                  >
                    Değiştir
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageUrl("")}
                    className="rounded-full border border-red-200 px-3 py-1 text-xs text-red-700 hover:border-red-600 hover:bg-red-600 hover:text-white"
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
                className="text-[10px] tracking-[0.22em] text-neutral-500 uppercase"
                style={{ fontFamily: "var(--mono), monospace" }}
              >
                {processing ? "İşleniyor…" : "Sürükle bırak veya tıkla"}
              </div>
              <div className="mt-2 text-sm text-neutral-700">
                Hero için <span className="font-medium">21:9 oran</span> (örn.
                1920×823 px)
              </div>
              <div className="mt-1 text-xs text-neutral-500">
                JPG, PNG, WebP, AVIF veya GIF · max 15 MB. Otomatik
                1920px&apos;e küçültülür, JPEG&apos;e dönüştürülür.
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
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}

          {/* URL girme alternatifi */}
          <div className="mt-2 flex items-center gap-2 border-t border-neutral-100 pt-3">
            <span
              className="text-[10px] tracking-[0.22em] text-neutral-500 uppercase"
              style={{ fontFamily: "var(--mono), monospace" }}
            >
              veya URL
            </span>
            <input
              type="url"
              value={isDataUrl ? "" : imageUrl}
              placeholder="https://images.example.com/hero.jpg"
              onChange={(e) => setImageUrl(e.target.value)}
              className="flex-1 rounded-md border border-[var(--admin-border)] bg-neutral-50 px-3 py-1.5 text-xs outline-none focus:border-[var(--admin-primary)] focus:bg-white"
            />
          </div>

          <input type="hidden" name="imageUrl" value={imageUrl} />
        </div>
      </Card>

      <Card>
        <div className="grid gap-4 sm:grid-cols-[1fr_1fr_180px]">
          <Field label="CTA buton yazısı" hint="Örn: Mağazaya git">
            <TextInput
              name="ctaLabel"
              defaultValue={d.ctaLabel ?? ""}
              maxLength={40}
            />
          </Field>
          <Field label="CTA URL'si" hint="/odeme veya https://...">
            <TextInput
              name="ctaHref"
              defaultValue={d.ctaHref ?? ""}
              maxLength={200}
            />
          </Field>
          <Field label="Metin teması" hint="Görsel koyuysa light seç.">
            <Select
              name="textTheme"
              value={textTheme}
              onChange={(e) => setTextTheme(e.target.value as "light" | "dark")}
            >
              <option value="light">Açık metin (koyu görsel)</option>
              <option value="dark">Koyu metin (açık görsel)</option>
            </Select>
          </Field>
        </div>
        <Checkbox
          name="isActive"
          defaultChecked={d.isActive ?? true}
          label="Aktif (mağaza sayfasında görünür)"
        />
      </Card>

      {/* Live preview */}
      <Card>
        <div className="mb-3 font-mono text-xs tracking-widest text-neutral-500 uppercase">
          Önizleme
        </div>
        <SlidePreview
          title={title}
          subtitle={subtitle}
          imageUrl={imageUrl}
          textTheme={textTheme}
        />
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <PrimaryButton type="submit">{submitLabel}</PrimaryButton>
        <GhostButton type="button" onClick={() => history.back()}>
          Vazgeç
        </GhostButton>
      </div>
    </form>
  );
}

function SlidePreview({
  title,
  subtitle,
  imageUrl,
  textTheme,
}: {
  title: string;
  subtitle: string;
  imageUrl: string;
  textTheme: "light" | "dark";
}) {
  const isLight = textTheme === "light";
  // The preview reads globals.css tokens rather than its own hexes, so an
  // operator always picks a text theme against the ground the live hero
  // actually uses - it used to paint a retired palette of its own.
  const previewBg = imageUrl
    ? `linear-gradient(${isLight ? "rgba(20,61,43,0.35), rgba(20,61,43,0.55)" : "rgba(255,255,255,0.1), rgba(255,255,255,0.3)"}), url(${imageUrl})`
    : isLight
      ? "linear-gradient(135deg, var(--brand) 0%, var(--bg-espresso) 100%)"
      : "linear-gradient(135deg, var(--bg-warm) 0%, var(--bg-stone) 100%)";
  const words = title.trim().split(/\s+/);
  const lead = words.slice(0, -1).join(" ");
  const accent = words.length > 1 ? words[words.length - 1] : null;
  return (
    <div
      style={{
        aspectRatio: "21/9",
        borderRadius: 16,
        overflow: "hidden",
        backgroundImage: previewBg,
        backgroundSize: "cover",
        backgroundPosition: "center",
        position: "relative",
        color: isLight ? "#FFF" : "var(--ink)",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          padding: "clamp(20px, 4vw, 40px)",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: 720 }}>
          <h1
            style={{
              fontFamily: "var(--serif)",
              fontStyle: "italic",
              fontWeight: 500,
              fontSize: "clamp(28px, 5vw, 56px)",
              lineHeight: 1.05,
              letterSpacing: "-0.022em",
              margin: 0,
            }}
          >
            {lead || (
              <span style={{ opacity: 0.5 }}>Başlık burada görünecek</span>
            )}
            {accent && (
              <>
                {" "}
                <span
                  style={{
                    fontFamily: "var(--script)",
                    fontStyle: "normal",
                    color: isLight ? "var(--gold-soft)" : "var(--gold)",
                    fontSize: "0.9em",
                  }}
                >
                  {accent}
                </span>
              </>
            )}
          </h1>
          {subtitle && (
            <p
              style={{
                margin: "14px auto 0",
                maxWidth: "52ch",
                fontSize: 14,
                lineHeight: 1.55,
                color: isLight
                  ? "rgba(255,255,255,0.85)"
                  : "rgba(29,28,28,0.7)",
              }}
            >
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
