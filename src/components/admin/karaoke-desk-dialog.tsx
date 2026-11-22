"use client";

import { useState } from "react";

import {
  cancelDeskReservationAction,
  createDeskReservationAction,
} from "@/app/admin/mobil/karaoke/actions";

import { Field, Select, Textarea, TextInput } from "./forms";
import { ActionModal, FieldError, useActionModalState } from "./ui";
import type { ButtonVariant } from "./ui/styles";

// "Elle rezervasyon / Saati kapat" (operator, 22 Kas 2026): a group booked
// by phone or at the counter, or hours the köşk closes. The hours show taken
// on the site, in the app and on the till at once. The server decides
// (createDeskReservation); this only asks.

export interface KaraokeDeskProps {
  /** Today, `YYYY-MM-DD` (Istanbul), and the last day the room takes. */
  today: string;
  lastDay: string;
  /** The room's first hour and closing hour (Ayarlar). */
  firstHour: number;
  closeHour: number;
  /** The room's capacity (Ayarlar → Karaoke). */
  capacity: number;
  variant?: ButtonVariant;
}

function useErr() {
  const { fieldErrors, errorId } = useActionModalState();
  return (name: string) =>
    fieldErrors[name]
      ? { "aria-invalid": true as const, "aria-describedby": errorId(name) }
      : {};
}

const pad = (h: number) => `${String(h).padStart(2, "0")}:00`;

function DeskFields(p: KaraokeDeskProps) {
  const err = useErr();
  const [kind, setKind] = useState<"booking" | "block">("booking");
  const starts: number[] = [];
  for (let h = p.firstHour; h < p.closeHour; h += 1) starts.push(h);
  const lengths: number[] = [];
  for (let n = 1; n <= p.closeHour - p.firstHour; n += 1) lengths.push(n);
  const block = kind === "block";
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Field label="Ne ekliyorsun?">
          <Select
            name="tur"
            value={kind}
            onChange={(e) =>
              setKind(e.target.value === "block" ? "block" : "booking")
            }
          >
            <option value="booking">
              Telefonla ya da kasada alınan rezervasyon
            </option>
            <option value="block">Saati kapat (etkinlik, bakım)</option>
          </Select>
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Field label="Tarih">
            <TextInput
              type="date"
              name="tarih"
              min={p.today}
              max={p.lastDay}
              defaultValue={p.today}
              required
              {...err("tarih")}
            />
          </Field>
          <FieldError name="tarih" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Field label="Başlangıç">
            <Select name="saat" required defaultValue="" {...err("saat")}>
              <option value="" disabled>
                Saat seç
              </option>
              {starts.map((h) => (
                <option key={h} value={String(h)}>
                  {pad(h)}
                </option>
              ))}
            </Select>
          </Field>
          <FieldError name="saat" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Field label="Süre">
            <Select name="sure" required defaultValue="1" {...err("sure")}>
              {lengths.map((n) => (
                <option key={n} value={String(n)}>
                  {n} saat
                </option>
              ))}
            </Select>
          </Field>
          <FieldError name="sure" />
        </div>
      </div>
      {block ? (
        <div className="flex flex-col gap-1.5">
          <Field
            label="Neden (yalnız panelde görünür)"
            hint="Sitede yalnız saatler dolu görünür; neden yazılmaz."
          >
            <TextInput
              name="not"
              maxLength={300}
              placeholder="Ör. özel etkinlik"
              {...err("not")}
            />
          </Field>
          <FieldError name="not" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Field label="Misafirin adı">
                <TextInput
                  name="ad"
                  maxLength={60}
                  required
                  autoComplete="off"
                  {...err("ad")}
                />
              </Field>
              <FieldError name="ad" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Field label="Kişi">
                <Select name="kisi" defaultValue="2" {...err("kisi")}>
                  {Array.from({ length: p.capacity }, (_, i) => i + 1).map(
                    (n) => (
                      <option key={n} value={String(n)}>
                        {n} kişi
                      </option>
                    ),
                  )}
                </Select>
              </Field>
              <FieldError name="kisi" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Field label="Telefon (isteğe bağlı)">
                <TextInput
                  name="telefon"
                  type="tel"
                  inputMode="tel"
                  autoComplete="off"
                  {...err("telefon")}
                />
              </Field>
              <FieldError name="telefon" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Field
                label="E-posta (isteğe bağlı)"
                hint="Yazarsan misafire onay e-postası gider."
              >
                <TextInput
                  name="eposta"
                  type="email"
                  autoComplete="off"
                  {...err("eposta")}
                />
              </Field>
              <FieldError name="eposta" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Field label="Not (isteğe bağlı)">
              <Textarea
                name="not"
                maxLength={300}
                className="min-h-[72px]"
                {...err("not")}
              />
            </Field>
            <FieldError name="not" />
          </div>
        </>
      )}
    </div>
  );
}

/** "Elle ekle": a phone/counter booking or closed hours. */
export function KaraokeDeskAdd(p: KaraokeDeskProps) {
  return (
    <ActionModal
      action={createDeskReservationAction}
      title="Elle rezervasyon ya da saati kapat"
      description="Telefonla ya da kasada alınan bir rezervasyonu ekle ya da saatleri kapat. Saatler sitede, uygulamada ve kasada hemen dolu görünür. Ödemesi köşkte alınır; kartla ödeme ve fatura bu kayıt için çalışmaz."
      trigger="Elle ekle"
      triggerVariant={p.variant ?? "primary"}
      submitLabel="Kaydet"
      size="md"
    >
      <DeskFields {...p} />
    </ActionModal>
  );
}

/** "Kaldır": frees a desk booking or closed hours. */
export function KaraokeDeskRemove({
  id,
  variant = "ghost",
}: {
  id: string;
  variant?: ButtonVariant;
}) {
  return (
    <ActionModal
      action={cancelDeskReservationAction}
      title="Elle eklenen kaydı kaldır"
      description="Saatler yeniden boş görünür. Kayıtta e-posta varsa misafire iptal e-postası gider."
      trigger="Kaldır"
      triggerVariant={variant}
      submitLabel="Kaldır"
      hidden={{ id }}
      size="sm"
    />
  );
}
