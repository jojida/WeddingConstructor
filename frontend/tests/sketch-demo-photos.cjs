const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const { SKETCH_DEMO_PHOTOS: demo, withSketchDemoPhotos } = require('../src/lib/sketch-demo-photos.ts');

test('old demo photos upgrade once and keep originals for restoration', () => {
  const old = { groomPhoto: demo.groomPhoto.originalUrl, bridePhoto: demo.bridePhoto.originalUrl, groomCaption: 'Мой текст' };
  const updated = withSketchDemoPhotos(old);
  assert.equal(updated.groomPhoto, demo.groomPhoto.resultUrl);
  assert.equal(updated.bridePhoto, demo.bridePhoto.resultUrl);
  assert.equal(updated.groomCaption, old.groomCaption);
  assert.equal(updated.photoCutouts.groomPhoto.originalUrl, old.groomPhoto);
  assert.equal(old.groomPhoto, demo.groomPhoto.originalUrl);
  assert.equal(withSketchDemoPhotos({ groomPhoto: '/invite/sketch/assets/polaroid-groom.png' }).groomPhoto, demo.groomPhoto.resultUrl);
  const restored = { ...updated, groomPhoto: demo.groomPhoto.originalUrl, photoCutouts: { bridePhoto: updated.photoCutouts.bridePhoto } };
  assert.equal(withSketchDemoPhotos(restored), restored, 'a later restore must stay restored');
});

test('uploads, deleted photos and custom crops stay unchanged', () => {
  const own = { groomPhoto: '/uploads/my-photo.png', bridePhoto: '', photoCutouts: { groomPhoto: { resultUrl: '/uploads/my-photo.png', originalUrl: '/uploads/original.jpg' } } };
  const next = withSketchDemoPhotos(own);
  assert.equal(next.groomPhoto, own.groomPhoto);
  assert.equal(next.bridePhoto, '');
  assert.equal(next.photoCutouts, own.photoCutouts);
  const cropped = { groomPhoto: demo.groomPhoto.originalUrl, photoFrames: { groomPhoto: { z: 2 } } };
  assert.equal(withSketchDemoPhotos(cropped).groomPhoto, cropped.groomPhoto);
});

test('hair cleanup refreshes an old cutout without undoing a restored original', () => {
  const previousUrl = '/invite/sketch/assets/photo-bride-cutout.png';
  const old = { __sketchDemoPhotos: 1, bridePhoto: previousUrl, groomPhoto: demo.groomPhoto.originalUrl,
    photoCutouts: { bridePhoto: { originalUrl: demo.bridePhoto.originalUrl, resultUrl: previousUrl } },
    photoFrames: { bridePhoto: { z: 1.2 } } };
  const updated = withSketchDemoPhotos(old);
  assert.equal(updated.bridePhoto, demo.bridePhoto.resultUrl);
  assert.equal(updated.photoCutouts.bridePhoto.resultUrl, demo.bridePhoto.resultUrl);
  assert.equal(updated.photoCutouts.bridePhoto.originalUrl, demo.bridePhoto.originalUrl);
  assert.equal(updated.photoFrames, old.photoFrames);
  assert.equal(updated.groomPhoto, old.groomPhoto);
  assert.equal(withSketchDemoPhotos({ __sketchDemoPhotos: 1, bridePhoto: demo.bridePhoto.originalUrl }).bridePhoto, demo.bridePhoto.originalUrl);
});
