/* =========================================================
   KEYS99 - SUPABASE CONFIG
   Supabase credentials + the properties table column list
   for the public site. Every public page loads this file
   before its own script. Fill in the two values below from
   the new Supabase project.
========================================================= */

const SUPABASE_URL =
  "https://ljyywdgwjiedeiuqchdt.supabase.co";

const SUPABASE_ANON_KEY =
  "YOUR_SUPABASE_ANON_KEY"; // Project Settings -> API -> anon / publishable key

const supabaseClient =
  window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
  );

const PROPERTY_SELECT_COLUMNS = `
  id,
  slug,
  title,
  description,
  seo_title,
  seo_description,
  created_at,
  developer,
  address,
  state,
  city,
  locality,
  pincode,
  status,
  possession,
  overview,
  main_image,
  gallery_images,
  reels,
  bhk_options,
  amenities,
  nearby_landmarks,
  interior,
  exterior,
  rera_id,
  contact_number,
  youtube_link,
  facebook_link,
  instagram_link,
  posted_by_user_id,
  posted_by_user_code,
  posted_by_name,
  virtual_tour_video,
  views
`;
