#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const cli = path.join(root, 'bin', 'beautiful-decks.js');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'beautiful-decks-cli-'));

function run(args) {
  const result = spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`${args.join(' ')} failed\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}

const formats = JSON.parse(run(['formats']));
assert.deepStrictEqual(formats.standard, { width: 1280, height: 720, ratio: '16:9', builder: 'engine/build.js' });
assert.strictEqual(formats.ultrawide.ratio, '48:9');
assert.strictEqual(formats.ultrawide.panels, 3);

const standard = path.join(tmp, 'standard.html');
const ultrawide = path.join(tmp, 'ultrawide.html');
run(['build', 'examples/standard.js', standard]);
run(['build', 'examples/ultrawide.js', ultrawide]);

const standardHtml = fs.readFileSync(standard, 'utf8');
const ultrawideHtml = fs.readFileSync(ultrawide, 'utf8');
assert.match(standardHtml, /<section class="slide/);
assert.doesNotMatch(standardHtml, /<body[^>]*class="[^"]*\bwide\b/);
assert.match(ultrawideHtml, /<body[^>]*class="[^"]*\bwide\b/);
assert.match(ultrawideHtml, /js\/deck-engine\.js/);

const portable = path.join(tmp, 'standard-portable.html');
run(['portable', standard, portable, '--strict']);
const portableHtml = fs.readFileSync(portable, 'utf8');
assert.doesNotMatch(portableHtml, /<link[^>]+stylesheet/i);
assert.doesNotMatch(portableHtml, /<script[^>]+src=/i);

console.log('✓ CLI formats, standard build, ultrawide build, and strict portability');
