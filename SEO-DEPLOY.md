# Keys99 — SEO & Deployment Guide

## What changed and why

Before this work, every property on Keys99 lived at `property-details.html?id=<uuid>`
— one URL, one title, and no content in the HTML (the page said "Loading property
details…" until JavaScript filled it in).

Property portals get their traffic from long-tail searches like
*"3 BHK flat for sale in Kharadi Pune"*. Those searches need **many unique pages
with real content in the HTML**. One shared URL cannot rank for them.

So the site now generates a real page per property, per locality, per city and per
city+BHK combination, at build time, with full content written into the HTML.

**The design is unchanged.** The generator does not define any layout of its own.
It loads the site's real `property-details.html` and `search.html`, fills the
existing elements with content, and writes the result out — same markup, same
stylesheets, same scripts. A visitor cannot tell a generated page from a live one.

---

## The URL structure

```
/                                              homepage (index.html, at root)
/projects/pune/                                city hub
/projects/pune/kharadi/                        locality page
/projects/pune/3-bhk-flats/                    long-tail "money" page
/projects/raaj-kharadi-pune/                    a listing
```

`projects/` holds only `search.html` and `property-details.html` — the two
listing pages — plus everything the generator builds from them. All other pages,
`css/`, `js/` and `assets/` stay at the site root.

The `/projects/` prefix on generated URLs is the single constant `BASE_PATH` in
`build/seo.js`; set it to `""` to move them to the domain root, with no other
change needed.

**`robots.txt` and `sitemap.xml` must stay at the root** — crawlers only read
them there.

Every generated page has a unique title, meta description, canonical URL,
Open Graph tags and JSON-LD structured data, plus visible breadcrumbs and
internal links back to its locality and city.

**The multiplier:** 5 sample listings produced **19 indexable pages**.
500 listings will produce roughly 700–900.

---

## Running the generator

```bash
npm install                       # once - the generator uses cheerio
node build/generate.js            # live Supabase data
node build/generate.js --sample   # mock data, no network needed
```

It reads the **`projects`** table (renamed from `properties`) and only rows with
`moderation_status = 'approved'`, so
unapproved or rejected listings never get a public page.

### index.html is written in place

Besides the generated pages, the build fills the homepage's **Top Cities**,
**Top Localities** and **Popular Properties** sections, because those links are
otherwise injected by JavaScript and never reach a first-pass crawler.

**New Launches is deliberately left alone.** It selects listings created within
30 days *of the moment it runs*, so a build's idea of "new" goes stale as soon
as a listing crosses that boundary, and the section would visibly change when
the script re-rendered it. It also adds no URLs of its own — it is a subset of
the same newest-first list Popular Properties already covers.

The cards are **not** built from a copy of the page's card markup. `homePage()`
lifts `createPropertyCard` and everything it calls out of `index.html` and runs
them in a `vm` sandbox, so the page stays the single source of truth for what a
card looks like. The dependency list is worked out from the source rather than
hand-maintained, and the sandbox has no `document` or `window`, so a helper that
started touching the DOM would fail the build instead of shipping a broken card.
Renaming `createPropertyCard` is the one change that needs a matching edit —
to `CARD_ENTRY` in `build/templates.js` — and the build says so by name if it
happens.

Two things the generator cannot reproduce, both expected:
`attachPropertyEvents()` sets `card.style.cursor` at runtime, and the `onerror`
fallback swaps an image `src` when a photo 404s. Neither is markup.

`titleCaseName` is pulled out of the page the same way, and the city and
locality lists here call it. Those two lists are written out in
`build/templates.js` rather than extracted — they build DOM rather than
returning a string — so borrowing the page's own function is what keeps the
spellings from diverging. Display text is title-cased; the `href` is still
built from the stored value, because slugs must not move once indexed.

`index.html` is the only file that is both an input and an output, so it is
**not** re-serialised through cheerio — that would rewrite `defer` to
`defer=""`, collapse multi-line tags and escape ampersands on every build, in a
file that is edited by hand. Instead only the spans between these markers are
replaced:

```html
<div class="city-grid"      id="topCitiesList"><!--keys99:cities:start--> … <!--keys99:cities:end--></div>
<div class="locality-scroll" id="topLocalitiesList"><!--keys99:localities:start--> … <!--keys99:localities:end--></div>
<div class="property-scroll" id="propertyList"><!--keys99:popular:start--> … <!--keys99:popular:end--></div>
```

Everything outside them survives byte for byte, and repeated builds produce an
identical file. **Do not remove the markers** — the build fails loudly if they
are missing rather than writing the lists somewhere wrong.

The city and locality markup in `homePage()` must stay identical to what
`renderTopCities` and `renderTopLocalities` build in `index.html` — those two
are short enough to be written out rather than extracted, so they are the one
place drift is still possible. If they diverge, the lists visibly change the
moment the page's own script runs.

The loader divs (`#topCitiesState`, `#topLocalitiesState`, `#propertyLoading`)
are `display:none` in the source, so a crawler does not read "Loading cities…"
as page content; the script still shows them for the empty and error states.

If the fetch returns nothing the homepage is left untouched, so a failed build
cannot blank out lists that are already correct.

### Titles and descriptions

Step 7 of `post-property.html` sets four optional columns. Every one of them
can be left empty, and a listing that leaves them all empty behaves exactly as
it did before they existed.

| Column | Used for |
|---|---|
| `title` | the listing page's H1, and the basis of its `<title>` |
| `description` | the meta description |
| `seo_title` | overrides `<title>` and `og:title` only — not the H1 |
| `seo_description` | overrides the meta description only |

The chain resolves **`seo_title` → `title` → generated**, and
**`seo_description` → `description` → generated**. A whitespace-only value
counts as empty and falls through. `" | Keys99"` is appended to a hand-written
title only when there is room inside the 60-character budget, so a carefully
sized one is never pushed past what Google shows.

`description` is deliberately separate from `overview`. Overview is the long
on-page text — in practice several paragraphs with emoji — which makes a poor
meta description. This is the short version written for a search result.

The form previews all of this live, including the generated fallback, so it is
clear what filling a field in actually changes. That preview builds the
fallback with its own copy of the title logic; it is only a hint, so if it ever
drifts from `build/seo.js` the cost is an inaccurate preview, not a wrong page.

### Slugs

A listing's URL comes from its **`slug`** column, so the URL stays fixed no
matter how the other fields are edited — which is what you want once Google has
indexed it. Rows with an empty slug get one derived from their attributes
(`2-bhk-flat-for-sale-in-moshi-pune-<project>-<id>`), so nothing breaks before
the column is filled in.

Listings sit directly under `/projects/<slug>/`, the same level as the city
hubs (`/projects/pune/`). A slug that matched a city name would overwrite that
hub, so the build reserves the city slugs and renames any listing that collides.

`slug` has **no unique constraint**. Two rows sharing one would mean the second
page overwrites the first and a listing silently disappears, so the build
detects duplicates, prints a warning naming both rows, and publishes the later
one at `<slug>-<short id>` rather than losing it. Treat that warning as
something to fix in the data, not as normal output.

Environment variables (optional locally — it falls back to `js/config.js`):

```
SUPABASE_URL       https://xxxx.supabase.co
SUPABASE_ANON_KEY  eyJ...
SITE_ORIGIN        https://keys99.com
```

`SITE_ORIGIN` matters: it's what canonical URLs and the sitemap are built from.
Set it to your real domain before going live, or Google will be told your pages
live at the placeholder domain.

---

## Deploying

The site is hosted on **Hostinger** shared hosting (Apache). Shared hosting
does not run Node, so the generator runs before upload, not on the server:

1. Run `node build/generate.js` with `SUPABASE_URL`, `SUPABASE_ANON_KEY` and
   `SITE_ORIGIN` set in the environment.
2. Upload the site to `public_html`, including `.htaccess` — it handles HTTPS,
   redirects, caching, compression and security headers.

Don't upload `build/`, `node_modules/`, `package.json`, the `supabase*` SQL
files or `supabase/` — they are not part of the website.

### Rebuilding when listings change

A new listing won't get its own page until the site is rebuilt and re-uploaded.
Until then, the `.htaccess` fallback sends visitors to the dynamic page, so
nothing 404s. Rebuild and re-upload regularly — daily is fine while listing
volume is low.

---

## After the first deploy

1. **Google Search Console** — add the property, verify via DNS, submit
   `https://keys99.com/sitemap.xml`.
2. **Bing Webmaster Tools** — same, and it imports from Search Console.
3. **Rich Results Test** — run one property URL through
   `search.google.com/test/rich-results` to confirm the `RealEstateListing`
   schema is picked up.
4. **PageSpeed Insights** — run the homepage and one property page.

Indexing takes time. New domains typically see little for the first 4–8 weeks.
That is normal and not a sign anything is broken.

---

## Structured data: what is deliberately missing

`index.html` declares a `RealEstateAgent` joined to a `WebSite` by `@id`.
Two properties are **intentionally left out**, and should be added once real
values exist:

- **`telephone`** — the footer shows `+91 98765 43210`, which is the standard
  Indian placeholder. Structured data is fed straight into search results and
  business panels, so publishing it there would put a fake number in front of
  real buyers. The footer has the same problem, in plainer sight.
- **`sameAs`** — the four social icons in the footer are `href="#"`. `sameAs`
  is how a search engine ties the site to its social profiles; it needs real
  URLs or nothing.

`email` was left out for the same reason: `support@keys99.com` appears in the
footer but has not been confirmed to exist.

Add all three to the `RealEstateAgent` block once confirmed.

## Privacy Policy and Terms

`privacy-policy.html` and `terms.html` are **working drafts that have not been
reviewed by a lawyer**. Every field still to be filled in is wrapped in
`<span class="fill-in">`, which renders highlighted on the page so it cannot
ship unnoticed. To list what is outstanding:

```bash
grep -o 'class="fill-in">\[[^<]*' privacy-policy.html terms.html
```

The privacy policy is written against the Digital Personal Data Protection Act,
2023 — including the Grievance Officer that the Act requires to be named. The
terms carry the clauses a listing platform needs most: that Keys99 is not a
party to any transaction, that listing content comes from the person who posted
it, and that "verified" refers to internal review and not to title, measurement
or RERA validation. Those three are the ones worth a lawyer's attention first.

Both pages are deliberately lightweight: no Supabase, no chat widget, just the
header, the text and the footer.

## Things still worth doing

These matter for ranking but weren't part of this pass:

- **The four property-type tiles are illustrations, not photographs.**
  `assets/type-*.svg` were drawn to replace hotlinked Unsplash photos, which
  could not be downloaded and localised. They are on-brand and weigh ~1.8KB
  each, but real photography would sell the categories better. Swap the four
  files and the markup does not change.
- **The LinkedIn icon in every footer is still `href="#"`** — 29 dead links,
  one per page. Facebook, Instagram and YouTube are wired up and listed in
  `sameAs`; no LinkedIn page was supplied. Either add the URL in both places,
  or drop the icon.
- **Existing rows still hold the messy values.** `post-property.html` now
  normalises city, state, locality, developer and BHK type on the way in, and
  `index.html` normalises on the way out, so both new and old listings display
  correctly. But the eight rows already in the database still store "DIGHI",
  "lodha" and "3BhK" until each is edited and resaved. A one-off `UPDATE` would
  clean them; nothing breaks either way, and slugs are unaffected because
  `slugify` lowercases regardless.
- **`index.html` has ~38KB of inline JavaScript.** It no longer blocks the
  parser the way the Supabase library did, but moving it to an external
  deferred file would make it cacheable across visits.
- **`property-details.html` hides its content** behind `.hidden{display:none}`
  until JavaScript loads. The generated pages ship with it already visible, but
  the original page still behaves the old way for anyone reaching it directly.
- **Image optimisation.** Listing photos go to the browser at full upload size.
  Serving WebP through Supabase's image transform would cut page weight sharply.
- **Content depth on locality pages.** Right now the intro text is generated from
  listing counts. Genuine 200–300 word write-ups per locality ("what it's like to
  live in Kharadi") is what actually beats 99acres on these terms.
- **The homepage H1** is "Find Your Dream Property with Keys99" — brand-focused
  rather than keyword-focused. Deliberately left alone as a design decision.

## Changes made to existing files

Kept deliberately minimal, none of them visual:

| File | Change |
|---|---|
| `index.html`, `search.html`, `post-property.html`, `reels.html` | SEO title + meta/OG/canonical added to `<head>` |
| `property-details.html`, `login.html`, `profile.html`, `my-properties.html`, `my-enquiries.html` | same, plus `noindex` |
| `js/property-details.js` | reads the property id from the page when there is no `?id=` (3 lines) |
| `search.html` (script) | seeds filters from the page on generated pages; keeps pre-rendered cards if the live fetch fails |

---

## Honest expectations

This gives Keys99 the *technical* foundation to rank — correct architecture,
indexable content, clean URLs, valid structured data. That is necessary but not
sufficient.

Ranking against 99acres, MagicBricks and Housing.com also needs listing volume
(they have hundreds of thousands), genuine local content, and backlinks. The
architecture here is built to scale into that — every new approved listing
automatically becomes an indexable page, and automatically strengthens its
locality and city pages through internal linking.
