#!/usr/bin/env node
/* Export a standard 16:9 HTML deck to PDF, one 1280×720 slide per page.
   Handles galleries and active-gated presentation/motion decks.
   Usage: node pdf.js <input.html> <out.pdf> */
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const { launchOptions } = require('./lib/browser');

const input = process.argv[2];
const output = process.argv[3];
if (!input || !output) {
  console.error('usage: node pdf.js <input.html> <out.pdf>');
  process.exit(2);
}
fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });

(async () => {
  const browser = await puppeteer.launch(launchOptions());
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
    await page.goto(pathToFileURL(path.resolve(input)).href, { waitUntil: 'networkidle0' });
    await page.evaluateHandle('document.fonts.ready');
    const count = await page.$$eval('.slide', slides => slides.length);
    if (!count) throw new Error('deck contains no .slide elements');

    await page.evaluate(() => {
      document.body.classList.add('gallery');
      document.querySelectorAll('.slide').forEach(slide => {
        slide.classList.add('active');
        slide.removeAttribute('inert');
        slide.setAttribute('aria-hidden', 'false');
        if (slide.hasAttribute('data-steps')) slide.setAttribute('data-cur', '0');
      });
    });
    await page.emulateMediaType('print');
    await page.addStyleTag({ content: `
      @page { size: 1280px 720px; margin: 0; }
      html, body { width:1280px !important; height:auto !important; background:#fff !important;
        padding:0 !important; margin:0 !important; overflow:visible !important; }
      body.gallery { padding:0 !important; }
      .g-label, #ov, #deck-status { display:none !important; }
      .slide { display:flex !important; position:relative !important; inset:auto !important;
        width:1280px !important; height:720px !important; margin:0 !important;
        transform:none !important; box-shadow:none !important; opacity:1 !important;
        page-break-after:always !important; break-after:page !important; }
      .slide:last-of-type { page-break-after:auto !important; break-after:auto !important; }
      *, *::before, *::after { animation:none !important; transition:none !important; }
      .r,.cap-rise,.seq-recede,.seq-takeover,.seq-task,.motion-cap,.cchip,.big-figure,
      .iqdot,.tnode,.reveal,.wrise,.ridein,.flap,.spotlit,.countwrap .cu-after {
        opacity:1 !important; transform:none !important; }
      .drawpath { stroke-dashoffset:0 !important; }
      .typeline { width:auto !important; }
      .curtain,.shutter { display:none !important; }
      .iris { clip-path:none !important; }
    ` });
    await new Promise(resolve => setTimeout(resolve, 100));
    await page.pdf({
      path: path.resolve(output),
      width: '1280px',
      height: '720px',
      printBackground: true,
      preferCSSPageSize: true,
    });
    console.log(`✓ PDF → ${output} (${count} slides)`);
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exit(1);
});
