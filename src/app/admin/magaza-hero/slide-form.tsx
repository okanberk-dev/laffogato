"use client";

import { useState } from "react";

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
  const [textTheme, setTextTheme] = useState<"light" | "dark">(d.textTheme ?? "light");

  return (
    <form action={action} className="grid gap-4">
      <Card>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Başlık (H1)" hint="Mağaza üstünde görünen ana başlık. Son kelime altın script ile vurgulanır.">
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
        <Field label="Küçük yazı / alt başlık" hint="Başlığın altına gelen tek-iki cümlelik açıklama.">
          <Textarea
            name="subtitle"
            rows={2}
            maxLength={300}
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
          />
        </Field>
        <Field label="Görsel URL'si" hint="Tam URL — Vercel Blob, Cloudinary veya kendi CDN'i. Boş bırakırsan altın gradient fallback görünür.">
          <TextInput
            name="imageUrl"
            type="url"
            placeholder="https://..."
            maxLength={500}
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
          />
        </Field>
      </Card>

      <Card>
        <div className="grid gap-4 sm:grid-cols-[1fr_1fr_180px]">
          <Field label="CTA buton yazısı" hint="Örn: Mağazaya git">
            <TextInput name="ctaLabel" defaultValue={d.ctaLabel ?? ""} maxLength={40} />
          </Field>
          <Field label="CTA URL'si" hint="/odeme veya https://...">
            <TextInput name="ctaHref" defaultValue={d.ctaHref ?? ""} maxLength={200} />
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
        <Checkbox name="isActive" defaultChecked={d.isActive ?? true} label="Aktif (mağaza sayfasında görünür)" />
      </Card>

      {/* Live preview */}
      <Card>
        <div className="font-mono text-xs uppercase tracking-widest text-neutral-500 mb-3">
          Önizleme
        </div>
        <SlidePreview title={title} subtitle={subtitle} imageUrl={imageUrl} textTheme={textTheme} />
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
  const previewBg = imageUrl
    ? `linear-gradient(${isLight ? "rgba(20,16,11,0.35), rgba(20,16,11,0.55)" : "rgba(255,255,255,0.1), rgba(255,255,255,0.3)"}), url(${imageUrl})`
    : isLight
      ? "linear-gradient(135deg, #6E4220 0%, #2F1F10 100%)"
      : "linear-gradient(135deg, #F5E6D3 0%, #E6D4B0 100%)";
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
        color: isLight ? "#FFF" : "#14100B",
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
                    color: isLight ? "#E6D4B0" : "#8A6332",
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
                color: isLight ? "rgba(255,255,255,0.85)" : "rgba(20,16,11,0.7)",
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
