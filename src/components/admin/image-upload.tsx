"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";

import {
  dataUrlFormat,
  encodeForUpload,
  fitUploadTotal,
  formatUploadMB,
  hasTransparentPixel,
  MAX_DIMENSION,
  MAX_UPLOAD_TOTAL_LENGTH,
  UploadError,
  uploadTotalMessage,
  uploadTotalNotice,
  type EncodeSource,
} from "@/lib/admin/image-encode";

import { BUTTON } from "./ui/styles";

const DEFAULT_MAX_IMAGES = 8;
const MAX_SOURCE_BYTES = 12 * 1024 * 1024;
const ACCEPTED_MIME = /^image\/(jpe?g|png|webp|avif|gif)$/i;

interface ImageUploadProps {
  name: string;
  initial: string[];
  /** How many images this field accepts. Menu items take exactly one. */
  max?: number;
}

type Status =
  | { kind: "idle" }
  | { kind: "processing"; current: number; total: number }
  /* `sticky`: a message too long to read in the few seconds a short one
     stays; it stays until the next upload, link or removal. */
  | { kind: "error"; message: string; sticky?: boolean };

/**
 * A real canvas behind `encodeForUpload`: each call draws the decoded file
 * afresh at the asked size (a downscale step redraws from the source, not
 * from the previous step). A JPEG cannot carry alpha, so its pixels are not
 * scanned.
 */
function canvasSource(bitmap: ImageBitmap, fileType: string): EncodeSource {
  const mayHaveAlpha = !/^image\/jpe?g$/i.test(fileType);
  return {
    width: bitmap.width,
    height: bitmap.height,
    draw(w, h) {
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new UploadError("Canvas context açılamadı.");
      ctx.drawImage(bitmap, 0, 0, w, h);
      return {
        hasTransparency: () =>
          mayHaveAlpha &&
          hasTransparentPixel(ctx.getImageData(0, 0, w, h).data),
        toDataURL: (type, quality) => canvas.toDataURL(type, quality),
      };
    },
  };
}

/**
 * The file → the stored data URL. GIFs may be animated: the first frame is
 * kept. Opaque photos become JPEG; a photo with transparency keeps it as
 * WebP (PNG where the canvas cannot encode WebP), see `image-encode.ts`.
 */
async function resizeImage(file: File): Promise<string> {
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error(`${file.name} 12 MB'ı aşıyor.`);
  }
  if (!ACCEPTED_MIME.test(file.type)) {
    throw new Error(`${file.name} desteklenmeyen format.`);
  }

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) {
    throw new Error(`${file.name} okunamadı.`);
  }
  try {
    return encodeForUpload(canvasSource(bitmap, file.type), file.name).dataUrl;
  } finally {
    bitmap.close?.();
  }
}

/** The stored format, for the thumbnail's corner label. */
function formatLabel(dataUrl: string): string {
  const m = /^data:image\/([a-z0-9.+-]+);/i.exec(dataUrl);
  return m ? m[1].toUpperCase() : "";
}

