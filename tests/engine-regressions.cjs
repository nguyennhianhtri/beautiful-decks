#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const puppeteer = require('puppeteer-core');
const { resolveBrowserPath } = require('../engine/lib/browser');

const PROJECT = path.resolve(__dirname, '..');
const ROOT = path.join(PROJECT, 'engine');
const BROWSER = resolveBrowserPath();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'beautiful-decks-regression-'));
let passed = 0;

function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => { passed += 1; console.log(`✓ ${name}`); })
    .catch(err => { err.message = `${name}: ${err.message}`; throw err; });
}

function run(script, args, opts = {}) {
  const result = spawnSync(process.execPath, [path.join(ROOT, script), ...args], {
    cwd: PROJECT,
    encoding: 'utf8',
    ...opts,
  });
  if (result.status !== 0) {
    throw new Error(`${script} failed (${result.status})\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
  }
  return result;
}

function writeSpec(name, source) {
  const file = path.join(tmp, name);
  fs.writeFileSync(file, source);
  return file;
}

async function browserFor(file, viewport = { width: 1280, height: 720, deviceScaleFactor: 1 }) {
  const browser = await puppeteer.launch({ executablePath: BROWSER, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport(viewport);
  await page.goto(`file://${file}`, { waitUntil: 'networkidle0' });
  await page.evaluateHandle('document.fonts.ready');
  return { browser, page };
}

(async () => {
  const staticSpec = writeSpec('static.js', `module.exports={title:'Static',slides:[
    {type:'statement',title:'One'},{type:'statement',title:'Two'}
  ]};`);
  const staticOut = path.join(tmp, 'nested', 'static.html');

  await test('standard builder creates parent directories and always loads presenter runtime', () => {
    run('build.js', [staticSpec, staticOut]);
    const html = fs.readFileSync(staticOut, 'utf8');
    assert.match(html, /js\/deck-engine\.js/);
  });

  await test('non-motion standard deck boots with exactly one visible slide', async () => {
    const { browser, page } = await browserFor(staticOut);
    try {
      const state = await page.evaluate(() => ({
        visible: [...document.querySelectorAll('.slide')].filter(s => getComputedStyle(s).display !== 'none').length,
        engine: Boolean(window.deck),
        index: window.deck && window.deck.index,
      }));
      assert.deepStrictEqual(state, { visible: 1, engine: true, index: 0 });
    } finally { await browser.close(); }
  });

  await test('interactive controls do not advance the deck', async () => {
    const { browser, page } = await browserFor(staticOut);
    try {
      await page.evaluate(() => {
        const button = document.createElement('button');
        button.id = 'fixture-button';
        button.textContent = 'Do action';
        document.querySelector('.slide.active').appendChild(button);
      });
      await page.click('#fixture-button');
      assert.strictEqual(await page.evaluate(() => window.deck.index), 0);
    } finally { await browser.close(); }
  });

  await test('overview entries are native keyboard-accessible buttons', async () => {
    const { browser, page } = await browserFor(staticOut);
    try {
      await page.keyboard.press('Escape');
      const info = await page.evaluate(() => ({
        count: document.querySelectorAll('#ov .ovcell').length,
        tags: [...document.querySelectorAll('#ov .ovcell')].map(x => x.tagName),
      }));
      assert.strictEqual(info.count, 2);
      assert.deepStrictEqual(info.tags, ['BUTTON', 'BUTTON']);
    } finally { await browser.close(); }
  });

  await test('unknown standard template fails fast instead of silently dropping a slide', () => {
    const { buildDeck } = require(path.join(ROOT, 'build.js'));
    assert.throws(() => buildDeck({ title: 'Bad', slides: [{ type: 'does-not-exist' }] }), /unknown/i);
  });

  await test('repeated builds are byte-deterministic and namespace repeated inline SVG ids', () => {
    const { buildDeck } = require(path.join(ROOT, 'build.js'));
    const deck = {
      title: 'Deterministic',
      customer: { logoSvg: '<svg viewBox="0 0 10 10"><defs><linearGradient id="g"><stop/></linearGradient></defs><rect id="r" fill="url(#g)"/></svg>' },
      slides: [{ type: 'statement', title: 'One' }, { type: 'statement', title: 'Two' }],
    };
    const first = buildDeck(deck);
    const second = buildDeck(deck);
    assert.strictEqual(first, second);
    const ids = [...first.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
    assert.strictEqual(ids.length, new Set(ids).size);
  });

  await test('wide builder fails fast on an unknown template', () => {
    const { buildWideDeck } = require(path.join(ROOT, 'build-wide.js'));
    assert.throws(() => buildWideDeck({ slides: [{ type: 'does-not-exist' }] }), /unknown/i);
  });

  await test('wide builder always loads presenter runtime and escapes plain-text fields', () => {
    const spec = writeSpec('wide.js', `module.exports={title:'Wide <unsafe>',slides:[
      {type:'wribbon',title:'A < B',kpis:[{l:'Only',n:'1',spark:[7]}]}
    ]};`);
    const out = path.join(tmp, 'nested-wide', 'wide.html');
    run('build-wide.js', [spec, out]);
    const html = fs.readFileSync(out, 'utf8');
    assert.match(html, /js\/deck-engine\.js/);
    assert.ok(!html.includes('NaN'));
    assert.ok(html.includes('A &lt; B'));
    assert.ok(html.includes('<title>Wide &lt;unsafe&gt;</title>'));
  });

  await test('step state resets when the presenter replays the current slide', async () => {
    const spec = writeSpec('steps.js', `module.exports={title:'Steps',slides:[
      {type:'wstatement',title:'Step fixture'}
    ]};`);
    const out = path.join(tmp, 'steps.html');
    run('build-wide.js', [spec, out]);
    const { browser, page } = await browserFor(out, { width: 1920, height: 360, deviceScaleFactor: 1 });
    try {
      const state = await page.evaluate(() => {
        const slide = document.querySelector('.slide.active');
        slide.setAttribute('data-steps', '3');
        window.deckSteps.set(2);
        const before = slide.getAttribute('data-cur');
        window.deck.show(window.deck.index);
        return { before, after: slide.getAttribute('data-cur') };
      });
      assert.deepStrictEqual(state, { before: '2', after: '0' });
    } finally { await browser.close(); }
  });

  await test('standard renderer exports every active-gated motion slide', () => {
    const built = path.join(tmp, 'motion.html');
    run('build.js', [path.join(PROJECT, 'examples', 'standard.js'), built]);
    const out = path.join(tmp, 'rendered');
    run('render.js', [built, out, 'slide', '--settle', '0', '--dsf', '1']);
    const pngs = fs.readdirSync(out).filter(f => /^slide-\d+\.png$/.test(f));
    assert.strictEqual(pngs.length, 7);
  });

  await test('PDF exporter preserves one page per active-gated slide', () => {
    const built = path.join(tmp, 'pdf-source.html');
    const pdf = path.join(tmp, 'nested-pdf', 'deck.pdf');
    run('build.js', [path.join(PROJECT, 'examples', 'standard.js'), built]);
    run('pdf.js', [built, pdf]);
    assert.ok(fs.statSync(pdf).size > 1000);
    const info = spawnSync('pdfinfo', [pdf], { encoding: 'utf8' });
    if (info.status === 0) {
      const match = info.stdout.match(/^Pages:\s+(\d+)/m);
      assert.ok(match, 'pdfinfo did not report page count');
      assert.strictEqual(Number(match[1]), 7);
    } else {
      console.log('  ↳ pdfinfo unavailable; validated non-empty PDF only');
    }
  });

  await test('QA rejects a broken slide image with an explicit diagnostic', () => {
    const spec = writeSpec('broken-image.js', `module.exports={title:'Broken image',slides:[
      {type:'cover',img:'definitely-missing-image',title:'Broken'}
    ]};`);
    const built = path.join(tmp, 'broken-image.html');
    run('build.js', [spec, built]);
    const out = path.join(tmp, 'qa-broken-image');
    const result = spawnSync(process.execPath, [path.join(ROOT, 'qa.js'), built, '--out', out, '--settle', '0'], {
      cwd: PROJECT, encoding: 'utf8',
    });
    assert.strictEqual(result.status, 1);
    assert.match(result.stdout, /BROKEN_IMAGE/);
  });

  await test('ultrawide renderer exports every slide and assembles a same-count PDF', () => {
    const built = path.join(tmp, 'wide-motion.html');
    const renders = path.join(tmp, 'wide-renders');
    const pdf = path.join(tmp, 'wide-deck.pdf');
    run('build-wide.js', [path.join(PROJECT, 'examples', 'ultrawide.js'), built]);
    run('render-wide.js', [built, renders, 'wide', '--settle', '0', '--dsf', '0.25', '--pdf', pdf]);
    const pngs = fs.readdirSync(renders).filter(file => /^wide-\d+\.png$/.test(file));
    assert.strictEqual(pngs.length, 5);
    const info = spawnSync('pdfinfo', [pdf], { encoding: 'utf8' });
    if (info.status === 0) assert.match(info.stdout, /^Pages:\s+5$/m);
  });

  await test('portable output contains no local CSS asset URLs', () => {
    const built = path.join(tmp, 'portable-source.html');
    run('build.js', [path.join(PROJECT, 'examples', 'standard.js'), built]);
    const portable = path.join(tmp, 'portable.html');
    run('make-portable.js', [built, portable, '--strict']);
    const html = fs.readFileSync(portable, 'utf8');
    const localCssUrls = [...html.matchAll(/url\(([^)]+)\)/gi)]
      .map(m => m[1].trim().replace(/^['"]|['"]$/g, ''))
      .filter(u => !/^(data:|https?:|#)/i.test(u));
    assert.deepStrictEqual(localCssUrls, []);
  });

  console.log(`\n${passed} regression tests passed`);
})().catch(err => {
  console.error(`\nFAIL: ${err.stack || err}`);
  process.exit(1);
});
