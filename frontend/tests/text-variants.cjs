const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const { TEMPLATE_FIELDS, TEMPLATE_DEFAULTS } = require('../src/lib/constants.ts');
const { TEXT_VARIANTS, TEXT_TONES, textVariantsFor, isUpperCaseText } = require('../src/lib/text-variants.ts');

// Тот же лимит, что у поля в редакторе (SchemaFieldRenderer): без maxLength — 300 знаков
const AREA_MAX = 300;

const fieldsWithVariants = () => {
  const out = [];
  for (const [tpl, sections] of Object.entries(TEMPLATE_FIELDS)) {
    for (const s of sections) for (const f of s.fields) {
      if (f.type === 'textarea' && TEXT_VARIANTS[f.id]) out.push({ tpl, field: f });
    }
  }
  return out;
};

test('every long text field of every template offers 5–8 variants of all three tones', () => {
  const found = fieldsWithVariants();
  assert.ok(found.length >= 30, `полей с вариантами слишком мало: ${found.length}`);
  for (const { tpl, field } of found) {
    const list = textVariantsFor(field.id, { maxLength: field.maxLength ?? AREA_MAX, weddingDate: '2027-06-12' });
    const where = `${tpl}.${field.id} (лимит ${field.maxLength ?? AREA_MAX})`;
    assert.ok(list.length >= 5 && list.length <= 8, `${where}: ${list.length} вариантов`);
    for (const tone of TEXT_TONES) assert.ok(list.some(v => v.tone === tone.id), `${where}: нет тона «${tone.one}»`);
  }
});

test('variants are unique, trimmed and never longer than the tightest template frame', () => {
  for (const [id, list] of Object.entries(TEXT_VARIANTS)) {
    const texts = list.map(v => v.text);
    assert.equal(new Set(texts).size, texts.length, `${id}: повтор`);
    for (const t of texts) assert.equal(t, t.trim(), `${id}: пробелы по краям`);
  }
  for (const { tpl, field } of fieldsWithVariants()) {
    const max = field.maxLength ?? AREA_MAX;
    for (const v of TEXT_VARIANTS[field.id]) {
      assert.ok(v.text.replace('{{rsvpDate}}', '00.00.00').length <= max, `${tpl}.${field.id}: «${v.text.slice(0, 40)}…» длиннее ${max}`);
    }
  }
});

test('survey variants carry the couple’s own reply deadline', () => {
  const list = textVariantsFor('surveyText', { weddingDate: '2027-06-12' });
  assert.ok(list.length > 0);
  for (const v of list) {
    assert.ok(!v.text.includes('{{'), v.text);
    assert.ok(v.text.includes('22.05.27'), v.text);   // за 3 недели до 12.06.27
  }
});

test('upper-case templates get upper-case variants, others stay as written', () => {
  const floral = TEMPLATE_DEFAULTS.floral;
  assert.ok(isUpperCaseText(floral.inviteText));
  assert.ok(!isUpperCaseText(TEMPLATE_DEFAULTS.tenderness.inviteText));
  const upper = textVariantsFor('inviteText', { upperCase: true });
  assert.ok(upper.every(v => v.text === v.text.toLocaleUpperCase('ru-RU')));
  assert.deepEqual(textVariantsFor('heroText'), []);
});
