#!/usr/bin/env node
/* =========================================================
   KEYS99 - STATIC PAGE GENERATOR

   Reads approved listings from Supabase and writes a real,
   fully-formed HTML page for every property, locality, city
   and city+BHK combination, plus sitemap.xml.

   Run:
     node build/generate.js              (live data)
     node build/generate.js --sample     (mock data, no network)

   Environment:
     SUPABASE_URL       - your project URL
     SUPABASE_ANON_KEY  - the public anon key
     SITE_ORIGIN        - e.g. https://keys99.com

   Falls back to reading js/config.js when the env vars are
   not set, so it works locally with zero setup.
========================================================= */

const fs = require("fs");
const path = require("path");

const seo = require("./seo");
const { propertyPage, collectionPage, homePage } = require("./templates");

const {
  slugify, propertyPath, cityPath, localityPath, bhkPath,
  bhkNumbers, bhkRangeText, priceText, absolute, pluralize, fitTitle, BASE_PATH,
  propertySlug, derivedSlug, shortId, titleCase
} = seo;

const ROOT = path.resolve(__dirname, "..");
const USE_SAMPLE = process.argv.includes("--sample");

/* --data=<file.json> runs the build against a saved rows dump - useful for
   checking output against real listings without hitting the network. */
const DATA_FILE = (process.argv.find(a => a.startsWith("--data=")) || "").slice(7);

/* Google rejects a sitemap above 50,000 URLs; we warn rather
   than silently truncating. */
const SITEMAP_URL_LIMIT = 50000;


/* ---------------------------------------------------------
   CREDENTIALS
--------------------------------------------------------- */

function readConfigCredentials(){
  try{
    const configFile = fs.readFileSync(path.join(ROOT, "js", "config.js"), "utf8");
    const url = (configFile.match(/https:\/\/[a-z0-9]+\.supabase\.co/) || [])[0];
    const key = (configFile.match(/eyJ[A-Za-z0-9._-]+/) || [])[0];
    return { url, key };
  }catch{
    return {};
  }
}

function credentials(){
  const fallback = readConfigCredentials();
  return {
    url: process.env.SUPABASE_URL || fallback.url,
    key: process.env.SUPABASE_ANON_KEY || fallback.key
  };
}


/* ---------------------------------------------------------
   DATA
--------------------------------------------------------- */

const SELECT_COLUMNS = [
  "id", "created_at", "developer", "address", "state", "city", "locality",
  "pincode", "status", "possession", "overview", "main_image",
  "gallery_images", "bhk_options", "amenities", "nearby_landmarks",
  "rera_id", "contact_number", "views", "slug",
  "title", "description", "seo_title", "seo_description"
].join(",");

async function fetchProperties(){
  if(DATA_FILE){
    console.log("Using rows from " + DATA_FILE);
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  }

  if(USE_SAMPLE){
    console.log("Using sample data (--sample)");
    return require("./sample-data");
  }

  const { url, key } = credentials();
  if(!url || !key){
    throw new Error("Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_ANON_KEY, or keep js/config.js in place.");
  }

  const all = [];
  const pageSize = 1000;

  /* PostgREST caps rows per request, so page through with
     Range headers until a short page comes back. */
  for(let from = 0; ; from += pageSize){
    const to = from + pageSize - 1;
    const endpoint = `${url}/rest/v1/projects?select=${SELECT_COLUMNS}&moderation_status=eq.approved&order=created_at.desc`;

    const response = await fetch(endpoint, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Range: `${from}-${to}`
      }
    });

    if(!response.ok){
      throw new Error(`Supabase returned ${response.status}: ${await response.text()}`);
    }

    const batch = await response.json();
    all.push(...batch);

    if(batch.length < pageSize) break;
  }

  return all;
}


/* ---------------------------------------------------------
   OUTPUT
--------------------------------------------------------- */

let written = 0;

function writePage(urlPath, html){
  const target = path.join(ROOT, urlPath, "index.html");
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, html);
  written += 1;
}

