// Run after npm --prefix backend run build. Previews and paid PDFs share a renderer.
const fs = require('node:fs');
const path = require('node:path');
const { PRINT_TEMPLATES, getPrintSample, renderPrintSvg } = require('../backend/dist/lib/printDesign');
const destination = path.join(__dirname, '../frontend/public/print');
fs.mkdirSync(destination, { recursive: true });
for (const template of PRINT_TEMPLATES) fs.writeFileSync(path.join(destination, `${template.id}.svg`), renderPrintSvg(template.id, getPrintSample(template.id), true));
