// Cinematic Clinic — static site generator (no dependencies).
// `node build.js` → dist/ (EN at /, FA at /fa/). Content lives in content/*.json.
const fs = require('fs');
const path = require('path');

const SITE = 'https://cinematicclinic.com';
const OUT = path.join(__dirname, 'dist');
const videos = require('./content/videos.json');
const LANGS = { en: require('./content/en.json'), fa: require('./content/fa.json') };
const PAGES = ['home', 'work', 'clinic-film', 'doctor-series', 'film-week', 'academy', 'about', 'consent', 'privacy', 'contact'];
const YT_IMG = (id, q) => `https://i.ytimg.com/vi/${id}/${q || 'hqdefault'}.jpg`;
const HERO_ID = '9SIWEmTUW6o';
// The band is the horizontal counterpart — the hero film is vertical (9:16),
// so using it there would pillarbox. Picked from videos.json orient === 'h'.
const BAND_ID = 'BHjNmSUK-do';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const md = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>').replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
const paras = (arr) => arr.map((p) => `<p>${md(p)}</p>`).join('\n');
const url = (lang, page) => (lang === 'en' ? '' : '/fa') + (page === 'home' ? '/' : `/${page}/`);
const abs = (lang, page) => SITE + url(lang, page);

function write(rel, content) {
  const f = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, content);
}

function fonts(lang) {
  return lang === 'fa'
    ? 'https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;600;700;800&family=Archivo:wght@400;500;600&display=swap'
    : 'https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..700&display=swap';
}

function layout(lang, page, { title, desc, body, schema, ogImage, noindex }) {
  const c = LANGS[lang];
  const other = lang === 'en' ? 'fa' : 'en';
  const canonical = abs(lang, page);
  const og = ogImage || SITE + '/assets/og.jpg';
  const ld = (schema || []).map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join('\n');
  const navItems = ['work', 'clinic-film', 'doctor-series', 'film-week', 'academy', 'about'];
  return `<!DOCTYPE html>
<html lang="${lang === 'fa' ? 'fa' : 'en'}" dir="${c.dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${canonical}">
<link rel="alternate" hreflang="en" href="${abs('en', page)}">
<link rel="alternate" hreflang="fa" href="${abs('fa', page)}">
<link rel="alternate" hreflang="x-default" href="${abs('en', page)}">
<meta name="robots" content="${noindex ? 'noindex, follow' : 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1'}">
<meta name="author" content="Shahab Balamchi">
<meta name="theme-color" content="#0B0B0D">
<meta name="color-scheme" content="dark">
<meta name="format-detection" content="telephone=no">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Cinematic Clinic">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${og}">
<meta property="og:locale" content="${c.locale}">
<meta property="og:locale:alternate" content="${LANGS[other].locale}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${og}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="alternate" type="text/plain" href="/llms.txt" title="LLMs.txt — AI-readable site overview">
<link rel="sitemap" type="application/xml" href="/sitemap.xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preconnect" href="https://i.ytimg.com">
<link rel="stylesheet" href="${fonts(lang)}">
<link rel="stylesheet" href="/assets/site.css">
${ld}
</head>
<body class="lang-${lang} page-${page}">
<a class="skip" href="#main">${esc(c.ui.skip)}</a>
<div class="curtain" aria-hidden="true"><span class="curtain-mark">CC</span></div>
<header class="top">
  <div class="wrap top-row">
    <a class="brand" href="${url(lang, 'home')}" aria-label="Cinematic Clinic"><span class="brand-mark">CC</span><span class="brand-name">Cinematic Clinic</span></a>
    <button class="nav-toggle" aria-expanded="false" aria-controls="nav" aria-label="${esc(c.ui.menu)}"><span></span><span></span></button>
    <nav id="nav" class="nav">
      ${navItems.map((p) => `<a href="${url(lang, p)}"${p === page ? ' aria-current="page"' : ''}>${esc(c.nav[p])}</a>`).join('')}
      <a class="lang" href="${url(other, page)}" lang="${other}" hreflang="${other}">${esc(c.nav.lang)}</a>
      <a class="btn btn-small" href="${url(lang, 'contact')}">${esc(c.nav.contact)}</a>
    </nav>
  </div>
</header>
<div id="scroll">
<main id="main">
${body}
</main>
<div id="lightbox" class="lightbox" aria-hidden="true"><button class="lightbox-close" type="button">${esc(c.ui.close)}</button><div class="lightbox-frame"></div></div>
<footer class="foot">
  <div class="wrap foot-grid">
    <div>
      <div class="foot-brand">Cinematic Clinic</div>
      <p class="foot-line">${esc(c.site.oneLiner)}</p>
      <p class="foot-print" dir="ltr">Canada · United States · Spain · UAE</p>
    </div>
    <div>
      <div class="foot-h">${esc(c.footer.pages)}</div>
      ${['work', 'clinic-film', 'doctor-series', 'film-week', 'academy', 'about', 'consent', 'contact'].map((p) => `<a href="${url(lang, p)}">${esc(c.nav[p] || c.footer[p])}</a>`).join('')}
    </div>
    <div>
      <div class="foot-h">${esc(c.footer.connect)}</div>
      <a href="mailto:balamchi@divangroup.ca" dir="ltr">balamchi@divangroup.ca</a>
      <a href="https://ca.linkedin.com/in/shahab-balamchi-612a67197" rel="me noopener" target="_blank">LinkedIn</a>
      <a href="https://youtube.com/@divan-group" rel="noopener" target="_blank">YouTube</a>
      <a href="${url(other, page)}" lang="${other}">${esc(c.nav.lang)}</a>
      <a href="${url(lang, 'privacy')}">${esc(c.footer.privacy)}</a>
    </div>
  </div>
  <div class="wrap foot-credit">
    <span><a href="https://www.divangroup.ca" rel="noopener" target="_blank">${esc(c.site.credit)}</a></span>
    <span>© ${new Date().getFullYear()} Shahab Balamchi · Cinematic Clinic</span>
  </div>
</footer>
</div>
<script src="/assets/site.js" defer></script>
</body>
</html>`;
}

