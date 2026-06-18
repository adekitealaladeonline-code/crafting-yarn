# Crafting Yarn — 2026 redesign

A from-scratch, editorial rebuild of [craftingyarn.com](https://www.craftingyarn.com) — the handmade
crochet store by **Freda** (plushies, bags, knit-look clothing & accessories, based in the UAE).

This is a fast, dependency-free **static site** (HTML + CSS + vanilla JS). No build step, no framework.

## What's here

```
index.html        Single-page editorial storefront
css/styles.css    Full design system (no libraries)
js/catalog.js     The live catalogue — 32 real products, real prices (AED), real categories
js/app.js         Filtering, sorting, search, quick-view modal, cart drawer, mobile nav, reveals
assets/brand/     Logo + hero image (pulled from the original site)
assets/products/  32 real product photos, optimised for web (≤1400px)
catalog.json      Source data the catalogue JS was generated from
server.js         Tiny static file server for local preview only
```

## Design notes — bold image-led storefront (ref: oreakinde.com / "By RE")

The look is modelled on the client-supplied reference **oreakinde.com**: bold, minimal-text,
photography-first handmade-fashion ecommerce.

- **Type**: a single typeface — **Bricolage Grotesque** — used everywhere (heavy uppercase
  banner titles, bold brown section headings, UI).
- **Palette**: white ground, near-black text, **terracotta `#E35D40`** (announcement bar, sale tags,
  accents) and **deep brown `#5E2816`** (display headings). The colourful crochet supplies the rest.
- **Structure**: stacked **full-bleed collection banners** (big uppercase title + white "SHOP NOW"
  box), a **"Looks you'll love"** product carousel, a clean filterable shop grid, a minimal
  image-led "Made by hand, by Freda" story split, newsletter, simple footer. Copy kept deliberately short.
- **Ecommerce details**: product cards swap to a **second photo on hover** (27/32 products), a
  **QUICK VIEW / ADD** action bar, **wishlist** hearts (localStorage), live item count + sort,
  hamburger + centered-logo header.
- All product copy, prices and imagery are the brand's own — only the design is new.

## Run locally

```bash
node server.js          # serves on http://localhost:5599
# or
python3 -m http.server 5599   # run from inside this folder
```

Then open <http://localhost:5599>.

## Notes for going live

- The cart is a front-end demo (persists to `localStorage`); wire `Checkout` to a real
  payment/Wix Stores / Shopify backend before launch.
- The newsletter form validates client-side only; connect it to your email provider.
- Add real `/shipping-policy` and `/returns` pages (footer links are placeholders).
