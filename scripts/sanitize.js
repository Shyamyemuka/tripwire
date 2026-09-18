const fs = require('fs');
const path = require('path');

function sanitize(str) {
  return str
    .replace(/\uFFFD/g, '-')
    .replace(/[\u2014\u2013]/g, '-')
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\u2026/g, '...')
    .replace(/\u2022/g, '*');
}

function walk(dir) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) {
      walk(full);
    } else if (/\.(ts|tsx|js|mjs|css)$/.test(item.name)) {
      const content = fs.readFileSync(full, 'utf8');
      const cleaned = sanitize(content);
      fs.writeFileSync(full, cleaned, 'utf8');
    }
  }
}

walk('src');
console.log('Sanitization complete');