// ---------- shared schema ----------
function orgSchema(lang) {
  const c = LANGS[lang];
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    '@id': SITE + '/#organization',
    name: 'Cinematic Clinic',
    alternateName: ['Cinematic Clinic by Shahab Balamchi', 'Shahab Balamchi — Clinic Filmmaker'],
    url: SITE,
    logo: SITE + '/favicon.svg',
    image: YT_IMG(HERO_ID, 'maxresdefault'),
    description: c.site.description,
    disambiguatingDescription: 'Cinematic Clinic is the film practice and film academy of cinematographer Shahab Balamchi, Toronto. It produces cinematic brand films for beauty and health clinics and is a Divan Group production. Not a medical clinic.',
    slogan: 'Film the beauty business.',
    founder: { '@id': SITE + '/#shahab' },
    parentOrganization: { '@type': 'Organization', '@id': 'https://www.divangroup.ca/#organization', name: 'Divan Group', url: 'https://www.divangroup.ca' },
    email: 'balamchi@divangroup.ca',
    address: { '@type': 'PostalAddress', addressLocality: 'Toronto', addressRegion: 'ON', addressCountry: 'CA' },
    areaServed: [
      { '@type': 'Country', name: 'Canada' },
      { '@type': 'Country', name: 'United States' },
      { '@type': 'Country', name: 'Spain' },
      { '@type': 'Country', name: 'United Arab Emirates' },
    ],
    availableLanguage: ['English', 'Persian'],
    knowsAbout: ['Clinic videography', 'Medical aesthetics video production', 'Med spa brand films', 'Cosmetic clinic cinematography', 'Dermatology clinic video', 'Plastic surgery practice video', 'Physician personal brand video', 'Patient consent on set', 'Lighting for skin', 'Clinic content strategy'],
    sameAs: ['https://ca.linkedin.com/in/shahab-balamchi-612a67197', 'https://youtube.com/@divan-group', 'https://www.divangroup.ca'],
    makesOffer: ['clinic-film', 'doctor-series', 'film-week'].map((p) => ({ '@type': 'Offer', itemOffered: { '@type': 'Service', name: c.nav[p], url: abs(lang, p) } })),
  };
}
function personSchema(lang) {
  const c = LANGS[lang];
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': SITE + '/#shahab',
    name: 'Shahab Balamchi',
    alternateName: 'شهاب بلامچی',
    jobTitle: 'Clinic Filmmaker · Commercial Cinematographer',
    description: c.about.metaDesc,
    url: abs(lang, 'about'),
    email: 'balamchi@divangroup.ca',
    worksFor: { '@id': SITE + '/#organization' },
    affiliation: { '@type': 'Organization', '@id': 'https://www.divangroup.ca/#organization', name: 'Divan Group' },
    knowsLanguage: ['en', 'fa'],
    homeLocation: { '@type': 'Place', name: 'Toronto, Canada' },
    knowsAbout: ['Cinematography', 'Clinic videography', 'Medical aesthetics marketing', 'Brand films', 'Lighting for skin'],
    sameAs: ['https://ca.linkedin.com/in/shahab-balamchi-612a67197', 'https://www.divangroup.ca'],
  };
}
function websiteSchema(lang) {
  return { '@context': 'https://schema.org', '@type': 'WebSite', '@id': SITE + '/#website', url: SITE, name: 'Cinematic Clinic', inLanguage: lang === 'fa' ? 'fa' : 'en', publisher: { '@id': SITE + '/#organization' } };
}
function breadcrumb(lang, page, label) {
  const c = LANGS[lang];
  const items = [{ '@type': 'ListItem', position: 1, name: c.ui.home, item: abs(lang, 'home') }];
  if (page !== 'home') items.push({ '@type': 'ListItem', position: 2, name: label, item: abs(lang, page) });
  return { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items };
}
function faqSchema(faq) {
  return { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) };
}
function serviceSchema(lang, page, name, desc) {
  return { '@context': 'https://schema.org', '@type': 'Service', '@id': abs(lang, page) + '#service', name, description: desc, serviceType: 'Video production', provider: { '@id': SITE + '/#organization' }, areaServed: ['Canada', 'United States', 'Spain', 'United Arab Emirates'], url: abs(lang, page) };
}
function videoSchema(lang, v) {
  const title = lang === 'fa' ? v.title_fa : v.title;
  return {
    '@type': 'VideoObject',
    '@id': abs(lang, 'work') + '#' + v.id,
    name: title,
    description: (lang === 'fa' ? 'فیلم کلینیک زیبایی — ' : 'Cosmetic clinic film — ') + (lang === 'fa' ? v.cat_fa : v.cat) + (lang === 'fa' ? '. فیلم‌برداری شهاب بلامچی، تولید Divan Group.' : '. Filmed by Shahab Balamchi, produced by Divan Group.'),
    thumbnailUrl: [YT_IMG(v.id, 'maxresdefault'), YT_IMG(v.id)],
    uploadDate: '2026-07-09',
    embedUrl: 'https://www.youtube-nocookie.com/embed/' + v.id,
    contentUrl: 'https://www.youtube.com/watch?v=' + v.id,
    genre: v.cat,
    creator: { '@id': SITE + '/#shahab' },
    producer: { '@type': 'Organization', '@id': 'https://www.divangroup.ca/#organization', name: 'Divan Group' },
  };
}

