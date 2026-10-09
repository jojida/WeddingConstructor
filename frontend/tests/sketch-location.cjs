const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const { SKETCH_DEMO_VENUE, SKETCH_LEGACY_LOCATION, SKETCH_LOCATION_TEXT, withSketchLocation } = require('../src/lib/sketch-location.ts');

test('old Sketch text gives way to the venue the couple entered', () => {
  const draft = { venue: 'Артурс Спа Отель', customData: { locationText: SKETCH_LEGACY_LOCATION, plaqueTheme: 'mint' } };
  const next = withSketchLocation(draft);
  assert.equal(next.venue, 'Артурс Спа Отель');
  assert.equal(next.customData.locationText, SKETCH_LOCATION_TEXT);
  assert.equal(next.customData.plaqueTheme, 'mint');
});

test('without a venue the old demo place stays, so the invitation looks as before', () => {
  const next = withSketchLocation({ venue: '  ', customData: { locationText: SKETCH_LEGACY_LOCATION } });
  assert.equal(next.venue, SKETCH_DEMO_VENUE);
  assert.equal(next.customData.locationText, SKETCH_LOCATION_TEXT);
});

test('own text is never touched', () => {
  const draft = { venue: '', customData: { locationText: 'Ждём вас в саду' } };
  assert.equal(withSketchLocation(draft), draft);
  const empty = { venue: 'Дом', customData: {} };
  assert.equal(withSketchLocation(empty), empty);
});
