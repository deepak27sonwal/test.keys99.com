-- =========================================================
-- KEYS99 (NEW PROJECT) - STEP 1: HOMEPAGE
--
-- Creates the "projects" table the homepage reads from, with
-- the columns js/config.js selects (PROPERTY_SELECT_COLUMNS),
-- and makes approved listings publicly readable.
--
-- Run once in the new Supabase project:
--   Dashboard -> SQL Editor -> New query -> paste -> Run
--
-- Safe to re-run. Later steps (sign-in, posting listings,
-- enquiries, admin) add their own scripts on top of this one.
-- =========================================================

create extension if not exists pgcrypto;

create table if not exists public.projects (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz not null default now(),

  -- URL + SEO
  slug                text unique,
  title               text,
  description         text,
  seo_title           text,
  seo_description     text,

  -- Project
  developer           text,
  status              text,            -- e.g. 'New Launch', 'Under Construction', 'Ready to Move'
  possession          text,            -- e.g. 'Sept 2026'
  overview            text,
  rera_id             text,

  -- Location
  address             text,
  state               text,
  city                text,
  locality            text,
  pincode             text,

  -- Media
  main_image          text,
  gallery_images      text[] not null default '{}',
  reels               text[] not null default '{}',
  virtual_tour_video  text,
  youtube_link        text,
  facebook_link       text,
  instagram_link      text,

  -- Configurations and features
  -- bhk_options: [{"type":"2 BHK","price":7500000,"sqft":785,"areaUnit":"Sq.Ft"}, ...]
  bhk_options         jsonb not null default '[]'::jsonb,
  amenities           jsonb not null default '[]'::jsonb,
  nearby_landmarks    jsonb not null default '[]'::jsonb,
  interior            text[] not null default '{}',
  exterior            text[] not null default '{}',

  -- Contact / owner
  contact_number      bigint,
  posted_by_user_id   uuid references auth.users(id) on delete set null,
  posted_by_user_code text,
  posted_by_name      text,

  -- Moderation + stats
  moderation_status   text not null default 'pending'
                      check (moderation_status in ('pending','approved','rejected','suspended')),
  views               integer not null default 0
);

create index if not exists projects_moderation_created_idx
  on public.projects (moderation_status, created_at desc);
create index if not exists projects_city_locality_idx
  on public.projects (city, locality);


-- ---------------------------------------------------------
-- Row Level Security
-- The homepage uses the public anon key, so without these
-- policies it can read nothing. Only approved listings are
-- visible to the public; writes come in later steps.
-- ---------------------------------------------------------

alter table public.projects enable row level security;

drop policy if exists "Approved projects are publicly viewable" on public.projects;
create policy "Approved projects are publicly viewable"
  on public.projects for select
  using (moderation_status = 'approved');
