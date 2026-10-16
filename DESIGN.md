---
name: omp packages
description: Compatibility-first package registry with an ink-violet band and four fixed status colours.
colors:
  bg: "oklch(0.99 0.003 285)"
  surface: "oklch(0.965 0.006 285)"
  fg: "oklch(0.23 0.02 285)"
  fg-2: "oklch(0.36 0.02 285)"
  muted: "oklch(0.49 0.02 285)"
  border: "oklch(0.9 0.01 285)"
  field-border: "oklch(0.68 0.02 285)"
  accent: "oklch(0.5 0.2 292)"
  accent-fg: "oklch(0.99 0 0)"
  link: "oklch(0.47 0.19 292)"
  band: "oklch(0.25 0.07 292)"
  band-fg: "oklch(0.97 0.01 292)"
  band-muted: "oklch(0.82 0.04 292)"
  band-accent: "oklch(0.8 0.13 292)"
  native: "oklch(0.5 0.2 292)"
  native-bg: "oklch(0.95 0.035 292)"
  works: "oklch(0.5 0.13 150)"
  works-bg: "oklch(0.95 0.04 150)"
  broken: "oklch(0.52 0.19 27)"
  broken-bg: "oklch(0.95 0.03 27)"
  untested: "oklch(0.47 0.02 285)"
  untested-bg: "oklch(0.94 0.006 285)"
  dark-bg: "oklch(0.17 0.012 285)"
  dark-surface: "oklch(0.21 0.014 285)"
  dark-fg: "oklch(0.94 0.01 285)"
  dark-fg-2: "oklch(0.84 0.012 285)"
  dark-muted: "oklch(0.72 0.015 285)"
  dark-border: "oklch(0.3 0.015 285)"
  dark-field-border: "oklch(0.48 0.015 285)"
  dark-accent: "oklch(0.74 0.14 292)"
  dark-accent-fg: "oklch(0.17 0.03 292)"
  dark-link: "oklch(0.78 0.12 292)"
  dark-band: "oklch(0.13 0.03 292)"
  dark-band-fg: "oklch(0.96 0.01 292)"
  dark-band-muted: "oklch(0.78 0.03 292)"
  dark-band-accent: "oklch(0.78 0.13 292)"
  dark-native: "oklch(0.78 0.13 292)"
  dark-native-bg: "oklch(0.3 0.07 292)"
  dark-works: "oklch(0.8 0.14 150)"
  dark-works-bg: "oklch(0.29 0.05 150)"
  dark-broken: "oklch(0.76 0.15 27)"
  dark-broken-bg: "oklch(0.3 0.06 27)"
  dark-untested: "oklch(0.78 0.015 285)"
  dark-untested-bg: "oklch(0.27 0.012 285)"
typography:
  body:
    fontFamily: 'system-ui,-apple-system,"Segoe UI",Roboto,sans-serif'
    fontSize: "15px"
    lineHeight: 1.55
  headline:
    fontSize: "clamp(1.6rem,4vw,2.2rem)"
    lineHeight: 1.2
    letterSpacing: "-.02em"
  title:
    fontSize: "1.35rem"
    lineHeight: 1.2
  label:
    fontSize: ".875rem"
    fontWeight: 600
  mono:
    fontFamily: "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace"
rounded:
  inline: "4px"
  compact: "6px"
  control: "8px"
  panel: "12px"
  pill: "999px"
spacing:
  small: ".5rem"
  medium: "1rem"
  large: "1.5rem"
  section: "2rem"
  column: "3rem"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-fg}"
    rounded: "{rounded.control}"
    padding: ".65rem 1.2rem"
  button-copy:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.fg-2}"
    rounded: "{rounded.compact}"
    padding: ".4rem .7rem"
  input-field:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.fg}"
    rounded: "{rounded.control}"
    padding: ".55rem .7rem"
  pill-works:
    backgroundColor: "{colors.works-bg}"
    textColor: "{colors.works}"
    rounded: "{rounded.pill}"
    padding: ".3rem .55rem .3rem .4rem"
  box:
    backgroundColor: "{colors.bg}"
    rounded: "{rounded.panel}"
    padding: "1.1rem 1.2rem"
---

# Design System: omp packages

## Overview

**Creative North Star: "Registry canon"**

An ink-violet search band above a cool-neutral, dense package registry. Compatibility is explicit in list rows and leads the package detail view; the interface uses familiar registry structure rather than a card grid. Source of truth: the direction contract, markup, CSS, and copy-state script in `src/views.ts`.

**Key Characteristics:**
- Central search, status facets, and divided list rows.
- Four consistent status colours, supported by text and Lucide SVG icons.
- System sans typography; monospace for code and versions.

