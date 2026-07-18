#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const excluded = new Set(['.git', 'node_modules', 'dist', 'coverage']);
const allowedLarge = new Set(['.woff2']);
const findings = [];
let files = 0;
let bytes = 0;

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (excluded.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      findings.push(`${path.relative(root, full)}: symlinks are not allowed in the public tree`);
      continue;
    }
    if (entry.isDirectory()) walk(full);
    else inspect(full);
  }
}

function inspect(file) {
  files += 1;
  const stat = fs.statSync(file);
  bytes += stat.size;
  const rel = path.relative(root, file);
  if (rel === path.join('scripts', 'check-public-safety.cjs')) return;
  if (stat.size > 5 * 1024 * 1024 && !allowedLarge.has(path.extname(file))) {
    findings.push(`${rel}: file is larger than 5 MiB`);
  }
  if (/\.(pdf|pptx|key|zip|tar|gz|7z)$/i.test(file)) findings.push(`${rel}: generated/archive artifact is not allowed`);
  if (/\.(woff2|png|jpg|jpeg|gif|webp|ico)$/i.test(file)) return;
  const text = fs.readFileSync(file, 'utf8');
  const rules = [
    [/\/Users\/tringuyen|\/home\/[^/\s]+|[A-Z]:\\Users\\/i, 'absolute home path'],
    [/BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY/i, 'private key'],
    [/(?:api[_-]?key|client[_-]?secret|password|connection[_-]?string)\s*[:=]\s*['"][^'"]{8,}/i, 'credential-like assignment'],
    [/\b(?:BPI|CIMB|Singtel|Rio Tinto)\b/i, 'customer-specific name'],
    [/@microsoft\.com\b/i, 'corporate email address'],
  ];
  for (const [pattern, label] of rules) if (pattern.test(text)) findings.push(`${rel}: ${label}`);
}

walk(root);
if (findings.length) {
  console.error(`Public-safety scan failed (${findings.length} finding${findings.length === 1 ? '' : 's'}):`);
  findings.forEach(finding => console.error(`- ${finding}`));
  process.exit(1);
}
console.log(`✓ public-safety scan: ${files} files, ${(bytes / 1024 / 1024).toFixed(2)} MiB, 0 findings`);