// ---------- components ----------
// WebP with a JPEG fallback. Width/height are set so nothing reflows while loading.
const photo = (base, alt, w, h, cls, eager) => `<span class="${cls || 'photo'}"><img src="/assets/${base}.jpg" alt="${esc(alt)}" width="${w}" height="${h}" loading="${eager ? 'eager' : 'lazy'}" decoding="async"></span>`;
const film = (lang, v, cls) => {
  const c0 = LANGS[lang];
  const t = lang === 'fa' ? v.title_fa : v.title;
  const cat = lang === 'fa' ? v.cat_fa : v.cat;
  return `<a class="film ${cls || ''}" href="https://www.youtube.com/watch?v=${v.id}" data-yt="${v.id}" data-cat="${esc(v.cat)}" data-cursor="${esc(c0.ui.play)}" target="_blank" rel="noopener">
  <span class="film-frame"><img src="${YT_IMG(v.id)}" alt="${esc(t)}" loading="lazy" width="480" height="360" data-parallax="8"><span class="play" aria-hidden="true"></span></span>
  <span class="film-meta"><span class="film-title">${esc(t)}</span><span class="film-cat">${esc(cat)}</span></span></a>`;
};
const faqBlock = (lang, title, faq) => `<section class="section faq"><div class="wrap narrow reveal"><h2 style="margin-bottom:28px">${esc(title)}</h2>
${faq.map((f) => `<details><summary>${esc(f.q)}</summary><div class="faq-a">${paras(Array.isArray(f.a) ? f.a : [f.a])}</div></details>`).join('\n')}</div></section>`;
const cta = (lang, c) => `<section class="closing rule"><div class="wrap reveal"><h2>${md(c.title)}</h2><p>${md(c.text)}</p><p class="cta-row"><a class="btn" href="${url(lang, 'contact')}">${esc(c.button)}</a><a class="link" href="mailto:balamchi@divangroup.ca" dir="ltr">balamchi@divangroup.ca</a></p></div></section>`;
const list = (items) => `<ul class="list">${items.map((i) => `<li>${md(i)}</li>`).join('')}</ul>`;
const steps = (items) => `<ol class="steps">${items.map((s, i) => `<li class="reveal"><span class="num" dir="ltr">0${i + 1}</span><strong>${esc(s.t)}</strong><span class="d">${md(s.d)}</span></li>`).join('')}</ol>`;
const cards = (lang, items) => `<div class="cards">${items.map((i, n) => `<a class="card reveal" data-delay="${n}" href="${url(lang, i.page)}"><span class="card-k">${esc(i.k)}</span><span class="card-t">${esc(i.t)}</span><span class="card-d">${esc(i.d)}</span><span class="card-more arrow">${esc(i.more)}</span></a>`).join('')}</div>`;
const stats = (items) => `<div class="stats">${items.map((s, i) => `<div class="reveal" data-delay="${i}"><span class="stat-n" dir="ltr" data-count>${esc(s.n)}</span><span class="l">${esc(s.l)}</span></div>`).join('')}</div>`;

const form = (lang, c, kind) => {
  const f = c.form;
  const interests = f.interests.map((o) => `<option value="${esc(o.v)}">${esc(o.l)}</option>`).join('');
  return `<form class="form" method="post" action="/api/contact" data-form="${kind}" data-lang="${lang}">
  <input type="text" name="company" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">
  <div class="field"><label for="f-name">${esc(f.name)}</label><input id="f-name" name="name" required autocomplete="name"></div>
  <div class="field"><label for="f-email">${esc(f.email)}</label><input id="f-email" type="email" name="email" required autocomplete="email" dir="ltr"></div>
  <div class="field-row">
    <div class="field"><label for="f-clinic">${esc(kind === 'academy' ? f.cityLabel : f.clinic)}</label><input id="f-clinic" name="clinic" autocomplete="organization"></div>
    <div class="field"><label for="f-location">${esc(kind === 'academy' ? f.experience : f.location)}</label><input id="f-location" name="location"></div>
  </div>
  ${kind === 'academy' ? '' : `<div class="field"><label for="f-interest">${esc(f.interest)}</label><select id="f-interest" name="interest">${interests}</select></div>`}
  <div class="field"><label for="f-message">${esc(kind === 'academy' ? f.academyMessage : f.message)}</label><textarea id="f-message" name="message" rows="5"></textarea></div>
  <input type="hidden" name="kind" value="${kind}"><input type="hidden" name="lang" value="${lang}">
  <p class="form-row"><button class="btn" type="submit">${esc(kind === 'academy' ? f.submitAcademy : f.submit)}</button><span class="form-note">${esc(f.note)}</span></p>
  <p class="form-status" role="status" aria-live="polite" data-ok="${esc(f.ok)}" data-err="${esc(f.err)}" data-fallback="${esc(f.fallback)}" data-to="balamchi@divangroup.ca"></p>
</form>`;
};

// ---------- pages ----------
const R = {};

