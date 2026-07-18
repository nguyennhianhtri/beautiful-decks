#!/usr/bin/env node
/* Render every 16:9 slide to PNG. Handles both stacked galleries and active-gated decks.
   Usage: node render.js <input.html> <outDir> [prefix] [--settle ms] [--dsf n] */
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const { launchOptions } = require('./lib/browser');

const args = process.argv.slice(2);
const input = args[0];
const outDir = args[1];
const prefix = args[2] && !args[2].startsWith('--') ? args[2] : 'slide';
const flag = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : fallback;
};
const settle = Number.parseInt(flag('settle', '2400'), 10);
const dsf = Number.parseFloat(flag('dsf', '2'));
const W = 1280;
const H = 720;

if (!input || !outDir) {
  console.error('usage: node render.js <input.html> <outDir> [prefix] [--settle ms] [--dsf n]');
  process.exit(2);
}
if (!Number.isFinite(settle) || settle < 0 || !Number.isFinite(dsf) || dsf <= 0) {
  console.error('settle must be >= 0 and dsf must be > 0');
  process.exit(2);
}

fs.mkdirSync(outDir, { recursive: true });
for (const name of fs.readdirSync(outDir)) {
  if (new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-\\d+\\.png$`).test(name)) {
    fs.unlinkSync(path.join(outDir, name));
  }
}

(async () => {
  const browser = await puppeteer.launch(launchOptions());
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: W, height: H, deviceScaleFactor: dsf });
    await page.goto(`file://${path.resolve(input)}`, { waitUntil: 'networkidle0' });
    await page.evaluateHandle('document.fonts.ready');

    const gallery = await page.evaluate(() => document.body.classList.contains('gallery'));
    const count = await page.$$eval('.slide', elements => elements.length);
    if (!count) throw new Error('deck contains no .slide elements');
    console.log(`found ${count} slides (${gallery ? 'gallery' : 'presentation'})`);

    for (let index = 0; index < count; index += 1) {
      await page.evaluate((slideIndex, isGallery) => {
        document.querySelectorAll('[data-render-target]').forEach(el => el.removeAttribute('data-render-target'));
        const slides = [...document.querySelectorAll('.slide')];
        if (isGallery) {
          slides[slideIndex].setAttribute('data-render-target', '1');
          slides[slideIndex].scrollIntoView();
        } else {
          if (window.deck && typeof window.deck.show === 'function') window.deck.show(slideIndex);
          else slides.forEach((slide, i) => slide.classList.toggle('active', i === slideIndex));
          slides[slideIndex].setAttribute('data-render-target', '1');
        }
      }, index, gallery);
      if (settle) await new Promise(resolve => setTimeout(resolve, settle));
      const target = await page.$('[data-render-target]');
      if (!target) throw new Error(`slide ${index + 1} did not become renderable`);
      const number = String(index + 1).padStart(2, '0');
      const output = path.join(outDir, `${prefix}-${number}.png`);
      await target.screenshot({ path: output });
      console.log(`✓ ${output}`);
    }
    console.log(`done — ${count} slides @ ${W * dsf}×${H * dsf}`);
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exit(1);
});
