export const SKETCH_DEMO_PHOTOS = {
  groomPhoto: {
    originalUrl: '/invite/sketch/assets/photo-groom.webp',
    resultUrl: '/invite/sketch/assets/photo-groom-cutout.png',
  },
  bridePhoto: {
    originalUrl: '/invite/sketch/assets/photo-bride.webp',
    resultUrl: '/invite/sketch/assets/photo-bride-cutout.png?v=hair2',
  },
} as const;

export const SKETCH_DEMO_DEFAULTS = {
  groomPhoto: SKETCH_DEMO_PHOTOS.groomPhoto.resultUrl,
  bridePhoto: SKETCH_DEMO_PHOTOS.bridePhoto.resultUrl,
  photoCutouts: SKETCH_DEMO_PHOTOS,
  __sketchDemoPhotos: 2,
};

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

/** Update untouched demo photos once; preserve uploads, crops and later restores. */
export function withSketchDemoPhotos(customData: Record<string, unknown>): Record<string, unknown> {
  if (customData.__sketchDemoPhotos === 2) return customData;
  const next: Record<string, unknown> = { ...customData, __sketchDemoPhotos: 2 };
  const cutouts = { ...record(customData.photoCutouts) };
  let changed = false;
  for (const [id, demo] of Object.entries(SKETCH_DEMO_PHOTOS)) {
    const previousCutout = demo.resultUrl.split('?')[0];
    if (previousCutout !== demo.resultUrl && customData[id] === previousCutout) {
      next[id] = demo.resultUrl;
      cutouts[id] = { ...record(cutouts[id]), ...demo };
      changed = true;
      continue;
    }
    // A restore after the first demo update must remain restored.
    if (customData.__sketchDemoPhotos === 1) continue;
    const legacyUrl = demo.originalUrl.replace('photo-', 'polaroid-').replace('.webp', '.png');
    if (customData[id] !== demo.originalUrl && customData[id] !== legacyUrl) continue;
    if (record(customData.photoFrames)[id] || cutouts[id]) continue;
    next[id] = demo.resultUrl;
    cutouts[id] = demo;
    changed = true;
  }
  if (changed) next.photoCutouts = cutouts;
  return next;
}
