-- 0005_billing.sql
-- Razorpay subscriptions, manual-cycle orders, and the immutable webhook ledger.
-- Writes happen only from Edge Functions using the service-role key. Clients can
-- read their own rows, never write them: Plus is never unlocked by the app.

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  provider text not null default 'razorpay',
  provider_subscription_id text not null,
  provider_plan_id text,
  plan_code plan_code_t not null,
  status text not null check (status in (
    'created','authenticated','active','pending','halted','cancelled','completed','expired'
  )),
  current_start timestamptz,
  current_end timestamptz,
  grace_until timestamptz,
  cancel_at_period_end boolean not null default false,
  ended_at timestamptz,
  short_url text,
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_subscription_id)
);

create index if not exists subscriptions_user_idx on public.subscriptions (user_id);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  provider text not null default 'razorpay',
  kind payment_kind_t not null,
  status payment_status_t not null default 'created',
  plan_code plan_code_t not null,
  provider_order_id text,
  provider_payment_id text,
  provider_subscription_id text,
  amount_paise integer not null check (amount_paise > 0),
  currency char(3) not null default 'INR',
  receipt text,
  signature_verified boolean not null default false,
  verified_at timestamptz,
  test_mode boolean not null default true,
  notes jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists payments_order_uidx on public.payments (provider_order_id) where provider_order_id is not null;
create unique index if not exists payments_payment_uidx on public.payments (provider_payment_id) where provider_payment_id is not null;
create index if not exists payments_user_idx on public.payments (user_id, created_at desc);

create table if not exists public.payment_events (
  id bigserial primary key,
  provider text not null default 'razorpay',
  event_id text not null,
  event_type text not null,
  signature_valid boolean not null default false,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  status text not null default 'received' check (status in ('received','processed','ignored','failed')),
  error text,
  unique (provider, event_id)
);

create index if not exists payment_events_type_idx on public.payment_events (event_type, received_at desc);

-- ---------------------------------------------------------------------------
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;
alter table public.payment_events enable row level security;

drop policy if exists subscriptions_select_own on public.subscriptions;
create policy subscriptions_select_own on public.subscriptions
  for select to authenticated using (user_id = auth.uid());

drop policy if exists payments_select_own on public.payments;
create policy payments_select_own on public.payments
  for select to authenticated using (user_id = auth.uid());

-- payment_events intentionally has no client policy at all.
revoke all on public.payment_events from anon, authenticated;
revoke insert, update, delete on public.subscriptions, public.payments from anon, authenticated;
revoke insert, update, delete on public.entitlements from anon, authenticated;
grant select on public.subscriptions, public.payments, public.entitlements to authenticated;

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();

drop trigger if exists payments_set_updated_at on public.payments;
create trigger payments_set_updated_at before update on public.payments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Single, audited way to change an entitlement. Only service_role may call it.
-- ---------------------------------------------------------------------------
create or replace function public.apply_entitlement(
  p_user uuid,
  p_status entitlement_status_t,
  p_plan plan_code_t,
  p_period_start timestamptz default null,
  p_period_end timestamptz default null,
  p_grace_until timestamptz default null,
  p_cancel_at_period_end boolean default false,
  p_source text default 'razorpay'
)
returns public.entitlements
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.entitlements;
begin
  insert into public.entitlements (
    user_id, status, plan_code, current_period_start, current_period_end,
    grace_until, cancel_at_period_end, source, version
  )
  values (p_user, p_status, p_plan, p_period_start, p_period_end, p_grace_until, p_cancel_at_period_end, p_source, 1)
  on conflict (user_id) do update
    set status = excluded.status,
        plan_code = excluded.plan_code,
        current_period_start = coalesce(excluded.current_period_start, public.entitlements.current_period_start),
        current_period_end = coalesce(excluded.current_period_end, public.entitlements.current_period_end),
        grace_until = excluded.grace_until,
        cancel_at_period_end = excluded.cancel_at_period_end,
        source = excluded.source,
        version = public.entitlements.version + 1,
        updated_at = now()
  returning * into v_row;

  -- Free means free: clear paid fields so the client cannot read stale dates.
  if v_row.plan_code = 'free' then
    update public.entitlements
       set current_period_start = null, current_period_end = null,
           grace_until = null, cancel_at_period_end = false
     where user_id = p_user
     returning * into v_row;
  end if;

  return v_row;
end;
$$;

revoke all on function public.apply_entitlement(uuid, entitlement_status_t, plan_code_t, timestamptz, timestamptz, timestamptz, boolean, text) from public;
grant execute on function public.apply_entitlement(uuid, entitlement_status_t, plan_code_t, timestamptz, timestamptz, timestamptz, boolean, text) to service_role;
