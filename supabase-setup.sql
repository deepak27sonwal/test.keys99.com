-- =========================================================
-- KEYS99 - SUPABASE SETUP FOR LOGIN + PROFILE
-- Run this once in your Supabase project's SQL Editor
-- (Dashboard -> SQL Editor -> New Query -> paste -> Run).
--
-- This project's config.js only carries the public anon key,
-- which can never create tables, buckets or policies on its
-- own - that requires your project's SQL Editor (or the
-- Dashboard UI) with your own login, which only you have.
--
-- Safe to re-run: every step either uses IF NOT EXISTS or
-- drops-then-recreates, so running this twice won't error
-- or duplicate anything.
-- =========================================================


-- =========================================================
-- 1. PROFILES TABLE
-- Holds the editable fields auth.users doesn't (full name,
-- phone, avatar). One row per user, keyed by their auth id.
-- =========================================================

create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  phone text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

-- Each user can only see/edit their own row.

drop policy if exists "Users can view their own profile" on public.profiles;
create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);


-- =========================================================
-- 2. AUTO-CREATE A PROFILE ROW ON SIGNUP (recommended)
-- profile.html also creates this row defensively on first
-- visit if it's missing, so this trigger is a nice-to-have,
-- not a hard requirement.
-- =========================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- =========================================================
-- 3. AVATAR STORAGE BUCKET
-- Public bucket named "users-avatars" - profile.html uploads
-- each photo to "<user id>/avatar.<ext>" and stores the
-- public URL on profiles.avatar_url.
-- =========================================================

insert into storage.buckets (id, name, public)
values ('users-avatars', 'users-avatars', true)
on conflict (id) do nothing;

