#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');
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
  await page.goto(pathToFileURL(file).href, { waitUntil: 'networkidle0' });
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

  await test('standard validator rejects missing required arrays with a slide field path', () => {
    const { validateDeck } = require(path.join(ROOT, 'build.js'));
    assert.throws(
      () => validateDeck({ slides: [{ type: 'cards3', title: 'Missing cards' }] }),
      /slide 1.*cards.*non-empty array/i,
    );
    assert.throws(
      () => validateDeck({ slides: [{ type: 'timeline', title: 'Missing items', body: 'x' }] }),
      /slide 1.*items.*non-empty array/i,
    );
    assert.throws(
      () => validateDeck({ slides: [{ type: 'quad', title: 'Unsafe class', cards: [{ icon: 'sparkle', title: 'x', body: 'x', color: 'blue\" onclick=\"alert(1)' }] }] }),
      /slide 1\.cards\[0\]\.color.*class token/i,
    );
    assert.throws(
      () => validateDeck({ slides: [{ type: 'archgrid', title: 'Unsafe zone', zones: [{ tone: '\"><img src=x onerror=alert(1)>', name: 'x', items: [{ label: 'x', glyph: 'layer' }] }] }] }),
      /slide 1\.zones\[0\]\.tone.*class token/i,
    );
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

  await test('asset resolution is traversal-safe, extension-aware, scoped, and non-mutating', () => {
    const B = require(path.join(ROOT, 'build.js'));
    const warn = console.warn;
    console.warn = () => {};
    try {
      assert.strictEqual(B.icon('../img/building'), '');
      assert.strictEqual(B.customerLogo('../icons/bank'), '');
      assert.strictEqual(B.IMG('figure.svg'), '../assets/img/figure.svg');
      assert.strictEqual(B.IMG('figure.png'), '../assets/img/figure.png');
      assert.strictEqual(B.IMG('bad" onerror="alert(1)'), '');
    } finally { console.warn = warn; }

    const deck = {
      _assetBase: 'alpha', foot: 'Original footer',
      slides: [{ type: 'cover', title: '<em>Trusted emphasis</em>', img: 'building' }],
    };
    const before = JSON.stringify(deck);
    const first = B.buildDeck(deck);
    const second = B.buildDeck({ _assetBase: 'beta', slides: [{ type: 'cover', title: 'Other', img: 'building' }] });
    assert.strictEqual(JSON.stringify(deck), before);
    assert.match(first, /href="alpha\/css\/fluent\.css"/);
    assert.match(first, /src="alpha\/assets\/img\/building\.svg"/);
    assert.match(first, /<em>Trusted emphasis<\/em>/);
    assert.match(second, /src="beta\/assets\/img\/building\.svg"/);
    assert.doesNotMatch(second, /alpha\/assets/);

    const linked = B.buildDeck({ slides: [{
      type: 'webexhibit', title: 'Safe link', img: 'data:image/svg+xml,%3Csvg/%3E',
      src: { url: 'javascript:alert(1)', label: 'Unsafe source' },
    }] });
    assert.match(linked, /class="xb-src" href="#"/);
    assert.doesNotMatch(linked, /href="javascript:/i);
  });

  await test('wide builder fails fast on an unknown template', () => {
    const { buildWideDeck } = require(path.join(ROOT, 'build-wide.js'));
    assert.throws(() => buildWideDeck({ slides: [{ type: 'does-not-exist' }] }), /unknown/i);
  });

  await test('wide validator rejects invalid geometry, unsafe colors, and unsupported light theme', () => {
    const { validateWideDeck } = require(path.join(ROOT, 'build-wide.js'));
    assert.throws(
      () => validateWideDeck({ slides: [{ type: 'wjourney', title: 'Empty', stations: [] }] }),
      /slide 1.*stations.*non-empty array/i,
    );
    assert.throws(
      () => validateWideDeck({ slides: [{ type: 'wunfold', title: 'Two acts', acts: [{}, {}] }] }),
      /slide 1.*acts.*exactly 3/i,
    );
    assert.throws(
      () => validateWideDeck({ brand: { accent: 'red;}body{display:none' }, slides: [{ type: 'wstatement', title: 'x' }] }),
      /brand\.accent.*CSS color/i,
    );
    assert.throws(
      () => validateWideDeck({ theme: 'light', slides: [{ type: 'wstatement', title: 'x' }] }),
      /light.*not supported/i,
    );
  });

  await test('wide validator rejects non-finite and out-of-bounds geometry inputs', () => {
    const { validateWideDeck } = require(path.join(ROOT, 'build-wide.js'));
    assert.throws(
      () => validateWideDeck({ slides: [{ type: 'wjourney', title: 'Bad emotion', stations: [{ phase: 'x', emo: 101 }] }] }),
      /slide 1\.stations\[0\]\.emo.*0.*100/i,
    );
    assert.throws(
      () => validateWideDeck({ slides: [{ type: 'wribbon', title: 'Bad spark', kpis: [{ l: 'x', n: '1', spark: [1, Infinity] }] }] }),
      /slide 1\.kpis\[0\]\.spark.*finite/i,
    );
    assert.throws(
      () => validateWideDeck({ slides: [{ type: 'wswim', title: 'Bad grid', cols: ['A'], lanes: [{ actor: 'x', steps: [{ col: 2, span: 1, t: 'x' }] }] }] }),
      /slide 1\.lanes\[0\]\.steps\[0\].*columns/i,
    );
    assert.throws(
      () => validateWideDeck({ slides: [{ type: 'wribbon', title: 'Bad color', kpis: [{ l: 'x', n: '1', color: 'red;}body{display:none' }] }] }),
      /slide 1\.kpis\[0\]\.color.*CSS color/i,
    );
    assert.throws(
      () => validateWideDeck({ slides: [{ type: 'wjourney', title: 'Bad class', stations: [{ phase: 'x', tone: 'high\" onclick=\"alert(1)' }] }] }),
      /slide 1\.stations\[0\]\.tone.*class token/i,
    );
    assert.throws(
      () => validateWideDeck({ slides: [{ type: 'wbigtri', title: 'Bad stat class', stats: [
        { n: '1', l: 'x', tone: '\"><img src=x onerror=alert(1)>' }, { n: '2', l: 'y' }, { n: '3', l: 'z' },
      ] }] }),
      /slide 1\.stats\[0\]\.tone.*class token/i,
    );
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

  await test('wide builds are non-mutating, asset-scoped, and free of duplicate journey SVG ids', () => {
    const { buildWideDeck } = require(path.join(ROOT, 'build-wide.js'));
    const station = { phase: 'Discover', when: 'Now', doing: 'Inspect', emo: 55 };
    const deck = {
      _assetBase: 'wide-alpha', foot: 'Wide footer',
      slides: [
        { type: 'wjourney', title: 'Journey one', stations: [station] },
        { type: 'wjourney', title: 'Journey two', stations: [station] },
        { type: 'wcover', title: 'Image', img: 'building' },
      ],
    };
    const before = JSON.stringify(deck);
    const html = buildWideDeck(deck);
    assert.strictEqual(JSON.stringify(deck), before);
    assert.match(html, /href="wide-alpha\/css\/wide\.css"/);
    assert.match(html, /src="wide-alpha\/assets\/img\/building\.svg"/);
    const emotionIds = [...html.matchAll(/\sid="(emo(?:Grad|Fill)-[^"]+)"/g)].map(match => match[1]);
    assert.strictEqual(emotionIds.length, 4);
    assert.strictEqual(emotionIds.length, new Set(emotionIds).size);
  });

  await test('wide product surfaces fall back to the neutral bundled product glyph', () => {
    const { buildWideDeck } = require(path.join(ROOT, 'build-wide.js'));
    const warnings = [];
    const warn = console.warn;
    console.warn = (...args) => warnings.push(args.join(' '));
    let html;
    try {
      html = buildWideDeck({ slides: [{
        type: 'whub', title: 'Fallback', hubIcon: 'p_not_bundled',
        nodes: [{ icon: 'p_not_bundled', t: 'Node' }],
      }] });
    } finally { console.warn = warn; }
    assert.deepStrictEqual(warnings, []);
    assert.match(html, /M8 8h8v8H8z/);
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

  await test('browser tools support encoded local paths', () => {
    const special = path.join(tmp, 'space # percent% unicode-測試');
    fs.mkdirSync(special, { recursive: true });
    const standard = path.join(special, 'deck #1%.html');
    const wide = path.join(special, 'wide #1%.html');
    run('build.js', [staticSpec, standard]);
    run('build-wide.js', [writeSpec('special-wide.js', `module.exports={slides:[{type:'wstatement',title:'Encoded path'}]};`), wide]);
    run('render.js', [standard, path.join(special, 'render standard'), 'slide', '--settle', '0', '--dsf', '0.25']);
    run('qa.js', [standard, '--out', path.join(special, 'qa standard'), '--settle', '0']);
    run('pdf.js', [standard, path.join(special, 'deck #1%.pdf')]);
    run('render-wide.js', [wide, path.join(special, 'render wide'), 'wide', '--settle', '0', '--dsf', '0.1']);
    assert.ok(fs.existsSync(path.join(special, 'render standard', 'slide-01.png')));
    assert.ok(fs.existsSync(path.join(special, 'render wide', 'wide-01.png')));
  });

  await test('synthetic galleries cover every exported template and build without warnings', () => {
    const { T } = require(path.join(ROOT, 'build.js'));
    const { W } = require(path.join(ROOT, 'build-wide.js'));
    const standardSpec = require(path.join(PROJECT, 'examples', 'template-gallery.js'));
    const wideSpec = require(path.join(PROJECT, 'examples', 'ultrawide-gallery.js'));
    assert.deepStrictEqual(standardSpec.slides.map(slide => slide.type).sort(), Object.keys(T).sort());
    assert.deepStrictEqual(wideSpec.slides.map(slide => slide.type).sort(), Object.keys(W).sort());
    const standardOut = path.join(tmp, 'all-standard.html');
    const wideOut = path.join(tmp, 'all-wide.html');
    const standardBuild = run('build.js', [path.join(PROJECT, 'examples', 'template-gallery.js'), standardOut]);
    const wideBuild = run('build-wide.js', [path.join(PROJECT, 'examples', 'ultrawide-gallery.js'), wideOut]);
    assert.strictEqual(standardBuild.stderr, '');
    assert.strictEqual(wideBuild.stderr, '');
    assert.strictEqual((fs.readFileSync(standardOut, 'utf8').match(/<section class="slide/g) || []).length, 22);
    assert.strictEqual((fs.readFileSync(wideOut, 'utf8').match(/<section class="slide/g) || []).length, 35);
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
