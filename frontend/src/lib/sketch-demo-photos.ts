export const SKETCH_DEMO_PHOTOS = {
  groomPhoto: {
    originalUrl: '/invite/sketch/assets/photo-groom.webp',
    resultUrl: '/invite/sketch/assets/photo-groom-cutout.png',
  },
  bridePhoto: {
    originalUrl: '/invite/sketch/assets/photo-bride.webp',
    resultUrl: '/invite/sketch/assets/photo-bride-cutout.png',
  },
} as const;

export const SKETCH_DEMO_DEFAULTS = {
  groomPhoto: SKETCH_DEMO_PHOTOS.groomPhoto.resultUrl,
  bridePhoto: SKETCH_DEMO_PHOTOS.bridePhoto.resultUrl,
  photoCutouts: SKETCH_DEMO_PHOTOS,
  __sketchDemoPhotos: 1,
};

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

/** Update untouched demo photos once; preserve uploads, crops and later restores. */
export function withSketchDemoPhotos(customData: Record<string, unknown>): Record<string, unknown> {
  if (customData.__sketchDemoPhotos === 1) return customData;
  const next: Record<string, unknown> = { ...customData, __sketchDemoPhotos: 1 };
  const cutouts = { ...record(customData.photoCutouts) };
  let changed = false;
  for (const [id, demo] of Object.entries(SKETCH_DEMO_PHOTOS)) {
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
