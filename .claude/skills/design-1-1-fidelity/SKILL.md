---
name: design-1-1-fidelity
description: Keep the customer SPA (src/components/laffogato/*) 1:1 with the original Claude Design handoff. Use when extending a page section, adding new visuals, or auditing whether the implementation has drifted from the design source files in /tmp/design/cafe/project/.
---

# Design 1:1 Fidelity

Müşteri SPA'sı (`src/components/laffogato/*`) Claude Design handoff'undan port edildi. Yeni özellik eklerken design'a sadık kalmak için bu kurallar.

## Kaynak

Handoff dosyaları `/tmp/design/cafe/project/site/`'da:

- `app.jsx` - App shell
- `chrome.jsx` - Nav + Footer
- `components.jsx` → `ui.tsx`
- `visuals.jsx` → `visuals.tsx`
- `data.jsx` → `data.ts`
- `styles.css` + `components.css` → `globals.css` (birleşik)
- `page-home.jsx`, `page-menu.jsx`, ... → `pages.tsx` (tümü tek dosyada)

Süreç boyunca dosyalar `/tmp` altında. Sandbox sıfırlanırsa Claude Design'dan tekrar export edilmesi gerekir.

## Korunması zorunlu olanlar

1. **SVG geometri** - `EdibleCupHero`, `MatchaGlass`, `BarRenderScene`, `CupEmblem`, `ReelScene` variantları, `FounderPortrait`, `MapPlaceholder`, `BeanIllo`, `CoffeeBag`, `EspressoCup`, `GelatoScoop`, `PhotoSurface`, `ProductSurface`, `MenuPlate`
2. **CSS değişkenleri** - `--gold`, `--ink`, `--bg-warm`, `--serif`, `--script`, vb. `globals.css`'de
3. **Layout / spacing** - `clamp()` ile responsive font'lar, `data-row` attribute ile grid override'ları
4. **Animasyonlar** - `marquee`, `pageIn`, `steam`, `pour`, `sway` keyframe'leri + `.reveal.in` transition
5. **Hash router** - `#home`, `#menu`, `#shop`, `#story`, `#visit`
6. **Hover state'ler** - `.product-card:hover .product-card-img { transform: translateY(-4px); ... }` gibi

## Zorunlu Next.js adaptasyonları (1:1 dışında bırakılanlar)

Bu üç değişiklik design'dan saparak yapıldı ama tutmamız gerekiyor:

- **`next/font/google`** ile font yükleme (design'daki `<link rel="stylesheet">` yerine)
- **`mounted` gate'i** `LaffogatoApp` içinde - SSR'da `window.location.hash`'i güvenle okumak için
- **Server-side data fetching** `src/app/page.tsx`'de - `products`/`settings`/`menu`/`notice` prop'lar olarak iniyor

Bunlar görsel sonucu değiştirmez. Yeni özellik eklerken bu üçü dışında design'a sadık kal.

## Değişiklik yaparken kontrol listesi

Müşteri SPA'sında bir değişiklik yapıyorsan:

- [ ] Design dosyalarına bak - bu kısım `/tmp/design/cafe/project/site/page-*.jsx`'de nasıl?
- [ ] Yeni bir SVG mi ekliyorsun? Önce visuals.jsx'de var mı kontrol et
- [ ] Yeni bir CSS class mı ekliyorsun? Önce design'ın styles.css + components.css'de var mı bak
- [ ] Inline `<style>` tag'i mi kullanıyorsun? Design'da varsa OK, yoksa **globals.css'e taşı**
- [ ] Renk hard-code mu? **Tailwind keyfine göre değil** - `var(--ink)`, `var(--gold)` gibi token kullan
- [ ] Yeni font mu? Sadece zaten yüklü 2 fonttan biri (Hanken Grotesk, JetBrains Mono)

## Yeni özellik eklerken

Design'da olmayan bir özellik (örn. müşteri login butonu, bildirim toast'ı, indirim banner'ı):

1. Mevcut design dilini koru: aynı `eyebrow` + `h-1` + `lede` tipografi sistemi
2. Mevcut renk paletini kullan: `--bg-warm` zemin, `--ink` text, `--gold` accent
3. Aynı responsive pattern: `data-row` attr ile grid breakpoint override'ları
4. Hover/transition: `cubic-bezier(0.2, 0.7, 0.2, 1)` (var(--ease-out))

## Audit (sapma var mı?)

Periodically:

1. Design dosyaları yerinde mi? `ls /tmp/design/cafe/project/site/`
2. Bir page-X.jsx'i karşılığı SPA bölümüyle yan yana diff'le
3. CSS değişkenlerinin hâlâ aynı değeri tuttuğunu kontrol et (`grep --gold globals.css`)
4. SVG primitive sayısı 13: `Cup​Emblem`, `Edible​CupHero`, `Espresso​Cup`, `Matcha​Glass`, `Gelato​Scoop`, `Bean​Illo`, `Coffee​Bag`, `Reel​Scene`, `Bar​RenderScene`, `Map​Placeholder`, `MenuPlate`, `Product​Surface`, `Founder​Portrait`, `Photo​Surface`

## Yapma

- **Tasarım dilini değiştirme** - sans-serif body, serif italic display başlık, script accent. Bu üçlü brand
- **Renkleri Tailwind palette'inden kullanma** - design tokenları `globals.css`'de
- **Yeni font ekleme** - 2 font yeterli, eklemen gerekiyorsa kullanıcıya sor
- **`box-shadow` değerini elle yazma** - `var(--shadow-sm/md/lg)` kullan
- **Hash route ekleme** - şu an 7 route var, yenisi gerekecekse `VALID_ROUTES` listesine ekle
- **Hot reload sırasında SPA'yı bozma** - `mounted` gate'i kaldırma, hash routing'i Next.js file routing'e çevirme (en azından kullanıcıya sormadan)
