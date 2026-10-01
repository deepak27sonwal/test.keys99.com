-- =========================================================
-- KEYS99 - SUPABASE SETUP FOR THE ADMIN PANEL
-- Run this once in your Supabase project's SQL Editor, after
-- supabase-setup.sql has already been run.
--
-- Safe to re-run: every step either uses IF NOT EXISTS or
-- drops-then-recreates, so running this twice won't error
-- or duplicate anything.
--
-- After running this, make YOURSELF an admin (see the DONE
-- section at the bottom) - otherwise admin-login.html will
-- have nobody who can sign in.
-- =========================================================


-- =========================================================
-- 1. is_admin FLAG + HELPER FUNCTION
-- One flag on the existing profiles table. The helper
-- function is security definer so RLS policies elsewhere can
-- call it without each policy having to read profiles itself
-- (which would otherwise recurse into profiles' own RLS).
-- =========================================================

alter table public.profiles add column if not exists is_admin boolean not null default false;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

grant execute on function public.is_admin() to anon, authenticated;

-- Admins can view every profile (regular users can already
-- view only their own, from supabase-setup.sql).

drop policy if exists "Admins can view all profiles" on public.profiles;
create policy "Admins can view all profiles"
  on public.profiles for select
  using (public.is_admin());

drop policy if exists "Admins can update all profiles" on public.profiles;
create policy "Admins can update all profiles"
  on public.profiles for update
  using (public.is_admin());


-- =========================================================
-- 2. AGENTS TABLE
-- Admin-managed directory of agents. Not tied to a login -
-- admin adds/edits/verifies/suspends these directly.
-- =========================================================

create table if not exists public.agents (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  company_name text,
  email text,
  phone text,
  rera_id text,
  photo_url text,
  bio text,
  verified boolean not null default false,
  status text not null default 'active' check (status in ('active','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.agents enable row level security;

drop policy if exists "Agents are publicly viewable" on public.agents;
create policy "Agents are publicly viewable"
  on public.agents for select
  using (status = 'active');

drop policy if exists "Admins manage agents" on public.agents;
create policy "Admins manage agents"
  on public.agents for all
  using (public.is_admin())
  with check (public.is_admin());


-- =========================================================
-- 3. DEVELOPERS TABLE
-- Admin-managed directory of developers, separate from the
-- free-text properties.developer column (which stays as-is
-- for backward compatibility with existing listings).
-- =========================================================

create table if not exists public.developers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  description text,
  rera_id text,
  website text,
  contact_email text,
  contact_phone text,
  verified boolean not null default false,
  status text not null default 'active' check (status in ('active','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.developers enable row level security;

drop policy if exists "Developers are publicly viewable" on public.developers;
create policy "Developers are publicly viewable"
  on public.developers for select
  using (status = 'active');

drop policy if exists "Admins manage developers" on public.developers;
create policy "Admins manage developers"
  on public.developers for all
  using (public.is_admin())
  with check (public.is_admin());


-- =========================================================
-- 4. PROPERTY MODERATION
-- moderation_status is separate from the existing "status"
-- column (which means listing status - Available/Limited/
-- Sold Out - not a moderation workflow state).
--
-- Existing rows are backfilled to 'approved' so nothing
-- currently live disappears from the site. New rows default
-- to 'pending' automatically (post-property.html doesn't need
-- any change), so every freshly-posted listing now waits for
-- admin approval before the public can see it.
--
-- agent_id / developer_id let admin link a listing to an
-- entry in the new directories above; both are optional and
-- don't replace the existing developer text column.
-- =========================================================

alter table public.projects add column if not exists moderation_status text not null default 'pending'
  check (moderation_status in ('pending','approved','rejected','suspended','sold','expired'));

update public.projects set moderation_status = 'approved' where moderation_status = 'pending';

alter table public.projects add column if not exists agent_id uuid references public.agents(id) on delete set null;
alter table public.projects add column if not exists developer_id uuid references public.developers(id) on delete set null;

-- Replace the old "anyone can see every property" policy with
-- one that only shows approved listings publicly, while still
-- letting an owner manage their own listing at any status and
-- letting admin see and moderate everything.

drop policy if exists "Properties are publicly viewable" on public.projects;
create policy "Properties are publicly viewable"
  on public.projects for select
  using (
    moderation_status = 'approved'
    or posted_by_user_id = auth.uid()::text
    or public.is_admin()
  );

drop policy if exists "Admins manage all properties" on public.projects;
create policy "Admins manage all properties"
  on public.projects for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins can delete properties" on public.projects;
create policy "Admins can delete properties"
  on public.projects for delete
  using (public.is_admin());


-- =========================================================
-- 5. REVIEWS TABLE
-- A review belongs to either a property or a developer (not
-- both). Pending until admin approves it, then publicly
-- visible.
-- =========================================================

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references public.projects(id) on delete cascade,
  developer_id uuid references public.developers(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  reviewer_name text,
  rating integer not null check (rating between 1 and 5),
  comment text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  constraint reviews_one_target check (
    (property_id is not null and developer_id is null)
    or (property_id is null and developer_id is not null)
  )
);

alter table public.reviews enable row level security;

drop policy if exists "Approved reviews are publicly viewable" on public.reviews;
create policy "Approved reviews are publicly viewable"
  on public.reviews for select
  using (status = 'approved' or user_id = auth.uid() or public.is_admin());

drop policy if exists "Signed-in users can submit reviews" on public.reviews;
create policy "Signed-in users can submit reviews"
  on public.reviews for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Admins moderate reviews" on public.reviews;
create policy "Admins moderate reviews"
  on public.reviews for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins delete reviews" on public.reviews;
create policy "Admins delete reviews"
  on public.reviews for delete
  using (public.is_admin());


-- =========================================================
-- 6. CITIES + LOCALITIES
-- Reference data admin curates. search.html/index.html can
-- optionally read these later for city/locality pickers -
-- for now this just gives admin somewhere to manage them.
-- =========================================================

create table if not exists public.cities (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  state text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.cities enable row level security;

drop policy if exists "Cities are publicly viewable" on public.cities;
create policy "Cities are publicly viewable"
  on public.cities for select
  using (true);

drop policy if exists "Admins manage cities" on public.cities;
create policy "Admins manage cities"
  on public.cities for all
  using (public.is_admin())
  with check (public.is_admin());

create table if not exists public.localities (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities(id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (city_id, name)
);

alter table public.localities enable row level security;

drop policy if exists "Localities are publicly viewable" on public.localities;
create policy "Localities are publicly viewable"
  on public.localities for select
  using (true);

drop policy if exists "Admins manage localities" on public.localities;
create policy "Admins manage localities"
  on public.localities for all
  using (public.is_admin())
  with check (public.is_admin());


-- =========================================================
-- 7. SITE VISITS
-- Booking requests ("I want to visit this property"),
-- separate from the existing page-view counter on
-- properties.views.
-- =========================================================

create table if not exists public.site_visits (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references public.projects(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  name text,
  phone text,
  email text,
  preferred_date date,
  preferred_time text,
  status text not null default 'pending' check (status in ('pending','confirmed','completed','cancelled')),
  created_at timestamptz not null default now()
);

alter table public.site_visits enable row level security;

drop policy if exists "Anyone can request a site visit" on public.site_visits;
create policy "Anyone can request a site visit"
  on public.site_visits for insert
  with check (true);

drop policy if exists "Owners and admins view site visits" on public.site_visits;
create policy "Owners and admins view site visits"
  on public.site_visits for select
  using (
    public.is_admin()
    or user_id = auth.uid()
    or exists (
      select 1 from public.projects p
      where p.id = site_visits.property_id
      and p.posted_by_user_id = auth.uid()::text
    )
  );

drop policy if exists "Owners and admins update site visits" on public.site_visits;
create policy "Owners and admins update site visits"
  on public.site_visits for update
  using (
    public.is_admin()
    or exists (
      select 1 from public.projects p
      where p.id = site_visits.property_id
      and p.posted_by_user_id = auth.uid()::text
    )
  );


-- =========================================================
-- 8. ENQUIRIES - ADMIN VISIBILITY
-- supabase-setup.sql already lets a property's owner see its
-- enquiries. Admin needs to see every enquiry too (for
-- admin-enquiries.html).
-- =========================================================

drop policy if exists "Admins view all enquiries" on public.enquiries;
create policy "Admins view all enquiries"
  on public.enquiries for select
  using (public.is_admin());

drop policy if exists "Admins update all enquiries" on public.enquiries;
create policy "Admins update all enquiries"
  on public.enquiries for update
  using (public.is_admin());


-- =========================================================
-- DONE
-- 1. Confirm in the Dashboard: Table Editor -> agents,
--    developers, reviews, cities, localities, site_visits all
--    exist with RLS enabled; properties has moderation_status,
--    agent_id, developer_id; profiles has is_admin.
-- 2. Make yourself an admin - run this once, with your own
--    email, in the SQL Editor:
--
--      update public.profiles set is_admin = true
--      where id = (select id from auth.users where email = 'you@example.com');
--
--    You must already have an account (sign up on login.html
--    first if you haven't) before this will find a row.
-- 3. Sign in at admin-login.html with that same account.
-- =========================================================