## Colors

Frontmatter records the CSS custom properties exactly: unprefixed keys are light mode; `dark-` keys replace the same property under `prefers-color-scheme: dark`. These are theme alternatives, not additional accents. Both modes set `color-scheme`; there is no manual theme control.

### Primary

Violet `accent` colours search and submit buttons, caret, selection, and focus; `accent-fg` provides their contrasting foreground. `link` colours ordinary links. The ink-violet `band` has its own foreground, muted navigation, and accent for the brand icon and focus.

### Neutral

`bg` is the page, field, copy-button, and box background; `surface` supplies subdued grouping, hover fills, command backgrounds, and code blocks. `fg` is main text, `fg-2` descriptive text, and `muted` metadata. `border` divides content; stronger `field-border` outlines copy controls and report fields. Dark-mode search uses `surface` instead of `bg`.

**The Fixed Status Rule.** Built for omp (`native`) is violet with a badge icon; works is green with a circled check; broken is red with a circled x; untested is grey with a circled question mark. Each status has its own foreground and background token. The same pair powers pills, verdicts, and checked report choices; facets use the status foreground for icons, and the tally uses green/red foregrounds. Colour never replaces the written status.

## Typography

The base is the frontmatter's system-sans body role. There is no separate display face or fixed modular ratio. Headings share balanced wrapping and the recorded heading line-height. Monospace applies to code, preformatted blocks, versions, and explicit mono fields; report version input uses `ui-monospace,SFMono-Regular,Menlo,monospace`. Numeric counts and metadata use tabular figures.

- Package headline: responsive `headline`; version beside it (1rem, weight 500).
- Prose headline: (2rem), tracking (-.02em); prose section headings (1.2rem).
- Verdict heading: `title`; report headings and lead text (1.1rem).
- Package row name: (1.05rem, weight 650); version (.82rem).
- Facet and sidebar headings: (.95rem); facet heading weight (600).
- Metadata, copy text, footer, and report timestamps: (.85rem). Sort and field labels: (.875rem); field labels weight (600).
- Status pills: (.75rem, weight 600, line-height 1); keyword tags (.8rem).
- Description measure: (75ch), clamped to two lines in rows. Lead and report-note measure: (70ch); prose paragraphs (68ch).

## Layout

Centred full-width wrapper, maximum (1160px), horizontal padding (1.5rem). The band wrapper is flex with a (2rem) gap and minimum height (68px). Main padding is (2.25rem 0 4rem). The recurring spacing steps are recorded in frontmatter; component-specific values below are observed dimensions, not an invented spacing scale.

Catalog grid: (232px minmax(0,1fr)) with (3rem) gap. Facets stick at (1.5rem) from the top. Detail grid: (minmax(0,1fr) 320px), also with (3rem) gap. Sidebar boxes stack with (1rem) gaps. Prose wrapper maximum is (760px). The body is a minimum-viewport-height flex column; main grows above the footer.

- At widths ≤900px: catalog becomes one column with (1.5rem) gap. Facets become static, wrapping pill links with (.4rem) gaps; their heading is visually hidden. Links gain a border, full rounding, and (.4rem .75rem) padding; explanatory note becomes (.8rem). Detail becomes one column with (2rem) gap: summary first, install second, report form and reports next, remaining sidebar boxes last, using `display:contents` and ordering.
- At widths ≤640px: wrapper padding becomes (1rem); band wraps with (.75rem 1rem) gap and (.75rem) vertical padding. Search moves to a full-width final row; navigation gap becomes (1rem). Main top padding becomes (1.5rem). Row gap becomes (.75rem); row copy padding becomes (.45rem) and its text is visually hidden. Report choice labels lose their (220px) maximum width.
- Names and command text wrap anywhere; row headers and metadata wrap. Toolbar and form footer wrap. Preformatted prose scrolls horizontally.

## Elevation & Depth

Predominantly flat: separation comes from borders, tonal fills, and space, not lifted cards. The selected sort segment uses `--shadow`: light (`0 1px 2px oklch(0.2 0.02 285/0.06),0 4px 12px oklch(0.2 0.02 285/0.05)`); dark (`0 1px 2px oklch(0 0 0/0.3),0 4px 12px oklch(0 0 0/0.25)`). Selected facets use an inset (1px) border shadow. Search and field focus use accent-coloured rings, not ambient elevation.

## Shapes

Small inline-code corners use `inline`; copy, sort segments, desktop facets, and the search button use `compact`; search, fields, report choices, primary submit, commands, and sort groups use `control`; verdict and sidebar boxes use `panel`; status pills, tags, and mobile facets use `pill`. Structural borders are (1px). Lucide icons use a (24px) viewBox and (2px) rounded strokes; typical sizes are (14–16px), with (18px) search, (22px) brand, and (28px) verdict icons.

