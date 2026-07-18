#!/usr/bin/env node
/* qa-wide.js — geometry linter + renderer for 48:9 (3840×720) gallery/decks.
 * Same checks as qa.js but parameterized for the wide canvas. For the GALLERY
 * (stacked, no .active gating) it measures each .slide in place; for an
 * .active-gated motion deck it toggles slides like qa.js.
 * Usage: node qa-wide.js <input.html> [--out dir] [--prefix w] [--settle ms] [--dsf 2]
 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const { launchOptions } = require('./lib/browser');
const args = process.argv.slice(2);
const input = args[0];
if (!input) { console.error('usage: node qa-wide.js <input.html> [--out dir] [--prefix p] [--settle ms] [--dsf n]'); process.exit(2); }
const getFlag = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const SETTLE = parseInt(getFlag('settle', '3200'), 10);
const PREFIX = getFlag('prefix', 'w');
const DSF = parseFloat(getFlag('dsf', '2'));
const OUT = getFlag('out', path.join(path.dirname(path.resolve(input)), 'qa-render'));
const W = 3840, H = 720;
const EDGE_TOL = 1.5, OVERLAP_AREA = 240, FONT_FLOOR = 11;
fs.mkdirSync(OUT, { recursive: true });

function measure(W, H, EDGE_TOL, OVERLAP_AREA, FONT_FLOOR, sel) {
  const slide = document.querySelector(sel);
  if (!slide) return { error: 'no slide for ' + sel };
  const sb = slide.getBoundingClientRect();
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
  const all = [...slide.querySelectorAll('*')].filter(el => {
    if (!viz(el)) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    return true;
  });
  for (const el of all) {
    const b = L(el); const off = [];
    if (b.x < -EDGE_TOL) off.push('left');
    if (b.y < -EDGE_TOL) off.push('top');
    if (b.right > W + EDGE_TOL) off.push('right');
    if (b.bottom > H + EDGE_TOL) off.push('bottom');
    const cls = String(el.className||'');
    if (off.length && !ignored(el, 'offcanvas') && !/\b(bg|mesh|an-stage|hb-line|iqsvg|wc-art|constel|jr-emo|emo-area|emo-line)\b/.test(cls)) {
      const has = (el.textContent||'').trim().length > 0;
      push(has ? 'ERROR':'WARN', 'OFFCANVAS', el, `pokes past ${off.join('+')} edge`, b);
    }
  }
  for (const el of all) {
    if (el.children.length > 6) continue;
    const oY = el.scrollHeight - el.clientHeight, oX = el.scrollWidth - el.clientWidth;
    const cs = getComputedStyle(el);
    if (cs.overflow === 'visible') continue;
    // skip full-bleed decorative motion layers whose glow/art intentionally exceeds the box
    // but is clipped by overflow:hidden (horizon glow, iris, dolly-back, curtain, leak)
    const dcls = String(el.className || '');
    if (/\b(horizon|hglow|iris|dolly-back|curtain|leak|shutter|wc-art|constel)\b/.test(dcls)) continue;
    if (ignored(el, 'overflow')) continue;
    if (oY > 3 || oX > 3) push('ERROR','OVERFLOW', el, `content ${oX>3?'wider':'taller'} than box by ${Math.round(Math.max(oX,oY))}px (clipped)`, L(el));
  }
  for (const el of slide.querySelectorAll('*')) {
    if (el.children.length) continue;
    if (!(el.textContent||'').trim()) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    let anc = el.parentElement, hidden = false;
    while (anc && anc !== slide) { const a = getComputedStyle(anc);
      if (a.display==='none' || a.visibility==='hidden') { hidden = true; break; } anc = anc.parentElement; }
    if (hidden || ignored(el, 'invisible')) continue;
    if (parseFloat(cs.opacity) < 0.05) push('ERROR','INVISIBLE', el, 'opacity~0 after settle', L(el));
  }
  for (const el of all) {
    if (!(el.textContent||'').trim() || el.children.length || ignored(el, 'tinytext')) continue;
    const fs2 = parseFloat(getComputedStyle(el).fontSize);
    if (fs2 && fs2 < FONT_FLOOR) push('WARN','TINYTEXT', el, `font-size ${fs2.toFixed(1)}px < ${FONT_FLOOR}px floor`, L(el));
  }
  const tightText = el => { try { const rg = document.createRange(); rg.selectNodeContents(el);
      const r = rg.getBoundingClientRect(); if (!r.width || !r.height) return null;
      return { x:(r.left-sb.left)/scale, y:(r.top-sb.top)/scale, w:r.width/scale, h:r.height/scale,
               right:(r.right-sb.left)/scale, bottom:(r.bottom-sb.top)/scale };
    } catch(e){ return null; } };
  const leaves = all.filter(el => (el.textContent||'').trim() && el.children.length === 0)
                    .map(el => ({ el, b: tightText(el) })).filter(x => x.b);
  for (let i = 0; i < leaves.length; i++) for (let j = i+1; j < leaves.length; j++) {
    const a = leaves[i], c = leaves[j];
    if (a.el.contains(c.el) || c.el.contains(a.el)) continue;
    if (a.el.closest('[data-qa-ignore~="overlap"]') || c.el.closest('[data-qa-ignore~="overlap"]')) continue;
    if (a.el.parentElement === c.el.parentElement) {
      const ai = getComputedStyle(a.el).display, ci = getComputedStyle(c.el).display;
      if (ai.startsWith('inline') && ci.startsWith('inline')) continue;
    }
    const ix = Math.max(0, Math.min(a.b.right,c.b.right) - Math.max(a.b.x,c.b.x));
    const iy = Math.max(0, Math.min(a.b.bottom,c.b.bottom) - Math.max(a.b.y,c.b.y));
    const area = ix * iy; if (area <= OVERLAP_AREA) continue;
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
  await page.setViewport({ width: W, height: H, deviceScaleFactor: DSF });
  await page.goto(pathToFileURL(path.resolve(input)).href, { waitUntil: 'networkidle0' });
  await page.evaluateHandle('document.fonts.ready');
  const gallery = await page.evaluate(() => document.body.classList.contains('gallery'));
  const count = await page.$$eval('.slide', els => els.length);
  if (!count) throw new Error('deck contains no .slide elements');
  const report = []; let errors = 0, warns = 0;
  for (let i = 0; i < count; i++) {
    if (gallery) {
      await page.evaluate(idx => { document.querySelectorAll('.slide')[idx].scrollIntoView(); }, i);
    } else {
      await page.evaluate(idx => { [...document.querySelectorAll('.slide')]
        .forEach((s,j) => s.classList.toggle('active', j === idx)); }, i);
    }
    await new Promise(r => setTimeout(r, SETTLE));
    await page.evaluate(idx => {
      document.querySelectorAll('[data-qa-target]').forEach(e => e.removeAttribute('data-qa-target'));
      const t = document.body.classList.contains('gallery')
        ? document.querySelectorAll('.slide')[idx] : document.querySelector('.slide.active');
      if (t) t.setAttribute('data-qa-target','1');
    }, i);
    const res = await page.evaluate(measure, W, H, EDGE_TOL, OVERLAP_AREA, FONT_FLOOR, '[data-qa-target]');
    const brokenImages = await page.$$eval('[data-qa-target] img', images => images
      .filter(image => image.complete && image.naturalWidth === 0)
      .map(image => image.getAttribute('src') || 'unknown'));
    const num = String(i+1).padStart(2,'0');
    const elh = await page.$('[data-qa-target]');
    if (elh) await elh.screenshot({ path: path.join(OUT, `${PREFIX}-${num}.png`) });
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
