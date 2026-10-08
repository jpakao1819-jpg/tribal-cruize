-- Tribal Cruize — Supabase schema
-- Run in the Supabase SQL editor (Dashboard -> SQL Editor -> New query).
-- Safe to re-run: uses IF NOT EXISTS / ON CONFLICT throughout.

-- ============================================================ storefronts ===
create table if not exists public.storefronts (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users (id) on delete cascade,
  name text not null default '',
  bio text default '',
  logo text default '',
  tier text not null default 'basic',
  status text not null default 'pending',   -- pending | active | suspended
  stripe_account_id text,
  created_at timestamptz not null default now()
);

create index if not exists storefronts_owner_idx on public.storefronts (owner);
create index if not exists storefronts_status_idx on public.storefronts (status);

-- ================================================================ products ===
-- Column is camelCase on purpose: the frontend uses "storefrontId".
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  "storefrontId" uuid not null references public.storefronts (id) on delete cascade,
  title text not null,
  price integer not null default 0,          -- amount in cents
  description text default '',
  image text default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists products_store_idx on public.products ("storefrontId");

-- ================================================================== orders ===
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  buyer_email text default '',
  "storefrontId" uuid references public.storefronts (id) on delete set null,
  "productId" uuid,
  title text default '',
  kind text not null default 'product',      -- product | space
  tier text,
  qty integer not null default 1,
  amount integer not null default 0,         -- cents
  currency text not null default 'PGK',
  status text not null default 'pending',    -- pending_payment | paid | refunded
  reference text,                            -- payment reference, e.g. TC-8F3K2A
  payment_method text,                       -- bank | mycash | cod
  stripe_session text,
  created_at timestamptz not null default now()
);

create index if not exists orders_store_idx on public.orders ("storefrontId");

-- ======================================================= row level security ===
alter table public.storefronts enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;

drop policy if exists "storefronts read" on public.storefronts;
create policy "storefronts read" on public.storefronts
  for select using (status = 'active' or owner = auth.uid());

drop policy if exists "storefronts insert own" on public.storefronts;
create policy "storefronts insert own" on public.storefronts
  for insert with check (owner = auth.uid());

drop policy if exists "storefronts update own" on public.storefronts;
create policy "storefronts update own" on public.storefronts
  for update using (owner = auth.uid());

drop policy if exists "storefronts delete own" on public.storefronts;
create policy "storefronts delete own" on public.storefronts
  for delete using (owner = auth.uid());

drop policy if exists "products read" on public.products;
create policy "products read" on public.products
  for select using (
    active = true
    or exists (
      select 1 from public.storefronts s
      where s.id = "storefrontId" and s.owner = auth.uid()
    )
  );

drop policy if exists "products insert own" on public.products;
create policy "products insert own" on public.products
  for insert with check (
    exists (
      select 1 from public.storefronts s
      where s.id = "storefrontId" and s.owner = auth.uid()
    )
  );

drop policy if exists "products update own" on public.products;
create policy "products update own" on public.products
  for update using (
    exists (
      select 1 from public.storefronts s
      where s.id = "storefrontId" and s.owner = auth.uid()
    )
  );

drop policy if exists "products delete own" on public.products;
create policy "products delete own" on public.products
  for delete using (
    exists (
      select 1 from public.storefronts s
      where s.id = "storefrontId" and s.owner = auth.uid()
    )
  );

-- Orders are written by the Stripe webhook (service role bypasses RLS);
-- vendors can read orders for their own storefront, nobody else.
drop policy if exists "orders read own" on public.orders;
create policy "orders read own" on public.orders
  for select using (
    exists (
      select 1 from public.storefronts s
      where s.id = "storefrontId" and s.owner = auth.uid()
    )
  );

-- Shoppers (guests included) may only place an order in the
-- `pending_payment` state; the vendor then marks it paid (below).
drop policy if exists "orders insert as pending" on public.orders;
create policy "orders insert as pending" on public.orders
  for insert with check (status = 'pending_payment');

-- Vendors confirm payment for their own orders.
drop policy if exists "orders update own" on public.orders;
create policy "orders update own" on public.orders
  for update using (
    exists (
      select 1 from public.storefronts s
      where s.id = "storefrontId" and s.owner = auth.uid()
    )
  );

-- ================================================================ storage ====
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "product images public read" on storage.objects;
create policy "product images public read" on storage.objects
  for select using (bucket_id = 'product-images');

drop policy if exists "product images authed write" on storage.objects;
create policy "product images authed write" on storage.objects
  for insert to authenticated with check (bucket_id = 'product-images');

drop policy if exists "product images authed update" on storage.objects;
create policy "product images authed update" on storage.objects
  for update to authenticated using (bucket_id = 'product-images');

drop policy if exists "product images authed delete" on storage.objects;
create policy "product images authed delete" on storage.objects
  for delete to authenticated using (bucket_id = 'product-images');

-- ===================================================== clothing library ===========
-- Registered garments (reusable 3D clothing templates) and the designs
-- created from them. The 3D artifact is stored as a JSON document so
-- geometry, sections, front/back surfaces, sleeves, collar, cuffs, hems,
-- UV mapping and editable-region metadata all survive registration.
create table if not exists public.clothing (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  description text default '',
  category text default '',
  fabric text default '',
  tags text default '',                        -- comma-separated
  status text not null default 'registered',   -- draft | registered | archived
  thumbnail text default '',
  garment_3d jsonb default '{}'::jsonb,        -- the editable 3D garment
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists clothing_created_by_idx on public.clothing (created_by);
create index if not exists clothing_status_idx on public.clothing (status);

create table if not exists public.designs (
  id uuid primary key default gen_random_uuid(),
  "garmentId" uuid not null references public.clothing (id) on delete cascade,
  name text not null default '',
  description text default '',
  fabric_override text default '',
  colors jsonb default '{}'::jsonb,            -- section -> color overrides
  applied_art jsonb default '{}'::jsonb,       -- artwork + placement on the garment
  status text not null default 'open',         -- open | done
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists designs_garment_idx on public.designs ("garmentId");

alter table public.clothing enable row level security;
alter table public.designs enable row level security;

drop policy if exists "clothing read own" on public.clothing;
create policy "clothing read own" on public.clothing
  for select using (created_by = auth.uid());

drop policy if exists "clothing insert own" on public.clothing;
create policy "clothing insert own" on public.clothing
  for insert with check (created_by = auth.uid());

drop policy if exists "clothing update own" on public.clothing;
create policy "clothing update own" on public.clothing
  for update using (created_by = auth.uid());

drop policy if exists "clothing delete own" on public.clothing;
create policy "clothing delete own" on public.clothing
  for delete using (created_by = auth.uid());

drop policy if exists "designs read own" on public.designs;
create policy "designs read own" on public.designs
  for select using (created_by = auth.uid());

drop policy if exists "designs insert own" on public.designs;
create policy "designs insert own" on public.designs
  for insert with check (created_by = auth.uid());

drop policy if exists "designs delete own" on public.designs;
create policy "designs delete own" on public.designs
  for delete using (created_by = auth.uid());

-- End clothing library block.
