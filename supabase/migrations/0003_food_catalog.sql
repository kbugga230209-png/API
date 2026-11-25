-- 0003_food_catalog.sql
-- Public Indian food reference data. Read-only for clients; only service_role
-- (seed pipeline / admin) may modify it.

create table if not exists public.food_items (
  slug text primary key,
  name text not null,
  name_local text,
  cuisine cuisine_t not null default 'not_regional',
  category food_category_t not null,
  default_variant text not null default 'homemade',
  verification verification_t not null default 'needs_audit',
  notes text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists food_items_category_idx on public.food_items (category);
create index if not exists food_items_cuisine_idx on public.food_items (cuisine);
create index if not exists food_items_name_trgm_idx on public.food_items using gin (name gin_trgm_ops);

create table if not exists public.food_aliases (
  id bigserial primary key,
  food_slug text not null references public.food_items (slug) on delete cascade,
  alias text not null,
  language text not null,
  kind text,
  unique (food_slug, alias, language)
);

create index if not exists food_aliases_alias_trgm_idx on public.food_aliases using gin (alias gin_trgm_ops);
create index if not exists food_aliases_slug_idx on public.food_aliases (food_slug);

create table if not exists public.food_variants (
  id uuid primary key default gen_random_uuid(),
  food_slug text not null references public.food_items (slug) on delete cascade,
  slug text not null,
  label text not null,
  preparation_style text not null check (preparation_style in ('homemade','restaurant','packaged','street')),
  consistency text check (consistency in ('dry','semi_gravy','gravy','liquid','solid')),
  oil_level text check (oil_level in ('low','medium','high')),
  is_default boolean not null default false,
  source text not null,
  source_reference text,
  methodology text not null check (methodology in (
    'ifct_value','usda_value','standardized_recipe_calculation','label_declaration','owner_supplied'
  )),
  unique (food_slug, slug)
);

create index if not exists food_variants_food_idx on public.food_variants (food_slug);

create table if not exists public.food_nutrition (
  variant_id uuid primary key references public.food_variants (id) on delete cascade,
  basis_grams integer not null default 100 check (basis_grams > 0),
  kcal numeric(8,2) not null check (kcal >= 0),
  protein_g numeric(8,2) not null check (protein_g >= 0),
  carbs_g numeric(8,2) not null check (carbs_g >= 0),
  fat_g numeric(8,2) not null check (fat_g >= 0),
  sat_fat_g numeric(8,2) not null default 0 check (sat_fat_g >= 0),
  fibre_g numeric(8,2) not null default 0 check (fibre_g >= 0),
  sugar_g numeric(8,2) not null default 0 check (sugar_g >= 0),
  sodium_mg numeric(8,2) not null default 0 check (sodium_mg >= 0),
  verified_at timestamptz,
  check (sat_fat_g <= fat_g + 1),
  check (sugar_g <= carbs_g + 1)
);

create table if not exists public.food_servings (
  id bigserial primary key,
  variant_id uuid not null references public.food_variants (id) on delete cascade,
  label text not null,
  grams numeric(8,2) not null check (grams > 0),
  household text,
  is_default boolean not null default false
);

create index if not exists food_servings_variant_idx on public.food_servings (variant_id);

-- ---------------------------------------------------------------------------
-- Recipes (used by the recipe builder and to document composite-dish math)
-- ---------------------------------------------------------------------------
create table if not exists public.food_recipes (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  food_slug text references public.food_items (slug) on delete set null,
  name text not null,
  servings integer not null default 2 check (servings > 0),
  cooked_yield_grams numeric(8,2) not null check (cooked_yield_grams > 0),
  instructions text,
  source text not null default 'BharatBite standardized recipe',
  created_at timestamptz not null default now()
);

create table if not exists public.recipe_ingredients (
  id bigserial primary key,
  recipe_id uuid not null references public.food_recipes (id) on delete cascade,
  ingredient_slug text not null references public.food_items (slug),
  grams numeric(8,2) not null check (grams >= 0),
  note text,
  unique (recipe_id, ingredient_slug)
);

create index if not exists recipe_ingredients_recipe_idx on public.recipe_ingredients (recipe_id);

-- ---------------------------------------------------------------------------
-- RLS: catalog is readable by anyone (it is public reference data) but writable
-- only by service_role, which bypasses RLS.
-- ---------------------------------------------------------------------------
alter table public.food_items enable row level security;
alter table public.food_aliases enable row level security;
alter table public.food_variants enable row level security;
alter table public.food_nutrition enable row level security;
alter table public.food_servings enable row level security;
alter table public.food_recipes enable row level security;
alter table public.recipe_ingredients enable row level security;

drop policy if exists food_items_public_read on public.food_items;
create policy food_items_public_read on public.food_items for select to anon, authenticated using (true);

drop policy if exists food_aliases_public_read on public.food_aliases;
create policy food_aliases_public_read on public.food_aliases for select to anon, authenticated using (true);

drop policy if exists food_variants_public_read on public.food_variants;
create policy food_variants_public_read on public.food_variants for select to anon, authenticated using (true);

drop policy if exists food_nutrition_public_read on public.food_nutrition;
create policy food_nutrition_public_read on public.food_nutrition for select to anon, authenticated using (true);

drop policy if exists food_servings_public_read on public.food_servings;
create policy food_servings_public_read on public.food_servings for select to anon, authenticated using (true);

drop policy if exists food_recipes_public_read on public.food_recipes;
create policy food_recipes_public_read on public.food_recipes for select to anon, authenticated using (true);

drop policy if exists recipe_ingredients_public_read on public.recipe_ingredients;
create policy recipe_ingredients_public_read on public.recipe_ingredients for select to anon, authenticated using (true);

-- Belt and braces: block accidental writes from client roles.
revoke insert, update, delete on public.food_items, public.food_aliases, public.food_variants,
  public.food_nutrition, public.food_servings, public.food_recipes, public.recipe_ingredients
  from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Search RPC: alias-aware, trigram-similarity fallback, always read-only.
-- ---------------------------------------------------------------------------
create or replace function public.search_foods(q text, lim integer default 20)
returns table (
  slug text,
  name text,
  name_local text,
  cuisine cuisine_t,
  category food_category_t,
  matched_alias text,
  score real,
  kcal numeric,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric
)
language sql
stable
as $$
  with needle as (select lower(trim(coalesce(q, ''))) as term)
  select fi.slug,
         fi.name,
         fi.name_local,
         fi.cuisine,
         fi.category,
         coalesce(best.alias, fi.name) as matched_alias,
         best.score,
         fn.kcal, fn.protein_g, fn.carbs_g, fn.fat_g
  from food_items fi
  join lateral (
    select lower(trim(coalesce(fi.name, ''))) as alias, 1.0::real as score
    union all
    select fa.alias, similarity(lower(fa.alias), (select term from needle))
    from food_aliases fa where fa.food_slug = fi.slug
  ) as best on true
  join food_variants fv on fv.food_slug = fi.slug and fv.slug = fi.default_variant
  join food_nutrition fn on fn.variant_id = fv.id
  where (select term from needle) <> ''
    and (
      best.alias = (select term from needle)
      or best.score >= 0.3
      or lower(fi.name) like '%' || (select term from needle) || '%'
    )
  order by best.score desc, fi.name asc
  limit greatest(1, least(coalesce(lim, 20), 100));
$$;

grant execute on function public.search_foods(text, integer) to anon, authenticated;
