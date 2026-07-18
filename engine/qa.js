#!/usr/bin/env node
/* ============================================================================
 * qa.js — Deterministic slide geometry linter + auto contact sheet.
 *
 * WHY: vision QA is fuzzy and misses pixel-level geometry bugs. This measures
 * every element's REAL bounding box against the 1280x720 canvas and flags the
 * exact bug classes that have shipped before:
 *   - OFFCANVAS : element extends past slide edges (the off-screen caption bug)
 *   - OVERFLOW  : content taller/wider than its box (clipped text)
 *   - OVERLAP   : two content boxes collide when they shouldn't (the hub bug)
 *   - INVISIBLE : element still opacity:0 / zero-size after settle (animation-clobber)
 *   - TINYTEXT  : rendered font-size below a legibility floor
 *
 * It activates each .slide in turn (single-file .active-gated decks), waits past
 * the longest animation, then runs measurement in page context. Exits non-zero
 * if any ERROR-level violation is found, so it can gate a build.
 *
 * Usage: node qa.js <input.html> [--out <renderDir>] [--prefix gp] [--settle 2200]
 * ==========================================================================*/
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const { launchOptions } = require('./lib/browser');
const args = process.argv.slice(2);
const input = args[0];
if (!input) { console.error('usage: node qa.js <input.html> [--out dir] [--prefix p] [--settle ms]'); process.exit(2); }
const getFlag = (name, def) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : def; };
const SETTLE = parseInt(getFlag('settle', '2400'), 10);
const PREFIX = getFlag('prefix', 'qa');
const OUT = getFlag('out', path.join(path.dirname(path.resolve(input)), 'qa-render'));
const W = 1280, H = 720;
const EDGE_TOL = 1.5;        // px an element may poke past the canvas edge (sub-px rounding)
const OVERLAP_AREA = 240;    // min intersection area (px^2) to count as a real overlap
const FONT_FLOOR = 11;       // px — smallest legible rendered font

fs.mkdirSync(OUT, { recursive: true });

