-- 0002_profiles.sql
-- User identity surface: profile, preferences, devices, and the signup trigger.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_path text,
  locale text not null default 'en-IN',
  timezone text not null default 'Asia/Kolkata',
  onboarding_completed boolean not null default false,
  ai_model_installed boolean not null default false,
  ai_model_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = auth.uid());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
create table if not exists public.user_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  theme_mode theme_mode_t not null default 'system',
  theme_id text not null default 'bharat-default',
  accent_color text not null default '#E4572E',
  diet_type text not null default 'vegetarian',
  cuisine_preference text not null default 'mixed',
  allergies text[] not null default '{}',
  restrictions text[] not null default '{}',
  monthly_budget_inr integer,
  prep_time_minutes integer not null default 30,
  meal_frequency smallint not null default 4,
  meal_schedule jsonb not null default '{"breakfast":"08:00","lunch":"13:00","evening_snack":"17:30","dinner":"20:30"}'::jsonb,
  dashboard_layout jsonb not null default '[]'::jsonb,
  height_cm numeric(5,1),
  sex text,
  birth_year smallint,
  activity_level activity_level_t not null default 'moderate',
  goal goal_t not null default 'maintain',
  target_weight_kg numeric(5,1),
  daily_kcal_target integer,
  protein_target_g integer,
  carb_target_g integer,
  fat_target_g integer,
  fibre_target_g integer,
  units text not null default 'metric',
  notifications_enabled boolean not null default true,
  health_disclaimer_accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- cuisine_preference needs to allow 'mixed' which is not a cuisine value.
alter table public.user_preferences
  drop constraint if exists user_preferences_cuisine_preference_check;
alter table public.user_preferences
  add constraint user_preferences_cuisine_preference_check
  check (prep_time_minutes between 5 and 240 and meal_frequency between 1 and 8);

alter table public.user_preferences enable row level security;

drop policy if exists prefs_select_own on public.user_preferences;
create policy prefs_select_own on public.user_preferences
  for select to authenticated using (user_id = auth.uid());

drop policy if exists prefs_insert_own on public.user_preferences;
create policy prefs_insert_own on public.user_preferences
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists prefs_update_own on public.user_preferences;
create policy prefs_update_own on public.user_preferences
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop trigger if exists prefs_set_updated_at on public.user_preferences;
create trigger prefs_set_updated_at before update on public.user_preferences
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  device_fingerprint text not null,
  platform text not null check (platform in ('android','ios','web')),
  app_version text,
  push_token text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, device_fingerprint)
);

create index if not exists devices_user_idx on public.devices (user_id);

alter table public.devices enable row level security;

drop policy if exists devices_own on public.devices;
create policy devices_own on public.devices
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Entitlements live with the identity surface because the signup trigger writes
-- one row per user; billing tables reference it in 0005.
-- ---------------------------------------------------------------------------
create table if not exists public.entitlements (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  status entitlement_status_t not null default 'free',
  plan_code plan_code_t not null default 'free',
  current_period_start timestamptz,
  current_period_end timestamptz,
  grace_until timestamptz,
  cancel_at_period_end boolean not null default false,
  source text not null default 'signup',
  version integer not null default 1,
  updated_at timestamptz not null default now()
);

create index if not exists entitlements_status_idx on public.entitlements (status);

alter table public.entitlements enable row level security;

-- Users may read their own entitlement. Only service_role may write it: there is
-- intentionally no insert/update/delete policy for anon or authenticated.
drop policy if exists entitlements_select_own on public.entitlements;
create policy entitlements_select_own on public.entitlements
  for select to authenticated using (user_id = auth.uid());

drop trigger if exists entitlements_set_updated_at on public.entitlements;
create trigger entitlements_set_updated_at before update on public.entitlements
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Central Plus check. Mirrors packages/core/src/entitlements.ts::isPlusActive.
-- SECURITY DEFINER so RLS policies on other tables can call it without needing
-- the caller to have select rights on `entitlements`. Defined here, after the
-- table it reads, so a clean replay of 0001..0008 succeeds in filename order.
create or replace function public.has_plus_access(p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select case
      when e.plan_code = 'free' then false
      when e.status in ('active','cancelled') then e.current_period_end is not null and e.current_period_end > now()
      when e.status = 'past_due' then coalesce(e.grace_until, e.current_period_end) > now()
      else false
    end
    from public.entitlements e
    where e.user_id = p_user
  ), false);
$$;

revoke all on function public.has_plus_access(uuid) from public;
grant execute on function public.has_plus_access(uuid) to authenticated, anon;

-- ---------------------------------------------------------------------------
-- Signup bootstrap: profile, preferences and a free entitlement row.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;

  insert into public.user_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  insert into public.entitlements (user_id, status, plan_code)
  values (new.id, 'free', 'free')
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
