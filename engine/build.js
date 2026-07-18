/* ============================================================================
   Beautiful Decks — standard 16:9 deck generator
   Template functions + data spec → one portable-capable HTML presentation.
   Usage: node build.js <deckModule.js> <out.html>
   Icons: local neutral SVG assets from assets/icons.
   ============================================================================ */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const ICON_DIR = path.join(ROOT, 'assets/icons');

// ---- asset helpers ---------------------------------------------------------
const escapeText = (value) => String(value == null ? '' : value)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const escapeAttr = escapeText;
function safeUrl(value){
  const url = String(value == null ? '' : value).trim();
  if(/^(?:https?:|mailto:|#|\.\.?\/)/i.test(url)) return escapeAttr(url);
  return '#';
}
const SAFE_ASSET_SLUG = /^[a-z0-9][a-z0-9_-]*$/i;
const _iconCache = new Map();
function icon(name){
  const slug = String(name == null ? '' : name);
  if(!SAFE_ASSET_SLUG.test(slug)){ console.warn('  ⚠ invalid icon slug:', slug); return ''; }
  if(_iconCache.has(slug)) return _iconCache.get(slug);
  const f = path.join(ICON_DIR, slug + '.svg');
  if(!fs.existsSync(f)){ console.warn('  ⚠ missing icon:', slug); return ''; }
  const svg = fs.readFileSync(f,'utf8').replace(/\n/g,'').trim();
  _iconCache.set(slug, svg); return svg;
}
// Asset base for images — scoped per build. Defaults to '..' for direct template calls.
let ASSET_BASE = '..';
function resolveImageRef(name){
  const value = String(name == null ? '' : name).trim();
  if(!value) return '';
  if(/^(?:data:|https?:|file:|\/|\.\.?\/)/i.test(value)) return value;
  const file = /\.[a-z0-9]{1,8}$/i.test(value) ? value : `${value}.svg`;
  if(!/^[a-z0-9][a-z0-9_.-]*$/i.test(file)){ console.warn('  ⚠ invalid image reference:', value); return ''; }
  return `${ASSET_BASE}/assets/img/${file}`;
}
const IMG = (name) => escapeAttr(resolveImageRef(name));
function withAssetBase(base, fn){
  const previous = ASSET_BASE;
  ASSET_BASE = String(base || '.').replace(/\/$/, '');
  try { return fn(); } finally { ASSET_BASE = previous; }
}

// Optional product/brand icon. Public core falls back to a neutral product glyph.
function picon(name){
  const slug = String(name == null ? '' : name);
  return SAFE_ASSET_SLUG.test(slug) && fs.existsSync(path.join(ICON_DIR, `${slug}.svg`)) ? icon(slug) : icon('product');
}

// ---- REAL Microsoft/Azure product icons (1200+ official logos) --------------
// Resolves a product NAME ("Microsoft Foundry", "Fabric IQ", "Azure AI Search")
// to the right official SVG via the durable manifest + fuzzy matcher.
// Brand rule: embedded verbatim, NEVER recolored/distorted. Below a confidence
// threshold it returns empty so the caller falls back to a generic node — we never
// force a wrong logo onto a non-Microsoft or unknown product.
let _productResolver = null;
function _getProductResolver(){
  if(_productResolver !== null) return _productResolver;
  const resolverPath = path.join(ROOT, 'assets/product-icons/product-icon-resolver.js');
  if(!fs.existsSync(resolverPath)){ _productResolver = false; return _productResolver; }
  try { _productResolver = require(resolverPath); }
  catch(e){ console.warn('  ⚠ optional product-icon resolver failed:', e.message); _productResolver = false; }
  return _productResolver;
}
// productIcon('Microsoft Purview') -> inline svg (or empty string if no confident match)
function productIcon(name, opts={}){
  const r = _getProductResolver();
  if(!r) return '';
  return r.productIconSvg(name, opts);
}
// productIconInfo('Fabric IQ') -> { slug, confidence, via, alts } for debugging/QA
function productIconInfo(name){
  const r = _getProductResolver();
  if(!r) return { slug:null, confidence:0, via:'resolver-missing' };
  return r.resolveIcon(name);
}
// inline product chip: brand-tinted square + label — for "covered by <Product>" cues
function pchip(p){ if(!p) return '';
  return `<span class="pchip ${p.tone||''}"><span class="pc-ico">${icon(p.icon)}</span>${p.label}</span>`; }

// ---- Beautiful Decks mark --------------------------------------------------
function logo(opts={}){
  const cls = ['ms-logo']; if(opts.dark) cls.push('on-dark'); if(opts.size) cls.push(opts.size);
  const sq = opts.size==='lg' ? 26 : 22;
  return `<div class="${cls.join(' ')}"><svg width="${sq}" height="${sq}" viewBox="0 0 23 23" aria-hidden="true">`+
    `<rect x="1" y="1" width="10" height="10" rx="2" fill="#7C3AED"/><rect x="12" y="1" width="10" height="10" rx="2" fill="#06B6D4"/>`+
    `<rect x="1" y="12" width="10" height="10" rx="2" fill="#F59E0B"/><rect x="12" y="12" width="10" height="10" rx="2" fill="#EC4899"/>`+
    `</svg><span class="wordmark">Beautiful Decks</span></div>`;
}

// ---- customer co-brand -----------------------------------------------------
// Load a customer's REAL, FULL-COLOR logo from assets/customers/. NEVER recolor a
// customer logo (hard rule) — instead we set it on a white contrast plate so dark
// marks read on a dark slide. NEVER fabricate a logo; register real ones (with
// source + license) in assets/customers/registry.json.
const CUST_DIR = path.join(ROOT, 'assets/customers');
const _custCache = new Map();
function customerLogo(key){
  const slug = String(key == null ? '' : key);
  if(!slug) return '';
  if(!SAFE_ASSET_SLUG.test(slug)){ console.warn('  ⚠ invalid customer-logo slug:', slug); return ''; }
  if(_custCache.has(slug)) return _custCache.get(slug);
  const candidates = [ `${slug}.inline.svg`, `${slug}.svg` ];   // full-color only
  for(const c of candidates){ const f = path.join(CUST_DIR, c);
    if(fs.existsSync(f)){ const svg = fs.readFileSync(f,'utf8').replace(/<\?xml[^>]*\?>/,'').replace(/<!--[\s\S]*?-->/g,'').replace(/\n/g,'').trim();
      _custCache.set(slug, svg); return svg; } }
  console.warn('  ⚠ missing customer logo:', slug, '(register it in assets/customers/)');
  _custCache.set(slug, ''); return '';
}

// The per-slide brandbar (top-right). DEFAULT = Microsoft logo ONLY (no title text).
// CO-BRAND (when deck.customer is set) = MS squares · soft divider · customer logo on a
// white contrast plate, carried on every slide. The customer logo keeps its TRUE colors;
// the plate is what makes a dark logo legible on the dark slide.
//   deck.customer: 'brand-key'  OR  {key:'brand-key', plate:true}  OR  {key, logoSvg, plate:false}
//   plate defaults to true (safe for dark logos); set plate:false only for logos that are
//   already light/white and read directly on dark.
// Per-embed ID namespacing. Some customer logos carry internal IDs referenced via url(#id) / href="#id". When the SAME logo
// is embedded more than once on a page — which is EXACTLY what happens in gallery/PDF mode
// (all slides rendered at once, brandbar on every slide) — duplicate IDs collide and every
// copy after the first resolves to the first definition, rendering blank. Re-namespace each
// embed with a unique counter so all copies paint. Brand-safe: only ID strings change.
let _brandbarSeq = 0;
function _nsLogoIds(svg){
  const tag = `b${(_brandbarSeq++).toString(36)}-`;
  const ids = new Set((svg.match(/id="([^"]+)"/g)||[]).map(m=>m.slice(4,-1)));
  for(const id of [...ids].sort((a,b)=>b.length-a.length)){
    svg = svg.split(`id="${id}"`).join(`id="${tag}${id}"`)
             .split(`url(#${id})`).join(`url(#${tag}${id})`)
             .split(`href="#${id}"`).join(`href="#${tag}${id}"`);
  }
  return svg;
}
const namespaceSvgIds = (svg) => _nsLogoIds(String(svg || ''));
function resetBuildState(){
  _brandbarSeq = 0;
  const resolver = _getProductResolver();
  if(resolver && typeof resolver.resetNamespaceCounter === 'function') resolver.resetNamespaceCounter();
}
function brandbar(deck={}){
  const ms = `<span class="ms-sq"><i></i><i></i><i></i><i></i></span>`;
  const cust = deck.customer ? (typeof deck.customer==='string'?{key:deck.customer}:deck.customer) : null;
  if(!cust) return `<div class="brandbar">${ms}</div>`;
  let svg = cust.logoSvg || customerLogo(cust.key);
  if(!svg) return `<div class="brandbar">${ms}</div>`;          // fail safe: logo-only, never a broken bar
  svg = _nsLogoIds(svg);                                         // unique IDs per embed (multi-slide safe)
  const plate = cust.plate!==false ? ' plate' : '';            // default ON (contrast for dark logos)
  return `<div class="brandbar">${ms}<span class="cobrand-div"></span><span class="cust-logo${plate}">${svg}</span></div>`;
}
// CSS the brandbar needs — injected once into every built deck's <head>.
const BRANDBAR_CSS = `
.brandbar{position:absolute;right:36px;top:30px;display:flex;align-items:center;gap:12px;z-index:50;}
.brandbar .ms-sq{width:19px;height:19px;display:grid;grid-template-columns:1fr 1fr;gap:2px;}
.brandbar .ms-sq i{display:block;border-radius:1px;}
.brandbar .ms-sq i:nth-child(1){background:#7C3AED;}.brandbar .ms-sq i:nth-child(2){background:#06B6D4;}
.brandbar .ms-sq i:nth-child(3){background:#F59E0B;}.brandbar .ms-sq i:nth-child(4){background:#EC4899;}
.brandbar .cobrand-div{width:1px;height:22px;background:linear-gradient(180deg,transparent,rgba(255,255,255,.28),transparent);}
.brandbar .cust-logo{display:flex;align-items:center;height:22px;}
.brandbar .cust-logo svg,.brandbar .cust-logo img{height:22px;width:auto;display:block;}
/* white contrast plate — keeps the customer logo's TRUE colors while making dark marks legible on dark slides */
.brandbar .cust-logo.plate{height:auto;background:#fff;border-radius:5px;padding:5px 9px;box-shadow:0 2px 10px rgba(0,0,0,.35);}
.brandbar .cust-logo.plate svg,.brandbar .cust-logo.plate img{height:20px;}
/* Co-brand: the brandbar owns the top-right corner, so the standard header's right-aligned
   kicker would render UNDERNEATH it (ghost text behind the logos). On co-branded decks,
   group the logo + kicker on the LEFT and reserve right space for the brandbar. */
.cobrand .s-header{justify-content:flex-start;gap:16px;padding-right:230px;}
.cobrand .s-header .eyebrow{margin:0;}`;
const eyebrow = (t,dark)=>`<div class="eyebrow bar${dark?' on-dark':''}">${t}</div>`;
function header(kicker,dark){return `<div class="s-header">${logo({dark})}`+
  (kicker?`<div class="eyebrow" style="margin:0;${dark?'color:var(--ms-blue);':''}">${kicker}</div>`:'')+`</div>`;}
function footer(left,page,dark){const c=dark?' style="color:var(--text-on-dark-dim);"':'';
  const pc=dark?' style="color:#fff;"':'';
  return `<div class="s-footer"${c}><span>${left||''}</span><span class="s-pageno"${pc}>${page}</span></div>`;}

// ============================================================================
//  TEMPLATE FUNCTIONS  — each returns a <section class="slide">…</section>
// ============================================================================
const T = {};

// 01 COVER — photographic duotone, big editorial title
T.cover = (s)=>`
<section class="slide dark">
  ${s.img?`<div class="duotone"><img src="${IMG(s.img)}" alt=""></div>`:'<div class="motif-grid"></div>'}
  <div class="s-header">${logo({dark:true})}${s.badge?`<div class="chip on-dark">${s.badge}</div>`:''}</div>
  <div class="slide-pad center" style="gap:0;">
    ${eyebrow(s.eyebrow||'Build 2026',true)}
    <h1 class="title" style="font-size:var(--fs-display);max-width:18ch;margin-top:6px;">${s.title}</h1>
    ${s.subtitle?`<p class="subtitle" style="font-size:25px;max-width:50ch;">${s.subtitle}</p>`:''}
    ${s.meta?`<div class="row" style="gap:28px;margin-top:46px;">${s.meta.map((m,i)=>
      `${i>0?'<div style="width:1px;height:38px;background:rgba(255,255,255,.2);"></div>':''}`+
      `<div><div style="font-size:14px;color:var(--text-on-dark-dim);">${m.k}</div>`+
      `<div style="font-size:18px;font-weight:600;margin-top:3px;">${m.v}</div></div>`).join('')}</div>`:''}
  </div>
  ${footer(s.foot||'Beautiful Decks',s.page,true)}
</section>`;

// 02 AGENDA
T.agenda = (s)=>`
<section class="slide">
  ${header(s.kicker||'Agenda')}
  <div class="slide-pad" style="padding-top:30px;">
    <h2 class="title">${s.title}</h2><div class="accent-rule"></div>
    <div class="agenda-list">${s.items.map(it=>
      `<div class="agenda-item${it.active?' is-active':''}"><span class="a-num">${it.n}</span>`+
      `<span class="a-title">${it.t}</span>${it.d?`<span class="a-desc">${it.d}</span>`:''}</div>`).join('')}</div>
  </div>
  ${footer(s.foot,s.page)}
</section>`;

// 03 SECTION DIVIDER — photographic duotone + big number
T.section = (s)=>`
<section class="slide dark">
  ${s.img?`<div class="duotone"><img src="${IMG(s.img)}" alt=""></div>`:'<div class="motif-grid"></div>'}
  <div class="section-num" data-qa-ignore="offcanvas overlap">${s.num}</div>
  <div class="slide-pad center">
    ${eyebrow(s.eyebrow||('Section '+s.num),true)}
    <h1 class="title" style="font-size:60px;max-width:20ch;">${s.title}</h1>
    ${s.subtitle?`<p class="subtitle" style="max-width:52ch;">${s.subtitle}</p>`:''}
  </div>
  ${footer(s.foot||'Beautiful Decks',s.page,true)}
</section>`;

// 04 CONTENT + bullets, optional insight
T.content = (s)=>`
<section class="slide">
  ${header(s.kicker)}
  <div class="slide-pad" style="padding-top:30px;">
    <h2 class="title">${s.title}</h2>
    ${s.subtitle?`<p class="subtitle">${s.subtitle}</p>`:''}
    <div class="accent-rule"></div>
    <ul class="f-list spaced" style="margin-top:8px;max-width:64ch;">${s.bullets.map(b=>`<li>${b}</li>`).join('')}</ul>
    ${s.insight?`<div class="insight mt-auto" style="max-width:72ch;"><span class="i-ico">→</span><div>${s.insight}</div></div>`:''}
  </div>
  ${footer(s.foot,s.page)}
</section>`;

// 05 SPLIT — text + full-bleed photo panel pinned right (absolute, no gaps)
T.split = (s)=>`
<section class="slide">
  <div class="side-photo${s.wide?' wide':''}"><img src="${IMG(s.img)}" alt=""></div>
  ${header(s.kicker)}
  <div class="slide-pad has-side${s.wide?' side-wide':''}" style="padding-top:26px;">
    <div class="center" style="flex:1;">
      <h2 class="title">${s.title}</h2><div class="accent-rule"></div>
      ${s.body?`<p class="body" style="margin-bottom:18px;">${s.body}</p>`:''}
      ${s.bullets?`<ul class="f-list" style="gap:14px;">${s.bullets.map(b=>`<li>${b}</li>`).join('')}</ul>`:''}
      ${s.insight?`<div class="insight" style="margin-top:22px;"><span class="i-ico">★</span><div>${s.insight}</div></div>`:''}
    </div>
  </div>
  ${footer(s.foot,s.page)}
</section>`;

// 06 THREE CARDS (real Fluent icons)
T.cards3 = (s)=>`
<section class="slide">
  ${header(s.kicker)}
  <div class="slide-pad" style="padding-top:30px;">
    <h2 class="title">${s.title}</h2><div class="accent-rule"></div>
    <div class="grid g-3 cards-mid" style="flex:1;margin-top:6px;">${s.cards.map(c=>
      `<div class="card accent-top${c.gold?' gold':''}"><div class="c-icon">${icon(c.icon)}</div>`+
      `${c.num?`<div class="c-num">${c.num}</div>`:''}<div class="c-title">${c.title}</div>`+
      `<div class="c-body">${c.body}</div>`+
      `${c.foot?`<div class="c-foot">${c.foot}</div>`:''}</div>`).join('')}</div>
  </div>
  ${footer(s.foot,s.page)}
</section>`;

// 07 QUAD 2x2 (colored, real icons)
T.quad = (s)=>`
<section class="slide">
  ${header(s.kicker)}
  <div class="slide-pad" style="padding-top:30px;">
    <h2 class="title">${s.title}</h2><div class="accent-rule"></div>
    <div class="grid g-2x2" style="flex:1;margin-top:6px;">${s.cards.map(c=>
      `<div class="card ${c.color}"><div class="c-icon">${icon(c.icon)}</div>`+
      `<div class="c-title">${c.title}${c.pill?` <span class="pill ${c.pill.cls}">${c.pill.t}</span>`:''}</div>`+
      `<div class="c-body">${c.body}</div></div>`).join('')}</div>
  </div>
  ${footer(s.foot,s.page)}
</section>`;

// 08 FEATURE ROWS — editorial de-carded list with inline icons (anti-blocky)
T.features = (s)=>`
<section class="slide">
  ${header(s.kicker)}
  <div class="slide-pad" style="padding-top:30px;">
    <h2 class="title">${s.title}</h2>${s.subtitle?`<p class="subtitle">${s.subtitle}</p>`:''}<div class="accent-rule"></div>
    <div class="feature-rows${s.cols===2?' two-col':''}">${s.rows.map((r,i)=>
      `<div class="feature-row${r.gold?' gold':''}"><div class="fr-ico">${icon(r.icon)}</div>`+
      `<div><div class="fr-h">${r.idx?`<span class="fr-idx">${r.idx}</span>`:''}${r.h}</div>`+
      `<div class="fr-b">${r.b}</div></div></div>`).join('')}</div>
  </div>
  ${footer(s.foot,s.page)}
</section>`;

// 09 METRICS (dark, photographic optional)
T.metrics = (s)=>`
<section class="slide dark">
  ${s.img?`<div class="duotone"><img src="${IMG(s.img)}" alt=""></div>`:'<div class="motif-grid"></div>'}
  ${header(s.kicker||'By the numbers',true)}
  <div class="slide-pad center">
    <h2 class="title" style="margin-bottom:8px;">${s.title}</h2>
    ${s.subtitle?`<p class="subtitle" style="margin-bottom:46px;">${s.subtitle}</p>`:'<div style="height:30px;"></div>'}
    <div class="stat-row row4">${s.stats.map(st=>
      `<div class="stat on-dark"><div class="s-num">${st.n}</div><div class="s-label">${st.l}</div></div>`).join('')}</div>
  </div>
  ${footer(s.foot||'Beautiful Decks',s.page,true)}
</section>`;

// 10 PHASES — workshop signature
T.phases = (s)=>`
<section class="slide">
  ${header(s.kicker)}
  <div class="slide-pad" style="padding-top:30px;">
    <h2 class="title">${s.title}</h2><div class="accent-rule"></div>
    <div class="phases" style="margin-top:24px;flex:0 0 auto;">${s.steps.map((p,i)=>
      `<div class="phase${p.state?' '+p.state:''}"><div class="p-track"></div>`+
      `<div class="p-step">${i+1}</div><div class="p-title">${p.t}</div><div class="p-body">${p.b}</div></div>`).join('')}</div>
    ${s.insight?`<div class="insight mt-auto" style="max-width:74ch;"><span class="i-ico">→</span><div>${s.insight}</div></div>`:''}
  </div>
  ${footer(s.foot,s.page)}
</section>`;

// 11 TIMELINE — vertical roadmap (text + timeline)
T.timeline = (s)=>`
<section class="slide">
  ${header(s.kicker)}
  <div class="slide-pad" style="padding-top:30px;">
    <div class="two-col" style="gap:56px;">
      <div class="center"><h2 class="title">${s.title}</h2><div class="accent-rule"></div>
        <p class="body" style="max-width:40ch;">${s.body}</p>
        ${s.insight?`<div class="insight" style="margin-top:22px;"><span class="i-ico">★</span><div>${s.insight}</div></div>`:''}</div>
      <div class="timeline">${s.items.map(it=>
        `<div class="tl-item"><span class="tl-dot"></span><div class="tl-when">${it.when}</div>`+
        `<div class="tl-title">${it.t}</div><div class="tl-body">${it.b}</div></div>`).join('')}</div>
    </div>
  </div>
  ${footer(s.foot,s.page)}
</section>`;

// 12 COMPARISON before→after — editorial delta rows (de-carded, anti-blocky)
T.compare = (s)=>`
<section class="slide">
  ${header(s.kicker)}
  <div class="slide-pad" style="padding-top:30px;">
    <h2 class="title">${s.title}</h2>
    ${s.subtitle?`<p class="subtitle">${s.subtitle}</p>`:''}
    <div class="accent-rule"></div>
    <div class="delta-head">
      <div class="dh-dim"></div>
      <div class="dh-from">${s.fromLabel||'Today · manual'}</div>
      <div class="dh-spacer"></div>
      <div class="dh-to">${s.toLabel||'With agents'}</div>
    </div>
    <div class="delta-rows">${s.rows.map(r=>
      `<div class="delta-row">`+
        `<div class="d-dim">${r.dim?`<span class="d-dim-ico">${r.icon?icon(r.icon):''}</span>`:''}${r.dim||''}</div>`+
        `<div class="d-from">${r.from}</div>`+
        `<div class="d-arrow">→</div>`+
        `<div class="d-to">${r.to}</div>`+
      `</div>`).join('')}</div>
    ${s.insight?`<div class="insight mt-auto" style="max-width:74ch;"><span class="i-ico">→</span><div>${s.insight}</div></div>`:''}
  </div>
  ${footer(s.foot,s.page)}
</section>`;

// 13 USE-CASE TABLE — banking pain→outcome (custom, editorial)
T.usecases = (s)=>`
<section class="slide${s.tight?' usecases-tight':''}">
  ${header(s.kicker)}
  <div class="slide-pad" style="padding-top:30px;">
    <h2 class="title">${s.title}</h2>${s.subtitle?`<p class="subtitle">${s.subtitle}</p>`:''}<div class="accent-rule"></div>
    <table class="f-table uc${s.tight?' compact':''}" style="margin-top:6px;">
      <thead><tr><th style="width:26%;">Use case</th><th style="width:37%;">Today's friction</th><th>With agents</th></tr></thead>
      <tbody>${s.rows.map(r=>`<tr><td class="col-em">${r.uc}</td><td class="muted">${r.pain}</td>`+
        `<td>${r.gain}</td></tr>`).join('')}</tbody>
    </table>
    ${s.insight?`<div class="insight mt-auto"><span class="i-ico">★</span><div>${s.insight}</div></div>`:''}
  </div>
  ${footer(s.foot,s.page)}
</section>`;

// 14 SPOTLIGHT — single use case, full-bleed photo panel right + big outcome
T.spotlight = (s)=>`
<section class="slide">
  <div class="side-photo${s.wide?' wide':''}"><img src="${IMG(s.img)}" alt=""></div>
  ${header(s.kicker)}
  <div class="slide-pad has-side${s.wide?' side-wide':''}" style="padding-top:26px;">
    <div class="center" style="flex:1;">
      <div class="chip" style="margin-bottom:14px;">${s.tag}</div>
      <h2 class="title">${s.title}</h2><div class="accent-rule"></div>
      <p class="body" style="margin-bottom:24px;">${s.body}</p>
      <div class="stat-row" style="gap:40px;">${s.stats.map(st=>
        `<div class="stat"><div class="s-num" style="font-size:44px;">${st.n}</div><div class="s-label">${st.l}</div></div>`).join('')}</div>
    </div>
  </div>
  ${footer(s.foot,s.page)}
</section>`;

// 15 STATEMENT — big idea, photographic
T.statement = (s)=>`
<section class="slide dark">
  ${s.img?`<div class="duotone"><img src="${IMG(s.img)}" alt=""></div>`:'<div class="motif-grid"></div>'}
  <div class="slide-pad center">
    ${eyebrow(s.eyebrow||'The one thing',true)}
    <h1 class="title" style="font-size:62px;max-width:18ch;line-height:1.07;">${s.title}</h1>
    ${s.subtitle?`<p class="subtitle" style="font-size:23px;max-width:52ch;">${s.subtitle}</p>`:''}
  </div>
  ${footer(s.foot||'Beautiful Decks',s.page,true)}
</section>`;

// 16 CLOSING — CTA numbered steps
T.closing = (s)=>`
<section class="slide dark">
  ${s.img?`<div class="duotone"><img src="${IMG(s.img)}" alt=""></div>`:'<div class="motif-grid"></div>'}
  <div class="s-header">${logo({dark:true,size:'lg'})}</div>
  <div class="slide-pad center">
    ${eyebrow(s.eyebrow||'Over to you',true)}
    <h1 class="title" style="font-size:56px;max-width:16ch;">${s.title}</h1>
    <div class="grid g-3" style="margin-top:40px;max-width:none;">${s.steps.map((st,i)=>{
      const colors=['var(--ms-blue)','var(--ms-green)','var(--ms-yellow)'];
      return `<div><div class="row" style="gap:12px;margin-bottom:12px;">`+
      `<span style="font-size:15px;font-weight:700;color:${colors[i%3]};font-variant-numeric:tabular-nums;">0${i+1}</span>`+
      `<span style="height:2px;flex:1;background:rgba(255,255,255,.15);"></span></div>`+
      `<div style="font-size:13px;color:var(--text-on-dark-dim);margin-bottom:6px;letter-spacing:.04em;text-transform:uppercase;">${st.k}</div>`+
      `<div style="font-size:19px;font-weight:600;line-height:1.3;">${st.v}</div></div>`;}).join('')}</div>
  </div>
  ${footer(s.foot,s.page,true)}
</section>`;

// 17 PLACEHOLDER — drop-zone for an official Build slide (paste-in target)
T.placeholder = (s)=>`
<section class="slide ph">
  ${header(s.kicker||'Official slide — paste in')}
  <div class="slide-pad" style="padding-top:26px;">
    <div class="ph-frame">
      <div class="ph-badge">${icon(s.icon||'slide_layout')}</div>
      <div class="ph-tag">${s.tag||'Build 2026 · official product slide'}</div>
      <h2 class="title ph-title">${s.title}</h2>
      <p class="ph-desc">${s.desc||''}</p>
      ${s.products?`<div class="ph-products">${s.products.map(p=>pchip(p)).join('')}</div>`:''}
      <div class="ph-source">
        <span class="ph-src-ico">${icon('image_add')}</span>
        <div class="ph-src-text">
          <div class="ph-src-label">Copy from</div>
          <a class="ph-src-link" href="${safeUrl(s.src.url)}">${escapeText(s.src.deck)}</a>
          ${s.src.note?`<div class="ph-src-note">${s.src.note}</div>`:''}
        </div>
      </div>
    </div>
  </div>
  ${footer(s.foot,s.page)}
</section>`;

// 17b WEB EXHIBIT — a REAL product image pulled from a referenced source page
// (diagram, architecture, benchmark chart, screenshot) shown as a framed exhibit.
// Sibling of `placeholder`: placeholder = a drop-zone to paste an official slide;
// webexhibit = the real sourced image actually embedded. Fed by link-image-audit.py
// (find candidate images on a deck's source links → vision-inspect → embed the good one).
//
// s = { kicker, title, img, caption, src:{label,url},
//       plate: 'white' (default — for light/transparent diagrams on a dark deck) |
//              'none'  (image already dark/full-bleed, no plate needed),
//       fit: 'contain' (default) | 'cover',
//       dark: true|false (slide theme; default true so white plate pops) }
// img = an absolute/relative path under assets/img OR a full data: URI OR an http(s) URL.
// PROVENANCE: always pass src.url so the slide credits + links the source page.
T.webexhibit = (s)=>{
  const dark = s.dark!==false;
  const plate = s.plate||'white';
  const fit = s.fit==='cover' ? 'cover' : 'contain';
  const imgsrc = /^(data:|https?:|file:|\.|\/)/.test(s.img) ? escapeAttr(s.img) : IMG(s.img);
  return `
<section class="slide exhibit${dark?' dark':''}">
  ${header(s.kicker||'',dark)}
  <div class="slide-pad" style="padding-top:14px;display:flex;flex-direction:column;gap:14px;">
    ${s.title?`<h2 class="title"${dark?' style="color:var(--text-on-dark);"':''}>${s.title}</h2>`:''}
    <div class="xb-stage">
      <div class="xb-plate ${plate==='white'?'on':'off'}">
        <img src="${imgsrc}" alt="${escapeAttr(s.alt||s.title||'sourced exhibit')}" style="object-fit:${fit};">
      </div>
    </div>
    ${(s.caption||s.src)?`<div class="xb-cap">
      ${s.caption?`<span class="xb-cap-t">${s.caption}</span>`:''}
      ${s.src?`<a class="xb-src" href="${safeUrl(s.src.url)}" target="_blank" rel="noopener">${escapeText(s.src.label||'Source ↗')}</a>`:''}
    </div>`:''}
  </div>
  ${footer(s.foot,s.page,dark)}
</section>`;
};
T.big = (s)=>`
<section class="slide dark big">
  ${s.img?`<div class="duotone soft"><img src="${IMG(s.img)}" alt=""></div>`:'<div class="motif-grid"></div>'}
  ${s.kicker?`<div class="s-header">${logo({dark:true})}<div class="eyebrow on-dark" style="margin:0;">${s.kicker}</div></div>`:''}
  <div class="slide-pad center" style="align-items:${s.align==='center'?'center':'flex-start'};text-align:${s.align==='center'?'center':'left'};">
    <div class="big-figure ${s.tone||''}" data-qa-ignore="overlap">${s.figure}</div>
    ${s.line?`<div class="big-line">${s.line}</div>`:''}
  </div>
  ${footer(s.foot||'Beautiful Decks',s.page,true)}
</section>`;

// 19 PUNCH — a few huge words, max impact (light or dark). Near-zero chrome.
T.punch = (s)=>`
<section class="slide${s.dark?' dark':''} punch">
  ${s.dark&&s.img?`<div class="duotone soft"><img src="${IMG(s.img)}" alt=""></div>`:''}
  <div class="s-header">${logo({dark:s.dark})}${s.tag?`<div class="chip${s.dark?' on-dark':''}">${s.tag}</div>`:''}</div>
  <div class="slide-pad center">
    ${s.eyebrow?`${eyebrow(s.eyebrow,s.dark)}`:''}
    <h1 class="punch-title">${s.title}</h1>
  </div>
  ${footer(s.foot,s.page,s.dark)}
</section>`;

// 20 PRODUCT — presentable announcement slide: left identity + right official-art drop-zone
//    Works as a real slide (talk to it now); marks exactly where the official visual pastes.
T.product = (s)=>`
<section class="slide product">
  ${header(s.kicker||'Build 2026 · product update')}
  <div class="slide-pad" style="padding-top:24px;">
    <div class="prod-grid">
      <div class="prod-left">
        <div class="prod-id">
          <div class="prod-badge ${s.tone||''}">${icon(s.icon)}</div>
          <div>
            <div class="prod-name">${s.name}</div>
            ${s.status?`<span class="pill ${s.status.cls}">${s.status.t}</span>`:''}
          </div>
        </div>
        <h2 class="prod-head">${s.head}</h2>
        ${s.sub?`<p class="prod-sub">${s.sub}</p>`:''}
        ${s.forBank?`<div class="prod-bank"><span class="pb-tag">Use case</span><span>${s.forBank}</span></div>`:''}
      </div>
      <div class="prod-right">
        <div class="prod-drop">
          <div class="pd-mark">${icon('image_add')}</div>
          <div class="pd-title">Official ${s.name} slide</div>
          <a class="pd-link" href="${safeUrl(s.src.url)}">${escapeText(s.src.deck)} ↗</a>
          ${s.src.note?`<div class="pd-note">${s.src.note}</div>`:''}
        </div>
      </div>
    </div>
  </div>
  ${footer(s.foot,s.page)}
</section>`;

// 21 ARCHGRID — zoned architecture grid with REAL Azure product logos.
//   Each cell shows the official product logo (resolver) + name + status tag.
//   Brand rule: logos embedded verbatim, never tinted. Cells with no confident
//   logo match fall back to a Fluent glyph (s.glyph default) — never a wrong logo.
//   s = { kicker, title, subtitle, zones:[ {name, tone, items:[{p, tag, glyph}]} ], insight }
//     p   = product NAME passed to productIcon() (e.g. 'Azure AI Search')
//     tag = 'NEW' | 'In LZ' | '' (status chip)
T.archgrid = (s)=>`
<section class="slide">
  ${header(s.kicker)}
  <div class="slide-pad" style="padding-top:30px;">
    <h2 class="title">${s.title}</h2>${s.subtitle?`<p class="subtitle">${s.subtitle}</p>`:''}<div class="accent-rule"></div>
    <div class="archzones">${s.zones.map(z=>
      `<div class="archzone ${z.tone||''}"><div class="az-name">${z.name}</div>`+
      `<div class="az-cells">${z.items.map(it=>{
        const svg = productIcon(it.p) || `<span class="az-glyph">${icon(it.glyph||'layer')}</span>`;
        return `<div class="az-cell"><span class="az-ico">${svg}</span>`+
          `<span class="az-label">${it.label||it.p}</span>`+
          `${it.tag?`<span class="az-tag ${it.tag==='NEW'?'new':'lz'}">${it.tag}</span>`:''}</div>`;
      }).join('')}</div></div>`).join('')}</div>
    ${s.insight?`<div class="insight mt-auto" style="max-width:80ch;"><span class="i-ico">→</span><div>${s.insight}</div></div>`:''}
  </div>
  ${footer(s.foot,s.page)}
</section>`;

// ---- page assembly ---------------------------------------------------------
const STANDARD_REQUIRED_ARRAYS = {
  agenda: ['items'], content: ['bullets'], cards3: ['cards'], quad: ['cards'],
  features: ['rows'], metrics: ['stats'], phases: ['steps'], timeline: ['items'],
  compare: ['rows'], usecases: ['rows'], spotlight: ['stats'], closing: ['steps'],
  archgrid: ['zones'],
};
function validateDeck(deck){
  if(!deck || typeof deck !== 'object') throw new TypeError('deck spec must export an object');
  if(!Array.isArray(deck.slides) || deck.slides.length===0) throw new TypeError('deck.slides must be a non-empty array');
  deck.slides.forEach((slide,i)=>{
    const label = `slide ${i + 1}`;
    if(!slide || typeof slide !== 'object') throw new TypeError(`${label} must be an object`);
    if(!slide.type || !T[slide.type]) throw new Error(`unknown standard slide type "${slide.type || ''}" at ${label}`);
    for(const field of STANDARD_REQUIRED_ARRAYS[slide.type] || []){
      if(!Array.isArray(slide[field]) || slide[field].length === 0){
        throw new TypeError(`${label}.${field} must be a non-empty array`);
      }
    }
    const classToken = (value, field) => {
      if(value != null && value !== '' && (typeof value !== 'string' || !SAFE_ASSET_SLUG.test(value))){
        throw new TypeError(`${field} must be a safe CSS class token`);
      }
    };
    if(slide.type === 'quad') slide.cards.forEach((card, cardIndex) => {
      if(!card || typeof card !== 'object') throw new TypeError(`${label}.cards[${cardIndex}] must be an object`);
      classToken(card.color, `${label}.cards[${cardIndex}].color`);
      classToken(card.pill && card.pill.cls, `${label}.cards[${cardIndex}].pill.cls`);
    });
    if(slide.type === 'archgrid') slide.zones.forEach((zone, zoneIndex) => {
      if(!zone || typeof zone !== 'object') throw new TypeError(`${label}.zones[${zoneIndex}] must be an object`);
      classToken(zone.tone, `${label}.zones[${zoneIndex}].tone`);
      if(!Array.isArray(zone.items) || zone.items.length === 0) throw new TypeError(`${label}.zones[${zoneIndex}].items must be a non-empty array`);
    });
    if(slide.type === 'phases') slide.steps.forEach((step, stepIndex) => classToken(step && step.state, `${label}.steps[${stepIndex}].state`));
    if(slide.type === 'big') classToken(slide.tone, `${label}.tone`);
    if(slide.type === 'product') {
      classToken(slide.tone, `${label}.tone`);
      classToken(slide.status && slide.status.cls, `${label}.status.cls`);
    }
    if(slide.type === 'placeholder' && Array.isArray(slide.products)) {
      slide.products.forEach((product, productIndex) => classToken(product && product.tone, `${label}.products[${productIndex}].tone`));
    }
  });
}
function buildDeck(deck){
  validateDeck(deck);
  resetBuildState();
  const A = String(deck._assetBase || '..').replace(/\/$/,'');
  const assetHref = escapeAttr(A);
  const resolvedSlides = deck.slides.map((slide, i) => ({
    ...slide,
    page: String(i + 1).padStart(2, '0'),
    foot: slide.foot === undefined ? deck.foot : slide.foot,
  }));
  // Co-brand: when deck.customer is set, stamp an independently namespaced
  // customer logo into every slide without mutating the caller-owned spec.
  const stampBrandbar = (html)=>{
    if(!deck.customer) return html;
    return html.replace(/<\/section>/g, ()=>`${brandbar(deck)}</section>`);
  };
  const rendered = withAssetBase(A, () => resolvedSlides.map((sp)=>{
    const fn = T[sp.type];
    return stampBrandbar(fn(sp));
  }));
  const slides = rendered.join('\n');
  const bodyClasses = [];
  if(deck.gallery) bodyClasses.push('gallery');
  if(deck.theme==='dark') bodyClasses.push('theme-dark');
  if(deck.customer) bodyClasses.push('cobrand');
  const bodyAttr = bodyClasses.length ? ` class="${bodyClasses.join(' ')}"` : '';
  // Every non-gallery build is a presentation. Motion is an optional visual layer,
  // not a prerequisite for navigation or for showing the first slide.
  const present = !deck.gallery;
  const motion = Boolean(deck.motion) && present;
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeText(deck.title||'Deck')}</title>
<link rel="stylesheet" href="${assetHref}/css/fluent.css">
${deck.customer?`<style>${BRANDBAR_CSS}</style>`:''}
${motion?`<link rel="stylesheet" href="${assetHref}/css/motion.css">`:''}
${deck.gallery?`<style>body.gallery{padding:40px 0 70px;}
.g-label{width:1280px;margin:0 auto 10px;color:#9ad0ff;font-size:13px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;font-family:var(--font);}
.g-label span{color:#777;font-weight:500;text-transform:none;letter-spacing:0;margin-left:10px;}</style>`:''}
${present?`<style>html,body{margin:0;background:#000;height:100%;overflow:hidden;}
.slide{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) scale(var(--fit,1));transform-origin:center;display:none;}
.slide.active{display:flex;flex-direction:column;}
#ov{position:fixed;inset:0;background:#0b0b0d;z-index:80;display:none;overflow:auto;padding:24px;}
#ov.on{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;align-content:start;}
.ovcell{appearance:none;text-align:left;font-family:var(--font);aspect-ratio:16/9;border-radius:8px;border:1px solid #222;position:relative;cursor:pointer;background:#0a1326;color:#cfe0ff;font-size:14px;font-weight:600;padding:26px 12px 0;}
.ovcell:hover{border-color:var(--ms-blue);}
.ovcell:focus-visible{outline:3px solid var(--ms-blue);outline-offset:2px;}
.ovcell .nn{position:absolute;top:6px;left:8px;font-size:10px;color:#5a7099;}</style>`:''}
</head><body${bodyAttr}>
${deck.gallery ? resolvedSlides.map((sp,i)=>`<div class="g-label">${escapeText(sp.page)} · ${escapeText(sp.label||sp.type)}${sp.note?` <span>${escapeText(sp.note)}</span>`:''}</div>\n`+rendered[i]).join('\n') : slides}
${present?`<script src="${assetHref}/js/deck-engine.js"></script>`:''}
</body></html>`;
}

// ---- main ------------------------------------------------------------------
function main(){
const deckPath = process.argv[2], outPath = process.argv[3];
if(!deckPath||!outPath){ console.error('usage: node build.js <deck.js> <out.html>'); process.exit(1); }
const inputDeck = require(path.resolve(deckPath));
// Auto-compute the relative path from the output HTML back to engine/ without
// mutating the caller-owned CommonJS export.
let assetBase = inputDeck._assetBase;
if(assetBase === undefined){
  const outDir = path.dirname(path.resolve(outPath));
  const rel = path.relative(outDir, ROOT).split(path.sep).join('/');
  assetBase = rel || '.';
}
const deck = { ...inputDeck, _assetBase: assetBase };
const html = buildDeck(deck);
const resolvedOut = path.resolve(outPath);
fs.mkdirSync(path.dirname(resolvedOut), { recursive: true });
fs.writeFileSync(resolvedOut, html);
console.log(`✓ ${deck.slides.length} slides → ${outPath}  (assets: ${assetBase})`);
}
if(require.main === module) main();
module.exports = { T, icon, picon, pchip, logo, brandbar, BRANDBAR_CSS, customerLogo,
  eyebrow, header, footer, buildDeck, validateDeck, productIcon, productIconInfo,
  escapeText, escapeAttr, safeUrl, resolveImageRef, namespaceSvgIds, resetBuildState, withAssetBase,
  setAssetBase: (b)=>{ ASSET_BASE = b; }, getAssetBase: ()=>ASSET_BASE, IMG };
