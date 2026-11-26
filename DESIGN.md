---
name: "duinlab-today"
description: "A daily paper for The Hague with pictures, sourced facts, weather, a quiz and web games, under a sky that follows the real sun."
colors:
  ink: 'light-dark(#1d1a26, #f1eef8)'
  mute: 'light-dark(#585164, #c4c5de)'
  lit: 'light-dark(#c2410c, #ff9f5a)'
  lit-text: 'light-dark(#9a3412, #ffc493)'
  sky-text: '#fff'
typography:
  body:
    fontFamily: 'Literata, Georgia, serif'
    fontSize: '1rem'
    lineHeight: 1.55
  label:
    fontFamily: 'Barlow Semi Condensed, Arial Narrow, sans-serif'
    fontSize: '0.8125rem'
    fontWeight: 600
    letterSpacing: '0.14em'
---

# Design System: duinlab-today

## Overview

A finite morning paper for a household in The Hague, open to anyone. Preserve its living
sky, dune horizon, sourced images and quiet editorial rules. The paper is Read; the image
itself is Experience, with the controls supporting it. [PRODUCT.md](PRODUCT.md) holds product constraints.
The tokens above are the `--ink`, `--mute`, `--lit` and `--lit-text` variables in `src/styles/global.css`, which stay the source.

## Colors

The sky's four stops and ground come from sun altitude in sky.ts; do not freeze them into a
single palette. Ground determines light/dark ink. Orange (`lit`) means played games; quiz answers use
ink. White occasion text keeps the same readable foreground role as the date. Rules are ink
mixed at 16%; secondary ground is ink mixed at 5%. Keep source credits legible in both grounds.

## Typography

Self-host Literata regular/italic for reading, Barlow Semi Condensed 500/600 for labels,
controls, credits and numerals. Use tabular numerals for weather, times and counts. Body text
stays 1rem when compacting the desktop. Source credits wrap with long names. Explicit spaces
at Astro inline boundaries are content, rather than a margin-only substitute.

## Layout

The paper leads on phones: pictures, facts/word/quiz, article, history, quote, games. At 1100px
it becomes image/article, reading, game rail. Recipes and local events follow, paired from
900px. The container tops out at 1320px, with 16px gutters and 32px from 700px.

At short desktop heights, history/quote follow the main paper. At 640px and below, use tighter
section spacing and a 40px horizon band; game hit areas stay 44px. Typical content fits at
1280×600, while unusually long daily content can scroll. Do not clip reading to force a fit.

## Elevation & Depth

The paper stays flat with editorial rules. The almanac floats above a dimmed sky. The viewer
uses the page's own ground and a sky-toned backdrop. No cards, frosted glass or decorative depth.

## Shapes

Round sky bodies and game marks reflect their subjects. Picture selectors are 8px circles
inside 44px buttons. Keep the artwork rectangular, uncropped and contained.

## Components

Pictures retain a stable image frame. The chosen exhibition-plate arrangement places browsing
controls below the caption; reserve 44px inside the existing image-plus-controls height budget.
Touch browsing uses swipe or dots; fine-pointer arrows appear where their labels fit. The image
link hints on hover/focus and opens originals in a viewer, with preview fallback and source links.
NASA leads when available; its official feed recovers the API's current logo-placeholder failure.

The almanac places the selected object's real, live node first, followed by Sun and moon,
Planets tonight and At Scheveningen groups. Restore original group order on the next selection.
Planet names and observing windows align without turning facts into cards.

Games mark on opening, with browser-local streaks and no undo. About explains this directly.
The quiz's existing dawn glow, score, review and end-of-paper line are the quiet completion
moment; retain them without additional choreography. Reduced-motion preferences stop animation.

## Do's and Don'ts

Preserve source credits, all ten games, keyboard focus restoration, no-JavaScript reading and
missing-source resilience. Validate day-specific feeds; never replace a missing daily item with
yesterday's. Do not invent alt descriptions, hide facts, add accounts, or create a component
library for a few similar selectors. No equivalent pattern needed extraction in this pass.
