-- 0007_models.sql
-- AI model registry and download telemetry. The app fetches a signed manifest
-- from the `model-manifest` Edge Function and verifies it locally; this table is
-- the publishing surface for that manifest.

create table if not exists public.model_versions (
  id uuid primary key default gen_random_uuid(),
  model_id text not null,
  version text not null,
  channel model_channel_t not null default 'stable',
  format text not null check (format in ('onnx','tflite')),
  architecture text not null check (architecture in ('efficientnet_lite0_int8','mobilenetv3_small_int8')),
  file_url text not null,
  size_bytes bigint not null check (size_bytes > 0),
  sha256 char(64) not null check (sha256 ~ '^[0-9a-f]{64}$'),
  input_shape integer[] not null,
  labels integer not null check (labels > 0),
  validation_top1 numeric(5,4) check (validation_top1 is null or (validation_top1 >= 0 and validation_top1 <= 1)),
  min_app_version text not null default '1.0.0',
  signature text not null,
  released_at timestamptz not null default now(),
  is_current boolean not null default false,
  notes text,
  manifest jsonb not null,
  created_at timestamptz not null default now(),
  unique (model_id, version, channel)
);

create unique index if not exists model_versions_current_uidx
  on public.model_versions (model_id, channel) where is_current;

alter table public.model_versions enable row level security;

drop policy if exists model_versions_public_read on public.model_versions;
create policy model_versions_public_read on public.model_versions
  for select to anon, authenticated using (true);

revoke insert, update, delete on public.model_versions from anon, authenticated;

create table if not exists public.model_downloads (
  id bigserial primary key,
  user_id uuid references public.profiles (id) on delete set null,
  device_fingerprint text,
  model_version_id uuid not null references public.model_versions (id) on delete cascade,
  status text not null default 'started' check (status in ('started','completed','failed','checksum_mismatch')),
  bytes_received bigint not null default 0,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists model_downloads_version_idx on public.model_downloads (model_version_id, created_at desc);

alter table public.model_downloads enable row level security;

drop policy if exists model_downloads_insert_own on public.model_downloads;
create policy model_downloads_insert_own on public.model_downloads
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists model_downloads_select_own on public.model_downloads;
create policy model_downloads_select_own on public.model_downloads
  for select to authenticated using (user_id = auth.uid());

drop trigger if exists model_downloads_set_updated_at on public.model_downloads;
create trigger model_downloads_set_updated_at before update on public.model_downloads
  for each row execute function public.set_updated_at();
