/* =========================================================
   KEYS99 - GENERATED PAGE TEMPLATES

   These do NOT define any design of their own. They load the
   site's real pages - property-details.html and search.html -
   and fill the existing elements with real content at build
   time, keeping every class, stylesheet and script exactly as
   the site already has them.

   Why: the live pages hide their content behind
   `.hidden{display:none!important}` until JavaScript has
   fetched from Supabase, so a crawler sees only a loader. The
   generated copies ship with that content already in the HTML
   and the loader already dismissed. The page's own JS still
   runs afterwards and renders the same values, so nothing
   looks or behaves differently to a visitor.
========================================================= */

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const cheerio = require("cheerio");

const seo = require("./seo");

const {
  escapeHtml, buildHead, absolute,
  propertyPath, cityPath, localityPath, bhkPath,
  bhkOptions, bhkNumbers, bhkRangeText, saleOrRentText,
  priceText, rowPrice, possessionText, landmarkText, areaText, toArray, propertyTitleText, titleCase,
  breadcrumbSchema, propertySchema, collectionSchema,
  organizationSchema, fitTitle, pluralize, BASE_PATH
} = seo;

const ROOT = path.resolve(__dirname, "..");

/* A trimmed string, or "" - so an empty or whitespace-only column
   falls through the || chains below instead of winning them. */
function text(value){
  return String(value == null ? "" : value).trim();
}

const shellCache = {};
function shell(file){
  if(!shellCache[file]){
    shellCache[file] = fs.readFileSync(path.join(ROOT, file), "utf8");
  }
  return shellCache[file];
}


/* ---------------------------------------------------------
   PATHS
   The source pages sit at the site root and link relatively
   ("css/…", "index.html"). Generated pages sit two levels
   down, so every relative link is rewritten to root-absolute.
--------------------------------------------------------- */

