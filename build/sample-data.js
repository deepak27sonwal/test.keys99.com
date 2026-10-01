/* =========================================================
   KEYS99 - SAMPLE LISTINGS
   Used only by `node build/generate.js --sample` so the
   generator can be run and inspected without touching
   Supabase. Mirrors the real properties table shape.
========================================================= */

module.exports = [
  {
    id: "a4f21c88-1111-4aaa-9c31-000000000001",
    created_at: "2026-09-10T08:00:00Z",
    developer: "Godrej Riverside Heights",
    address: "Survey 42, Riverside Road",
    state: "Maharashtra",
    city: "Pune",
    locality: "Kharadi",
    pincode: "411014",
    status: "Sale",
    possession: "Dec 2027",
    overview: "Godrej Riverside Heights is a premium residential project in Kharadi, Pune, offering thoughtfully planned 2 and 3 BHK homes with river-facing balconies. The development sits minutes from EON IT Park and offers a landscaped podium, clubhouse and dedicated work-from-home pods.",
    main_image: "https://images.example.com/godrej-kharadi-1.jpg",
    gallery_images: [
      "https://images.example.com/godrej-kharadi-2.jpg",
      "https://images.example.com/godrej-kharadi-3.jpg"
    ],
    bhk_options: [
      { type: "2 BHK", sqft: "745", areaUnit: "Sq.Ft", price: "8900000", priceWords: "89 Lakh", availability: "Available" },
      { type: "3 BHK", sqft: "1120", areaUnit: "Sq.Ft", price: "13500000", priceWords: "1.35 Crore", availability: "Limited" }
    ],
    amenities: ["Clubhouse", "Swimming Pool", "Gymnasium", "Kids Play Area", "24x7 Security", "EV Charging"],
    nearby_landmarks: ["EON IT Park - 2.4 km", "Phoenix Marketcity - 5 km", "Columbia Asia Hospital - 3 km"],
    rera_id: "P52100047821",
    contact_number: "+919876543210",
    views: 412
  },
  {
    id: "b7d33e19-2222-4bbb-8d42-000000000002",
    created_at: "2026-09-14T11:30:00Z",
    developer: "Kolte Patil Green Meadows",
    address: "Lane 6, Baner Road",
    state: "Maharashtra",
    city: "Pune",
    locality: "Baner",
    pincode: "411045",
    status: "Sale",
    possession: "Ready to Move",
    overview: "Green Meadows offers ready-to-move 3 BHK residences in the heart of Baner, with a rooftop infinity pool and uninterrupted views of the Baner hills. Walking distance to schools, cafes and the Mumbai-Bengaluru highway access point.",
    main_image: "https://images.example.com/kolte-baner-1.jpg",
    gallery_images: ["https://images.example.com/kolte-baner-2.jpg"],
    bhk_options: [
      { type: "3 BHK", sqft: "1340", areaUnit: "Sq.Ft", price: "16200000", priceWords: "1.62 Crore", availability: "Available" }
    ],
    amenities: ["Rooftop Pool", "Co-working Lounge", "Yoga Deck", "Covered Parking"],
    nearby_landmarks: ["Balewadi Stadium - 3.5 km", "Symbiosis School - 1.2 km"],
    rera_id: "P52100039114",
    contact_number: "+919812345678",
    views: 287
  },
  {
    id: "c9e55f2a-3333-4ccc-7e53-000000000003",
    created_at: "2026-09-18T09:15:00Z",
    developer: "Lodha Sterling Enclave",
    address: "Plot 18, Hiranandani Link Road",
    state: "Maharashtra",
    city: "Mumbai",
    locality: "Powai",
    pincode: "400076",
    status: "Sale",
    possession: "Mar 2028",
    overview: "Sterling Enclave brings compact, efficiently planned 1 and 2 BHK apartments to Powai, overlooking the lake. Designed for first-time buyers and investors, with a rental-ready fit-out option and full lifestyle amenities on the podium level.",
    main_image: "https://images.example.com/lodha-powai-1.jpg",
    gallery_images: [],
    bhk_options: [
      { type: "1 BHK", sqft: "465", areaUnit: "Sq.Ft", price: "11000000", priceWords: "1.10 Crore", availability: "Available" },
      { type: "2 BHK", sqft: "690", areaUnit: "Sq.Ft", price: "17500000", priceWords: "1.75 Crore", availability: "Available" }
    ],
    amenities: ["Lake View Deck", "Gymnasium", "Indoor Games", "Concierge"],
    nearby_landmarks: ["IIT Bombay - 2 km", "Powai Lake - 600 m", "R City Mall - 6 km"],
    rera_id: "P51800028733",
    contact_number: "+919900112233",
    views: 655
  },
  {
    id: "d1a77b40-4444-4ddd-6f64-000000000004",
    created_at: "2026-09-19T16:45:00Z",
    developer: "Prestige Lake Habitat",
    address: "Outer Ring Road, Whitefield",
    state: "Karnataka",
    city: "Bengaluru",
    locality: "Whitefield",
    pincode: "560066",
    status: "Sale",
    possession: "Ready to Move",
    overview: "Prestige Lake Habitat is a low-density gated community in Whitefield with 3 and 4 BHK homes set around a two-acre central green. Built for families working along the ORR tech corridor, with an on-site creche and international school within a kilometre.",
    main_image: "https://images.example.com/prestige-whitefield-1.jpg",
    gallery_images: ["https://images.example.com/prestige-whitefield-2.jpg"],
    bhk_options: [
      { type: "3 BHK", sqft: "1580", areaUnit: "Sq.Ft", price: "14900000", priceWords: "1.49 Crore", availability: "Available" },
      { type: "4 BHK", sqft: "2240", areaUnit: "Sq.Ft", price: "22500000", priceWords: "2.25 Crore", availability: "Limited" }
    ],
    amenities: ["Central Green", "Creche", "Tennis Court", "Amphitheatre", "Solar Backup"],
    nearby_landmarks: ["ITPL - 4 km", "Vydehi Hospital - 3 km"],
    rera_id: "PRM/KA/RERA/1251/446",
    contact_number: "+919845001122",
    views: 198
  },
  {
    id: "e2b88c51-5555-4eee-5a75-000000000005",
    created_at: "2026-09-20T07:20:00Z",
    developer: "Brigade Orchards Villa",
    address: "Devanahalli Main Road",
    state: "Karnataka",
    city: "Bengaluru",
    locality: "Devanahalli",
    pincode: "562110",
    status: "Sale",
    possession: "Jun 2027",
    overview: "Independent 4 BHK villas within Brigade Orchards, a smart township near Bengaluru airport. Each villa has a private garden, terrace deck and provision for a home lift, set inside a township with its own school, sports arena and retail street.",
    main_image: "https://images.example.com/brigade-devanahalli-1.jpg",
    gallery_images: [],
    bhk_options: [
      { type: "4 BHK", sqft: "3100", areaUnit: "Sq.Ft", price: "31000000", priceWords: "3.10 Crore", availability: "Available" }
    ],
    amenities: ["Private Garden", "Sports Arena", "Township School", "Retail Street"],
    nearby_landmarks: ["Kempegowda International Airport - 9 km"],
    rera_id: "PRM/KA/RERA/1250/303",
    contact_number: "+919844556677",
    views: 143
  }
];
