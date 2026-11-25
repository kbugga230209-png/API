-- 0004_logging.sql
-- Diary: meals, food logs, saved meals and weight history.
-- Every row is user-private; RLS is `user_id = auth.uid()` for all operations.
-- Log rows carry a nutrition *snapshot* so historic days never change when a
-- food record is corrected later.

create table if not exists public.meal_logs (
  id uuid primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  log_date date not null,
  meal_type meal_type_t not null,
  note text,
  photo_path text,
  client_created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists meal_logs_user_date_idx on public.meal_logs (user_id, log_date);
create index if not exists meal_logs_updated_idx on public.meal_logs (user_id, updated_at);

create table if not exists public.food_logs (
  id uuid primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  meal_log_id uuid references public.meal_logs (id) on delete set null,
  log_date date not null,
  meal_type meal_type_t not null,
  food_slug text not null references public.food_items (slug),
  variant_slug text not null,
  grams numeric(8,2) not null check (grams > 0 and grams <= 5000),
  kcal numeric(8,2) not null check (kcal >= 0),
  protein_g numeric(8,2) not null default 0,
  carbs_g numeric(8,2) not null default 0,
  fat_g numeric(8,2) not null default 0,
  sat_fat_g numeric(8,2) not null default 0,
  fibre_g numeric(8,2) not null default 0,
  sugar_g numeric(8,2) not null default 0,
  sodium_mg numeric(8,2) not null default 0,
  source log_source_t not null default 'manual_search',
  confidence numeric(4,3) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  image_path text,
  user_corrected boolean not null default false,
  client_created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists food_logs_user_date_idx on public.food_logs (user_id, log_date);
create index if not exists food_logs_user_updated_idx on public.food_logs (user_id, updated_at);
create index if not exists food_logs_meal_idx on public.food_logs (meal_log_id);

create table if not exists public.saved_meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists saved_meals_user_idx on public.saved_meals (user_id);

create table if not exists public.saved_meal_items (
  id bigserial primary key,
  saved_meal_id uuid not null references public.saved_meals (id) on delete cascade,
  food_slug text not null references public.food_items (slug),
  variant_slug text not null,
  grams numeric(8,2) not null check (grams > 0)
);

create table if not exists public.weight_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  measured_on date not null,
  weight_kg numeric(5,2) not null check (weight_kg > 10 and weight_kg < 400),
  body_fat_pct numeric(4,1),
  note text,
  created_at timestamptz not null default now(),
  unique (user_id, measured_on)
);

create index if not exists weight_history_user_idx on public.weight_history (user_id, measured_on desc);

-- ---------------------------------------------------------------------------
alter table public.meal_logs enable row level security;
alter table public.food_logs enable row level security;
alter table public.saved_meals enable row level security;
alter table public.saved_meal_items enable row level security;
alter table public.weight_history enable row level security;

drop policy if exists meal_logs_own on public.meal_logs;
create policy meal_logs_own on public.meal_logs
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists food_logs_own on public.food_logs;
create policy food_logs_own on public.food_logs
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists saved_meals_own on public.saved_meals;
create policy saved_meals_own on public.saved_meals
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists saved_meal_items_own on public.saved_meal_items;
create policy saved_meal_items_own on public.saved_meal_items
  for all to authenticated using (
    exists (select 1 from public.saved_meals sm where sm.id = saved_meal_items.saved_meal_id and sm.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.saved_meals sm where sm.id = saved_meal_items.saved_meal_id and sm.user_id = auth.uid())
  );

drop policy if exists weight_history_own on public.weight_history;
create policy weight_history_own on public.weight_history
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop trigger if exists food_logs_set_updated_at on public.food_logs;
create trigger food_logs_set_updated_at before update on public.food_logs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Day rollup used by the dashboard and the web app.
-- ---------------------------------------------------------------------------
create or replace function public.day_totals(p_date date)
returns table (
  kcal numeric, protein_g numeric, carbs_g numeric, fat_g numeric,
  fibre_g numeric, sugar_g numeric, sodium_mg numeric, entries integer
)
language sql
stable
as $$
  select coalesce(sum(fl.kcal), 0),
         coalesce(sum(fl.protein_g), 0),
         coalesce(sum(fl.carbs_g), 0),
         coalesce(sum(fl.fat_g), 0),
         coalesce(sum(fl.fibre_g), 0),
         coalesce(sum(fl.sugar_g), 0),
         coalesce(sum(fl.sodium_mg), 0),
         count(*)::integer
  from public.food_logs fl
  where fl.user_id = auth.uid()
    and fl.log_date = p_date
    and fl.deleted_at is null;
$$;

grant execute on function public.day_totals(date) to authenticated;