function absolutiseLinks($){
  $("[href], [src]").each((_, el) => {
    const node = $(el);
    ["href", "src"].forEach(attr => {
      const value = node.attr(attr);
      if(!value) return;
      if(/^(https?:|\/\/|#|mailto:|tel:|data:|javascript:)/i.test(value)) return;
      if(value.startsWith("/")) return;

      /* The source pages sit in BASE_PATH and link relatively
         ("../css/…", "search.html"), so resolve against that
         folder rather than prefixing - "../css/x" has to end up
         at "/css/x", not "/projects/../css/x". */
      const [pathPart, suffix = ""] = value.split(/(?=[?#])/);
      node.attr(attr, path.posix.normalize(BASE_PATH + "/" + pathPart) + suffix);
    });
  });
}

/* Links written inside inline <script> blocks - "property-details.html?id=",
   "../profile.html" and friends - are relative to BASE_PATH, because that is
   where the source page lives. A generated page sits deeper than that, and the
   browser resolves those strings against the *document*, not the script file,
   so they have to be re-pointed for each output depth.

   Attributes are handled by absolutiseLinks; this covers what it cannot see. */
function rerelativiseScriptLinks(html, outputPath){
  const fromDir = path.posix.dirname(outputPath.replace(/\/$/, "") + "/x");
  const prefix = path.posix.relative(fromDir, BASE_PATH);
  if(!prefix) return html;

  return html.replace(
    /<script\b(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/g,
    block => block.replace(
      /(["'`])((?:\.\.\/)*[A-Za-z0-9._-]+\.html(?:\?[^"'`]*)?)\1/g,
      (match, quote, link) => {
        if(/^(https?:|\/\/|\/)/.test(link)) return match;
        const resolved = path.posix.normalize(prefix + "/" + link);
        return quote + resolved + quote;
      }
    )
  );
}

/* The site's own head tags are replaced wholesale by the SEO
   head, so remove the originals first to avoid two titles or
   two stylesheets fighting. */
function replaceHead($, headHtml, keepSelectors){
  const head = $("head");

  /* Scripts are always carried over. property-details.html loads all four of
     its scripts from <head>, so emptying it without this leaves the generated
     page with no JavaScript at all - no gallery, no enquiry form, no chat. */
  const selectors = ["script[src]", ...keepSelectors];
  const kept = selectors.map(sel => $.html(head.find(sel))).join("\n");

  head.empty();
  head.append(headHtml + "\n" + kept);
}


/* ---------------------------------------------------------
   PROPERTY PAGE
--------------------------------------------------------- */

function propertyPage(property, context = {}){
  const $ = cheerio.load(shell(BASE_PATH.replace(/^\//, "") + "/property-details.html"));

  const bhk = bhkRangeText(property);
  const where = [titleCase(property.locality), titleCase(property.city)].filter(Boolean).join(", ");
  const price = priceText(property);
  const area = areaText(property);
  const rows = bhkOptions(property);
  const amenities = toArray(property.amenities);
  const possession = possessionText(property);
  const urlPath = propertyPath(property);

  /* What the listing is called on the page. seo_title overrides it for
     search results only, so a listing can read one way to a visitor and
     another to Google. Both are optional; blank falls through to the
     text built from the listing's own attributes, which is what every
     listing did before these columns existed. */
  const ownTitle = text(property.title);
  const ownDescription = text(property.description);

  const generatedTitle = fitTitle([
    { text: `${bhk ? bhk + " Flat" : "Property"} ${saleOrRentText(property)} in ${where}`, sep: "" },
    { text: titleCase(property.developer), sep: " - " },
    { text: "Keys99", sep: " | " }
  ]);

  const generatedDescription = [
    `${bhk || "Property"} ${saleOrRentText(property).toLowerCase()} in ${where}`,
    property.developer ? `at ${titleCase(property.developer)}` : "",
    price ? `priced ${price}` : "",
    area ? `, ${area}` : "",
    possession ? `. Possession ${possession}` : "",
    ". Photos, floor plans, amenities and contact details on Keys99."
  ].join(" ");

  /* seo_title -> title -> generated. The brand suffix is only appended
     to a hand-written title when there is room, so a carefully sized
     one is never pushed past what Google shows. */
  const title = text(property.seo_title)
    || (ownTitle ? fitTitle([{ text: ownTitle, sep: "" }, { text: "Keys99", sep: " | " }]) : generatedTitle);

  const description = text(property.seo_description) || ownDescription || generatedDescription;

  const trail = [
    { name: "Home", path: "/" },
    { name: titleCase(property.city) || "City", path: cityPath(property.city) },
    { name: titleCase(property.locality) || "Locality", path: localityPath(property.city, property.locality) },
    { name: titleCase(property.developer) || "Property", path: urlPath }
  ];

  absolutiseLinks($);

  replaceHead($, buildHead({
    title,
    description,
    path: urlPath,
    image: property.main_image,
    cssHref: "/css/property-details.css",
    schema: [propertySchema(property), breadcrumbSchema(trail), organizationSchema()]
  }), ['link[href*="chat-widget"]', 'link[rel="preconnect"]']);

  /* Content is present from the first byte, so the loader has
     nothing left to wait for. */
  $("#loading").addClass("hidden");
  $("#propertyPage").removeClass("hidden");

  /* --- breadcrumbs --- */
  $("#crumbName").text(titleCase(property.developer) || "Details");
  $(".breadcrumb").html(
    trail.map((crumb, i) => i === trail.length - 1
      ? `<span id="crumbName">${escapeHtml(crumb.name)}</span>`
      : `<a href="${crumb.path}">${escapeHtml(crumb.name)}</a><span>›</span>`
    ).join("")
  );

  /* --- gallery --- */
  if(property.main_image){
    $("#mainImage")
      .attr("src", property.main_image)
      .attr("alt", propertyTitleText(property));
  }
  $("#statusBadge").text(saleOrRentText(property).replace("for ", "For "));

  /* --- title card --- */
  $("#miniBreadcrumb").text(bhk ? bhk : "Residential");
  /* The page heading uses the listing's own title when it has one.
     seo_title is not considered here - it is for search results, not
     for what a visitor reads. */
  $("#propertyName").text(ownTitle || `${bhk ? bhk + " Flat " : "Property "}${saleOrRentText(property)} in ${where}`);
  $("#propertyLocation").html(`⌖ ${escapeHtml(property.address ? property.address + ", " + where : where)}`);
  if(property.developer) $("#developer").text(titleCase(property.developer));
  if(property.rera_id) $("#reraBadge").removeAttr("hidden");
  $("#metaLine").text([possession && "Possession " + possession, property.rera_id && "RERA " + property.rera_id].filter(Boolean).join("  ·  "));

  /* --- price --- */
  if(price){
    $("#propertyPrice").text(price);
    $("#priceNote").text("Onwards");
  }

  /* --- overview tiles --- */
  $("#propertyType").text("Residential");
  $("#bhk").text(bhk || "—");
  $("#carpetArea").text(area || "—");
  $("#possession").text(possession || "—");

  /* --- description --- */
  if(property.overview){
    $("#description").text(property.overview);
  }

  /* --- configuration table --- */
  if(rows.length){
    $("#configurationBody").html(rows.map(row => `<tr>
      <td>${escapeHtml(row.type || "-")}</td>
      <td>${escapeHtml(rowPrice(row) || "On Request")}</td>
      <td>${escapeHtml(row.sqft ? row.sqft + " " + (row.areaUnit || "Sq.Ft") : "-")}</td>
      <td>${escapeHtml(row.availability || "Available")}</td>
    </tr>`).join(""));
  }else{
    $("#configurationSection").addClass("hidden");
  }

  /* --- amenities --- */
  if(amenities.length){
    $("#amenities").html(amenities.map(a => `<div class="amenity">${escapeHtml(a)}</div>`).join(""));
  }else{
    $("#amenitiesSection").addClass("hidden");
  }

  /* --- location --- */
  $("#mapLocation").text(property.address ? property.address + ", " + where : where);

  /* Landmarks come through as {place, distance, unit} on some rows and as
     plain strings on others, so each entry is normalised before rendering. */
  const landmarks = toArray(property.nearby_landmarks)
    .map(entry => ({ entry, text: landmarkText(entry) }))
    .filter(item => item.text);

  if(landmarks.length){
    $("#locationAdvantages").html(landmarks.map(({ entry, text }) => {
      const place = entry && typeof entry === "object" ? (entry.place || entry.name || text) : text;
      const distance = entry && typeof entry === "object" && entry.distance
        ? String(entry.distance).trim() + " " + (entry.unit || "km").trim()
        : "";
      return `<tr><td>${escapeHtml(place)}</td><td>${escapeHtml(distance || "—")}</td></tr>`;
    }).join(""));
  }else{
    $("#locationSection").addClass("hidden");
  }

  /* --- internal links to the locality / city / BHK pages.
     Appended inside the existing .content-main using the
     site's own .section-card styling, so it reads as part of
     the page rather than a bolted-on block. --- */
  const links = [
    `<li><a href="${localityPath(property.city, property.locality)}">Property in ${escapeHtml(property.locality || "")}, ${escapeHtml(property.city || "")}</a></li>`,
    `<li><a href="${cityPath(property.city)}">Property in ${escapeHtml(property.city || "")}</a></li>`,
    ...bhkNumbers(property).map(n => `<li><a href="${bhkPath(property.city, n)}">${n} BHK flats in ${escapeHtml(property.city || "")}</a></li>`)
  ].join("");

  $(".content-main").append(`<section class="section-card">
      <h2><i></i>Explore More</h2>
      <ul class="explore-links">${links}</ul>
    </section>`);

  /* The page's JS reads ?id= from the query string, which a
     clean URL does not have - hand it the id directly. */
  const rootPrefix = path.posix.relative(
    path.posix.dirname(urlPath.replace(/\/$/, "") + "/x"), "/"
  ) + "/";

  $("body").append(`<script>window.__KEYS99_PROPERTY_ID__=${JSON.stringify(property.id)};`
    + `window.__KEYS99_ROOT__=${JSON.stringify(rootPrefix)};</script>`);

  return rerelativiseScriptLinks("<!DOCTYPE html>\n" + $.html(), urlPath);
}


/* ---------------------------------------------------------
   COLLECTION PAGE (city / locality / city+BHK)
   Built from the real search.html, with the results grid
   pre-rendered using that page's own .property-card markup.
--------------------------------------------------------- */

function cardHtml(property){
  const path = propertyPath(property);
  const image = property.main_image || "";
  const title = titleCase(property.developer) || "Property";
  const location = [titleCase(property.locality), titleCase(property.city)].filter(Boolean).join(", ");
  const price = priceText(property);
  /* Mirrors the chip markup search.html's own createPropertyCard
     builds, so the pre-rendered cards are styled identically to
     the ones its script renders. */
  const bhkChips = bhkOptions(property).map(row => {
    const availability = row.availability || "Available";
    return `<div class="bhk-chip">
          <div class="bhk-stat">
            <strong>${escapeHtml(row.type || "—")}</strong>
            <span>Config</span>
          </div>
          <div class="bhk-stat">
            <strong>${escapeHtml(row.sqft ? row.sqft + " " + (row.areaUnit || "Sq.Ft") : "—")}</strong>
            <span>Carpet Area</span>
          </div>
          <div class="bhk-stat price-stat">
            <strong>${escapeHtml(rowPrice(row) || "On Request")}</strong>
            <span>Price</span>
          </div>
          <div class="bhk-stat status-stat status-${escapeHtml(String(availability).toLowerCase().replace(/\s+/g, "-"))}">
            <strong>${escapeHtml(availability)}</strong>
            <span>Status</span>
          </div>
        </div>`;
  }).join("");

  return `<article class="property-card" data-id="${escapeHtml(property.id)}">
      <div class="property-image">
        <a href="${path}">
          <img src="${escapeHtml(image)}" alt="${escapeHtml(propertyTitleText(property))}" loading="lazy" width="400" height="300">
        </a>
        <span class="badge">${escapeHtml(saleOrRentText(property).replace("for ", "For "))}</span>
      </div>
      <div class="property-body">
        <h3><a href="${path}">${escapeHtml(title)}</a></h3>
        <p class="location">⌖ &nbsp; ${escapeHtml(location)}</p>
        <p class="price">${escapeHtml(price || "Price on Request")}</p>
        ${property.developer ? `<p class="developer">By &nbsp; ${escapeHtml(titleCase(property.developer))}</p>` : ""}
        ${property.rera_id ? `<span class="rera-badge">✓ RERA</span>` : ""}
        <div class="bhk-scroll">${bhkChips}</div>
      </div>
    </article>`;
}

function collectionPage({
  heading, title, description, intro, path: urlPath,
  properties, trail, siblingLinks = [], siblingHeading = "", filters = {}
}){
  const $ = cheerio.load(shell(BASE_PATH.replace(/^\//, "") + "/search.html"));

  absolutiseLinks($);

  replaceHead($, buildHead({
    title,
    description,
    path: urlPath,
    image: properties.length ? properties[0].main_image : undefined,
    cssHref: "/css/search.css",
    schema: [
      collectionSchema({ name: heading, description, path: urlPath, properties }),
      breadcrumbSchema(trail),
      organizationSchema()
    ]
  }), ['link[href*="chat-widget"]', 'link[rel="preconnect"]']);

  /* Page heading carries the search phrase this page targets
     instead of the generic "Search Properties". */
  $(".page-title").text(heading);
  $(".page-subtitle").text(intro);

  /* Pre-render the results so they are in the HTML. The page's
     own script re-renders the same set once it loads. */
  $("#resultsGrid").html(properties.map(cardHtml).join(""));

  if(siblingLinks.length){
    $("#resultsGrid").after(`<section class="sibling-links">
      <h2>${escapeHtml(siblingHeading)}</h2>
      <ul>${siblingLinks.map(link =>
        `<li><a href="${link.path}">${escapeHtml(link.name)}</a>${link.count ? ` <span>(${link.count})</span>` : ""}</li>`
      ).join("")}</ul>
    </section>`);
  }

  /* A clean URL has no query string, so hand the page's
     existing filter logic the values it would have read. */
  $("body").append(`<script>window.__KEYS99_FILTERS__=${JSON.stringify(filters)};</script>`);

  return rerelativiseScriptLinks("<!DOCTYPE html>\n" + $.html(), urlPath);
}

/* ---------------------------------------------------------
   HOMEPAGE

   index.html is the one page that is both the build's input and
   its output, so this does NOT re-serialise it through cheerio -
   that rewrites `defer` to `defer=""`, collapses multi-line tags
   and escapes ampersands, and the churn would compound on every
   build of a file that is edited by hand. Only the spans between
   the marker comments are replaced; every other byte survives.

   Why bother: without JavaScript the homepage carries two real
   links. Every city and locality link is injected at runtime, so
   the first-pass crawler never sees them and the generated hubs
   get no link equity from the site's strongest page.

   The markup below must stay identical to what renderTopCities
   and renderTopLocalities build in index.html. If the two drift,
   the lists visibly change the moment the script runs.
--------------------------------------------------------- */

const TOP_CITY_COUNT = 5;
const TOP_LOCALITY_COUNT = 10;

/* The card markup depends on a dozen helpers in index.html's own script
   (getCardTitle, getStatusClass, getOptionPriceText and friends). Copying
   them here would mean two implementations that must stay byte-identical
   forever, and the first time one changed the cards would visibly flip
   when the script ran.

   So the generator lifts those functions out of index.html and runs them.
   index.html stays the single source of truth for what a card looks like.
   Every one of them is pure - property in, string out - and the sandbox
   below has no document or window, so anything that reaches for the DOM
   fails here at build time rather than shipping a broken page. */
const CARD_ENTRY = "createPropertyCard";

/* Every top-level `function name(){…}` in the page, by name. They are all
   written flush to the left margin, so the first "\n}" closes one. */
function topLevelFunctions(source){
  const found = new Map();
  const declaration = /\nfunction ([A-Za-z0-9_$]+)\s*\(/g;
  let match;
  while((match = declaration.exec(source)) !== null){
    const end = source.indexOf("\n}", match.index);
    if(end === -1) continue;
    found.set(match[1], source.slice(match.index + 1, end + 2));
  }
  return found;
}

/* The helpers also read top-level constants - CATEGORY_LABELS maps a
   listing to its property type, for one - so those have to come across
   too. Reads to the semicolon that closes the declaration, counting
   brackets so a multi-line object literal survives intact. */
function topLevelConstants(source){
  const found = new Map();
  const declaration = /\n(?:const|let) ([A-Z][A-Z0-9_]*)\s*=/g;
  let match;

  while((match = declaration.exec(source)) !== null){
    let depth = 0;
    let end = -1;

    for(let i = match.index; i < source.length; i++){
      const ch = source[i];
      if("{[(".includes(ch)) depth++;
      else if("}])".includes(ch)) depth--;
      else if(ch === ";" && depth === 0){ end = i; break; }
    }

    if(end !== -1) found.set(match[1], source.slice(match.index + 1, end + 1));
  }

  return found;
}

/* Walk out from createPropertyCard and collect everything it calls,
   transitively. Working this out from the source beats keeping a hand-
   written list that goes stale the moment a helper is added. */
function requiredFunctions(defined, entry){
  if(!defined.has(entry)){
    throw new Error(
      `index.html no longer defines ${entry}(). The homepage card generator ` +
      `runs that function straight out of the page; update CARD_ENTRY in ` +
      `build/templates.js to match the rename.`
    );
  }

  const needed = new Set();
  const queue = [entry];

  while(queue.length){
    const name = queue.pop();
    if(needed.has(name)) continue;
    needed.add(name);

    /* Any bare identifier, not just `name(`. A helper passed by
       reference - `types.map(normaliseBhkType)` - is used just as
       surely as one that is called, and matching only call sites
       missed it. Over-matching here is safe: the worst case is
       carrying across a function that is never used. */
    const identifiers = defined.get(name).matchAll(/\b([A-Za-z_$][A-Za-z0-9_$]*)\b/g);
    for(const [, referenced] of identifiers){
      if(defined.has(referenced) && !needed.has(referenced)) queue.push(referenced);
    }
  }

  /* Source order, so the extracted code reads like the original. */
  return [...defined.keys()].filter(name => needed.has(name));
}

let cardRendererCache = null;
function cardRenderer(indexHtml){
  if(cardRendererCache) return cardRendererCache;

  const defined = topLevelFunctions(indexHtml);
  const constants = topLevelConstants(indexHtml);
  const names = requiredFunctions(defined, CARD_ENTRY);

  /* Constants are cheap and order-independent, so carry them all rather
     than working out which ones the chosen functions touch. */
  const code = [...constants.values(), ...names.map(name => defined.get(name))].join("\n");

  /* No document, no window: a helper that reached for the DOM would throw
     here, at build time, instead of shipping a half-rendered card. */
  const sandbox = {};
  vm.createContext(sandbox);
  /* titleCaseName comes across too. The city and locality lists below
     are written out here rather than extracted, so taking the page's
     own function is what stops the two spellings diverging. */
  vm.runInContext(
    code + `\nthis.render = ${CARD_ENTRY};` +
           `\nthis.POPULAR_COUNT = POPULAR_COUNT;` +
           `\nthis.titleCaseName = titleCaseName;`,
    sandbox,
    { filename: "index.html (extracted card functions)" }
  );

  if(typeof sandbox.titleCaseName !== "function"){
    throw new Error(
      "index.html no longer defines titleCaseName(). The homepage city and " +
      "locality lists use it for display, and must match the page's own spelling."
    );
  }

  cardRendererCache = {
    render: sandbox.render,
    popularCount: sandbox.POPULAR_COUNT,
    titleCaseName: sandbox.titleCaseName
  };
  return cardRendererCache;
}

function countLabel(count){
  return count + " " + (count === 1 ? "Property" : "Properties");
}

/* Matches computeTopCities: count by city, highest first. Ties keep
   first-seen order, and `properties` arrives newest-first, so this
   lands on the same order the script does. */
function topCities(properties, limit){
  const counts = new Map();
  properties.forEach(p => {
    const city = String(p.city || "").trim();
    if(!city) return;
    counts.set(city, (counts.get(city) || 0) + 1);
  });
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([city, count]) => ({ city, count }));
}

function topLocalities(properties, limit){
  const counts = new Map();
  properties.forEach(p => {
    const locality = String(p.locality || "").trim();
    if(!locality) return;
    const city = String(p.city || "").trim();
    const key = locality + "|" + city;
    if(!counts.has(key)) counts.set(key, { locality, city, count: 0 });
    counts.get(key).count += 1;
  });
  return [...counts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

function replaceMarked(html, name, replacement){
  const start = `<!--keys99:${name}:start-->`;
  const end = `<!--keys99:${name}:end-->`;
  const from = html.indexOf(start);
  const to = html.indexOf(end);

  if(from === -1 || to === -1 || to < from){
    throw new Error(
      `index.html is missing the ${name} markers (${start} … ${end}). ` +
      `Without them the generator cannot fill that list.`
    );
  }

  return html.slice(0, from + start.length) + replacement + html.slice(to);
}

function homePage(properties){
  let html = shell("index.html");

  const cards = cardRenderer(html);
  const name = cards.titleCaseName;

  /* Display text is title-cased with the page's own titleCaseName, so
     a locality stored as "DIGHI" reads "Dighi" here and after the
     script re-renders. The href still comes from the stored value -
     slugs must not move. */
  const cities = topCities(properties, TOP_CITY_COUNT).map(item => `
    <a class="city-card" href="${escapeHtml(cityPath(item.city).replace(/^\//, ""))}">
      <div class="city-icon">⌖</div>
      <strong>${escapeHtml(name(item.city))}</strong>
      <span>${countLabel(item.count)}</span>
    </a>
  `).join("");

  const localities = topLocalities(properties, TOP_LOCALITY_COUNT).map(item => `
    <a class="locality-chip" href="${escapeHtml(localityPath(item.city, item.locality).replace(/^\//, ""))}">
      <strong>${escapeHtml(name(item.locality))}</strong>
      <span>${escapeHtml(name(item.city) || "—")}</span>
      <span class="count">${countLabel(item.count)}</span>
    </a>
  `).join("");

  /* Popular Properties mirrors renderPopularProperties: the first
     POPULAR_COUNT of the same newest-first list the page fetches.

     New Launches is deliberately NOT pre-rendered. It selects on a
     30-day window measured from the moment it runs, so a build's idea
     of "new" goes stale as soon as a listing crosses that boundary and
     the section would visibly change when the script re-rendered it.
     It also adds no URLs of its own - it is a subset of the same
     newest-first list Popular already covers. */
  const popular = properties.slice(0, cards.popularCount).map(p => cards.render(p)).join("");

  html = replaceMarked(html, "cities", cities);
  html = replaceMarked(html, "localities", localities);
  html = replaceMarked(html, "popular", popular);

  return html;
}

module.exports = { propertyPage, collectionPage, homePage };