-- Anyone can view avatars (it's a public profile photo).

drop policy if exists "Avatar images are publicly accessible" on storage.objects;
create policy "Avatar images are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'users-avatars');

-- A user can only upload/update/delete files inside their
-- own "<user id>/..." folder within the bucket.

drop policy if exists "Users can upload their own avatar" on storage.objects;
create policy "Users can upload their own avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'users-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can update their own avatar" on storage.objects;
create policy "Users can update their own avatar"
  on storage.objects for update
  using (
    bucket_id = 'users-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can delete their own avatar" on storage.objects;
create policy "Users can delete their own avatar"
  on storage.objects for delete
  using (
    bucket_id = 'users-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );


-- =========================================================
-- 4. PROPERTIES TABLE - ROW LEVEL SECURITY
-- post-property.html lets a signed-in user insert a new row
-- here. Enabling RLS + a public "select" policy keeps every
-- existing public listing page (index/search/details) working
-- exactly as before, while only allowing an authenticated user
-- to create or edit their OWN listings (matched by
-- posted_by_user_id, which the app always sets to auth.uid()).
-- =========================================================

-- Columns the listing form writes that were added after the table
-- was first created. Additive and nullable, so running this against
-- an existing database changes no data; a listing that leaves them
-- empty falls back to the title and description the build generates
-- from its own attributes.
alter table public.projects
  add column if not exists slug            text,
  add column if not exists title           text,
  add column if not exists description     text,
  add column if not exists seo_title       text,
  add column if not exists seo_description text;

alter table public.projects enable row level security;

drop policy if exists "Properties are publicly viewable" on public.projects;
create policy "Properties are publicly viewable"
  on public.projects for select
  using (true);

drop policy if exists "Signed-in users can post their own properties" on public.projects;
create policy "Signed-in users can post their own properties"
  on public.projects for insert
  to authenticated
  with check (posted_by_user_id = auth.uid()::text);

drop policy if exists "Users can update their own properties" on public.projects;
create policy "Users can update their own properties"
  on public.projects for update
  to authenticated
  using (posted_by_user_id = auth.uid()::text)
  with check (posted_by_user_id = auth.uid()::text);


-- =========================================================
-- 5. PROPERTY IMAGES STORAGE BUCKET
-- Public bucket named "property-images" - post-property.html
-- uploads the main photo (and any interior/exterior photo) to
-- "<user id>/<filename>" and stores the public URL on the
-- matching properties column.
-- =========================================================

insert into storage.buckets (id, name, public)
values ('property-images', 'property-images', true)
on conflict (id) do nothing;

drop policy if exists "Property images are publicly accessible" on storage.objects;
create policy "Property images are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'property-images');

drop policy if exists "Users can upload their own property images" on storage.objects;
create policy "Users can upload their own property images"
  on storage.objects for insert
  with check (
    bucket_id = 'property-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can update their own property images" on storage.objects;
create policy "Users can update their own property images"
  on storage.objects for update
  using (
    bucket_id = 'property-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can delete their own property images" on storage.objects;
create policy "Users can delete their own property images"
  on storage.objects for delete
  using (
    bucket_id = 'property-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );


-- =========================================================
-- 6. GALLERY + REELS COLUMNS ON PROPERTIES
-- gallery_images holds extra photos beyond main_image.
-- reels holds short property-tour video URLs.
-- =========================================================

alter table public.projects add column if not exists gallery_images text[] default '{}'::text[];
alter table public.projects add column if not exists reels text[] default '{}'::text[];


-- =========================================================
-- 7. ENQUIRIES TABLE
-- Lead-capture form on property-details.html. Anyone
-- (including anonymous visitors) can submit one; only the
-- property's own poster can read the leads that come in.
-- =========================================================

create table if not exists public.enquiries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  property_id uuid references public.projects(id) on delete cascade,
  name text,
  phone text,
  email text,
  message text,
  status text not null default 'new'
);

alter table public.enquiries enable row level security;

drop policy if exists "Anyone can submit an enquiry" on public.enquiries;
create policy "Anyone can submit an enquiry"
  on public.enquiries for insert
  with check (true);

drop policy if exists "Owners can view enquiries on their properties" on public.enquiries;
create policy "Owners can view enquiries on their properties"
  on public.enquiries for select
  using (
    exists (
      select 1 from public.projects p
      where p.id = enquiries.property_id
      and p.posted_by_user_id = auth.uid()::text
    )
  );

drop policy if exists "Owners can update enquiries on their properties" on public.enquiries;
create policy "Owners can update enquiries on their properties"
  on public.enquiries for update
  using (
    exists (
      select 1 from public.projects p
      where p.id = enquiries.property_id
      and p.posted_by_user_id = auth.uid()::text
    )
  );


-- =========================================================
-- 8. PROPERTY REELS STORAGE BUCKET
-- Public bucket named "property-reels" - post-property.html
-- uploads short videos to "<user id>/<filename>" and stores
-- the public URLs in properties.reels.
-- =========================================================

insert into storage.buckets (id, name, public)
values ('property-reels', 'property-reels', true)
on conflict (id) do nothing;

drop policy if exists "Property reels are publicly accessible" on storage.objects;
create policy "Property reels are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'property-reels');

drop policy if exists "Users can upload their own property reels" on storage.objects;
create policy "Users can upload their own property reels"
  on storage.objects for insert
  with check (
    bucket_id = 'property-reels'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can update their own property reels" on storage.objects;
create policy "Users can update their own property reels"
  on storage.objects for update
  using (
    bucket_id = 'property-reels'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can delete their own property reels" on storage.objects;
create policy "Users can delete their own property reels"
  on storage.objects for delete
  using (
    bucket_id = 'property-reels'
    and (storage.foldername(name))[1] = auth.uid()::text
  );


-- =========================================================
-- 9. VIEW COUNTER
-- property-details.html calls the increment_property_views()
-- function once per page load (anonymous visitors included).
-- It's a security definer function scoped to only ever touch
-- the views column of one row, so it's safe to grant to
-- anon/authenticated without opening up general write access.
-- =========================================================

alter table public.projects add column if not exists views integer not null default 0;

create or replace function public.increment_property_views(target_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update public.projects set views = views + 1 where id = target_id;
end;
$$;

grant execute on function public.increment_property_views(uuid) to anon, authenticated;


-- =========================================================
-- DONE
-- After running this, confirm in the Dashboard:
--  - Table Editor -> "profiles" table exists
--  - Table Editor -> "projects" -> RLS is enabled, has the
--    gallery_images/reels/views columns, and the 3 policies
--    above
--  - Database -> Functions -> "increment_property_views"
--    exists and is callable by anon + authenticated
--  - Table Editor -> "enquiries" table exists with RLS
--  - Storage -> "users-avatars" bucket exists and is Public
--  - Storage -> "property-images" bucket exists and is Public
--  - Storage -> "property-reels" bucket exists and is Public
--  - Authentication -> Providers -> Email is enabled
--    (it's on by default in every new Supabase project)
-- =========================================================
