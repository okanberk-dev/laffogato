"use client";

import { rescheduleReservationAction } from "@/app/admin/mobil/karaoke/actions";
import {
  karaokeRescheduleStarts,
  type KaraokeRoomCalendar,
} from "@/lib/mobile/karaoke-reschedule-core";

import { Field, Select, TextInput } from "./forms";
import { ActionModal, FieldError, useActionModalState } from "./ui";
import type { ButtonVariant } from "./ui/styles";

// "Saati değiştir" on a karaoke booking (operator, 27 Eki 2026): another day
// or hour for the same length; the party, the price, the payment and the
// cancellation rule stay, and the member is mailed the new evening. The
// server decides (rescheduleReservationAction -> rescheduleReservation);
// this only asks.

export interface KaraokeRescheduleProps {
  id: string;
  /** The booking's evening now: YYYY-MM-DD, its start hour and length. */
  date: string;
  startHour: number;
  hours: number;
  /** "30 Ekim 2026, 20:00 - 22:00": the evening as the page shows it. */
  current: string;
  /** Paid online: the dialog says the payment carries over. */
  paid: boolean;
  room: KaraokeRoomCalendar;
  variant: ButtonVariant;
  disabledReason?: string;
}

const pad = (h: number) => `${String(h).padStart(2, "0")}:00`;

function RescheduleFields(p: KaraokeRescheduleProps) {
  const { fieldErrors, errorId } = useActionModalState();
  const err = (name: string) =>
    fieldErrors[name]
      ? { "aria-invalid": true as const, "aria-describedby": errorId(name) }
      : {};
  const starts = karaokeRescheduleStarts(p.hours, p.room);
  // A booking further out than today's window (the setting was lowered
  // since) keeps its own day selectable.
  const lastDay = p.date > p.room.lastDay ? p.date : p.room.lastDay;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-1.5">
        <Field label="Yeni tarih" hint="Odanın takviminde açık bir gün.">
          <TextInput
            type="date"
            name="tarih"
            min={p.room.today}
            max={lastDay}
            defaultValue={p.date}
            required
            {...err("tarih")}
          />
        </Field>
        <FieldError name="tarih" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Field label="Yeni başlangıç" hint={`${p.hours} saat, şimdiki gibi.`}>
          <Select
            name="saat"
            required
            defaultValue={
              starts.includes(p.startHour) ? String(p.startHour) : ""
            }
            {...err("saat")}
          >
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
  );
}

/** "Saati değiştir": the booking's page (`ghost`) or the list's ⋯ menu. */
export function KaraokeReschedule(p: KaraokeRescheduleProps) {
  const money = p.paid
    ? "Alınan ödeme yeni saat için geçerli"
    : "Ücret değişmez";
  return (
    <ActionModal
      action={rescheduleReservationAction}
      title="Saati değiştir"
      description={`Şimdiki saat: ${p.current}. Yeni gün ve başlangıcı seç; süre, kişi sayısı ve iptal kuralı aynı kalır; ücretsiz iptalin son anı rezervasyonun yapıldığı kuralla yeniden hesaplanır (yeni kuralda rezervasyondan sayılır, yeni saate göre uzamaz) ve e-postada yazar. ${money}, para hareket etmez. Kaydedince müşteriye yeni saati bildiren e-posta gider.`}
      trigger="Saati değiştir"
      triggerVariant={p.variant}
      submitLabel="Saati değiştir"
      hidden={{ id: p.id }}
      disabledReason={p.disabledReason}
      size="md"
    >
      <RescheduleFields {...p} />
    </ActionModal>
  );
}
