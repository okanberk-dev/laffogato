---
name: new-migration
description: Create a new Supabase SQL migration with the correct timestamp and conventions for the Laffogato project. Use when the user wants to add, alter, or drop database tables/columns/policies. Examples: "yeni bir tablo ekleyelim", "siparişlere bir kolon ekle", "RLS politikası ekle".
---

# Yeni Supabase Migration Oluştur

Bu projede her schema değişikliği `supabase/migrations/YYYYMMDDHHMMSS_aciklama.sql` formatında yeni bir dosya olarak yazılır. Önce dosyaya yazılır, sonra Supabase MCP `apply_migration` ile uygulanır.

## Adımlar

1. **Timestamp'i oluştur** (UTC):
   ```bash
   date -u +"%Y%m%d%H%M%S"
   ```

2. **Dosya adı:** `supabase/migrations/<timestamp>_<kebab_case_aciklama>.sql`
   - Örnek: `20260525143000_add_loyalty_points_to_users.sql`
   - Açıklama snake_case veya kebab; kısa ve anlamlı.

3. **Dosya iskeleti:**
   ```sql
   -- <Kısa amaç>
   -- Idempotent yaz; mümkün olduğunca geri-uyumlu ol (önce add nullable, sonra backfill, sonra not null).

   -- Schema değişiklikleri
   ...

   -- RLS (yeni tablo eklediysen mutlaka)
   alter table public.<yeni_tablo> enable row level security;
   create policy "<tablo>_public_read"
     on public.<yeni_tablo> for select
     using (...);
   ...
   ```

4. **Kontroller** (dosyayı yazmadan önce):
   - [ ] Yeni tablo → RLS açık + en az 1 SELECT politika
   - [ ] Yeni kolon → default değer var mı, NULL kabul ediyor mu?
   - [ ] Yeni unique/foreign key → mevcut veriyle çakışma var mı? Önce data fix migration'ı yaz.
   - [ ] `created_at`/`updated_at` lazımsa trigger ekle (`public.set_updated_at()` mevcut).
   - [ ] Para alanı varsa `_minor int` kullan (TRY için kuruş).

5. **Uygula:**
   - Önce migration'ı dosyaya yaz.
   - Sonra MCP ile uygula:
     ```
     mcp__32e5c71b-e66a-4a9d-9f63-fe8ba4dfeb40__apply_migration({
       project_id: "<ref>",
       name: "<aciklama>",
       query: "<sql içeriği>"
     })
     ```
   - Hangi project_id kullanılacağını kullanıcıdan onayla (birden fazla proje varsa).

6. **Type'ları yenile:**
   ```
   mcp__32e5c71b-e66a-4a9d-9f63-fe8ba4dfeb40__generate_typescript_types({ project_id: "<ref>" })
   ```
   Çıktıyı `src/types/database.ts` üzerine yaz.

7. **Doğrula:** `mcp__supabase__list_tables` veya `mcp__supabase__get_advisors` ile yeni tablonun göründüğünü ve hiç güvenlik uyarısı kalmadığını teyit et.

## Yapma

- Production'da `drop table` ya da `drop column not null` gibi destruktif komutu **kullanıcıya açıkça onaylatmadan** uygulama.
- `disable row level security` **asla**.
- Service role key'i client koduna sızdırma.
