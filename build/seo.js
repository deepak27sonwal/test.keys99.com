/* =========================================================
   KEYS99 - SEO HELPERS
   Shared by every generated page: URL slugs, titles,
   descriptions, social tags and JSON-LD structured data.

   Titles and descriptions are built from real listing
   attributes so no two pages share the same ones - duplicate
   titles across pages are one of the fastest ways to stop a
   property portal ranking.
========================================================= */

/* Every page except index.html lives under /projects/, so all
   generated URLs carry this prefix. Set it to "" to serve the
   generated pages from the domain root instead - nothing else
   needs changing. */
const BASE_PATH = process.env.SITE_BASE_PATH !== undefined
  ? process.env.SITE_BASE_PATH
  : "/projects";

const SITE = {
  name: "Keys99",
  legalName: "Keys99.com",
  origin: process.env.SITE_ORIGIN || "https://keys99.com",
  twitter: "@keys99",
  logo: "/assets/logo.png",
  defaultImage: "/assets/og-default.jpg"
};

/* ---------------------------------------------------------
   SLUGS
   Transliteration-free, lowercase, hyphenated. Trailing
   short id keeps property URLs unique when two listings in
   the same locality share a name.
--------------------------------------------------------- */

function slugify(value){
  return String(value == null ? "" : value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function shortId(id){
  return String(id || "").replace(/-/g, "").slice(0, 6);
}

/* The slug the listing carries in the database wins, so the URL stays
   whatever was chosen for it and never shifts when a field is edited.
   Rows without one fall back to a slug derived from the attributes people
   actually search: BHK, intent, locality, city, project. */
function derivedSlug(property){
  const bhk = primaryBhkLabel(property);
  return slugify([
    bhk ? bhk + "-flat" : "property",
    "for",
    saleOrRent(property),
    "in",
    property.locality,
    property.city,
    property.developer,
    shortId(property.id)
  ].filter(Boolean).join("-"));
}

function propertySlug(property){
  /* set by the build when two rows collide on the same slug */
  if(property && property.__slugOverride) return property.__slugOverride;
  const own = slugify(property && property.slug);
  return own || derivedSlug(property);
}

/* Property pages sit directly under the base path - /projects/<slug>/ -
   so they share a level with the city hubs (/projects/pune/). The build
   checks for a slug that collides with a city and renames it rather than
   letting a listing overwrite a city page. */
function propertyPath(property){
  return BASE_PATH + "/" + propertySlug(property) + "/";
}

function cityPath(city){
  return BASE_PATH + "/" + slugify(city) + "/";
}

function localityPath(city, locality){
  return BASE_PATH + "/" + slugify(city) + "/" + slugify(locality) + "/";
}

function bhkPath(city, bhk){
  return BASE_PATH + "/" + slugify(city) + "/" + slugify(bhk) + "-bhk-flats/";
}

function absolute(path){
  return SITE.origin.replace(/\/$/, "") + path;
}

/* ---------------------------------------------------------
   LISTING ATTRIBUTE HELPERS
   bhk_options is an array of
   { type, sqft, areaUnit, price, priceWords, availability }
   and is sometimes stored as a JSON string.
--------------------------------------------------------- */

function bhkOptions(property){
  let raw = property && property.bhk_options;
  if(typeof raw === "string"){
    try{ raw = JSON.parse(raw); }catch{ return []; }
  }
  if(!Array.isArray(raw)) return [];
  return raw.filter(row => row && typeof row === "object");
}

/* "3 BHK" -> "3". Handles "3BHK", "3 bhk", "2.5 BHK". */
function bhkNumber(type){
  const match = String(type || "").match(/(\d+(?:\.\d+)?)/);
  return match ? match[1] : "";
}

function bhkNumbers(property){
  const seen = new Set();
  bhkOptions(property).forEach(row => {
    const n = bhkNumber(row.type);
    if(n) seen.add(n);
  });
  return [...seen].sort((a, b) => Number(a) - Number(b));
}

function primaryBhkLabel(property){
  const numbers = bhkNumbers(property);
  return numbers.length ? numbers[0] + "-bhk" : "";
}

function bhkRangeText(property){
  const numbers = bhkNumbers(property);
  if(numbers.length === 0) return "";
  if(numbers.length === 1) return numbers[0] + " BHK";
  return numbers[0] + " to " + numbers[numbers.length - 1] + " BHK";
}

/* The site's `status` column holds the listing intent
   (sale / rent) as well as availability wording. */
function saleOrRent(property){
  const status = String(property && property.status || "").toLowerCase();
  return status.includes("rent") ? "rent" : "sale";
}

function saleOrRentText(property){
  return saleOrRent(property) === "rent" ? "for Rent" : "for Sale";
}

/* 8000000 -> "₹ 80 Lac", 80000000 -> "₹ 8 Crore". A bare number in a
   Google snippet is unreadable to an Indian property buyer, who reads
   prices in lakhs and crores. */
function formatIndianPrice(value){
  const n = Number(String(value).replace(/[^\d.]/g, ""));
  if(!n || !isFinite(n)) return "";
  const trim = x => String(Number(x.toFixed(2)));
  if(n >= 10000000) return "\u20B9 " + trim(n / 10000000) + " Crore";
  if(n >= 100000)   return "\u20B9 " + trim(n / 100000) + " Lac";
  return "\u20B9 " + n.toLocaleString("en-IN");
}

/* The live rows carry price_words (snake_case); older sample rows used
   priceWords. A words value is only trusted when it actually contains a
   number - rows in the wild hold things like "DDQ" and "ON REQUEST",
   which would otherwise be printed as if they were the price. */
function rowPrice(row){
  const words = row.priceWords || row.price_words;
  if(words && /\d/.test(String(words))) return String(words).trim();
  const formatted = formatIndianPrice(row.price);
  if(formatted) return formatted;
  return words ? "Price on request" : "";
}

function priceText(property){
  for(const row of bhkOptions(property)){
    const price = rowPrice(row);
    if(price) return price;
  }
  return "";
}

/* possession is a date column, so it arrives as 2026-03-27 - which reads
   badly in a title or a fact table. Show "Mar 2026"; pass anything
   non-date through untouched. */
function possessionText(property){
  const raw = property && property.possession;
  if(!raw) return "";
  const date = new Date(raw);
  if(isNaN(date.getTime())) return String(raw).trim();
  return date.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

/* nearby_landmarks is jsonb and comes in two shapes across the live rows:
   plain strings, and {place, distance, unit} objects. */
function landmarkText(entry){
  if(entry == null) return "";
  if(typeof entry === "string") return entry.trim();
  if(typeof entry !== "object") return String(entry);
  const place = entry.place || entry.name || "";
  const distance = entry.distance == null || entry.distance === "" ? "" : String(entry.distance).trim();
  const unit = (entry.unit || "km").trim();
  if(!place) return "";
  return distance ? `${place} - ${distance} ${unit}`.replace(/\s+/g, " ").trim() : place;
}

function areaText(property){
  const rows = bhkOptions(property);
  for(const row of rows){
    if(row.sqft) return String(row.sqft).trim() + " " + (row.areaUnit || "Sq.Ft");
  }
  return "";
}

function toArray(value){
  if(Array.isArray(value)) return value.filter(Boolean);
  if(typeof value === "string"){
    try{
      const parsed = JSON.parse(value);
      if(Array.isArray(parsed)) return parsed.filter(Boolean);
    }catch{
      return value.split(",").map(s => s.trim()).filter(Boolean);
    }
  }
  return [];
}

function propertyTitleText(property){
  const bhk = bhkRangeText(property);
  const where = [property.locality, property.city].filter(Boolean).join(", ");
  const name = property.developer || "Property";
  return [
    bhk ? bhk + " Flat" : "Property",
    saleOrRentText(property),
    where ? "in " + where : "",
    "- " + name
  ].filter(Boolean).join(" ");
}

/* ---------------------------------------------------------
   HEAD BUILDER
   Every generated page goes through this, so meta, canonical,
   social tags and schema can never drift apart per page type.
--------------------------------------------------------- */

/* Listers type "DIGHI" and "lodha"; both look wrong in a title or a
   Google snippet. Only used for display - slugs stay lowercase. */
function titleCase(value){
  return String(value == null ? "" : value)
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map(word => word.length <= 3 && word === word.toUpperCase() && /^[A-Z]+$/.test(word)
      ? word
      : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function escapeHtml(value){
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* Descriptions must stay under ~160 chars or Google truncates
   them mid-sentence in the results page. */
function pluralize(count, singular, plural){
  return count === 1 ? singular : (plural || singular + "s");
}

/* Google shows roughly 60 characters of a title. Parts are
   passed most-valuable-first (the words people actually
   search), and anything that would push past the limit is
   dropped rather than truncated mid-word - so the brand
   suffix falls away before the locality ever does. */
function fitTitle(parts, limit = 60){
  let title = "";
  for(const part of parts){
    if(!part || !part.text) continue;
    const candidate = title ? title + part.sep + part.text : part.text;
    if(title && candidate.length > limit) continue;
    title = candidate;
  }
  return title;
}

function clamp(text, limit = 158){
  /* Parts are joined with spaces, which leaves " ," and " ." before
     punctuation - visible in the Google snippet, so tidy it here. */
  const clean = String(text || "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/([,.])\1+/g, "$1")
    .trim();
  if(clean.length <= limit) return clean;
  return clean.slice(0, limit - 1).replace(/[\s,;.]+\S*$/, "") + "…";
}

function buildHead({ title, description, path, image, cssHref, schema, noindex }){
  const canonical = absolute(path);
  const ogImage = absolute(image || SITE.defaultImage);
  const schemaBlocks = (Array.isArray(schema) ? schema : [schema])
    .filter(Boolean)
    .map(block => `<script type="application/ld+json">${JSON.stringify(block)}</script>`)
    .join("\n");

  return `<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="theme-color" content="#006b5b">

<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(clamp(description))}">
<link rel="canonical" href="${escapeHtml(canonical)}">
${noindex ? '<meta name="robots" content="noindex,follow">' : '<meta name="robots" content="index,follow,max-image-preview:large">'}

<meta property="og:type" content="website">
<meta property="og:site_name" content="${escapeHtml(SITE.name)}">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(clamp(description))}">
<meta property="og:url" content="${escapeHtml(canonical)}">
<meta property="og:image" content="${escapeHtml(ogImage)}">
<meta property="og:locale" content="en_IN">

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(clamp(description))}">
<meta name="twitter:image" content="${escapeHtml(ogImage)}">

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${escapeHtml(cssHref)}">

${schemaBlocks}`;
}

/* ---------------------------------------------------------
   JSON-LD BUILDERS
--------------------------------------------------------- */

function breadcrumbSchema(trail){
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: absolute(crumb.path)
    }))
  };
}

/* RealEstateListing is what produces the rich property result
   with price and location in Google. */
function propertySchema(property){
  const path = propertyPath(property);
  const images = [property.main_image, ...toArray(property.gallery_images)]
    .filter(Boolean)
    .slice(0, 8);

  const schema = {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    name: propertyTitleText(property),
    url: absolute(path),
    description: clamp(property.overview || propertyTitleText(property), 300),
    datePosted: property.created_at,
    image: images.map(src => /^https?:/i.test(src) ? src : absolute(src))
  };

  const address = {
    "@type": "PostalAddress",
    addressCountry: "IN"
  };
  if(property.address) address.streetAddress = property.address;
  if(property.locality) address.addressLocality = property.locality;
  if(property.city) address.addressRegion = property.city;
  if(property.state) address.addressRegion = property.state;
  if(property.pincode) address.postalCode = String(property.pincode);
  schema.address = address;

  const numbers = bhkNumbers(property);
  if(numbers.length){
    schema.numberOfRooms = Number(numbers[0]);
  }

  const area = bhkOptions(property).find(row => row.sqft);
  if(area){
    schema.floorSize = {
      "@type": "QuantitativeValue",
      value: Number(String(area.sqft).replace(/[^\d.]/g, "")) || undefined,
      unitCode: "FTK"
    };
  }

  const price = priceText(property);
  if(price){
    schema.offers = {
      "@type": "Offer",
      priceCurrency: "INR",
      price: price,
      availability: "https://schema.org/InStock",
      url: absolute(path)
    };
  }

  if(property.contact_number){
    schema.telephone = String(property.contact_number);
  }

  return schema;
}

/* Collection pages (city / locality / BHK) list their
   properties so Google understands them as real index pages
   rather than thin duplicates of each other. */
function collectionSchema({ name, description, path, properties }){
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name,
    description: clamp(description, 300),
    url: absolute(path),
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: properties.length,
      itemListElement: properties.slice(0, 50).map((property, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: absolute(propertyPath(property)),
        name: propertyTitleText(property)
      }))
    }
  };
}

function organizationSchema(){
  return {
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    name: SITE.name,
    legalName: SITE.legalName,
    url: SITE.origin,
    logo: absolute(SITE.logo),
    areaServed: "IN"
  };
}

/* Enables the sitelinks search box in Google results. */
function websiteSchema(){
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE.name,
    url: SITE.origin,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: absolute(BASE_PATH + "/search.html?q={search_term_string}")
      },
      "query-input": "required name=search_term_string"
    }
  };
}

module.exports = {
  SITE,
  BASE_PATH,
  slugify,
  shortId,
  derivedSlug,
  propertySlug,
  propertyPath,
  cityPath,
  localityPath,
  bhkPath,
  absolute,
  bhkOptions,
  bhkNumber,
  bhkNumbers,
  bhkRangeText,
  primaryBhkLabel,
  saleOrRent,
  saleOrRentText,
  formatIndianPrice,
  rowPrice,
  priceText,
  titleCase,
  possessionText,
  landmarkText,
  areaText,
  toArray,
  propertyTitleText,
  escapeHtml,
  clamp,
  pluralize,
  fitTitle,
  buildHead,
  breadcrumbSchema,
  propertySchema,
  collectionSchema,
  organizationSchema,
  websiteSchema
};
