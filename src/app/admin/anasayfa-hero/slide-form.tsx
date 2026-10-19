"use client";

import Link from "next/link";
import { useState } from "react";

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
import { ImageUpload } from "@/components/admin/image-upload";
import { BUTTON, type ModalAction } from "@/components/admin/ui";
import { SCENES } from "@/components/laffogato/scenes";
import {
  HOME_HERO_BUNDLED_IMAGES,
  HOME_HERO_LIMITS as L,
  HOME_HERO_SCENE_LABELS,
  HOME_HERO_SCENES,
  HOME_SLIDE_ACTION_LABELS,
  HOME_SLIDE_ACTIONS,
  isBundledHomeHeroImage,
  isHomeHeroScene,
  isHomeSlideAction,
  type HomeHeroSlideInput,
} from "@/lib/admin/home-hero-core";
import { toDateTimeLocalInput } from "@/lib/admin/publish-window";

// Same strings as home-hero-schema.ts (CUSTOM_IMAGE, LINK_TARGET), which is
// Zod and stays on the server.
const CUSTOM_IMAGE = "custom";
const LINK_TARGET = "link";

/** One stacked field with its refusal under it. */
function Row({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div className="grid content-start gap-1.5">
      {children}
      <FormFieldError name={name} />
    </div>
  );
}

function ButtonFields({
  which,
  heading,
  defaults,
}: {
  which: "primary" | "secondary";
  heading: string;
  defaults: { label: string; action: string; href: string };
}) {
  const initialTarget = isHomeSlideAction(defaults.action)
    ? defaults.action
    : defaults.href
      ? LINK_TARGET
      : "";
  const [targetValue, setTargetValue] = useState(initialTarget);
  return (
    <fieldset className="grid gap-4">
      <legend className="mb-1 text-sm font-medium text-[var(--admin-text)]">
        {heading}
      </legend>
      <div className="grid gap-4 sm:grid-cols-2">
        <Row name={`${which}Label`}>
          <Field label="Yazı" hint="Boş bırakırsan bu düğme çizilmez.">
            <TextInput
              name={`${which}Label`}
              defaultValue={defaults.label}
              maxLength={L.buttonLabel}
              placeholder={which === "primary" ? "Sezonu gör" : "Tüm menü"}
            />
          </Field>
        </Row>
        <Row name={`${which}Target`}>
          <Field label="Nereye gider">
            <Select
              name={`${which}Target`}
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
            >
              <option value="">Düğme yok</option>
              <optgroup label="Sitedeki sayfalar">
                {HOME_SLIDE_ACTIONS.map((a) => (
                  <option key={a} value={a}>
                    {HOME_SLIDE_ACTION_LABELS[a]}
                  </option>
                ))}
              </optgroup>
              <option value={LINK_TARGET}>Bağlantı (adres yaz)</option>
            </Select>
          </Field>
        </Row>
      </div>
      {targetValue === LINK_TARGET ? (
        <Row name={`${which}Href`}>
          <Field
            label="Bağlantı"
            hint="Sitedeki bir yol (örn. /kampanyalar, /menu/matcha) ya da https:// ile başlayan tam adres."
          >
            <TextInput
              name={`${which}Href`}
              defaultValue={defaults.href}
              maxLength={L.urlHref}
              placeholder="/kampanyalar"
              inputMode="url"
              autoComplete="off"
            />
          </Field>
        </Row>
      ) : null}
    </fieldset>
  );
}

/**
 * The home hero slide editor (/admin/anasayfa-hero). The form posts its
 * fields by these names; home-hero-schema.ts reads the same names and puts
 * each refusal back under its field.
 */
