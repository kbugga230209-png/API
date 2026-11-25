-- 0001_init_shared.sql
-- BharatBite — shared extensions, enums and helper functions.
-- Every later migration depends on the types created here.

create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type cuisine_t as enum (
    'gujarati','punjabi','rajasthani','maharashtrian','bengali','south_indian',
    'north_indian','kashmiri','bihari','odia','northeastern','street_food',
    'pan_indian','not_regional'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type food_category_t as enum (
    'grain_cereal','roti_bread','dal_legume','vegetable_sabzi','paneer_dairy',
    'non_veg_curry','rice_dish','breakfast','snack_street_food','sweet_dessert',
    'beverage','condiment_chutney','salad_raita','soup','egg','fruit',
    'dry_fruit_nut','oil_fat','spice_masala','raw_ingredient','mixed_meal'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type meal_type_t as enum (
    'breakfast','mid_morning','lunch','evening_snack','dinner','midnight'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type verification_t as enum (
    'source_verified','calculated_from_recipe','needs_audit'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type entitlement_status_t as enum (
    'free','pending','active','past_due','cancelled','expired','refunded'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type plan_code_t as enum ('free','plus_monthly','plus_annual');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_kind_t as enum ('auto_renew','manual_cycle');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_status_t as enum ('created','authorized','captured','failed','refunded');
exception when duplicate_object then null; end $$;

do $$ begin
  create type log_source_t as enum ('ai_scan','manual_search','saved_meal','recipe','barcode');
exception when duplicate_object then null; end $$;

do $$ begin
  create type activity_level_t as enum ('sedentary','light','moderate','active','very_active');
exception when duplicate_object then null; end $$;

do $$ begin
  create type goal_t as enum ('lose','maintain','gain');
exception when duplicate_object then null; end $$;

do $$ begin
  create type theme_mode_t as enum ('light','dark','system');
exception when duplicate_object then null; end $$;

do $$ begin
  create type model_channel_t as enum ('dev','beta','stable');
exception when duplicate_object then null; end $$;

do $$ begin
  create type diet_plan_status_t as enum ('draft','active','archived');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Simple fixed-window rate limiter used by Edge Functions.
create table if not exists public.api_rate_limits (
  bucket text primary key,
  window_start timestamptz not null default now(),
  hits integer not null default 0
);
alter table public.api_rate_limits enable row level security;
revoke all on public.api_rate_limits from anon, authenticated;

create or replace function public.check_rate_limit(p_bucket text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_row public.api_rate_limits;
begin
  insert into public.api_rate_limits (bucket, window_start, hits)
  values (p_bucket, v_now, 1)
  on conflict (bucket) do update
    set hits = case
                 when public.api_rate_limits.window_start < v_now - make_interval(secs => p_window_seconds) then 1
                 else public.api_rate_limits.hits + 1
               end,
        window_start = case
                 when public.api_rate_limits.window_start < v_now - make_interval(secs => p_window_seconds) then v_now
                 else public.api_rate_limits.window_start
               end
  returning * into v_row;

  return v_row.hits <= p_limit;
end;
$$;

revoke all on function public.check_rate_limit(text, integer, integer) from public;
grant execute on function public.check_rate_limit(text, integer, integer) to service_role;
