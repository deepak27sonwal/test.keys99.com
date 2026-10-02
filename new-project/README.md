# Keys99 – new project

Same UI as the Keys99 site in the repo root, running on a **separate Supabase
database**. Built step by step; this folder currently holds **step 1: the
homepage**.

## Setup

1. In the new Supabase project, open **SQL Editor** and run
   `supabase/01-projects.sql`. It creates the `projects` table and lets the
   public read approved listings.
2. Open `js/config.js` and replace `YOUR_SUPABASE_URL` and
   `YOUR_SUPABASE_ANON_KEY` with the values from **Project Settings → API**.
   Use the anon / publishable key only — never the service-role key.
3. Upload the folder's contents to Hostinger (`public_html`), including
   `.htaccess`.

Only listings with `moderation_status = 'approved'` appear on the homepage.

## Not built yet

Links to search, listing, city/locality, login, profile, post-property, reels,
terms and privacy pages will 404 until those steps are added. The chat widget
needs the `chat-agent` Edge Function, which is also a later step.
