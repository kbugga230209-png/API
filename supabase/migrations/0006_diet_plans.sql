-- 0006_diet_plans.sql
-- Plus-only diet planner storage. Reading is always allowed (a lapsed member
-- keeps their history); creating or changing plans requires active Plus, checked
-- by has_plus_access() inside the RLS policy as well as by the API layer.

create table if not exists public.diet_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  week_start date not null,
  title text not null default 'Weekly Indian meal plan',
  status diet_plan_status_t not null default 'active',
  preferences_snapshot jsonb not null default '{}'::jsonb,
  targets_snapshot jsonb not null default '{}'::jsonb,
  notes text[] not null default '{}',
  estimated_cost_inr numeric(8,2),
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week_start)
);

create index if not exists diet_plans_user_idx on public.diet_plans (user_id, week_start desc);

create table if not exists public.diet_plan_meals (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.diet_plans (id) on delete cascade,
  day_index smallint not null check (day_index between 0 and 6),
  meal_type meal_type_t not null,
  food_slug text not null references public.food_items (slug),
  grams numeric(8,2) not null check (grams > 0),
  kcal numeric(8,2) not null default 0,
  protein_g numeric(8,2) not null default 0,
  carbs_g numeric(8,2) not null default 0,
  fat_g numeric(8,2) not null default 0,
  cost_inr numeric(8,2) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists diet_plan_meals_plan_idx on public.diet_plan_meals (plan_id, day_index);

create table if not exists public.grocery_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.diet_plans (id) on delete cascade,
  name text not null,
  grams numeric(8,2) not null default 0,
  cost_inr numeric(8,2) not null default 0,
  checked boolean not null default false
);

create index if not exists grocery_items_plan_idx on public.grocery_items (plan_id);

-- ---------------------------------------------------------------------------
alter table public.diet_plans enable row level security;
alter table public.diet_plan_meals enable row level security;
alter table public.grocery_items enable row level security;

drop policy if exists diet_plans_select_own on public.diet_plans;
create policy diet_plans_select_own on public.diet_plans
  for select to authenticated using (user_id = auth.uid());

drop policy if exists diet_plans_insert_plus on public.diet_plans;
create policy diet_plans_insert_plus on public.diet_plans
  for insert to authenticated
  with check (user_id = auth.uid() and public.has_plus_access(auth.uid()));

drop policy if exists diet_plans_update_plus on public.diet_plans;
create policy diet_plans_update_plus on public.diet_plans
  for update to authenticated
  using (user_id = auth.uid() and public.has_plus_access(auth.uid()))
  with check (user_id = auth.uid());

drop policy if exists diet_plans_delete_own on public.diet_plans;
create policy diet_plans_delete_own on public.diet_plans
  for delete to authenticated using (user_id = auth.uid());

drop policy if exists diet_plan_meals_own on public.diet_plan_meals;
create policy diet_plan_meals_own on public.diet_plan_meals
  for all to authenticated
  using (exists (select 1 from public.diet_plans p where p.id = diet_plan_meals.plan_id and p.user_id = auth.uid()))
  with check (
    exists (select 1 from public.diet_plans p where p.id = diet_plan_meals.plan_id and p.user_id = auth.uid())
    and public.has_plus_access(auth.uid())
  );

drop policy if exists grocery_items_own on public.grocery_items;
create policy grocery_items_own on public.grocery_items
  for all to authenticated
  using (exists (select 1 from public.diet_plans p where p.id = grocery_items.plan_id and p.user_id = auth.uid()))
  with check (exists (select 1 from public.diet_plans p where p.id = grocery_items.plan_id and p.user_id = auth.uid()));

drop trigger if exists diet_plans_set_updated_at on public.diet_plans;
create trigger diet_plans_set_updated_at before update on public.diet_plans
  for each row execute function public.set_updated_at();
