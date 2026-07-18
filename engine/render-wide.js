/* render-wide.js — export a 48:9 deck/gallery at EXACT theater spec.
 * 3840×720 @ dsf 2.625 → 10080×1890 PNGs. Optionally assemble a PDF.
 * Usage: node render-wide.js <input.html> <outDir> [prefix] [--pdf out.pdf]
 *
 * Presentation decks: the engine + CSS show ONE .active slide (others display:none),
 * so we drive window.deck.show(i) and screenshot the VIEWPORT — guaranteeing the
 * captured pixels are the active slide. Gallery pages (all slides stacked) fall back
 * to per-element screenshots.
 */
const puppeteer = require('puppeteer-core');
const { PDFDocument } = require('pdf-lib');
const path = require('path'); const fs = require('fs');
const { launchOptions } = require('./lib/browser');
const a = process.argv.slice(2);
const input = a[0], outDir = a[1] || 'render-wide', prefix = (a[2] && !a[2].startsWith('--')) ? a[2] : 'w';
if (!input) { console.error('usage: node render-wide.js <input.html> <outDir> [prefix] [--pdf out.pdf] [--settle ms] [--dsf n]'); process.exit(2); }
const getFlag = (name, fallback) => { const i = a.indexOf(`--${name}`); return i >= 0 ? a[i + 1] : fallback; };
const pdfI = a.indexOf('--pdf'); const pdfOut = pdfI >= 0 ? a[pdfI + 1] : null;
const W = 3840, H = 720;
const DSF = Number.parseFloat(getFlag('dsf', '2.625'));   // 10080 × 1890 by default
const SETTLE = Number.parseInt(getFlag('settle', '3200'), 10);
if (!Number.isFinite(DSF) || DSF <= 0 || !Number.isFinite(SETTLE) || SETTLE < 0) {
  console.error('dsf must be > 0 and settle must be >= 0'); process.exit(2);
}
fs.mkdirSync(outDir, { recursive: true });
(async () => {
  const b = await puppeteer.launch(launchOptions());
  const p = await b.newPage();
  await p.setViewport({ width: W, height: H, deviceScaleFactor: DSF });
  await p.goto('file://' + path.resolve(input), { waitUntil: 'networkidle0' });
  await p.evaluateHandle('document.fonts.ready');
  const gallery = await p.evaluate(() => document.body.classList.contains('gallery'));
  const count = await p.$$eval('.slide', els => els.length);
  const files = [];
  for (let i = 0; i < count; i++) {
    if (!gallery) {
      // Drive the engine so exactly slide i is .active (others are display:none).
      await p.evaluate(idx => {
        if (window.deck && window.deck.show) window.deck.show(idx);
        else [...document.querySelectorAll('.slide')].forEach((s,j)=>s.classList.toggle('active', j===idx));
      }, i);
      await new Promise(r => setTimeout(r, SETTLE));   // settle finite cinematic motion + reflow
      const f = path.join(outDir, `${prefix}-${String(i+1).padStart(2,'0')}.png`);
      await p.screenshot({ path: f });               // viewport = the one visible slide
      files.push(f);
    } else {
      // Gallery: all slides stacked & visible — screenshot each element.
      await p.evaluate(idx => { document.querySelectorAll('[data-r]').forEach(e=>e.removeAttribute('data-r'));
        const t = document.querySelectorAll('.slide')[idx]; if (t){ t.setAttribute('data-r','1'); t.scrollIntoView(); } }, i);
      await new Promise(r => setTimeout(r, 250));
      const el = await p.$('[data-r]');
      const f = path.join(outDir, `${prefix}-${String(i+1).padStart(2,'0')}.png`);
      await el.screenshot({ path: f }); files.push(f);
    }
    console.log('✓', files[files.length-1]);
  }
  await b.close();
  if (pdfOut) {
    const pdf = await PDFDocument.create();
    const pageWidth = 1440;
    const pageHeight = 270;
    for (const file of files) {
      const image = await pdf.embedPng(fs.readFileSync(file));
      const page = pdf.addPage([pageWidth, pageHeight]);
      page.drawImage(image, { x: 0, y: 0, width: pageWidth, height: pageHeight });
    }
    fs.mkdirSync(path.dirname(path.resolve(pdfOut)), { recursive: true });
    fs.writeFileSync(path.resolve(pdfOut), await pdf.save());
    console.log(`✓ PDF → ${pdfOut} (${files.length} pages)`);
  }
  console.log(`done — ${count} slides @ ${Math.round(W * DSF)}×${Math.round(H * DSF)}`);
})().catch(e => { console.error(e); process.exit(1); });
