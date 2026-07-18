#!/usr/bin/env node
/* Build one portable HTML deck by inlining local images, scripts, stylesheets, and
   every local url(...) referenced from CSS (including embedded fonts).
   Usage: node make-portable.js <input.html> <output.html> [--strict]
   --strict fails if any local asset is missing or any remote dependency remains. */
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const input = args[0];
const output = args[1];
const strict = args.includes('--strict');
if (!input || !output) {
  console.error('usage: node make-portable.js <input.html> <output.html> [--strict]');
  process.exit(2);
}

const inputPath = path.resolve(input);
const inputDir = path.dirname(inputPath);
let html = fs.readFileSync(inputPath, 'utf8');
const stats = { images: 0, scripts: 0, stylesheets: 0, cssAssets: 0, missing: [], remote: [] };

function mime(file) {
  return ({
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
    '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
    '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf',
    '.mp4': 'video/mp4', '.webm': 'video/webm', '.json': 'application/json',
  })[path.extname(file).toLowerCase()] || 'application/octet-stream';
}

function classification(ref) {
  const value = String(ref || '').trim();
  if (/^data:/i.test(value) || value.startsWith('#')) return 'inline';
  if (/^https?:/i.test(value) || /^\/\//.test(value)) return 'remote';
  return 'local';
}

function resolveLocal(ref, baseDir) {
  const withoutFragment = ref.split('#')[0].split('?')[0];
  if (/^file:/i.test(withoutFragment)) return new URL(withoutFragment).pathname;
  return path.resolve(baseDir, decodeURIComponent(withoutFragment));
}

function dataUri(ref, baseDir, kind) {
  const type = classification(ref);
  if (type === 'inline') return ref;
  if (type === 'remote') {
    stats.remote.push({ kind, ref });
    return ref;
  }
  const file = resolveLocal(ref, baseDir);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    stats.missing.push({ kind, ref, resolved: file });
    return ref;
  }
  const encoded = fs.readFileSync(file).toString('base64');
  return `data:${mime(file)};base64,${encoded}`;
}

function inlineCssAssets(css, cssDir) {
  return css.replace(/url\(\s*(['"]?)(.*?)\1\s*\)/gi, (match, quote, ref) => {
    const value = ref.trim();
    const converted = dataUri(value, cssDir, 'css-url');
    if (converted !== value && converted.startsWith('data:')) stats.cssAssets += 1;
    return `url("${converted.replace(/"/g, '%22')}")`;
  });
}

html = html.replace(/<img\b([^>]*?)\bsrc=(['"])(.*?)\2([^>]*)>/gi,
  (match, before, quote, src, after) => {
    const converted = dataUri(src, inputDir, 'image');
    if (converted !== src && converted.startsWith('data:')) stats.images += 1;
    return `<img${before}src="${converted}"${after}>`;
  });

html = html.replace(/<script\b([^>]*?)\bsrc=(['"])(.*?)\2([^>]*)><\/script>/gi,
  (match, before, quote, src, after) => {
    const type = classification(src);
    if (type === 'remote') {
      stats.remote.push({ kind: 'script', ref: src });
      return match;
    }
    if (type === 'inline') return match;
    const file = resolveLocal(src, inputDir);
    if (!fs.existsSync(file)) {
      stats.missing.push({ kind: 'script', ref: src, resolved: file });
      return match;
    }
    stats.scripts += 1;
    return `<script${before}${after}>\n${fs.readFileSync(file, 'utf8')}\n</script>`;
  });

html = html.replace(/<link\b([^>]*?)>/gi, (match, attrs) => {
  const rel = attrs.match(/\brel=(['"])(.*?)\1/i);
  const href = attrs.match(/\bhref=(['"])(.*?)\1/i);
  if (!rel || !/\bstylesheet\b/i.test(rel[2]) || !href) return match;
  const ref = href[2];
  const type = classification(ref);
  if (type === 'remote') {
    stats.remote.push({ kind: 'stylesheet', ref });
    return match;
  }
  if (type === 'inline') return match;
  const file = resolveLocal(ref, inputDir);
  if (!fs.existsSync(file)) {
    stats.missing.push({ kind: 'stylesheet', ref, resolved: file });
    return match;
  }
  const css = inlineCssAssets(fs.readFileSync(file, 'utf8'), path.dirname(file));
  stats.stylesheets += 1;
  return `<style data-inlined-from="${ref.replace(/"/g, '&quot;')}">\n${css}\n</style>`;
});

// Inline local URLs in author-supplied style blocks relative to the input HTML.
html = html.replace(/<style(\b[^>]*)>([\s\S]*?)<\/style>/gi,
  (match, attrs, css) => `<style${attrs}>${inlineCssAssets(css, inputDir)}</style>`);

fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
fs.writeFileSync(path.resolve(output), html);
const kb = Math.round(fs.statSync(path.resolve(output)).size / 1024);
const summary = `${stats.images} images, ${stats.scripts} scripts, ${stats.stylesheets} stylesheets, ${stats.cssAssets} CSS assets; ${stats.missing.length} missing, ${stats.remote.length} remote`;
console.log(`✓ portable → ${output} (${summary}; ${kb} KB)`);
if (stats.missing.length) console.warn('missing:', JSON.stringify(stats.missing, null, 2));
if (stats.remote.length) console.warn('remote:', JSON.stringify(stats.remote, null, 2));
if (strict && (stats.missing.length || stats.remote.length)) process.exit(1);