function approxKB(dataUrl: string): number {
  const i = dataUrl.indexOf(",");
  if (i === -1) return 0;
  const b64Len = dataUrl.length - i - 1;
  return Math.round((b64Len * 0.75) / 1024);
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

export function ImageUpload({
  name,
  initial,
  max: MAX_IMAGES = DEFAULT_MAX_IMAGES,
}: ImageUploadProps) {
  const [images, setImages] = useState<string[]>(() =>
    initial.slice(0, MAX_IMAGES),
  );
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [dragOver, setDragOver] = useState(false);
  const [urlDraft, setUrlDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputId = useId();

  const remainingSlots = MAX_IMAGES - images.length;
  const json = useMemo(() => JSON.stringify(images), [images]);

  const ingestFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList).filter((f) => f.size > 0);
      if (files.length === 0) return;
      const slots = MAX_IMAGES - images.length;
      if (slots <= 0) {
        setStatus({
          kind: "error",
          message: `En fazla ${MAX_IMAGES} görsel ekleyebilirsin.`,
        });
        return;
      }
      const batch = files.slice(0, slots);
      const skipped = files.length - batch.length;

      const next: string[] = [];
      for (let i = 0; i < batch.length; i += 1) {
        setStatus({ kind: "processing", current: i + 1, total: batch.length });
        try {
          const url = await resizeImage(batch[i]);
          next.push(url);
        } catch (err) {
          setStatus({
            kind: "error",
            message: err instanceof Error ? err.message : "Görsel işlenemedi.",
          });
          return;
        }
      }

      // Every photo is posted on every save, so a photo that would take the
      // item past the one-save total is left out here, with the reason,
      // instead of the platform refusing the whole save later (413) and the
      // error page wiping the form.
      const fit = fitUploadTotal(images, next);
      setImages((prev) =>
        // `prev` is the list as it is now; the check is repeated on it so
        // the posted total never passes the limit.
        [...prev, ...fitUploadTotal(prev, fit.accepted).accepted].slice(
          0,
          MAX_IMAGES,
        ),
      );
      const slotNote =
        skipped > 0 ? `${skipped} görsel atlandı (limit: ${MAX_IMAGES}).` : "";
      if (fit.refused.length > 0) {
        const message = uploadTotalMessage(
          fit.refused.map((i) => batch[i].name),
          fit.refusedLength,
          fit.refused.some((i) => dataUrlFormat(next[i]) === "png"),
        );
        setStatus({
          kind: "error",
          message: slotNote ? `${message} ${slotNote}` : message,
          sticky: true,
        });
        return;
      }
      setStatus(
        slotNote ? { kind: "error", message: slotNote } : { kind: "idle" },
      );
    },
    [images, MAX_IMAGES],
  );

  const onFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      void ingestFiles(e.target.files);
    }
    e.target.value = "";
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      void ingestFiles(e.dataTransfer.files);
    }
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!dragOver) setDragOver(true);
  };

  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
  };

  const removeAt = (i: number) => {
    setImages((prev) => prev.filter((_, idx) => idx !== i));
    // Removing a photo is the answer to a "too much" message; it goes.
    setStatus((s) => (s.kind === "error" ? { kind: "idle" } : s));
  };

  const moveTo = (from: number, to: number) =>
    setImages((prev) => {
      if (to < 0 || to >= prev.length || from === to) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });

  const makePrimary = (i: number) => moveTo(i, 0);

  const addUrl = () => {
    const v = urlDraft.trim();
    if (!isHttpUrl(v)) {
      setStatus({
        kind: "error",
        message: "https:// ile başlayan bir görsel adresi gir.",
      });
      return;
    }
    if (images.length >= MAX_IMAGES) {
      setStatus({
        kind: "error",
        message: `En fazla ${MAX_IMAGES} görsel ekleyebilirsin.`,
      });
      return;
    }
    const fit = fitUploadTotal(images, [v]);
    if (fit.refused.length > 0) {
      setStatus({
        kind: "error",
        message: uploadTotalMessage(["Bu adres"], fit.refusedLength, false),
        sticky: true,
      });
      return;
    }
    setImages((prev) => [...prev, v]);
    setUrlDraft("");
    setStatus({ kind: "idle" });
  };

  // Reset error after a short while so stale messages don't linger.
  useEffect(() => {
    if (status.kind !== "error" || status.sticky) return;
    const t = setTimeout(() => setStatus({ kind: "idle" }), 5000);
    return () => clearTimeout(t);
  }, [status]);

  /* Photos stored before the one-save total existed can already pass it.
     Nothing new can be added then, and the operator is told before saving. */
  const overTotal = json.length > MAX_UPLOAD_TOTAL_LENGTH;

  return (
    <div className="grid gap-3">
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        role="button"
        tabIndex={0}
        aria-label="Görsel yükle"
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-5 py-10 text-center transition-colors ${
          dragOver
            ? "border-[var(--admin-primary)] bg-[var(--admin-surface-2)]"
            : remainingSlots > 0
              ? "border-[var(--admin-border-strong)] bg-[var(--admin-surface-2)]/50 hover:border-[var(--admin-border-field)]"
              : "border-[var(--admin-border)] bg-[var(--admin-surface-2)] opacity-60"
        }`}
      >
        <div className="text-[13px] font-medium text-[var(--admin-text-soft)]">
          {remainingSlots > 0
            ? "Sürükle bırak veya tıkla"
            : `Sınır doldu: ${MAX_IMAGES} görsel`}
        </div>
        <div className="mt-2 text-sm text-[var(--admin-text-soft)]">
          {remainingSlots > 0 ? (
            <>
              <span className="font-medium">{remainingSlots}</span> görsel daha
              ekleyebilirsin · JPG, PNG, WebP, AVIF, GIF
            </>
          ) : (
            <>
              {MAX_IMAGES > 1
                ? "Yenisini eklemek için aşağıdan birini kaldır."
                : "Değiştirmek için aşağıdakini kaldır."}
            </>
          )}
        </div>
        <div className="mt-1 text-xs text-[var(--admin-text-mute)]">
          Uzun kenarı {MAX_DIMENSION} px&apos;e küçültülür. Saydam arka planlı
          (dekupe) fotoğraf saydamlığıyla WebP, diğerleri JPEG olarak saklanır.
          {MAX_IMAGES > 1 &&
            ` Tek kayıtta fotoğrafların toplamı en çok ${formatUploadMB(MAX_UPLOAD_TOTAL_LENGTH)} MB olabilir.`}
        </div>
        <input
          ref={inputRef}
          id={fileInputId}
          type="file"
          accept="image/*"
          multiple
          onChange={onFileInputChange}
          className="hidden"
          disabled={remainingSlots <= 0}
        />
      </div>

      {status.kind === "processing" && (
        <div className="rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-2)] px-3 py-2 text-xs text-[var(--admin-text-soft)]">
          İşleniyor… ({status.current}/{status.total})
        </div>
      )}
      {status.kind === "error" && (
        <div className="rounded-md border border-[var(--admin-danger)]/30 bg-[var(--admin-danger-soft)] px-3 py-2 text-xs text-[var(--admin-danger-ink)]">
          {status.message}
        </div>
      )}
      {overTotal && (
        <div
          role="alert"
          className="rounded-md border border-[var(--admin-warning)]/30 bg-[var(--admin-warning-soft)] px-3 py-2 text-xs text-[var(--admin-warning)]"
        >
          {uploadTotalNotice(json.length)}
        </div>
      )}

      {images.length > 0 && (
        // Columns by the field's own width, not the screen's: inside the
        // menu form's narrow column md:grid-cols-4 made 96 px cards whose
        // badges overlapped. Each card is at least 9.5rem, where the
        // footer's arrows and × fit on one row.
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-3">
          {images.map((src, i) => {
            const isPrimary = i === 0;
            const isData = src.startsWith("data:");
            return (
              <li
                key={`${i}-${src.slice(0, 32)}`}
                className={`group relative overflow-hidden rounded-lg border bg-white ${
                  isPrimary
                    ? "border-[var(--admin-primary)]"
                    : "border-[var(--admin-border)]"
                }`}
              >
                <div className="relative aspect-square w-full bg-[var(--admin-surface-2)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt={`Görsel ${i + 1}`}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover"
                  />
                  {isPrimary && (
                    <span className="absolute top-2 left-2 rounded-full bg-[var(--admin-primary)] px-2 py-0.5 text-[11px] font-medium text-white">
                      Birincil
                    </span>
                  )}
                  <span className="absolute top-2 right-2 rounded-full bg-white/85 px-2 py-0.5 text-[11px] font-medium text-[var(--admin-text-soft)] backdrop-blur">
                    {isData ? `${approxKB(src)} KB` : "URL"}
                  </span>
                  {isData && (
                    // The stored format: WEBP or PNG is a photo that kept
                    // its transparency (a cutout), JPEG an opaque one.
                    <span className="absolute bottom-2 left-2 rounded-full bg-white/85 px-2 py-0.5 text-[11px] font-medium text-[var(--admin-text-soft)] backdrop-blur">
                      {formatLabel(src)}
                    </span>
                  )}
                </div>
                {/* Wraps instead of clipping: on a phone the two-column card
                    is about 150 px, and "Birincil yap" pushed × out of it, so
                    a second photo could not be removed (admin audit CAT-12).
                    The arrows, × and "Birincil yap" each name the photo they
                    act on (CAT-23); the arrows move left and right. */}
                <div className="flex flex-wrap items-center justify-between gap-1 border-t border-[var(--admin-border)] px-1.5 py-1">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => moveTo(i, i - 1)}
                      disabled={i === 0}
                      aria-label={`Sola taşı: görsel ${i + 1}`}
                      title="Sola taşı"
                      className="grid h-11 w-10 shrink-0 place-items-center rounded-md text-[var(--admin-text-soft)] hover:bg-[var(--admin-surface-2)] hover:text-[var(--admin-primary)] disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                      <span aria-hidden="true">←</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => moveTo(i, i + 1)}
                      disabled={i === images.length - 1}
                      aria-label={`Sağa taşı: görsel ${i + 1}`}
                      title="Sağa taşı"
                      className="grid h-11 w-10 shrink-0 place-items-center rounded-md text-[var(--admin-text-soft)] hover:bg-[var(--admin-surface-2)] hover:text-[var(--admin-primary)] disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                      <span aria-hidden="true">→</span>
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeAt(i)}
                    aria-label={`Sil: görsel ${i + 1}`}
                    title="Sil"
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-md text-lg text-[var(--admin-danger-ink)] hover:bg-[var(--admin-danger-soft)]"
                  >
                    <span aria-hidden="true">×</span>
                  </button>
                  {!isPrimary && (
                    <button
                      type="button"
                      onClick={() => makePrimary(i)}
                      aria-label={`Birincil yap: görsel ${i + 1}`}
                      className="min-h-[44px] basis-full rounded-md px-2 text-xs font-medium text-[var(--admin-text-soft)] hover:bg-[var(--admin-surface-2)] hover:text-[var(--admin-primary)]"
                    >
                      Birincil yap
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-[var(--admin-border)] pt-3">
        <span
          className="basis-full text-[13px] font-medium text-[var(--admin-text-soft)] sm:basis-auto"
          aria-hidden="true"
        >
          Bağlantıyla ekle
        </span>
        <input
          type="url"
          inputMode="url"
          autoComplete="off"
          aria-label="Görsel bağlantısı"
          value={urlDraft}
          onChange={(e) => setUrlDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addUrl();
            }
          }}
          placeholder="https://images.example.com/sirena-1.jpg"
          className="min-h-[44px] min-w-0 flex-[1_1_10rem] rounded-xl border border-[var(--admin-border-field)] bg-[var(--admin-surface)] px-3 py-2 text-base outline-none focus:border-[var(--admin-primary)] focus:bg-white focus:ring-2 focus:ring-[var(--admin-accent)]/25 sm:text-sm"
        />
        <button
          type="button"
          onClick={addUrl}
          disabled={!urlDraft.trim() || images.length >= MAX_IMAGES}
          className={BUTTON.ghost}
        >
          Ekle
        </button>
      </div>

      <input type="hidden" name={name} value={json} />
    </div>
  );
}
