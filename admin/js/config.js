/* =========================================================
   KEYS99 - SUPABASE CONFIG (ADMIN COPY)
   The admin panel keeps its own copy so it stays independent
   of the public site. The public site has its own at
   ../../js/config.js - if you ever rotate the Supabase keys,
   update BOTH files.
========================================================= */

const SUPABASE_URL =
  "https://xeesusgbdyrgxvzevjha.supabase.co";

const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhlZXN1c2diZHlyZ3h2emV2amhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4NzI1MzksImV4cCI6MjA4ODQ0ODUzOX0.8TjnH50MO4YBu8liCJwnUu36hiX6zAwRpGOCPFVW7sI";

const supabaseClient =
  window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
  );

const PROPERTY_SELECT_COLUMNS = `
  id,
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
