const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, filename);
};
const { canResumeDraft, readGuestDraft } = require('../src/lib/editor-draft.ts');

test('a remembered draft from a different design cannot replace Garden Evening', () => {
  assert.equal(canResumeDraft({ id: 'old', templateId: 'dark', status: 'draft' }, 'garden-evening'), false);
  assert.equal(canResumeDraft({ id: 'same', templateId: 'garden-evening', status: 'draft' }, 'garden-evening'), true);
});
test('published invitations cannot be reopened implicitly as a new draft', () => {
  for (const status of ['paid', 'published']) {
    assert.equal(canResumeDraft({ templateId: 'garden-evening', status }, 'garden-evening'), false);
  }
});
test('guest recovery keeps matching content and rejects other designs', () => {
  const draft = { templateId: 'garden-evening', groomName: 'Иван', customData: { greeting: 'Привет' } };
  assert.deepEqual(readGuestDraft(JSON.stringify(draft), 'garden-evening'), draft);
  assert.deepEqual(readGuestDraft(JSON.stringify(draft), 'calla'), {});
});
test('invalid storage does not break editor initialization', () => {
  for (const raw of [null, '', '{', 'null', '[]', '42', '{}']) {
    assert.deepEqual(readGuestDraft(raw, 'garden-evening'), {});
  }
});
