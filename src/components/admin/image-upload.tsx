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

const DEFAULT_MAX_IMAGES = 8;
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.82;
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
  | { kind: "error"; message: string };

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

  const { width: srcW, height: srcH } = bitmap;
  const longest = Math.max(srcW, srcH);
  const scale = longest > MAX_DIMENSION ? MAX_DIMENSION / longest : 1;
  const w = Math.round(srcW * scale);
  const h = Math.round(srcH * scale);

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

  // GIFs may be animated — we flatten to a single JPEG frame. PNGs with
  // alpha become JPEG too (white background) to keep the payload small.
  if (ctx.globalCompositeOperation && file.type === "image/png") {
    ctx.globalCompositeOperation = "destination-over";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
  }

  return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
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

      setImages((prev) => [...prev, ...next].slice(0, MAX_IMAGES));
      setStatus(
        skipped > 0
          ? {
              kind: "error",
              message: `${skipped} görsel atlandı (limit: ${MAX_IMAGES}).`,
            }
          : { kind: "idle" },
      );
    },
    [images.length, MAX_IMAGES],
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

  const removeAt = (i: number) =>
    setImages((prev) => prev.filter((_, idx) => idx !== i));

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
      setStatus({ kind: "error", message: "Geçerli bir http(s) URL gir." });
      return;
    }
    if (images.length >= MAX_IMAGES) {
      setStatus({
        kind: "error",
        message: `En fazla ${MAX_IMAGES} görsel ekleyebilirsin.`,
      });
      return;
    }
    setImages((prev) => [...prev, v]);
    setUrlDraft("");
    setStatus({ kind: "idle" });
  };

  // Reset error after a short while so stale messages don't linger.
  useEffect(() => {
    if (status.kind !== "error") return;
    const t = setTimeout(() => setStatus({ kind: "idle" }), 5000);
    return () => clearTimeout(t);
  }, [status]);

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
            ? "border-neutral-900 bg-neutral-50"
            : remainingSlots > 0
              ? "border-neutral-300 bg-neutral-50/50 hover:border-neutral-500"
              : "border-[var(--admin-border)] bg-neutral-100 opacity-60"
        }`}
      >
        <div
          className="text-[10px] tracking-[0.22em] text-neutral-500 uppercase"
          style={{ fontFamily: "var(--mono), monospace" }}
        >
          {remainingSlots > 0
            ? "Sürükle bırak veya tıkla"
            : `Limit doldu - ${MAX_IMAGES} görsel`}
        </div>
        <div className="mt-2 text-sm text-neutral-700">
          {remainingSlots > 0 ? (
            <>
              <span className="font-medium">{remainingSlots}</span> görsel daha
              ekleyebilirsin · JPG, PNG, WebP, AVIF, GIF
            </>
          ) : (
            <>Silmek için aşağıdan görsel kaldır.</>
          )}
        </div>
        <div className="mt-1 text-xs text-neutral-500">
          Otomatik olarak 1600px&apos;e küçültülür, JPEG&apos;e dönüştürülür.
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
        <div className="rounded-md border border-[var(--admin-border)] bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
          İşleniyor… ({status.current}/{status.total})
        </div>
      )}
      {status.kind === "error" && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {status.message}
        </div>
      )}

      {images.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {images.map((src, i) => {
            const isPrimary = i === 0;
            const isData = src.startsWith("data:");
            return (
              <li
                key={`${i}-${src.slice(0, 32)}`}
                className={`group relative overflow-hidden rounded-lg border bg-white ${
                  isPrimary
                    ? "border-neutral-900"
                    : "border-[var(--admin-border)]"
                }`}
              >
                <div className="relative aspect-square w-full bg-neutral-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt={`Görsel ${i + 1}`}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover"
                  />
                  {isPrimary && (
                    <span
                      className="absolute top-2 left-2 rounded-full bg-[var(--admin-primary)] px-2 py-0.5 text-[9px] tracking-[0.18em] text-white uppercase"
                      style={{ fontFamily: "var(--mono), monospace" }}
                    >
                      Birincil
                    </span>
                  )}
                  <span
                    className="absolute top-2 right-2 rounded-full bg-white/85 px-2 py-0.5 text-[9px] tracking-[0.18em] text-neutral-600 uppercase backdrop-blur"
                    style={{ fontFamily: "var(--mono), monospace" }}
                  >
                    {isData ? `${approxKB(src)} KB` : "URL"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-1 border-t border-neutral-100 px-2 py-1.5">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => moveTo(i, i - 1)}
                      disabled={i === 0}
                      aria-label="Yukarı taşı"
                      className="grid h-7 w-7 place-items-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-[var(--admin-primary)] disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      onClick={() => moveTo(i, i + 1)}
                      disabled={i === images.length - 1}
                      aria-label="Aşağı taşı"
                      className="grid h-7 w-7 place-items-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-[var(--admin-primary)] disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                      →
                    </button>
                    {!isPrimary && (
                      <button
                        type="button"
                        onClick={() => makePrimary(i)}
                        className="rounded-md px-2 py-1 text-[10px] tracking-[0.16em] text-neutral-500 uppercase hover:bg-neutral-100 hover:text-[var(--admin-primary)]"
                        style={{ fontFamily: "var(--mono), monospace" }}
                      >
                        Birincil yap
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeAt(i)}
                    aria-label="Sil"
                    className="grid h-7 w-7 place-items-center rounded-md text-red-600 hover:bg-red-50"
                  >
                    ×
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-3">
        <span
          className="text-[10px] tracking-[0.22em] text-neutral-500 uppercase"
          style={{ fontFamily: "var(--mono), monospace" }}
        >
          URL ile ekle
        </span>
        <input
          type="url"
          value={urlDraft}
          onChange={(e) => setUrlDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addUrl();
            }
          }}
          placeholder="https://images.example.com/sirena-1.jpg"
          className="flex-1 rounded-md border border-[var(--admin-border)] bg-neutral-50 px-3 py-1.5 text-xs outline-none focus:border-[var(--admin-primary)] focus:bg-white"
        />
        <button
          type="button"
          onClick={addUrl}
          disabled={!urlDraft.trim() || images.length >= MAX_IMAGES}
          className="rounded-full border border-neutral-300 px-3 py-1.5 text-xs text-neutral-700 hover:border-[var(--admin-primary)] hover:text-[var(--admin-primary)] disabled:opacity-40"
        >
          Ekle
        </button>
      </div>

      <input type="hidden" name={name} value={json} />
    </div>
  );
}
