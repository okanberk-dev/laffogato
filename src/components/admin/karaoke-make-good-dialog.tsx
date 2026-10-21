"use client";

import {
  giveKaraokeMakeGoodHourAction,
  recordKaraokeMakeGoodPaidAction,
} from "@/app/admin/mobil/karaoke/actions";

import { Field, Select, Textarea, TextInput } from "./forms";
import { ActionModal, FieldError, useActionModalState } from "./ui";
import type { ButtonVariant } from "./ui/styles";

// The köşk's late cancel made good (karaoke terms §8, OP-KARAOKE-GOODWILL,
// 21 Eki 2026): the guest chooses a free hour of the same length or the
// amount paid to their own bank account. One of the two closes the other;
// the server decides (giveKaraokeMakeGoodHour, recordKaraokeMakeGoodPaid),
// these only ask.

export interface KaraokeMakeGoodProps {
  id: string;
  /** "₺2.000,00": the make-good. */
  amount: string;
  /** The amount as the transfer box prefills it ("2.000,00"). */
  amountInput: string;
  /** The booking's length, which the free hour keeps. */
  hours: number;
  /** "19 Nisan 2027": the last day the guest may ask for the free hour. */
  until: string;
  /**
   * Today and the last day the room's calendar is open, `YYYY-MM-DD` (the
   * date box): the hour itself may fall after `until`.
   */
  today: string;
  lastDay: string;
  /** The room's first hour and closing hour (Ayarlar). */
  firstHour: number;
  closeHour: number;
  variant: ButtonVariant;
  hourDisabledReason?: string;
  paidDisabledReason?: string;
}

function useErr() {
  const { fieldErrors, errorId } = useActionModalState();
  return (name: string) =>
    fieldErrors[name]
      ? { "aria-invalid": true as const, "aria-describedby": errorId(name) }
      : {};
}

function HourFields(p: KaraokeMakeGoodProps) {
  const err = useErr();
  const starts: number[] = [];
  for (let h = p.firstHour; h + p.hours <= p.closeHour; h += 1) starts.push(h);
  const pad = (h: number) => `${String(h).padStart(2, "0")}:00`;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Field
            label="Tarih"
            hint={`Misafir ${p.until} tarihine kadar istediyse; saat odanın takviminde açık bir gün.`}
          >
            <TextInput
              type="date"
              name="tarih"
              min={p.today}
              max={p.lastDay}
              required
              {...err("tarih")}
            />
          </Field>
          <FieldError name="tarih" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Field
            label="Başlangıç"
            hint={`${p.hours} saat, iptal edilenle aynı.`}
          >
            <Select name="saat" required defaultValue="" {...err("saat")}>
              <option value="" disabled>
                Saat seç
              </option>
              {starts.map((h) => (
                <option key={h} value={String(h)}>
                  {pad(h)} - {pad(h + p.hours)}
                </option>
              ))}
            </Select>
          </Field>
          <FieldError name="saat" />
        </div>
      </div>
    </div>
  );
}

function PaidFields(p: KaraokeMakeGoodProps) {
  const err = useErr();
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Field label="Havale tarihi">
            <TextInput
              type="date"
              name="havaleTarihi"
              max={p.today}
              defaultValue={p.today}
              required
              {...err("havaleTarihi")}
            />
          </Field>
          <FieldError name="havaleTarihi" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Field
            label="Tutar (₺)"
            hint={`Telafi ${p.amount}; havale tam bu tutar olmalı.`}
          >
            <TextInput
              name="tutar"
              inputMode="decimal"
              defaultValue={p.amountInput}
              required
              {...err("tutar")}
            />
          </Field>
          <FieldError name="tutar" />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Field
          label="Not (yalnız kayıtta kalır)"
          hint="IBAN'ı buraya yazma: dekont muhasebede durur."
        >
          <Textarea
            name="reason"
            required
            minLength={3}
            maxLength={500}
            placeholder="Ör. 20 Eki havale, dekont muhasebeye verildi"
            className="min-h-[80px]"
            {...err("reason")}
          />
        </Field>
        <FieldError name="reason" />
      </div>
    </div>
  );
}

/** "Telafi saati ver": a free hour of the same length for the same guest. */
export function KaraokeMakeGoodHour(p: KaraokeMakeGoodProps) {
  return (
    <ActionModal
      action={giveKaraokeMakeGoodHourAction}
      title="Telafi saati ver"
      description={`Misafire ${p.hours} saatlik ücretsiz bir karaoke saati (${p.amount} telafi). Rezervasyon onaylı açılır, misafire "Bu saat için senden ödeme alınmaz." yazan onay e-postası gider; telafinin ödeme seçeneği kapanır.`}
      trigger="Telafi saati ver"
      triggerVariant={p.variant}
      submitLabel="Saati ver"
      hidden={{ id: p.id }}
      disabledReason={p.hourDisabledReason}
      size="md"
    >
      <HourFields {...p} />
    </ActionModal>
  );
}

/** "Telafi ödendi": the amount paid to the guest's own bank account. */
export function KaraokeMakeGoodPaid(p: KaraokeMakeGoodProps) {
  return (
    <ActionModal
      action={recordKaraokeMakeGoodPaidAction}
      title="Telafi ödendi"
      description={`Misafirin kendi adına kayıtlı hesabına ${p.amount} havale ettiysen kaydet; telafinin ücretsiz saat seçeneği kapanır. Para buradan gönderilmez.`}
      trigger="Telafi ödendi"
      triggerVariant={p.variant}
      submitLabel="Kaydet"
      hidden={{ id: p.id }}
      disabledReason={p.paidDisabledReason}
      size="md"
    >
      <PaidFields {...p} />
    </ActionModal>
  );
}
