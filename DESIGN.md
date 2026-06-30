---
name: Ethereal Union
colors:
  surface: '#f5faff'
  surface-dim: '#ccdce9'
  surface-bright: '#f5faff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#e9f5ff'
  surface-container: '#e0f0fd'
  surface-container-high: '#daeaf7'
  surface-container-highest: '#d5e5f1'
  on-surface: '#0e1d26'
  on-surface-variant: '#4b463d'
  inverse-surface: '#23323c'
  inverse-on-surface: '#e4f3ff'
  outline: '#7d766c'
  outline-variant: '#cec5ba'
  surface-tint: '#685d4a'
  primary: '#685d4a'
  on-primary: '#ffffff'
  primary-container: '#f7e7ce'
  on-primary-container: '#726753'
  inverse-primary: '#d3c5ad'
  secondary: '#7c5454'
  on-secondary: '#ffffff'
  secondary-container: '#ffcaca'
  on-secondary-container: '#7b5353'
  tertiary: '#56642b'
  on-tertiary: '#ffffff'
  tertiary-container: '#dff1a9'
  on-tertiary-container: '#606e34'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#f0e0c8'
  primary-fixed-dim: '#d3c5ad'
  on-primary-fixed: '#221b0b'
  on-primary-fixed-variant: '#4f4533'
  secondary-fixed: '#ffdad9'
  secondary-fixed-dim: '#edbaba'
  on-secondary-fixed: '#2f1314'
  on-secondary-fixed-variant: '#613d3d'
  tertiary-fixed: '#d9eaa3'
  tertiary-fixed-dim: '#bdce89'
  on-tertiary-fixed: '#161f00'
  on-tertiary-fixed-variant: '#3e4c16'
  background: '#f5faff'
  on-background: '#0e1d26'
  surface-variant: '#d5e5f1'
typography:
  display-lg:
    fontFamily: Playfair Display
    fontSize: 64px
    fontWeight: '400'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Playfair Display
    fontSize: 40px
    fontWeight: '400'
    lineHeight: '1.2'
  headline-lg-mobile:
    fontFamily: Playfair Display
    fontSize: 32px
    fontWeight: '400'
    lineHeight: '1.2'
  headline-md:
    fontFamily: Playfair Display
    fontSize: 24px
    fontWeight: '500'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0.1em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 8px
  margin-mobile: 20px
  margin-desktop: 80px
  gutter: 24px
  section-gap: 120px
---

## Brand & Style

The design system is centered on the concept of "Refined Intimacy." It targets couples seeking a sophisticated, stress-free creative process for their wedding stationery. The UI must evoke feelings of grace, celebration, and premium craftsmanship.

The chosen style is **Modern Minimalism with an Editorial Edge**. It leverages expansive whitespace, high-quality photography, and intentional typographic hierarchies to create a sense of calm and luxury. Visual interest is maintained through delicate, high-contrast borders and subtle, translucent overlays that mimic the tactile quality of vellum or fine stationery.

## Colors

The palette is inspired by natural wedding elements: champagne silk, pressed petals, and botanical stems.

*   **Primary (Champagne - #F7E7CE):** Used for large surface areas, background sections, and primary action containers to maintain a warm, inviting glow.
*   **Secondary (Dusty Rose - #D4A3A3):** Reserved for highlights, active states, and soft accents that draw the eye to romantic details.
*   **Tertiary (Sage Green - #8A9A5B):** Used for success states, secondary interactive elements, and botanical-themed UI accents.
*   **Neutral (Charcoal - #36454F):** Provides the necessary contrast for legibility. This replaces pure black to ensure the interface feels grounded but not harsh.
*   **Surface:** Use a tinted white (#FCFAF7) for main content areas to prevent screen fatigue and maintain the "paper" aesthetic.

## Typography

Typography is the cornerstone of this design system, mimicking the contrast found in high-end editorial magazines.

*   **Serif (Playfair Display):** Used for all headlines and display text. It should be typeset with generous leading to feel airy. 
*   **Sans-Serif (Plus Jakarta Sans):** Selected for its modern, clean curves that complement the serif's elegance. It ensures high legibility for functional tasks like form filling and instruction reading.
*   **Styling Note:** Display headings should occasionally use *italic* variants for emphasis or to denote a "handwritten" sentiment. Labels should always be uppercase with increased letter spacing to provide a sophisticated, architectural feel to the functional UI.

## Layout & Spacing

This design system utilizes a **Fixed-Fluid Hybrid Grid**. On desktop, content is centered within a 1280px max-width container, while background elements bleed to the edges.

*   **Rhythm:** An 8px baseline grid ensures vertical consistency. 
*   **Negative Space:** Use aggressive "section-gaps" (120px+) to separate different phases of the builder experience, ensuring the user never feels overwhelmed.
*   **Mobile:** Transition to a single-column layout with 20px side margins. Horizontal scrolling "carousels" should be used for template browsing to save vertical space.

## Elevation & Depth

Depth is achieved through **Tonal Layers and Glassmorphism** rather than traditional heavy shadows.

*   **The Vellum Effect:** Modal windows and floating panels use a backdrop blur (12px) with a 70% white opacity fill, mimicking semi-transparent paper.
*   **Soft Casting:** When shadows are necessary for interactive cards, use a very large blur (30px+) with a low-opacity (5%) Charcoal tint. 
*   **Hairline Borders:** Use 0.5pt or 1pt borders in #D4A3A3 at 30% opacity to define boundaries without adding visual weight.

## Shapes

The shape language is **Soft and Sophisticated**. 

Avoid sharp 90-degree corners to maintain the romantic feel, but also avoid fully "pill-shaped" buttons which can feel too casual or "tech-heavy." The 0.25rem (Soft) base roundedness provides a subtle nod to premium stationery card-stock corners. 

Use circular shapes exclusively for avatars or decorative floral frame "portals."

## Components

*   **Primary Buttons:** Use a solid Charcoal background with White text for maximum authority. Apply a subtle 1px inset border in a lighter tint to give a "pressed" paper effect.
*   **Secondary Buttons:** Outlined in Charcoal or Dusty Rose with a transparent background.
*   **Input Fields:** Minimalist design—only a bottom border in #36454F (20% opacity). On focus, the border transitions to a solid Dusty Rose with a soft Champagne glow.
*   **Cards (Template Selection):** Use a "floating" style with no border. On hover, apply a very soft Charcoal shadow and scale the image by 2%.
*   **Chips/Tags:** Used for "Wedding Style" filters (e.g., *Boho*, *Classic*). Use a sage-tinted background with Sage Green text and no border.
*   **The "Florals" Accent:** Include a decorative component class for SVG floral ornaments that can be anchored to the top-left or bottom-right of cards and sections.