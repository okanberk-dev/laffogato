-- Site images managed from the panel (operator, 22 Kas 2026: "sitedeki
-- görselleri panelden de yönetebiliyor olalım").
--
-- One row per slot of the site that shows a photograph (a page's opening
-- picture, the home page's section photos, the visit gallery …), keyed by
-- the slot's name in src/lib/admin/site-images-core.ts. A slot with no row
-- shows the photograph bundled with the site. `imageUrl` is the uploaded
-- picture as a `data:image/…` URL, like every other upload, and is served at
-- /gorsel/site/<key> behind a content stamp (src/lib/admin/image-url.ts);
-- `alt` is the text a screen reader hears ("" = the slot's own).
--
-- Written only by the panel; read by the public pages through the Data
-- Cache under `pub:site` (src/lib/cache/tags.ts).

create table if not exists public.site_images (
  key         text primary key,
  "imageUrl"  text not null default '',
  alt         text not null default '',
  "updatedAt" text not null default ''
);
alter table public.site_images enable row level security;
