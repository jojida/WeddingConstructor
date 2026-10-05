const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, filename);
};
const { isSectionEnabled } = require('../src/lib/section-visibility.ts');
const { TEMPLATE_FIELDS } = require('../src/lib/constants.ts');

test('old invitations keep their blocks and their existing map preference', () => {
  assert.equal(isSectionEnabled({ id: 'schedule' }), true);
  assert.equal(isSectionEnabled({ id: 'map' }, {}, false), false);
  assert.equal(isSectionEnabled({ id: 'map' }, { map: true }, false), true);
  assert.equal(isSectionEnabled({ id: 'map' }, { map: false }, true), false);
});
test('optional sections can be removed while core sections stay enabled', () => {
  assert.equal(isSectionEnabled({ id: 'schedule' }, { schedule: false }), false);
  assert.equal(isSectionEnabled({ id: 'schedule' }, { schedule: true }), true);
  for (const id of ['cover', 'date', 'venue', 'closing']) {
    assert.equal(isSectionEnabled({ id, required: true }, { [id]: false }), true);
  }
});
test('every active design exposes the protected core and matches its HTML boundaries', () => {
  for (const [template, sections] of Object.entries(TEMPLATE_FIELDS)) {
    const dir = template === 'mediterranean' ? '' : `${template}/`;
    const html = fs.readFileSync(`${__dirname}/../public/invite/${dir}index.html`, 'utf8');
    for (const id of ['cover', 'date', 'venue', 'closing']) {
      assert.ok(sections.some(s => s.id === id && s.required), `${template}: missing required ${id}`);
      assert.ok(html.includes(`data-wc-section="${id}"`), `${template}: missing ${id} boundary`);
    }
    for (const section of sections) {
      assert.ok(section.id, `${template}: ${section.title} has no key`);
      if (section.required || ['music', 'map', 'envelope'].includes(section.id)) continue;
      assert.ok(html.includes(`data-wc-section="${section.id}"`), `${template}: missing ${section.title} boundary`);
    }
  }
});