// Full-bleed horizontal film. Uses a self-hosted loop when static/reel.(webm|mp4)
// exists; until then it shows the brand film's frame and opens it in the lightbox.
// Either way the band is real content, never an empty placeholder.
function filmBand(lang, h) {
  const c = LANGS[lang];
  const hasReel = fs.existsSync(path.join(__dirname, 'static', 'reel.mp4'));
  const poster = hasReel ? '/assets/reel-poster.jpg' : YT_IMG(BAND_ID, 'maxresdefault');
  const media = hasReel
    ? `<video autoplay muted loop playsinline preload="none" poster="${poster}" aria-hidden="true" tabindex="-1"><source src="/assets/reel.webm" type="video/webm"><source src="/assets/reel.mp4" type="video/mp4"></video>`
    : `<img src="${poster}" onerror="this.onerror=null;this.src='${YT_IMG(BAND_ID)}'" alt="" width="1280" height="720" loading="lazy" aria-hidden="true">`;
  return `
<section class="band" aria-label="${esc(h.bandEyebrow)}">
  <div class="band-media">${media}</div>
  <div class="band-shade" aria-hidden="true"></div>
  <div class="wrap band-copy reveal">
    <span class="label ox">${esc(h.bandEyebrow)}</span>
    <h2>${md(h.bandTitle)}</h2>
    <button class="play-btn" type="button" data-lightbox="${BAND_ID}"><span class="ring" aria-hidden="true"></span><span>${esc(h.bandWatch)}</span></button>
  </div>
</section>`;
}

function verticalFromCatalogue(lang, h) {
  const c = LANGS[lang];
  const picks = videos.filter((v) => v.orient === 'v').slice(0, 4);
  if (!picks.length) return '';
  const cards = picks.map((v, i) => {
    const t = lang === 'fa' ? v.title_fa : v.title;
    const k = lang === 'fa' ? v.cat_fa : v.cat;
    return `<figure class="vcard reveal" data-delay="${i}">
      <a class="film vframe" href="https://www.youtube.com/watch?v=${v.id}" data-yt="${v.id}" data-cursor="${esc(c.ui.play)}" target="_blank" rel="noopener" aria-label="${esc(t)}"><img src="${YT_IMG(v.id, 'maxresdefault')}" onerror="this.onerror=null;this.src='${YT_IMG(v.id)}'" alt="${esc(t)}" width="1280" height="720" loading="lazy"><span class="play" aria-hidden="true"></span></a>
      <figcaption><span class="vcap-t">${esc(t)}</span><span class="vcap-k">${esc(k)}</span></figcaption>
    </figure>`;
  }).join('\n');
  return `
<section class="section"><div class="wrap">
  <div class="section-head reveal"><div><span class="label ox">${esc(h.vertEyebrow)}</span><h2 style="margin-top:14px">${esc(h.vertTitle)}</h2></div><p class="lead" style="margin:0">${md(h.vertLead)}</p></div>
  <div class="vstrip">${cards}</div>
</div></section>`;
}

// 9:16 counterpart to the band. Renders only when there are real vertical files
// in static/vertical/ — an empty strip would be worse than no strip.
function verticalStrip(lang, h) {
  const c = LANGS[lang];
  const dir = path.join(__dirname, 'static', 'vertical');
  if (!fs.existsSync(dir)) return verticalFromCatalogue(lang, h);
  const clips = fs.readdirSync(dir).filter((f) => f.endsWith('.mp4')).sort().slice(0, 6);
  if (!clips.length) return verticalFromCatalogue(lang, h);
  const cards = clips.map((f, i) => {
    const stem = f.replace(/\.mp4$/, '');
    const webm = fs.existsSync(path.join(dir, stem + '.webm'));
    const poster = fs.existsSync(path.join(dir, stem + '.jpg')) ? `/assets/vertical/${stem}.jpg` : '';
    const sources = (webm ? `<source src="/assets/vertical/${stem}.webm" type="video/webm">` : '') +
                    `<source src="/assets/vertical/${stem}.mp4" type="video/mp4">`;
    return `<figure class="vcard reveal" data-delay="${i}">
      <span class="vframe"><video muted loop playsinline preload="none"${poster ? ` poster="${poster}"` : ''} aria-hidden="true" tabindex="-1">${sources}</video></span>
    </figure>`;
  }).join('\n');
  return `
<section class="section"><div class="wrap">
  <div class="section-head reveal"><div><span class="label ox">${esc(h.vertEyebrow)}</span><h2 style="margin-top:14px">${esc(h.vertTitle)}</h2></div><p class="lead" style="margin:0">${md(h.vertLead)}</p></div>
  <div class="vstrip">${cards}</div>
</div></section>`;
}