export function HomeSlideForm({
  action,
  defaults,
  submitLabel,
}: {
  action: ModalAction;
  defaults: HomeHeroSlideInput;
  submitLabel: string;
}) {
  const bundled = isBundledHomeHeroImage(defaults.image);
  const [imageSource, setImageSource] = useState(
    bundled ? defaults.image : defaults.image ? CUSTOM_IMAGE : "",
  );
  const [scene, setScene] = useState(
    isHomeHeroScene(defaults.scene) ? defaults.scene : "latte",
  );
  const light = SCENES[isHomeHeroScene(scene) ? scene : "latte"];

  return (
    <ActionForm action={action} className="grid max-w-4xl gap-4">
      <Card className="grid gap-5">
        <Row name="kicker">
          <Field
            label="Üst satır"
            hint={`Başlığın üstündeki küçük satır, örn. "Sezon · Strawberry Aşkı". En çok ${L.kicker} karakter.`}
          >
            <TextInput
              name="kicker"
              defaultValue={defaults.kicker}
              maxLength={L.kicker}
            />
          </Field>
        </Row>
        <div className="grid gap-5 sm:grid-cols-2">
          <Row name="titleLine1">
            <Field
              label="Başlık · 1. satır"
              hint={`Çok büyük yazılır: satır başına en çok ${L.titleLine} karakter.`}
            >
              <TextInput
                name="titleLine1"
                defaultValue={defaults.titleLine1}
                maxLength={L.titleLine}
                required
              />
            </Field>
          </Row>
          <Row name="titleLine2">
            <Field label="Başlık · 2. satır" hint="İsteğe bağlı.">
              <TextInput
                name="titleLine2"
                defaultValue={defaults.titleLine2}
                maxLength={L.titleLine}
              />
            </Field>
          </Row>
        </div>
        <Row name="body">
          <Field
            label="Metin"
            hint={`Telefonda yalnız ilk cümle görünür: onu en çok ${L.lead} karakter tut. {kapasite} ve {kapanis} karaoke odasının ayarlardaki kapasitesi ve kapanış saatiyle dolar.`}
          >
            <Textarea
              name="body"
              defaultValue={defaults.body}
              maxLength={L.body}
              rows={3}
              required
            />
          </Field>
        </Row>
      </Card>

      <Card className="grid gap-5">
        <Row name="imageSource">
          <Field
            label="Görsel"
            hint="Slayt görseli sahnenin ışığında durur: arka planı saydam (dekupe) bir fotoğraf ya da çizim en iyi görünür."
          >
            <Select
              name="imageSource"
              value={imageSource}
              onChange={(e) => setImageSource(e.target.value)}
            >
              <option value="" disabled>
                Görsel seç…
              </option>
              <optgroup label="Sitenin kendi görselleri">
                {HOME_HERO_BUNDLED_IMAGES.map((img) => (
                  <option key={img.path} value={img.path}>
                    {img.label}
                  </option>
                ))}
              </optgroup>
              <option value={CUSTOM_IMAGE}>
                Kendi görselim (yükle ya da https bağlantısı)
              </option>
            </Select>
          </Field>
        </Row>
        {imageSource === CUSTOM_IMAGE ? (
          <Row name="imageUpload">
            <ImageUpload
              name="imageUpload"
              initial={!bundled && defaults.image ? [defaults.image] : []}
              max={1}
            />
          </Row>
        ) : null}
        <div className="grid gap-5 sm:grid-cols-[1fr_auto] sm:items-end">
          <Row name="alt">
            <Field
              label="Görsel açıklaması"
              hint="Görselde ne var? Ekran okuyucu bunu okur."
            >
              <TextInput
                name="alt"
                defaultValue={defaults.alt}
                maxLength={L.alt}
                required
              />
            </Field>
          </Row>
          {imageSource && imageSource !== CUSTOM_IMAGE ? (
            <span
              aria-hidden="true"
              className="grid h-24 w-20 place-items-end overflow-hidden rounded-xl border border-[var(--admin-border)]"
              style={{
                background: `radial-gradient(circle at 50% 42%, ${light.mid} 0%, ${light.edge} 72%)`,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageSource}
                alt=""
                className="h-full w-full object-contain"
              />
            </span>
          ) : null}
        </div>
        <Row name="scene">
          <Field
            label="Sahne ışığı"
            hint="Görselin arkasındaki renkli ışık: içeceğin kendi rengini seç."
          >
            <span className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="h-10 w-10 shrink-0 rounded-full border border-[var(--admin-border)]"
                style={{
                  background: `radial-gradient(circle at 50% 42%, ${light.core} 0%, ${light.edge} 80%)`,
                }}
              />
              <Select
                name="scene"
                value={scene}
                onChange={(e) =>
                  setScene(
                    isHomeHeroScene(e.target.value) ? e.target.value : "latte",
                  )
                }
              >
                {HOME_HERO_SCENES.map((k) => (
                  <option key={k} value={k}>
                    {HOME_HERO_SCENE_LABELS[k]}
                  </option>
                ))}
              </Select>
            </span>
          </Field>
        </Row>
      </Card>

      <Card className="grid gap-6">
        <ButtonFields
          which="primary"
          heading="Birinci düğme (dolu)"
          defaults={{
            label: defaults.primaryLabel,
            action: defaults.primaryAction,
            href: defaults.primaryHref,
          }}
        />
        <ButtonFields
          which="secondary"
          heading="İkinci düğme (çerçeveli)"
          defaults={{
            label: defaults.secondaryLabel,
            action: defaults.secondaryAction,
            href: defaults.secondaryHref,
          }}
        />
      </Card>

      <Card className="grid gap-5">
        <div className="sm:max-w-[240px]">
          <Row name="sortOrder">
            <Field label="Sıra" hint="Küçük sayı önce gelir.">
              <TextInput
                name="sortOrder"
                type="number"
                min={0}
                max={L.sortOrder}
                defaultValue={String(defaults.sortOrder)}
              />
            </Field>
          </Row>
        </div>
        {/* Two columns, not three: a datetime-local box will not shrink
            below its own width and pushed the third column out of the card. */}
        <div className="grid gap-5 sm:grid-cols-2">
          <Row name="startsAt">
            <Field label="Başlangıç" hint="Boşsa hemen. Saat İstanbul saati.">
              <TextInput
                type="datetime-local"
                name="startsAt"
                defaultValue={toDateTimeLocalInput(defaults.startsAt)}
              />
            </Field>
          </Row>
          <Row name="endsAt">
            <Field label="Bitiş" hint="Boşsa süresiz.">
              <TextInput
                type="datetime-local"
                name="endsAt"
                defaultValue={toDateTimeLocalInput(defaults.endsAt)}
              />
            </Field>
          </Row>
        </div>
        <Checkbox
          name="isActive"
          label="Yayında"
          defaultChecked={defaults.isActive}
        />
      </Card>

      <FormMessage />
      <div className="flex flex-wrap gap-2">
        <SubmitButton>{submitLabel}</SubmitButton>
        <Link href="/admin/anasayfa-hero" className={BUTTON.ghost}>
          Vazgeç
        </Link>
      </div>
    </ActionForm>
  );
}
