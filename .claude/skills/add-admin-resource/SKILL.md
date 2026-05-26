---
name: add-admin-resource
description: Add a new CRUD-able entity to the admin panel (store type + seed + Zod schema + actions + list + new + edit pages + nav link). Use when the user wants admin to manage a new resource type — e.g. "promosyon kodları ekle", "blog yazıları yönet", "müşteri rolleri sayfası yap".
---

# Yeni Admin Kaynağı Ekle

Admin panelde yeni bir CRUD-able entity eklemek için 8 dokunma noktası vardır. Bu dosya her noktayı sırasıyla anlatır.

## 1. Store entity'sini ekle

`src/lib/admin/store.ts`:

```ts
export interface AdminPromo {
  id: string;
  code: string;
  discountPct: number;
  isActive: boolean;
  updatedAt: string;
}

const promos: AdminPromo[] = [
  // Seed (opsiyonel) — geliştirme için 2-3 örnek satır
];

export async function listPromos(): Promise<AdminPromo[]> {
  return [...promos];
}

export async function getPromo(id: string): Promise<AdminPromo | null> {
  return promos.find((p) => p.id === id) ?? null;
}

export interface PromoInput {
  code: string;
  discountPct: number;
  isActive: boolean;
}

export async function createPromo(input: PromoInput): Promise<AdminPromo> {
  const id = slugifyId("prm", promos.length + 1);
  const promo: AdminPromo = { id, ...input, updatedAt: new Date().toISOString() };
  promos.push(promo);
  return promo;
}

export async function updatePromo(id: string, input: PromoInput): Promise<AdminPromo | null> {
  const idx = promos.findIndex((p) => p.id === id);
  if (idx === -1) return null;
  promos[idx] = { ...promos[idx], ...input, updatedAt: new Date().toISOString() };
  return promos[idx];
}

export async function deletePromo(id: string): Promise<boolean> {
  const idx = promos.findIndex((p) => p.id === id);
  if (idx === -1) return false;
  promos.splice(idx, 1);
  return true;
}
```

## 2. Zod schema (opsiyonel ama önerilen)

Karmaşık form'lar için `src/lib/admin/<entity>-schema.ts` aç. Basit alanlar için inline parse yeterli.

```ts
import { z } from "zod";

export const promoFormSchema = z.object({
  code: z.string().trim().min(2).max(20).toUpperCase(),
  discountPct: z.coerce.number().int().min(0).max(100),
  isActive: z.string().optional(),
}).transform((v) => ({
  code: v.code,
  discountPct: v.discountPct,
  isActive: v.isActive === "on",
}));
```

## 3. Server actions

`src/app/admin/<entity>/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createPromo, deletePromo, updatePromo } from "@/lib/admin/store";
import { promoFormSchema } from "@/lib/admin/promo-schema";

function revalidate() {
  revalidatePath("/admin/promosyon");
  revalidatePath("/admin");
  // revalidatePath("/") — eğer müşteri sayfası da etkileniyorsa
}

export async function createPromoAction(formData: FormData) {
  const obj = Object.fromEntries(formData.entries()) as Record<string, string>;
  const parsed = promoFormSchema.safeParse(obj);
  if (!parsed.success) return;
  await createPromo(parsed.data);
  revalidate();
  redirect("/admin/promosyon");
}

export async function updatePromoAction(id: string, formData: FormData) {
  const obj = Object.fromEntries(formData.entries()) as Record<string, string>;
  const parsed = promoFormSchema.safeParse(obj);
  if (!parsed.success) return;
  await updatePromo(id, parsed.data);
  revalidate();
  redirect("/admin/promosyon");
}

export async function deletePromoAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await deletePromo(id);
  revalidate();
}
```

`useActionState`'le inline hata göstermek istiyorsan `ProductActionState` kalıbına bak.

## 4. Sayfalar

**Liste** — `src/app/admin/<entity>/page.tsx`:

```tsx
import Link from "next/link";
import { Card, DangerButton, PageHeader } from "@/components/admin/forms";
import { listPromos } from "@/lib/admin/store";
import { deletePromoAction } from "./actions";

export const metadata = { title: "Admin · Promosyonlar" };
export const dynamic = "force-dynamic";

export default async function AdminPromosPage() {
  const promos = await listPromos();
  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <PageHeader
        eyebrow="Pazarlama"
        title="Promosyonlar"
        action={
          <Link href="/admin/promosyon/yeni" className="...">
            + Yeni promosyon
          </Link>
        }
      />
      <Card>
        {/* table with edit/delete actions; copy from /admin/urunler/page.tsx pattern */}
      </Card>
    </main>
  );
}
```

**Yeni** — `src/app/admin/<entity>/yeni/page.tsx` — `PromoForm` componenti ile.

**Düzenle** — `src/app/admin/<entity>/[id]/duzenle/page.tsx` — `getPromo(id)` + `notFound()` + bound action.

## 5. Paylaşılan form bileşeni

`src/components/admin/promo-form.tsx` — `forms.tsx`'den `Field`, `TextInput`, `Checkbox`, `PrimaryButton`, `GhostButton`, `Card` import et. `category-form.tsx`'i şablon olarak kullan.

## 6. Admin nav'a link ekle

`src/app/admin/layout.tsx` içindeki `NAV` array'ine satır ekle:

```ts
const NAV: Array<[string, string]> = [
  ["/admin", "Genel bakış"],
  ["/admin/menu", "Menü"],
  ["/admin/urunler", "Ürünler"],
  ["/admin/promosyon", "Promosyonlar"],  // ← yeni
  ["/admin/kategoriler", "Kategoriler"],
  ["/admin/siparisler", "Siparişler"],
  ["/admin/ayarlar", "Ayarlar"],
];
```

## 7. Dashboard stat (opsiyonel)

Aktif/inaktif sayım dashboard'a eklemek istiyorsan:

- `getDashboardStats()` içine yeni alan
- `/admin/page.tsx` içine yeni kart

## 8. Doğrulama

```bash
npx tsc --noEmit && npm run build
```

Sonra `/admin/promosyon`'a giderek list + yeni + düzenle + sil akışını gör.

## Yapma

- **`"use server"` directive'i unutma** — yoksa server action gibi çalışmaz
- **revalidatePath'i pas geçme** — yoksa client cache eski veri gösterir
- **redirect'i try/catch içine alma** — Next.js redirect intentional throw eder
- **id'leri client'tan güvenmeden parse etme** — Zod / manuel check şart
- **Müşteri tarafına etki ediyorsa `/` revalidate'i unutma** — örn. promosyon shop'ta görünüyorsa