R.home = (lang) => {
  const c = LANGS[lang], h = c.home;
  const hero = videos.find((v) => v.id === HERO_ID);
  const heroTitle = lang === 'fa' ? hero.title_fa : hero.title;
  const hasMp4 = fs.existsSync(path.join(__dirname, 'static', 'hero.mp4'));
  // Plays once on load and fades to black; the poster IS that last black frame,
  // so there is no flash before playback and no jump when it ends.
  const media = hasMp4
    ? `<video autoplay muted playsinline preload="auto" poster="/assets/hero-poster.jpg" aria-hidden="true" tabindex="-1"><source src="/assets/hero.webm" type="video/webm"><source src="/assets/hero.mp4" type="video/mp4"></video>`
    : '';
  const mediaAttr = hasMp4 ? '' : ` data-yt="${HERO_ID}" data-title="${esc(heroTitle)}"`;
  const selected = h.selected.map((sel, i) => {
    const v = videos.find((x) => x.id === sel.id);
    const t = sel.t || (lang === 'fa' ? v.title_fa : v.title);
    return `<article class="feature reveal">
    <a class="film" href="https://www.youtube.com/watch?v=${v.id}" data-yt="${v.id}" data-cursor="${esc(c.ui.play)}" target="_blank" rel="noopener" aria-label="${esc(t)}"><span class="film-frame"><img src="${YT_IMG(v.id, 'maxresdefault')}" onerror="this.onerror=null;this.src='${YT_IMG(v.id)}'" alt="${esc(t)}" width="1280" height="720" loading="${i ? 'lazy' : 'eager'}" data-parallax="10"><span class="play" aria-hidden="true"></span></span></a>
    <div class="feature-meta"><h3>${esc(t)}</h3><p>${md(sel.d)}</p><span class="label">${esc(sel.k)}</span></div>
  </article>`;
  }).join('\n');
  const body = `
<section class="hero">
  <div class="hero-media"${mediaAttr} style="background-image:url('${hasMp4 ? '/assets/hero-poster.jpg' : YT_IMG(HERO_ID, 'maxresdefault')}')">${media}</div>
  <div class="hero-shade"></div>
  <div class="hero-grain" aria-hidden="true"></div>
  <div class="wrap reveal in">
    <span class="label">${esc(h.eyebrow)}</span>
    <p class="display">${md(h.tagline)}</p>
    <h1>${esc(h.h1)}</h1>
    <div class="hero-foot">
      <div class="cta-row"><a class="btn" href="${url(lang, 'contact')}">${esc(h.cta1)}</a><button class="play-btn" type="button" data-lightbox="${HERO_ID}"><span class="ring" aria-hidden="true"></span><span>${esc(h.watch)}</span></button></div>
      <span class="scroll-hint" aria-hidden="true">${esc(h.scroll)}</span>
    </div>
  </div>
</section>
<section class="led">
  ${h.led.map((b, i) => `<div class="reveal" data-delay="${i}"><span class="label ox">${esc(b.k)}</span><h2>${md(b.t)}</h2><p>${md(b.d)}</p><div class="tags">${b.tags.map((x) => `<span>${esc(x)}</span>`).join('')}</div></div>`).join('')}
</section>
${filmBand(lang, h)}
<section class="section"><div class="wrap reveal">
  <p class="manifesto">${md(h.manifesto)}</p>
  <p class="entity" style="margin-top:36px">${md(h.entity)}</p>
</div></section>
<section class="section proof"><div class="wrap proof-row">
  <div class="reveal">${photo('shahab-rig', c.media.rig, 800, 879, 'photo proof-img')}</div>
  <div class="reveal" data-delay="1">
    <span class="label ox">${esc(c.media.proofLabel)}</span>
    <h2>${md(c.media.proofTitle)}</h2>
    <p class="lead">${md(c.media.proofText)}</p>
  </div>
</div></section>
<section class="marquee" aria-hidden="true"><div class="marquee-track">${[0, 1].map(() => h.marquee.map((m) => `<span>${esc(m)}</span>`).join('')).join('')}</div></section>
<section class="section rule" style="padding-top:clamp(56px,7vw,96px)"><div class="wrap">
  <div class="section-head reveal"><h2>${esc(h.selectedTitle)}</h2><a class="link arrow" href="${url(lang, 'work')}">${esc(h.filmsAll)}</a></div>
  <div class="selected">${selected}</div>
</div></section>
${verticalStrip(lang, h)}
<section class="section"><div class="wrap">
  <div class="section-head reveal"><h2>${esc(h.offersTitle)}</h2></div>
  ${cards(lang, h.offers)}
</div></section>
<section class="section"><div class="wrap">
  <div class="section-head reveal"><div><span class="label ox">${esc(h.processLabel)}</span><h2 style="margin-top:14px">${esc(h.processTitle)}</h2></div><p class="lead" style="margin:0">${md(h.processLead)}</p></div>
  ${steps(h.process)}
  <p class="note reveal">${md(h.consentNote)}</p>
</div></section>
<section class="section"><div class="wrap">
  <div class="section-head reveal"><h2>${esc(h.numbersTitle)}</h2></div>
  ${stats(c.stats)}
</div></section>
<section class="section"><div class="wrap positioning">
  <div class="reveal"><span class="label ox">${esc(h.whyLabel)}</span><h2 style="margin-top:14px">${esc(h.whyTitle)}</h2></div>
  <div>${h.why.map((w, i) => `<div class="why-item reveal" data-delay="${i}"><h3>${esc(w.t)}</h3><p>${md(w.d)}</p></div>`).join('')}</div>
</div></section>
${faqBlock(lang, h.faqTitle, h.faq)}
<section class="wrap academy-strip reveal"><div><span class="label ox">${esc(h.academyEyebrow)}</span><h2 style="margin-top:14px">${esc(h.academyTitle)}</h2></div><div><p>${md(h.academyText)}</p><a class="btn btn-ghost" href="${url(lang, 'academy')}">${esc(h.academyCta)}</a></div></section>
${cta(lang, h.cta)}`;
  return { title: h.title, desc: h.metaDesc, body, schema: [orgSchema(lang), personSchema(lang), websiteSchema(lang), faqSchema(h.faq), breadcrumb(lang, 'home', c.ui.home)] };
};