function groupBy(items, keyFn){
  const map = new Map();
  items.forEach(item => {
    const key = keyFn(item);
    if(!key) return;
    if(!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  });
  return map;
}

function newest(properties){
  return properties
    .map(p => p.created_at)
    .filter(Boolean)
    .sort()
    .pop();
}


/* ---------------------------------------------------------
   INTRO COPY
   Built from each page's own numbers so collection pages
   aren't near-identical to one another.
--------------------------------------------------------- */

function collectionIntro({ scope, properties }){
  const count = properties.length;
  const bhks = [...new Set(properties.flatMap(bhkNumbers))].sort((a, b) => Number(a) - Number(b));
  const priced = properties.map(priceText).filter(Boolean);
  const projects = [...new Set(properties.map(p => p.developer).filter(Boolean))];

  const parts = [
    `Browse ${count} verified ${count === 1 ? "property" : "properties"} ${scope} on Keys99.`
  ];

  if(bhks.length){
    parts.push(`Choose from ${bhks.join(", ")} BHK configurations.`);
  }
  if(priced.length){
    parts.push(`Prices start from ${priced[0]}.`);
  }
  if(projects.length){
    parts.push(`Projects include ${projects.slice(0, 4).join(", ")}${projects.length > 4 ? " and more" : ""}.`);
  }

  parts.push("Every listing carries photos, floor plans, amenities and direct contact details.");

  return parts.join(" ");
}


/* ---------------------------------------------------------
   BUILD
--------------------------------------------------------- */

async function build(){
  const properties = (await fetchProperties()).filter(p => p && p.city);

  if(properties.length === 0){
    console.warn("No approved properties found - only the sitemap will be written.");
  }

  const byCity = groupBy(properties, p => p.city.trim());
  const cityNames = [...byCity.keys()].sort();
  const sitemap = [];

  /* slug has no unique constraint in the database, so two rows can carry the
     same one. Writing both would leave the second silently overwriting the
     first - a listing would vanish from the site with no error. Detect it,
     say so loudly, and keep both pages by disambiguating the later one. */
  const slugOwner = new Map();
  const slugClashes = [];

  /* City hubs live at /projects/<city>/, the same level as property pages,
     so a listing whose slug equals a city name would overwrite that hub.
     Seed the taken-slug map with the city slugs to make that impossible. */
  const cityReserved = new Set(cityNames.map(c => slugify(c)));

  properties.forEach(property => {
    let slug = propertySlug(property);

    if(cityReserved.has(slug)){
      const unique = slug + "-" + shortId(property.id);
      console.warn(`WARNING: slug "${slug}" on ${property.id} collides with the ${slug} city page - published at "${unique}".`);
      property.__slugOverride = unique;
      slug = unique;
    }
    if(slugOwner.has(slug)){
      const unique = slug + "-" + shortId(property.id);
      slugClashes.push({ slug, kept: slugOwner.get(slug), renamed: property.id, unique });
      property.__slugOverride = unique;
      slugOwner.set(unique, property.id);
    }else{
      slugOwner.set(slug, property.id);
    }
  });

  if(slugClashes.length){
    console.warn(`\nWARNING: ${slugClashes.length} duplicate slug(s) in the projects table.`);
    slugClashes.forEach(c => {
      console.warn(`  "${c.slug}" is used by ${c.kept} and ${c.renamed}`);
      console.warn(`    -> ${c.renamed} published at "${c.unique}" instead`);
    });
    console.warn("  Give each row its own slug, then add a unique index.\n");
  }

  const missingSlug = properties.filter(p => !p.slug || !String(p.slug).trim());
  if(missingSlug.length){
    console.warn(`NOTE: ${missingSlug.length} of ${properties.length} listings have no slug - a URL was derived from their attributes.\n`);
  }

  /* --- property pages --- */
  properties.forEach(property => {
    const localityPeers = properties.filter(other =>
      other.id !== property.id &&
      other.city === property.city &&
      other.locality === property.locality
    );
    const cityPeers = properties.filter(other =>
      other.id !== property.id && other.city === property.city
    );
    const related = (localityPeers.length ? localityPeers : cityPeers).slice(0, 6);

    const urlPath = propertyPath(property);
    writePage(urlPath, propertyPage(property, { related, cityLinks: cityNames }));
    sitemap.push({ path: urlPath, lastmod: property.created_at, priority: "0.8" });
  });

  /* --- city pages --- */
  byCity.forEach((cityProperties, city) => {
    const byLocality = groupBy(cityProperties, p => (p.locality || "").trim());

    const localityLinks = [...byLocality.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .map(([locality, items]) => ({
        name: `Property in ${locality}, ${city}`,
        path: localityPath(city, locality),
        count: items.length
      }));

    const cityBhks = [...new Set(cityProperties.flatMap(bhkNumbers))]
      .sort((a, b) => Number(a) - Number(b));

    const bhkLinks = cityBhks.map(n => ({
      name: `${n} BHK flats in ${city}`,
      path: bhkPath(city, n)
    }));

    const urlPath = cityPath(city);
    writePage(urlPath, collectionPage({
      heading: `Property for Sale in ${titleCase(city)}`,
      title: fitTitle([
        { text: `Property for Sale in ${titleCase(city)}`, sep: "" },
        { text: `${cityProperties.length} Verified ${pluralize(cityProperties.length, "Listing")}`, sep: " - " },
        { text: "Keys99", sep: " | " }
      ]),
      description: `Find ${cityProperties.length} verified properties for sale in ${city}. Compare ${cityBhks.join(", ")} BHK flats by locality, price and possession date on Keys99.`,
      intro: collectionIntro({ scope: `in ${city}`, properties: cityProperties }),
      path: urlPath,
      properties: cityProperties.slice(0, 60),
      trail: [
        { name: "Home", path: "/" },
        { name: titleCase(city), path: urlPath }
      ],
      siblingHeading: `Popular localities in ${city}`,
      siblingLinks: [...localityLinks, ...bhkLinks],
      cityLinks: cityNames
    }));
    sitemap.push({ path: urlPath, lastmod: newest(cityProperties), priority: "0.9" });

    /* --- locality pages --- */
    byLocality.forEach((localityProperties, locality) => {
      const localityUrl = localityPath(city, locality);
      const siblings = [...byLocality.keys()]
        .filter(other => other !== locality)
        .slice(0, 12)
        .map(other => ({
          name: `Property in ${other}`,
          path: localityPath(city, other),
          count: byLocality.get(other).length
        }));

      writePage(localityUrl, collectionPage({
        heading: `Property for Sale in ${titleCase(locality)}, ${titleCase(city)}`,
        title: fitTitle([
          { text: `Property for Sale in ${titleCase(locality)}, ${titleCase(city)}`, sep: "" },
          { text: `${localityProperties.length} ${pluralize(localityProperties.length, "Listing")}`, sep: " - " },
          { text: "Keys99", sep: " | " }
        ]),
        description: `${localityProperties.length} verified ${localityProperties.length === 1 ? "property" : "properties"} for sale in ${locality}, ${city}. Compare prices, floor plans and amenities on Keys99.`,
        intro: collectionIntro({ scope: `in ${locality}, ${city}`, properties: localityProperties }),
        path: localityUrl,
        properties: localityProperties,
        trail: [
          { name: "Home", path: "/" },
          { name: titleCase(city), path: cityPath(city) },
          { name: titleCase(locality), path: localityUrl }
        ],
        siblingHeading: `Other localities in ${city}`,
        siblingLinks: siblings,
        cityLinks: cityNames
      }));
      sitemap.push({ path: localityUrl, lastmod: newest(localityProperties), priority: "0.7" });
    });

    /* --- city + BHK pages (the long-tail money pages) --- */
    cityBhks.forEach(n => {
      const matching = cityProperties.filter(p => bhkNumbers(p).includes(n));
      if(matching.length === 0) return;

      const urlPathBhk = bhkPath(city, n);
      writePage(urlPathBhk, collectionPage({
        heading: `${n} BHK Flats for Sale in ${titleCase(city)}`,
        title: fitTitle([
          { text: `${n} BHK Flats for Sale in ${titleCase(city)}`, sep: "" },
          { text: `${matching.length} ${pluralize(matching.length, "Listing")}`, sep: " - " },
          { text: "Keys99", sep: " | " }
        ]),
        description: `Browse ${matching.length} ${n} BHK ${matching.length === 1 ? "flat" : "flats"} for sale in ${city}. Compare prices, carpet area, possession dates and amenities on Keys99.`,
        intro: collectionIntro({ scope: `with ${n} BHK configurations in ${city}`, properties: matching }),
        path: urlPathBhk,
        properties: matching,
        trail: [
          { name: "Home", path: "/" },
          { name: titleCase(city), path: cityPath(city) },
          { name: `${n} BHK`, path: urlPathBhk }
        ],
        siblingHeading: `Other configurations in ${city}`,
        siblingLinks: cityBhks
          .filter(other => other !== n)
          .map(other => ({ name: `${other} BHK flats in ${city}`, path: bhkPath(city, other) })),
        cityLinks: cityNames
      }));
      sitemap.push({ path: urlPathBhk, lastmod: newest(matching), priority: "0.8" });
    });
  });

  /* --- homepage: fill its city, locality and listing grids ---
     Written in place rather than to <path>/index.html, because
     index.html IS the homepage. Skipped when there is nothing to
     list, so a failed or empty fetch cannot blank out content
     that is already correct in the file. */
  if(properties.length){
    fs.writeFileSync(path.join(ROOT, "index.html"), homePage(properties));
    console.log("Filled index.html cities, localities and property cards");
  }else{
    console.warn("No properties - left index.html untouched.");
  }

  /* --- hand-written pages belong in the sitemap too --- */
  [
    { path: "/", priority: "1.0" },
    { path: BASE_PATH + "/search.html", priority: "0.6" },
    { path: "/post-property.html", priority: "0.5" },
    { path: "/reels.html", priority: "0.5" },
    { path: "/privacy-policy.html", priority: "0.3" },
    { path: "/terms.html", priority: "0.3" }
  ].forEach(page => sitemap.push({ ...page, lastmod: new Date().toISOString() }));

  writeSitemap(sitemap);

  console.log(`\nGenerated ${written} pages`);
  console.log(`  properties : ${properties.length}`);
  console.log(`  cities     : ${byCity.size}`);
  console.log(`  sitemap    : ${sitemap.length} URLs`);
}

function writeSitemap(entries){
  if(entries.length > SITEMAP_URL_LIMIT){
    console.warn(`WARNING: ${entries.length} URLs exceeds the ${SITEMAP_URL_LIMIT} sitemap limit. Split into a sitemap index before submitting.`);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.map(entry => `  <url>
    <loc>${absolute(entry.path)}</loc>${entry.lastmod ? `
    <lastmod>${String(entry.lastmod).slice(0, 10)}</lastmod>` : ""}
    <priority>${entry.priority || "0.5"}</priority>
  </url>`).join("\n")}
</urlset>
`;

  fs.writeFileSync(path.join(ROOT, "sitemap.xml"), xml);
}

build().catch(error => {
  console.error("\nBuild failed:", error.message);
  process.exit(1);
});