## Components

### Band and search

Dark ink-violet band; brand is (1.1rem, weight 700) with (-.01em) tracking. Navigation is muted, undecorated, weight (500); hover/current becomes band foreground. Search flexes to a maximum (600px), with (.5rem) inner gap and (.8rem) left padding. Its border uses band foreground at (.22) alpha. Input padding is (.65rem 0); submit uses (.5rem 1rem) padding and (.25rem) margin, weight (600). Focus-within changes border to accent and adds a (3px) accent ring at (.35) alpha; shadow transition is (.2s cubic-bezier(.16,1,.3,1)).

### Facets and sort

Facet links have (.5rem .65rem) padding and (.6rem) gap; counts align right in muted tabular type. Hover fills with surface; current adds weight (600), the same fill, and the inset border. Sort is a surface-filled segmented group with (3px) padding and (.25rem) gap; segments use (.3rem .7rem) padding. Hover raises foreground contrast; current uses page background, main foreground, and the theme shadow. Selection is expressed by `aria-current`.

### Package rows and pills

Rows are flex, top-aligned, separated by a bottom border, with (1.15rem 0) padding and (1.5rem) gap. Name, version, and pill share a wrapping header; name hover turns link-coloured and underlined. Descriptions use secondary foreground; author, downloads, and date share muted icon metadata. One trailing copy action installs the package. Pills pair a (14px) status icon with the status text, (.3rem) gap, and the recorded fully rounded padding.

### Verdict and tally

Verdict is a status-background panel with (1.25rem 1.4rem) padding and (1rem) gap; icon and heading use status foreground, explanation uses main foreground. Inline code is tinted from status foreground at (.12) alpha. A tally appears only when reports exist: flex segments proportional to works/broken counts, (8px) height, (3px) gap, full rounding, and (1.25rem) top margin. Its legend uses coloured icons, counts, weight (600), and (.875rem) text; the bar has an accessible count label.

### Report form and reports

Form starts after (2.5rem), with a top border and (2rem) top padding. Two required-result radio choices share the row with (.75rem) gap; each grows to maximum (220px), uses (.7rem 1rem) padding, and shows a status icon. Hover fills surface; checked adds status border, fill, and text; focused radio outlines its label in accent. Fields stack with (1rem) gap, maximum (560px); labels have (.35rem) gap. Version input is capped at (220px); notes can resize vertically and have minimum height (5rem). Field focus changes border and adds a (3px) accent ring at (.25) alpha. Submit uses the recorded primary tokens, weight (600), and hover brightness (1.1), transitioning filter (.15s). Fields have no custom disabled/error treatment in this implementation; native required validation handles the result choice. Reports are bordered rows, with pill, muted version/time, and full-width pre-line notes; no reports renders quiet text.

### Install box and copy button

Sidebar boxes have border and recorded box padding. Install contains a surface command strip, (.5rem) gap, and (.35rem .35rem .35rem .75rem) padding. Code is (.82rem), line-height (1.5), with (.3rem 0) padding; the muted dollar prompt is unselectable. Its copy control uses (.35rem .55rem) padding.

Copy controls have field-border strokes, (.4rem) icon/text gap, weight (500), and (.15s) background/border/colour transitions. Hover uses surface/main foreground. Successful clipboard write switches to green border/text/background, check icon, and “Copied”; failure switches to red border/text and “Copy failed”. Both announce through a polite live region and reset after (1600ms). Each has an explicit command-bearing accessible label.

### Shared interaction and empty states

Global focus-visible is a (2px) accent outline, (2px) offset, and (4px) radius; within the band its colour is band accent. Ordinary links increase underline thickness from (1px) to (2px) on hover. Reduced-motion preference disables all transitions. No-match results show a heading and recovery text within (60ch), padded (3rem 0), rather than empty rows. Pagination is previous/page/next with unavailable directions omitted. No custom loading, skeleton, or generic disabled state is built.

## Do's and Don'ts

### Do:
- **Do** retain the fixed status foreground/background pairing, icon, and readable label across list and detail views.
- **Do** use borders and tonal grouping for the registry, reserving the theme shadow for selected sort segments.
- **Do** retain visible keyboard focus and accessible text when mobile copy labels are visually hidden.

### Don't:
- **Don't** treat untested as broken: its grey treatment is intentionally neutral.
- **Don't** replace the catalog's dense divided rows with download-first ranking cards.
- **Don't** introduce a separate display face: the built system uses system sans, with monospace for code and versions.