// This function runs INSIDE the page for the active slide. Pure geometry.
function measure(W, H, EDGE_TOL, OVERLAP_AREA, FONT_FLOOR) {
  const slide = document.querySelector('.slide.active');
  if (!slide) return { error: 'no active slide' };
  const sb = slide.getBoundingClientRect();
  // map a client rect into slide-local 1280x720 space (deck is scaled to fit viewport)
  const scale = sb.width / W;
  const L = el => { const r = el.getBoundingClientRect();
    return { x:(r.left-sb.left)/scale, y:(r.top-sb.top)/scale, w:r.width/scale, h:r.height/scale,
             right:(r.right-sb.left)/scale, bottom:(r.bottom-sb.top)/scale }; };
  const viz = el => { const s = getComputedStyle(el);
    return s.display!=='none' && s.visibility!=='hidden' && parseFloat(s.opacity) > 0.01; };
  const text = el => (el.textContent||'').trim().slice(0,42);

  const V = [];
  const push = (sev, type, el, msg, box) => V.push({ sev, type, msg,
    el: el.className ? '.'+String(el.className).split(' ').join('.') : el.tagName.toLowerCase(),
    text: text(el), box: box && {x:Math.round(box.x),y:Math.round(box.y),w:Math.round(box.w),h:Math.round(box.h)} });
  const ignored = (el, type) => Boolean(el.closest(`[data-qa-ignore~="${type.toLowerCase()}"]`));

  // Walk visible elements that actually carry content (skip pure layout wrappers w/o text/bg/border).
  const all = [...slide.querySelectorAll('*')].filter(el => {
    if (!viz(el)) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    return true;
  });

  // 1) OFFCANVAS — any visible element poking past the slide edges.
  for (const el of all) {
    const b = L(el);
    const off = [];
    if (b.x < -EDGE_TOL) off.push('left');
    if (b.y < -EDGE_TOL) off.push('top');
    if (b.right > W + EDGE_TOL) off.push('right');
    if (b.bottom > H + EDGE_TOL) off.push('bottom');
    // ignore full-bleed bg layers intentionally inset negative, and falling-confetti
    // pieces which by design start above the top edge (cfx = confetti layer)
    const cls = String(el.className||'');
    if (off.length && !ignored(el, 'offcanvas') && !/\b(bg|mesh|an-stage|hb-line|iqsvg|confetti|cfx)\b/.test(cls)) {
      const has = (el.textContent||'').trim().length > 0;
      push(has ? 'ERROR':'WARN', 'OFFCANVAS', el, `pokes past ${off.join('+')} edge`, b);
    }
  }

  // 2) OVERFLOW — element content exceeds its own box (clipped text).
  for (const el of all) {
    if (el.children.length > 6) continue;          // containers legitimately scroll children
    const oY = el.scrollHeight - el.clientHeight;
    const oX = el.scrollWidth - el.clientWidth;
    const cs = getComputedStyle(el);
    if (cs.overflow === 'visible') continue;        // visible overflow isn't clipped
    if (ignored(el, 'overflow')) continue;
    if (oY > 3 || oX > 3) push('ERROR', 'OVERFLOW', el,
      `content ${oX>3?'wider':'taller'} than box by ${Math.round(Math.max(oX,oY))}px (clipped)`, L(el));
  }

  // 3) INVISIBLE — leaf content element fully transparent after settle (animation-clobber).
  //    Scan the DOM directly (NOT the pre-filtered `all`, which already dropped opacity~0 els),
  //    since a clobbered-invisible element is exactly what we must catch. Skip elements that are
  //    legitimately hidden by an ancestor display:none (not on the active slide path).
  for (const el of slide.querySelectorAll('*')) {
    if (el.children.length) continue;
    if (!(el.textContent||'').trim()) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;          // not laid out
    // ancestor must be visible too (else it's intentionally hidden, e.g. an overview cell)
    let anc = el.parentElement, hidden = false;
    while (anc && anc !== slide) { const a = getComputedStyle(anc);
      if (a.display==='none' || a.visibility==='hidden') { hidden = true; break; } anc = anc.parentElement; }
    if (hidden || ignored(el, 'invisible')) continue;
    if (parseFloat(cs.opacity) < 0.05) push('ERROR','INVISIBLE', el, 'opacity~0 after settle (animation never resolved)', L(el));
  }

  // 4) TINYTEXT — rendered font below legibility floor.
  for (const el of all) {
    if (!(el.textContent||'').trim() || el.children.length || ignored(el, 'tinytext')) continue;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs && fs < FONT_FLOOR) push('WARN','TINYTEXT', el, `font-size ${fs.toFixed(1)}px < ${FONT_FLOOR}px floor`, L(el));
  }

  // 5) OVERLAP — leaf TEXT boxes that intersect materially (collision like the hub bug).
  //    Use tight GLYPH bounds (Range) not the block box, else full-width block elements
  //    with short text false-positive against anything in their horizontal band.
  const tightText = el => {
    try { const rg = document.createRange(); rg.selectNodeContents(el);
      const r = rg.getBoundingClientRect();
      if (!r.width || !r.height) return null;
      return { x:(r.left-sb.left)/scale, y:(r.top-sb.top)/scale, w:r.width/scale, h:r.height/scale,
               right:(r.right-sb.left)/scale, bottom:(r.bottom-sb.top)/scale };
    } catch(e){ return null; }
  };
  const leaves = all.filter(el => (el.textContent||'').trim() && el.children.length === 0)
                    .map(el => ({ el, b: tightText(el) })).filter(x => x.b);
  for (let i = 0; i < leaves.length; i++) for (let j = i+1; j < leaves.length; j++) {
    const a = leaves[i], c = leaves[j];
    if (a.el.contains(c.el) || c.el.contains(a.el)) continue;     // nesting, not collision
    // Opt-out: an intentional overlap (e.g. a giant watermark numeral behind a label) can be
    // marked data-qa-ignore="overlap" on either element. Good linters need an escape hatch.
    if (a.el.closest('[data-qa-ignore~="overlap"]') || c.el.closest('[data-qa-ignore~="overlap"]')) continue;
    // Skip inline siblings in the SAME flowing text block (e.g. multiple <b> highlights in one
    // sentence) — their Range boxes span wrapped lines and pseudo-overlap but never collide.
    if (a.el.parentElement === c.el.parentElement) {
      const ai = getComputedStyle(a.el).display, ci = getComputedStyle(c.el).display;
      if (ai.startsWith('inline') && ci.startsWith('inline')) continue;
    }
    const ix = Math.max(0, Math.min(a.b.right,c.b.right) - Math.max(a.b.x,c.b.x));
    const iy = Math.max(0, Math.min(a.b.bottom,c.b.bottom) - Math.max(a.b.y,c.b.y));
    const area = ix * iy;
    if (area <= OVERLAP_AREA) continue;
    // Require the overlap to cover a meaningful FRACTION of the smaller box — filters
    // line-height "leading kisses" between stacked labels and inline <b> on wrapped lines
    // (which overlap by only a few px) while still catching real box-on-box collisions.
    const minArea = Math.min(a.b.w*a.b.h, c.b.w*c.b.h);
    if (area / minArea < 0.30) continue;
    push('WARN','OVERLAP', a.el, `glyphs overlap "${text(c.el)}" by ~${Math.round(area)}px² (${Math.round(100*area/minArea)}% of smaller)`, a.b);
  }
  return { ok: true, violations: V, counts: { elements: all.length } };
}

