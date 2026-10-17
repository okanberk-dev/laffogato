---
name: server-action-pattern
description: Write a Next.js server action correctly for this project - Zod parse, store call, revalidatePath, redirect. Use when adding/changing any mutation (form submission, button-driven action) on the admin side or customer side.
---

# Server Action Pattern

Bu projede her mutation **server action** üzerinden gider. Pattern aşağıdaki sıraya sadık kalır.

## İskelet

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { someStoreFn } from "@/lib/admin/store";
// (opsiyonel) Zod schema:
// import { mySchema } from "@/lib/admin/my-schema";

export async function myAction(formData: FormData) {
  // 1) Parse - FormData → obj
  const obj = Object.fromEntries(formData.entries()) as Record<string, string>;

  // 2) Validate - Zod (karmaşıksa) ya da manuel
  const parsed = mySchema.safeParse(obj);
  if (!parsed.success) {
    return; // veya useActionState ile error map dönüş
  }

  // 3) Mutate - store fonksiyonu
  await someStoreFn(parsed.data);

  // 4) Revalidate - etkilenen sayfalar
  revalidatePath("/admin/<resource>");
  revalidatePath("/admin");
  // revalidatePath("/")  ← müşteri tarafı da etkileniyorsa

  // 5) Redirect - kullanıcıyı bir yere götür
  redirect("/admin/<resource>");
}
```

## useActionState ile inline hata

Form'da kullanıcıya alan-bazlı hata göstermek istiyorsan:

```ts
"use server";

export interface ActionState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function createSomeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const obj = Object.fromEntries(formData.entries()) as Record<string, string>;
  const parsed = mySchema.safeParse(obj);

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = issue.path.join(".") || "form";
      if (!fieldErrors[k]) fieldErrors[k] = issue.message;
    }
    return {
      error: "Lütfen formdaki uyarıları gidermeden devam et.",
      fieldErrors,
    };
  }

  await someStoreFn(parsed.data);
  revalidatePath("/admin/<resource>");
  redirect("/admin/<resource>");
}
```

Client tarafında (admin paneli):

```tsx
"use client";
import { useActionState } from "react";
import {
  PANEL_ACTION_FAILED,
  useNoResetSubmit,
  withPanelCatch,
} from "@/components/admin/action-form";
import { createSomeAction } from "./actions";

const [state, formAction, pending] = useActionState(
  // Bir throw tam sayfa hata ekranı değil, formun kendi hatası olur;
  // redirect() yine çalışır.
  withPanelCatch(createSomeAction, (prev) => ({
    ...prev,
    error: PANEL_ACTION_FAILED,
  })),
  {},
);
const onSubmit = useNoResetSubmit(formAction, pending);
return (
  <form onSubmit={onSubmit}>
    <input name="..." />
    {state.fieldErrors?.name && <span>{state.fieldErrors.name}</span>}
    <button disabled={pending}>{pending ? "..." : "Kaydet"}</button>
  </form>
);
```

`<form action={formAction}>` yazma: React 19 action bitince, yanıt ne olursa
olsun formun alanlarını sıfırlar; reddedilen kayıtta yazılan metin, seçimler
ve kutular gider. `useNoResetSubmit` formu `onSubmit`'ten elle gönderir ve yanıt
gelmeden ikinci gönderimi düşürür. Action `ActionResult` döndürüyorsa hazır
`ActionForm`'u kullan (`src/components/admin/action-form.tsx`).

## Bind ile parametre

Edit action'da `id`'yi prop'tan bind et:

```ts
// page.tsx (Server Component)
const boundUpdate = updateProductAction.bind(null, product.id);
<ProductWizard action={boundUpdate} ... />

// veya useActionState ile:
const boundUpdate = (prev: State, fd: FormData) => updateProductAction(product.id, prev, fd);
```

## revalidatePath kuralı

Hangi sayfaları revalidate edeceğine karar verirken:

- **Aynı liste sayfasını mı değiştirdin?** → o yolu revalidate et
- **Dashboard sayaçları değişti mi?** → `/admin` revalidate et
- **Müşteri sitesi değişti mi?** → `/` revalidate et
- **Detay sayfası değişti mi?** → `/admin/<resource>/<id>/duzenle` revalidate et (ardışık düzenlemeler için)

Mevcut helper'lar:
- `revalidateShop()` `urunler/actions.ts` - `/` + `/admin/urunler` + `/admin`
- `revalidateMenu()` `menu/actions.ts` - `/admin/menu` + `/admin` + `/`

## Güvenlik

1. **Yetkilendirme:** `/admin/*` route'ları zaten `proxy.ts` ile korumalı. Ekstra check gerekmiyor.
2. **Input güvenilmez:** Asla `formData.get(...)`'i tipi varmış gibi kullanma - string'e cast et + Zod
3. **Para birimleri minor unit:** Client'tan gelen "₺" string'i parse et, `Math.round(v * 100)` ile minor'a çevir, asla `parseFloat(price) * 100` direkt yazma (floating-point hatası)
4. **Constant-time karşılaştırma sadece kimlik için:** Genel form alanları için normal compare yeterli
5. **Redirect'ten önce mutate:** Mutate başarısızsa redirect'e gitme

## Yapma

- **`"use server"` directive'i unutma** - dosyanın en üstünde olmalı
- **Server action'dan client state'i değiştirmeye çalışma** - server action sadece DB/store + redirect/revalidate yapar
- **Server action içinde React hook çağırma** - useEffect/useState falan yok burada
- **try/catch ile redirect()'i yutma** - Next.js redirect intentional throw eder
- **Aynı action'ı hem prop hem inline tanımla** - bind ile tek noktada tanımla, prop olarak ilet

## Test

```bash
# Local
npm run dev
# Formu submit et, network tab'da action POST'unu gör (200), redirect'i takip et

# CI
npm run typecheck && npm run build
```
