import {
  Card,
  Checkbox,
  DangerButton,
  Field,
  PageHeader,
  PrimaryButton,
  Select,
  TextInput,
} from "@/components/admin/forms";
import { requireRole } from "@/lib/admin/auth";
import { listReels, type AdminReel } from "@/lib/admin/store";

import { createReelAction, deleteReelAction, updateReelAction } from "./actions";

export const metadata = { title: "Admin · Reels" };
export const dynamic = "force-dynamic";

const ACCENTS = ["caramel", "strawberry", "matcha", "pistachio", "dark", "cream", "rose", "gold"];

function AccentSelect({ value }: { value?: string }) {
  return (
    <Select name="accent" defaultValue={value ?? "caramel"}>
      {ACCENTS.map((a) => (
        <option key={a} value={a}>{a}</option>
      ))}
    </Select>
  );
}

function Row({ reel }: { reel: AdminReel }) {
  return (
    <Card>
      <form action={updateReelAction.bind(null, reel.id)} className="grid gap-3 sm:grid-cols-2">
        <Field label="Başlık (caption)"><TextInput name="caption" defaultValue={reel.caption} /></Field>
        <Field label="Meta (ör. 0:36 · 31.6K)"><TextInput name="meta" defaultValue={reel.meta} /></Field>
        <Field label="Renk tonu"><AccentSelect value={reel.accent} /></Field>
        <Field label="Video URL (opsiyonel)"><TextInput name="videoUrl" defaultValue={reel.videoUrl} /></Field>
        <Field label="Sıra"><TextInput name="sortOrder" type="number" defaultValue={reel.sortOrder} /></Field>
        <div className="flex items-end justify-between gap-3">
          <Checkbox name="isActive" label="Aktif" defaultChecked={reel.isActive} />
          <PrimaryButton type="submit">Kaydet</PrimaryButton>
        </div>
      </form>
      <form action={deleteReelAction} className="mt-2 border-t border-neutral-100 pt-2">
        <input type="hidden" name="id" value={reel.id} />
        <DangerButton type="submit">Sil</DangerButton>
      </form>
    </Card>
  );
}

export default async function AdminReelsPage() {
  await requireRole("reels");
  const reels = await listReels();

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="İçerik · Reels"
        title="Reels"
        description="Ana sayfa ve Reels bölümündeki kısa film kartları. Sıra ve aktiflik anında siteye yansır."
      />

      <Card className="mb-6">
        <h3 className="mb-3 text-sm font-medium">+ Yeni reel</h3>
        <form action={createReelAction} className="grid gap-3 sm:grid-cols-2">
          <Field label="Başlık (caption)"><TextInput name="caption" placeholder="How an affogato is born" /></Field>
          <Field label="Meta"><TextInput name="meta" placeholder="0:24 · 12.4K" /></Field>
          <Field label="Renk tonu"><AccentSelect /></Field>
          <Field label="Video URL (opsiyonel)"><TextInput name="videoUrl" placeholder="https://…" /></Field>
          <Field label="Sıra"><TextInput name="sortOrder" type="number" defaultValue={reels.length} /></Field>
          <div className="flex items-end justify-between gap-3">
            <Checkbox name="isActive" label="Aktif" defaultChecked />
            <PrimaryButton type="submit">Ekle</PrimaryButton>
          </div>
        </form>
      </Card>

      <div className="grid gap-3">
        {reels.map((r) => <Row key={r.id} reel={r} />)}
      </div>
    </main>
  );
}
