# Cinematic Clinic — cinematicclinic.com

Static bilingual (EN + FA) site for Shahab Balamchi, clinic filmmaker. A Divan Group production.

## Look at it locally (one command)

    npm run preview          # builds, then serves at http://localhost:3000

Or, with no npm at all:

    cd dist && python3 -m http.server 3000

Do **not** just double-click `dist/index.html` — the pages link assets from `/assets/…`, which only
resolves over http, not `file://`. Opening it that way shows unstyled text.

## Build

    node build.js     # writes dist/

No dependencies. Node 18+. `dist/` is already built and included in this package.

## Deploy to Vercel

### If you want Claude to deploy it for you

The Claude ↔ Vercel connection currently returns
`403 — You don't have permission to create a project`, even for existing projects. That is an
install-scope setting on the Vercel side, not something Claude can work around. Fix it once:

**Vercel → Settings → Integrations → Claude → Configure → change project access from
"Specific Projects" to "All Projects" → Save.**

(If it is already on All Projects, then the connected account's role on the team is below Admin —
Vercel → Settings → Members. Owner or Admin can create projects; Member cannot.)

After that, Claude can create the project and deploy straight from chat.

### Or do it yourself in one minute

CLI:

    npm i -g vercel
    vercel            # first run: creates the project, links it
    vercel --prod

Vercel settings (auto-detected from vercel.json, or set manually):
- Framework preset: Other
- Build command: `node build.js`
- Output directory: `dist`
- Install command: `echo no dependencies`

Git route: push this folder to a GitHub repo, then import it in Vercel.

## Environment variables (Vercel → Settings → Environment Variables)

- `RESEND_API_KEY` — required for the contact + waitlist forms to send email.
  Without it, the form falls back to opening the visitor's own mail app, pre-filled — so the
  site still works on day one, it just doesn't collect submissions server-side.
- `CONTACT_TO` — optional, defaults to balamchi@divangroup.ca
- `CONTACT_FROM` — optional, defaults to "Cinematic Clinic <cinematic@divangroup.ca>"
  (divangroup.ca is already verified in Resend; switch to cinematicclinic.com once that domain is verified there too.)

## Domain

Point cinematicclinic.com at the Vercel project (Vercel → Settings → Domains).
Add cinematiclinic.com (single c) as a redirect domain if you own it.
After go-live, update `SITE` at the top of build.js if the canonical host ever changes.

## Where things live

- `content/en.json`, `content/fa.json` — all page copy. Edit these, never the HTML.
- `content/videos.json` — the 59 portfolio films (YouTube id + EN/FA title + category).
- `static/site.css`, `static/site.js`, `static/favicon.svg` — copied into `dist/assets/` at build.
- `build.js` — the generator: layout, JSON-LD schema, sitemap, robots.txt, llms.txt.
- `api/contact.js` — Vercel serverless function; posts both forms to balamchi@divangroup.ca via Resend.

## Pages (each in EN at `/` and FA at `/fa/`)

home · work · clinic-film · doctor-series · film-week · academy · about · consent · privacy · contact

## Adding a film

Add `{"id":"<youtube id>","title":"…","title_fa":"…","cat":"…","cat_fa":"…"}` to `content/videos.json`,
then rebuild. Categories drive the filter chips on /work/ and the VideoObject schema.

## SEO / GEO built in

- Per-page title, meta description, canonical, Open Graph, Twitter card
- hreflang en / fa / x-default on every page, and in the sitemap
- JSON-LD: ProfessionalService, Person (Shahab), WebSite, BreadcrumbList, Service, Course,
  FAQPage, and 59 VideoObject entries on /work/
- sitemap.xml, robots.txt (AI crawlers explicitly allowed), llms.txt and llms-full.txt
- No render-blocking JS; all content is in the HTML for crawlers that don't run JavaScript