R.work = (lang) => {
  const c = LANGS[lang], w = c.work;
  const catsOrder = ['Brand Film', 'Clinic Tour', 'Practitioner', 'Injectables', 'Facial', 'Laser', 'Skincare', 'Head Spa', 'HIFU', 'Body Contouring', 'Microneedling', 'PRP', 'Dermatology', 'Brows', 'Behind the Scenes'];
  const catLabel = (cat) => (lang === 'fa' ? videos.find((v) => v.cat === cat).cat_fa : cat);
  const sorted = [...videos].sort((a, b) => catsOrder.indexOf(a.cat) - catsOrder.indexOf(b.cat));
  const body = `
<section class="page-head"><div class="wrap reveal in"><span class="label ox">${esc(w.eyebrow)}</span><h1>${esc(w.h1)}</h1><p class="lead">${md(w.lead)}</p></div></section>
<section class="section"><div class="wrap reveal">
  <div class="filters" role="toolbar" aria-label="${esc(w.filterLabel)}"><button class="chip is-on" data-filter="all" aria-pressed="true">${esc(w.all)} <span dir="ltr">(${videos.length})</span></button>${catsOrder.map((cat) => `<button class="chip" data-filter="${esc(cat)}" aria-pressed="false">${esc(catLabel(cat))} <span dir="ltr">(${videos.filter((v) => v.cat === cat).length})</span></button>`).join('')}</div>
  <div class="grid grid-4" id="films">${sorted.map((v) => film(lang, v)).join('')}</div>
  <p class="note">${md(w.note)}</p>
</div></section>
${cta(lang, w.cta)}`;
  const itemList = { '@context': 'https://schema.org', '@type': 'ItemList', name: w.h1, numberOfItems: videos.length, itemListElement: sorted.map((v, i) => ({ '@type': 'ListItem', position: i + 1, item: videoSchema(lang, v) })) };
  return { title: w.title, desc: w.metaDesc, body, schema: [orgSchema(lang), itemList, breadcrumb(lang, 'work', c.nav.work)] };
};

function offerPage(lang, page, key, extra) {
  const c = LANGS[lang], o = c[key];
  const body = `
<section class="page-head"><div class="wrap reveal in"><span class="label ox">${esc(o.eyebrow)}</span><h1>${esc(o.h1)}</h1><p class="lead">${md(o.lead)}</p><p class="cta-row"><a class="btn" href="${url(lang, 'contact')}">${esc(o.cta.button)}</a></p></div></section>
<section class="section"><div class="wrap narrow reveal">${paras(o.intro)}</div></section>
${o.blocks.map((b) => `<section class="section"><div class="wrap narrow reveal"><h2>${esc(b.t)}</h2>${b.p ? paras(b.p) : ''}${b.list ? list(b.list) : ''}${b.steps ? steps(b.steps) : ''}</div></section>`).join('')}
${extra || ''}
${faqBlock(lang, o.faqTitle, o.faq)}
${cta(lang, o.cta)}`;
  return { title: o.title, desc: o.metaDesc, body, schema: [orgSchema(lang), serviceSchema(lang, page, o.h1, o.metaDesc), faqSchema(o.faq), breadcrumb(lang, page, c.nav[page])] };
}
R['clinic-film'] = (lang) => offerPage(lang, 'clinic-film', 'clinicFilm');
R['doctor-series'] = (lang) => {
  const docs = videos.filter((v) => v.cat === 'Practitioner');
  const c = LANGS[lang];
  const extra = `<section class="section"><div class="wrap reveal"><h2 class="section-h">${esc(c.doctorSeries.proofTitle)}</h2><div class="grid grid-4">${docs.map((v) => film(lang, v)).join('')}</div></div></section>`;
  return offerPage(lang, 'doctor-series', 'doctorSeries', extra);
};
R['film-week'] = (lang) => offerPage(lang, 'film-week', 'filmWeek');

R.academy = (lang) => {
  const c = LANGS[lang], a = c.academy;
  const bts = videos.filter((v) => v.cat === 'Behind the Scenes');
  const body = `
<section class="page-head"><div class="wrap reveal in"><span class="label ox">${esc(a.eyebrow)}</span><h1>${md(a.h1)}</h1><p class="lead">${md(a.lead)}</p><p class="cta-row"><a class="btn" href="#waitlist">${esc(a.cta1)}</a><a class="btn btn-ghost" href="#modules">${esc(a.cta2)}</a></p></div></section>
<section class="section"><div class="wrap narrow reveal">${paras(a.intro)}</div></section>
<section class="section" id="modules"><div class="wrap narrow reveal"><h2>${esc(a.modulesTitle)}</h2>
<ol class="modules">${a.modules.map((m) => `<li><span class="mod-n" dir="ltr">${esc(m.n)}</span><span class="mod-b"><strong>${esc(m.t)}</strong><span>${esc(m.d)}</span><span class="mod-len" dir="ltr">${esc(m.len)}</span></span></li>`).join('')}</ol></div></section>
<section class="section"><div class="wrap narrow reveal"><h2>${esc(a.operatorTitle)}</h2>${paras(a.operator)}</div></section>
<section class="section"><div class="wrap reveal"><h2 class="section-h">${esc(a.btsTitle)}</h2><div class="grid">${bts.map((v) => film(lang, v)).join('')}</div></div></section>
<section class="section" id="waitlist"><div class="wrap narrow reveal"><h2>${esc(a.waitlistTitle)}</h2>${paras(a.waitlist)}${form(lang, c, 'academy')}</div></section>
${faqBlock(lang, a.faqTitle, a.faq)}`;
  const course = { '@context': 'https://schema.org', '@type': 'Course', '@id': abs(lang, 'academy') + '#course', name: a.courseName, description: a.metaDesc, provider: { '@id': SITE + '/#organization' }, instructor: { '@id': SITE + '/#shahab' }, inLanguage: ['en', 'fa'], courseMode: 'online', teaches: a.modules.map((m) => m.t), url: abs(lang, 'academy') };
  return { title: a.title, desc: a.metaDesc, body, schema: [orgSchema(lang), course, faqSchema(a.faq), breadcrumb(lang, 'academy', c.nav.academy)] };
};

