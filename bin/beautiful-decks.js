#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const ENGINE = path.join(ROOT, 'engine');

function fail(message, code = 2) {
  console.error(`beautiful-decks: ${message}`);
  process.exit(code);
}

function run(script, args) {
  const result = spawnSync(process.execPath, [path.join(ENGINE, script), ...args], {
    cwd: process.cwd(),
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  process.exitCode = result.status == null ? 1 : result.status;
  return result.status;
}

function isUltrawide(htmlPath) {
  const html = fs.readFileSync(path.resolve(htmlPath), 'utf8');
  return /<body[^>]*class="[^"]*\bwide\b/i.test(html);
}

function takeFlag(args, name) {
  const index = args.indexOf(name);
  if (index < 0) return null;
  const value = args[index + 1];
  args.splice(index, value && !value.startsWith('--') ? 2 : 1);
  return value || true;
}

function help() {
  console.log(`Beautiful Decks

Usage:
  beautiful-decks build <spec.js> [out.html] [--standard|--ultrawide]
  beautiful-decks qa <deck.html> [QA flags]
  beautiful-decks render <deck.html> <outDir> [prefix] [--pdf out.pdf] [render flags]
  beautiful-decks pdf <deck.html> <out.pdf> [--settle ms] [--dsf n]
  beautiful-decks portable <deck.html> <out.html> [--strict]
  beautiful-decks patterns <find|list|show|tags> [query]
  beautiful-decks doctor
  beautiful-decks formats

Formats:
  standard    1280×720 (16:9). Use for normal presentations and requests for
              “widescreen 16:9”.
  ultrawide   3840×720 (48:9), exactly three contiguous 16:9 panels. Use only
              for panoramic/theatre/multi-screen requests.
`);
}

const argv = process.argv.slice(2);
const command = argv.shift();

if (!command || command === 'help' || command === '--help' || command === '-h') {
  help();
} else if (command === 'formats') {
  console.log(JSON.stringify({
    standard: { width: 1280, height: 720, ratio: '16:9', builder: 'engine/build.js' },
    ultrawide: { width: 3840, height: 720, ratio: '48:9', panels: 3, builder: 'engine/build-wide.js' },
  }, null, 2));
} else if (command === 'build') {
  const spec = argv.shift();
  if (!spec) fail('build requires <spec.js>');
  let output = argv[0] && !argv[0].startsWith('--') ? argv.shift() : null;
  const forcedWide = argv.includes('--ultrawide') || argv.includes('--wide');
  const forcedStandard = argv.includes('--standard');
  if (forcedWide && forcedStandard) fail('choose either --standard or --ultrawide, not both');
  const specPath = path.resolve(spec);
  if (!fs.existsSync(specPath)) fail(`spec not found: ${specPath}`);
  delete require.cache[specPath];
  const deck = require(specPath);
  const format = forcedWide ? 'ultrawide' : forcedStandard ? 'standard' : String(deck.format || 'standard').toLowerCase();
  const ultrawide = ['ultrawide', '48:9', 'wide'].includes(format);
  if (!ultrawide && !['standard', '16:9', 'widescreen'].includes(format)) {
    fail(`unsupported format "${format}"; use standard or ultrawide`);
  }
  if (!output) {
    output = path.join('dist', `${path.basename(spec, path.extname(spec))}.html`);
  }
  run(ultrawide ? 'build-wide.js' : 'build.js', [specPath, output]);
} else if (command === 'qa') {
  const input = argv.shift();
  if (!input) fail('qa requires <deck.html>');
  run(isUltrawide(input) ? 'qa-wide.js' : 'qa.js', [input, ...argv]);
} else if (command === 'render') {
  const input = argv.shift();
  const outDir = argv.shift();
  if (!input || !outDir) fail('render requires <deck.html> <outDir>');
  const pdf = takeFlag(argv, '--pdf');
  if (pdf === true) fail('--pdf requires an output path');
  const ultrawide = isUltrawide(input);
  const status = run(ultrawide ? 'render-wide.js' : 'render.js', [input, outDir, ...argv, ...(ultrawide && pdf ? ['--pdf', pdf] : [])]);
  if (status === 0 && pdf && !ultrawide) run('pdf.js', [input, pdf]);
} else if (command === 'pdf') {
  const input = argv.shift();
  const output = argv.shift();
  if (!input || !output) fail('pdf requires <deck.html> <out.pdf>');
  if (isUltrawide(input)) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'beautiful-decks-pdf-'));
    run('render-wide.js', [input, tmp, 'page', '--pdf', output, ...argv]);
  } else {
    run('pdf.js', [input, output]);
  }
} else if (command === 'portable') {
  const input = argv.shift();
  const output = argv.shift();
  if (!input || !output) fail('portable requires <deck.html> <out.html>');
  run('make-portable.js', [input, output, ...argv]);
} else if (command === 'patterns') {
  run('patterns.js', argv);
} else if (command === 'doctor') {
  try {
    const { resolveBrowserPath } = require(path.join(ENGINE, 'lib/browser.js'));
    const browser = resolveBrowserPath();
    const packageJson = require(path.join(ROOT, 'package.json'));
    console.log(JSON.stringify({
      ok: true,
      node: process.version,
      browser,
      version: packageJson.version,
      formats: ['standard 16:9', 'ultrawide 48:9'],
    }, null, 2));
  } catch (error) {
    fail(error.message, 1);
  }
} else {
  fail(`unknown command "${command}"; run beautiful-decks help`);
}