(async () => {
  const browser = await puppeteer.launch(launchOptions());
  const page = await browser.newPage();
  const runtimeErrors = [];
  page.on('pageerror', error => runtimeErrors.push(`pageerror: ${error.message}`));
  page.on('requestfailed', request => runtimeErrors.push(`requestfailed: ${request.url()} — ${request.failure() && request.failure().errorText}`));
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 2 });
  await page.goto('file://' + path.resolve(input), { waitUntil: 'networkidle0' });
  await page.evaluateHandle('document.fonts.ready');

  const count = await page.$$eval('.slide', els => els.length);
  if (!count) throw new Error('deck contains no .slide elements');
  const report = [];
  let errors = 0, warns = 0;
  for (let i = 0; i < count; i++) {
    await page.evaluate(idx => { [...document.querySelectorAll('.slide')]
      .forEach((s,j) => s.classList.toggle('active', j === idx)); }, i);
    await new Promise(r => setTimeout(r, SETTLE));
    const res = await page.evaluate(measure, W, H, EDGE_TOL, OVERLAP_AREA, FONT_FLOOR);
    const brokenImages = await page.$$eval('.slide.active img', images => images
      .filter(image => image.complete && image.naturalWidth === 0)
      .map(image => image.getAttribute('src') || 'unknown'));
    const num = String(i+1).padStart(2,'0');
    const el = await page.$('.slide.active');
    await el.screenshot({ path: path.join(OUT, `${PREFIX}-${num}.png`) });
    const v = res.violations || [];
    if (res.error) v.push({ sev:'ERROR', type:'MEASURE', el:'.slide', msg:res.error, text:'' });
    brokenImages.forEach(src => v.push({ sev:'ERROR', type:'BROKEN_IMAGE', el:'img', msg:`failed to load ${src}`, text:'' }));
    const e = v.filter(x=>x.sev==='ERROR').length, w = v.filter(x=>x.sev==='WARN').length;
    errors += e; warns += w;
    report.push({ slide: i+1, errors: e, warns: w, violations: v });
    const tag = e ? '❌' : (w ? '⚠️ ' : '✓');
    console.log(`${tag} slide ${num}  ${e} err  ${w} warn  (${res.counts? res.counts.elements:'?'} els)`);
    for (const x of v) console.log(`     [${x.sev}] ${x.type}  ${x.el}  — ${x.msg}${x.text?`  «${x.text}»`:''}`);
  }
  await browser.close();
  errors += runtimeErrors.length;
  runtimeErrors.forEach(message => console.log(`     [ERROR] RUNTIME — ${message}`));
  fs.writeFileSync(path.join(OUT, 'qa-report.json'), JSON.stringify({ input, count, errors, warns, runtimeErrors, report }, null, 2));
  console.log(`\n${errors} errors, ${warns} warnings across ${count} slides → ${path.join(OUT,'qa-report.json')}`);
  process.exit(errors > 0 ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
