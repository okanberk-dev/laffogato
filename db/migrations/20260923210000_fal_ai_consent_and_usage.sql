-- fA'L read by AI (karar 177): the member's explicit consent and the usage
-- record the daily limit counts. Nothing here holds a photo or a reading.
--
-- feature_consents: one row per member and feature. The row IS the proof of
-- consent KVKK asks the data controller to keep - who, which text version,
-- when - so a withdrawal stamps "revokedAt" rather than deleting it.
--
-- fal_readings: one row per AI reading - the Istanbul day, whether a cup was
-- seen, the model. Swept after ninety days (src/lib/retention.ts), as the
-- R12 text promises.
--
-- Same conventions as the rest of the schema: camelCase-quoted columns,
-- ISO-8601 text dates; RLS on with no policies (the server's own role
-- bypasses it).
create table if not exists public.feature_consents (
  "customerEmail" text not null,
  feature         text not null,
  version         text not null default '',
  "grantedAt"     text not null default '',
  "revokedAt"     text not null default '',
  primary key ("customerEmail", feature)
);
alter table public.feature_consents enable row level security;

create table if not exists public.fal_readings (
  id              bigserial primary key,
  "customerEmail" text    not null,
  day             text    not null,
  "createdAt"     text    not null default '',
  model           text    not null default '',
  "cupSeen"       boolean not null default false
);
create index if not exists fal_readings_member_day on public.fal_readings ("customerEmail", day);
create index if not exists fal_readings_created on public.fal_readings ("createdAt");
alter table public.fal_readings enable row level security;
