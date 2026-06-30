---
name: canva-to-code
description: >
  Convert Canva designs into pixel-perfect HTML + CSS code. Use this skill whenever the user wants
  to turn a Canva design, page, or component into front-end code — even if they say "export to code",
  "build this from Canva", "transfer this design to HTML", "make a site from my Canva", or simply
  paste a Canva URL. Also use when the user wants to reproduce a design they describe as being "from
  Canva" or when they upload a PNG/screenshot of a Canva design and ask to code it.
  Stack: HTML + CSS (no framework). Output is a single .html file with embedded styles.
---

# Canva → Code Skill

Converts a Canva design to a single HTML file with embedded CSS.

## Step 0 — Identify the design

Need the Design ID (11 chars, starts with D).

| What the user gives | What to do |
|---|---|
| Full URL canva.com/design/DABcXxXxXxX/... | Extract ID from URL |
| PNG only | Skip Steps 1–2, go PNG-only mode |

## Step 1 — Read the design structure

Call start-editing-transaction with design_id. Gets:
- richtexts — all text with font, size, weight, color, alignment, position
- fills — backgrounds, image fills, colors per element

After reading — immediately call cancel-editing-transaction. Never commit.

## Step 2 — Export PNG reference

Call export-design: format type=png, export_quality=pro.
This PNG is visual ground truth for QA. Not for guessing spacing.

## Step 3 — Build token map

Before writing any code, build this from extracted data:

COLORS
  --color-bg, --color-surface, --color-text, --color-text-muted, --color-accent, --color-border

TYPOGRAPHY
  --font-display, --font-body
  --text-hero, --text-h1, --text-h2, --text-body, --text-caption
  (size / weight / line-height for each)

SPACING — infer from PNG
  --space-xs:4px  --space-sm:8px  --space-md:16px  --space-lg:32px  --space-xl:64px

SHAPE — infer from PNG
  --radius-sm:4px  --radius-md:8px  --radius-lg:16px  --radius-pill:9999px

Color channels from Canva are 0–1 floats. Convert to hex:
  hex = '#' + [r,g,b].map(n => Math.round(n*255).toString(16).padStart(2,'0')).join('')

## Step 4 — Write the HTML + CSS

Single .html file. All CSS in style block in head. No external dependencies except Google Fonts.

Rules:
- Every magic number must come from a token. No bare #fff or 24px in component CSS.
- position: absolute for each element with exact top/left from Canva JSON data.
- Container: width matching Canva canvas width, position:relative, background from tokens.
- One class per visual component: .hero, .nav, .card, .cta-button
- No !important
- Responsive: clamp() for fluid type, mobile-first

For images — if not provided use placeholder div:
  background: var(--color-surface); with correct aspect ratio from Canva dimensions

For SVG icons — if provided by user, place in assets/ and reference with img src.
If not provided — use placeholder div with aria-label describing the icon.

Canva font → Google Fonts mapping:
  Canva Sans → Inter
  Canva Display → Plus Jakarta Sans
  DM Sans, Lato, Raleway, Montserrat, Poppins → same name on Google Fonts

## Step 5 — QA checklist

Compare generated HTML against PNG reference:
- [ ] Background color matches
- [ ] All text content present
- [ ] Font sizes proportionally correct
- [ ] Font weights match
- [ ] Text colors match
- [ ] Button/CTA color and shape matches
- [ ] Spacing between sections proportional
- [ ] No horizontal scroll on desktop
- [ ] No broken layout on mobile (375px)

Fix everything before delivering.

## Step 6 — Save file

Save to: frontend/public/invite/[design-name]/index.html
Assets to: frontend/public/invite/[design-name]/assets/

Tell user:
- URL to open: localhost:3000/invite/[design-name]/
- Which fonts were substituted
- Which images still need to be added
