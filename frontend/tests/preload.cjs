const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '../public/invite');

test('every template page preloads its pictures in the background', () => {
  const pages = ['index.html', ...fs.readdirSync(root)
    .filter(dir => fs.existsSync(path.join(root, dir, 'index.html')))
    .map(dir => dir + '/index.html')];
  assert.ok(pages.length >= 15);
  for (const page of pages) {
    const html = fs.readFileSync(path.join(root, page), 'utf8');
    const src = page === 'index.html' ? 'assets/preload.js' : '../assets/preload.js';
    assert.ok(html.includes(`<script src="${src}"></script>`), page);
  }
});

test('the map waits for the background preload, and never in the editor', () => {
  const source = fs.readFileSync(path.join(root, 'assets/venue-map.js'), 'utf8');
  assert.match(source, /if \(!EDITING\) window\.addEventListener\('wc:preloaded'/);
  const preload = fs.readFileSync(path.join(root, 'assets/preload.js'), 'utf8');
  assert.match(preload, /dispatchEvent\(new Event\('wc:preloaded'\)\)/);
  assert.match(preload, /saveData/);
});