R.about = (lang) => {
  const c = LANGS[lang], a = c.about;
  const body = `
<section class="page-head"><div class="wrap reveal in"><span class="label ox">${esc(a.eyebrow)}</span><h1>${esc(a.h1)}</h1><p class="lead">${md(a.lead)}</p></div></section>
<section class="section"><div class="wrap portrait-row">
  <div class="reveal">${photo('shahab-on-set', c.media.onSet, 800, 1000, 'photo portrait-img', true)}</div>
  <div class="reveal" data-delay="1"><blockquote class="statement" lang="en" dir="ltr">${md(a.statement)}</blockquote>${paras(a.bio)}</div>
</div></section>
<section class="section"><div class="wrap narrow reveal">${stats(c.stats)}</div></section>
<section class="section"><div class="wrap narrow reveal"><h2>${esc(a.factsTitle)}</h2><dl class="facts">${a.facts.map((f) => `<div><dt>${esc(f.k)}</dt><dd>${md(f.v)}</dd></div>`).join('')}</dl></div></section>
<section class="section"><div class="wrap narrow reveal"><h2>${esc(a.divanTitle)}</h2>${paras(a.divan)}</div></section>
<section class="section"><div class="wrap narrow reveal"><h2>${esc(a.voiceTitle)}</h2>${paras(a.voice)}</div></section>
${cta(lang, a.cta)}`;
  return { title: a.title, desc: a.metaDesc, body, schema: [personSchema(lang), orgSchema(lang), breadcrumb(lang, 'about', c.nav.about)] };
};

R.consent = (lang) => {
  const c = LANGS[lang], p = c.consent;
  const body = `
<section class="page-head"><div class="wrap reveal in"><span class="label ox">${esc(p.eyebrow)}</span><h1>${esc(p.h1)}</h1><p class="lead">${md(p.lead)}</p></div></section>
<section class="section"><div class="wrap narrow reveal">${paras(p.intro)}
${p.sections.map((s) => `<h2>${esc(s.t)}</h2>${s.p ? paras(s.p) : ''}${s.list ? list(s.list) : ''}`).join('')}
<p class="note">${md(p.note)}</p></div></section>
${cta(lang, p.cta)}`;
  return { title: p.title, desc: p.metaDesc, body, schema: [orgSchema(lang), breadcrumb(lang, 'consent', c.footer.consent)] };
};

R.privacy = (lang) => {
  const c = LANGS[lang], p = c.privacy;
  const body = `<section class="page-head"><div class="wrap reveal in"><h1>${esc(p.h1)}</h1><p class="lead">${md(p.lead)}</p></div></section>
<section class="section"><div class="wrap narrow reveal">${p.sections.map((s) => `<h2>${esc(s.t)}</h2>${paras(s.p)}`).join('')}</div></section>`;
  return { title: p.title, desc: p.metaDesc, body, schema: [breadcrumb(lang, 'privacy', c.footer.privacy)], noindex: false };
};

R.contact = (lang) => {
  const c = LANGS[lang], k = c.contact;
  const body = `
<section class="page-head"><div class="wrap reveal in"><span class="label ox">${esc(k.eyebrow)}</span><h1>${esc(k.h1)}</h1><p class="lead">${md(k.lead)}</p></div></section>
<section class="section"><div class="wrap contact-grid">
  <div>${form(lang, c, 'contact')}</div>
  <aside class="contact-aside"><h2>${esc(k.asideTitle)}</h2>${paras(k.aside)}<p><a class="link" href="mailto:balamchi@divangroup.ca" dir="ltr">balamchi@divangroup.ca</a></p><p class="foot-print" dir="ltr">Canada · United States · Spain · UAE</p><p><a class="link" href="${url(lang, 'consent')}">${esc(c.footer.consent)} →</a></p></aside>
</div></section>`;
  return { title: k.title, desc: k.metaDesc, body, schema: [orgSchema(lang), breadcrumb(lang, 'contact', c.nav.contact)] };
};

// ---------- build ----------
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'assets'), { recursive: true });
for (const f of fs.readdirSync(path.join(__dirname, 'static'))) fs.copyFileSync(path.join(__dirname, 'static', f), path.join(OUT, /\.(css|js|mp4|webm|jpg|jpeg|png|webp|avif)$/.test(f) ? 'assets/' + f : f));

const urls = [];
for (const lang of Object.keys(LANGS)) {
  for (const page of PAGES) {
    const r = R[page](lang);
    const html = layout(lang, page, r);
    write(url(lang, page).replace(/^\//, '') + 'index.html', html);
    urls.push({ loc: abs(lang, page), lang, page });
  }
  const nf = LANGS[lang].notFound;
  write((lang === 'en' ? '' : 'fa/') + '404.html', layout(lang, 'home', { title: nf.title, desc: nf.title, noindex: true, body: `<section class="page-head"><div class="wrap reveal in"><h1>${esc(nf.h1)}</h1><p class="lead">${esc(nf.text)}</p><p><a class="btn" href="${url(lang, 'home')}">${esc(nf.button)}</a></p></div></section>` }));
}

// sitemap with hreflang pairs
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.map((u) => `  <url><loc>${u.loc}</loc><xhtml:link rel="alternate" hreflang="en" href="${abs('en', u.page)}"/><xhtml:link rel="alternate" hreflang="fa" href="${abs('fa', u.page)}"/><xhtml:link rel="alternate" hreflang="x-default" href="${abs('en', u.page)}"/><changefreq>${u.page === 'work' ? 'weekly' : 'monthly'}</changefreq><priority>${u.page === 'home' ? '1.0' : u.page === 'privacy' ? '0.2' : '0.8'}</priority></url>`).join('\n')}
</urlset>
`);

write('robots.txt', `# Cinematic Clinic — cinematicclinic.com
User-agent: *
Allow: /

# AI and answer-engine crawlers are welcome
User-agent: GPTBot
Allow: /
User-agent: OAI-SearchBot
Allow: /
User-agent: ChatGPT-User
Allow: /
User-agent: ClaudeBot
Allow: /
User-agent: anthropic-ai
Allow: /
User-agent: PerplexityBot
Allow: /
User-agent: Google-Extended
Allow: /
User-agent: Applebot-Extended
Allow: /
User-agent: CCBot
Allow: /
User-agent: Bingbot
Allow: /

Sitemap: ${SITE}/sitemap.xml
`);

// llms.txt (overview) + llms-full.txt (EN pages as markdown)
const en = LANGS.en;
const strip = (s) => s.replace(/\*\*/g, '').replace(/\*/g, '').replace(/\[(.+?)\]\((.+?)\)/g, '$1');
write('llms.txt', `# Cinematic Clinic

> ${strip(en.site.description)}

Cinematic Clinic is the film practice of Shahab Balamchi, a Toronto-based commercial cinematographer who has spent seven years filming beauty and health clinics (40+ clinics, 5,000+ hours behind the lens). Films are produced with his team at Divan Group (divangroup.ca) and delivered in Canada, the United States, Spain and the UAE, in English and Persian. Cinematic Clinic is not a medical clinic. No prices are published; every project is scoped individually.

## Key facts
- Founder and cinematographer: Shahab Balamchi (Toronto, Canada) — founder of Divan Group
- Offers: The Clinic Film (cinematic brand film for a clinic), The Doctor Series (personal-brand video series for a physician or clinic owner), Film Week (batched international shoots in one city), The Film Academy for the Beauty Business (online cinematography course for videographers)
- Clients: dermatology, plastic surgery, medical aesthetics / med spas, cosmetic dentistry, wellness practices
- Markets: Canada · United States · Spain · UAE
- Languages: English, Persian (Farsi)
- Contact: balamchi@divangroup.ca

## Pages
${PAGES.filter((p) => p !== 'privacy').map((p) => `- [${strip(LANGS.en[p === 'home' ? 'home' : p === 'clinic-film' ? 'clinicFilm' : p === 'doctor-series' ? 'doctorSeries' : p === 'film-week' ? 'filmWeek' : p].h1)}](${abs('en', p)}): ${strip(LANGS.en[p === 'home' ? 'home' : p === 'clinic-film' ? 'clinicFilm' : p === 'doctor-series' ? 'doctorSeries' : p === 'film-week' ? 'filmWeek' : p].metaDesc)}`).join('\n')}
- Persian version: ${abs('fa', 'home')}

## Optional
- [Full text](${SITE}/llms-full.txt)
- [Divan Group — parent studio](https://www.divangroup.ca)
`);

const sectionText = (key) => {
  const o = en[key];
  let t = `# ${strip(o.h1)}\n\n${strip(o.lead)}\n\n`;
  if (o.intro) t += o.intro.map(strip).join('\n\n') + '\n\n';
  if (o.blocks) t += o.blocks.map((b) => `## ${b.t}\n\n${(b.p || []).map(strip).join('\n\n')}${b.list ? '\n' + b.list.map((i) => '- ' + strip(i)).join('\n') : ''}${b.steps ? '\n' + b.steps.map((s, i) => `${i + 1}. ${s.t} — ${strip(s.d)}`).join('\n') : ''}\n\n`).join('');
  if (o.faq) t += `## FAQ\n\n${o.faq.map((f) => `**${f.q}**\n${strip(Array.isArray(f.a) ? f.a.join(' ') : f.a)}`).join('\n\n')}\n\n`;
  return t;
};
write('llms-full.txt', `# Cinematic Clinic — full text (English)\n\nSource: ${SITE} · Contact: balamchi@divangroup.ca · A Divan Group production · Canada · United States · Spain · UAE\n\n` +
  `# ${strip(en.home.h1)}\n\n${strip(en.home.lead)}\n\n${strip(en.home.entity)}\n\n${en.home.why.map((w) => `## ${w.t}\n\n${strip(w.d)}`).join('\n\n')}\n\n## FAQ\n\n${en.home.faq.map((f) => `**${f.q}**\n${strip(Array.isArray(f.a) ? f.a.join(' ') : f.a)}`).join('\n\n')}\n\n` +
  ['clinicFilm', 'doctorSeries', 'filmWeek'].map(sectionText).join('') +
  `# ${strip(en.academy.h1)}\n\n${strip(en.academy.lead)}\n\n${en.academy.intro.map(strip).join('\n\n')}\n\n## Modules\n\n${en.academy.modules.map((m) => `${m.n}. ${m.t} — ${m.d} (${m.len})`).join('\n')}\n\n## FAQ\n\n${en.academy.faq.map((f) => `**${f.q}**\n${strip(Array.isArray(f.a) ? f.a.join(' ') : f.a)}`).join('\n\n')}\n\n` +
  `# ${strip(en.about.h1)}\n\n${strip(en.about.statement)}\n\n${en.about.bio.map(strip).join('\n\n')}\n\n${en.about.facts.map((f) => `- ${f.k}: ${strip(f.v)}`).join('\n')}\n\n${en.about.divan.map(strip).join('\n\n')}\n\n` +
  `# ${strip(en.consent.h1)}\n\n${en.consent.intro.map(strip).join('\n\n')}\n\n${en.consent.sections.map((s) => `## ${s.t}\n\n${(s.p || []).map(strip).join('\n\n')}${s.list ? '\n' + s.list.map((i) => '- ' + strip(i)).join('\n') : ''}`).join('\n\n')}\n\n` +
  `# Films\n\n${videos.map((v) => `- ${v.title} (${v.cat}) — https://www.youtube.com/watch?v=${v.id}`).join('\n')}\n`);

console.log('Built', urls.length, 'pages →', OUT);
