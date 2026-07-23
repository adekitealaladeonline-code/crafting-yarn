/* =================================================================
   Crafting Yarn — static page generator (dev tool)
   Generates the homepage, per-product pages, the About/Contact/
   Shipping/Returns pages and the thank-you page from the editable
   sources in data/ (all managed by the CMS at /admin), so every page
   shares one header/footer/cart and never drifts out of sync.

   Editable sources:
     data/products/*.json   products (name, price, photos, stock…)
     data/homepage.json     hero, collection banners, story, newsletter
     data/settings.json     ticker, socials, footer, cart note, form id
     data/pages/*.md        About / Shipping / Returns / Contact copy
     data/pages/success.json  thank-you page copy

   Run:  node build-pages.js   (normally via `npm run build`)
   ================================================================= */
const fs = require("fs");
const path = require("path");

globalThis.window = {};
require("./js/catalog.js");
const CATALOG = window.CATALOG;

const ROOT = __dirname;
const SITE = "https://craftingyarn.com";
const money = (n) => "AED " + (Number.isInteger(n) ? n : n.toFixed(2));
const priceOf = (p) => (p.sale != null ? p.sale : p.price);
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
// editable multi-line headline -> safe HTML with <br/>
const lines = (s) => esc(String(s || "").trim()).replace(/\r?\n/g, "<br/>");
const readJSON = (rel, fallback = {}) => {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8")); } catch { return fallback; }
};
// settings lists are stored as [{text:"…"}] (CMS-friendly); accept plain strings too
const texts = (arr, fallback) => {
  const out = (Array.isArray(arr) ? arr : []).map((t) => (typeof t === "string" ? t : t && t.text)).filter(Boolean);
  return out.length ? out : fallback;
};

/* ---------- editable site data ---------- */
const S = readJSON("data/settings.json");
const HOME = readJSON("data/homepage.json");
const TICKER_MSGS = texts(S.ticker, ["Handmade with love in the UAE"]);
const IG_URL = S.instagram || "https://www.instagram.com/craftingyarn/";
const TT_URL = S.tiktok || "https://www.tiktok.com/@craftingyarn";
const handleOf = (url) => {
  const seg = String(url).replace(/\/+$/, "").split("/").pop() || "";
  const h = seg.split("?")[0];
  return h ? (h.startsWith("@") ? h : "@" + h) : "";
};
const IG_HANDLE = handleOf(IG_URL);
const TT_HANDLE = handleOf(TT_URL);
const FOOTER_BLURB = S.footerBlurb || "Handmade crochet, made with love in the UAE by Freda.";
const FOOTER_TAGLINE = S.footerTagline || "Every stitch tells a story";
const CART_HINT = S.cartHint || "Shipping calculated at checkout";
const PRODUCT_META = texts(S.productMeta, ["Crocheted by hand", "No two are ever identical", "Ships from the UAE"]);
const FORM_ID = S.formspree || "your-form-id";

/* ---------- categories (each gets its own page; no all-products page) ---------- */
const CATEGORIES = ["Bags", "Accessories"];
const catSlug = (c) => String(c).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

// Sale section — a page listing every product with a sale price. Freda edits the
// heading/intro (and can hide it) in data/sale.json via the CMS.
const SALE = (() => { try { return readJSON("data/sale.json"); } catch { return {}; } })();
const SALE_ENABLED = SALE.enabled !== false;

const catHref = (px, c) =>
  (c === "sale" || c === "Sale") ? `${px}sale.html`
  : CATEGORIES.includes(c) ? `${px}${catSlug(c)}.html`
  : `${px}index.html#featured`;
const catNav = (px, active) => {
  const chips = CATEGORIES.map(
    (c) => `<a href="${px}${catSlug(c)}.html" class="chip${c === active ? " is-active" : ""}">${esc(c)}</a>`
  );
  if (SALE_ENABLED) chips.push(`<a href="${px}sale.html" class="chip chip--sale${active === "sale" ? " is-active" : ""}">Sale</a>`);
  return `<nav class="catnav" aria-label="Shop categories">${chips.join("")}</nav>`;
};

/* ---------- shared chrome (prefix = "" for root, "../" for /product/) ---------- */
const FONT = `<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,300;12..96,400;12..96,500;12..96,600;12..96,700;12..96,800&display=swap" rel="stylesheet" />`;

const tickerRow = TICKER_MSGS.map((t) => `<span>${esc(t)}</span><i>✶</i>`).join("");
const ticker = `<div class="ticker" aria-hidden="true"><div class="ticker__track">
  ${tickerRow}
  ${tickerRow}
</div></div>`;

const socialMenuLinks = `<a class="menu__ig" href="${esc(IG_URL)}" target="_blank" rel="noopener">Instagram ${esc(IG_HANDLE)} ↗</a>
  <a class="menu__ig" href="${esc(TT_URL)}" target="_blank" rel="noopener">TikTok ${esc(TT_HANDLE)} ↗</a>`;

const header = (px) => `<header class="site-header" id="siteHeader"><div class="header__inner">
  <button class="header__menu" id="menuToggle" aria-label="Open menu" aria-expanded="false"><span></span><span></span></button>
  <a href="${px}index.html" class="brand" aria-label="Crafting Yarn home"><span class="brand__word">Crafting Yarn</span></a>
  <div class="header__actions">
    <button class="icon-btn cart-btn" id="cartToggle" aria-label="Open cart"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 8h12l-1 12H7L6 8Z"/><path d="M9 8a3 3 0 0 1 6 0"/></svg><span class="cart-count" id="cartCount">0</span></button>
  </div>
</div></header>`;

const menu = (px) => {
  const items = [
    ["index.html", "Home"],
    ["bags.html", "Bags"],
    ["accessories.html", "Accessories"],
    ...(SALE_ENABLED ? [["sale.html", "Sale"]] : []),
    ["about.html", "Our story"],
    ["contact.html", "Contact"],
  ];
  const links = items
    .map(([href, label], i) => `<a href="${px}${href}"><span>${String(i + 1).padStart(2, "0")}</span> ${label}</a>`)
    .join("\n    ");
  return `<div class="menu" id="mobileNav" hidden>
  <nav aria-label="Main">
    ${links}
  </nav>
  ${socialMenuLinks}
</div>`;
};

const footer = (px) => `<footer class="site-footer"><div class="footer__top">
  <div class="footer__brand"><p>${esc(FOOTER_BLURB)}</p></div>
  <nav class="footer__col" aria-label="Shop"><h4>Shop</h4>
    <a href="${px}bags.html">Bags</a><a href="${px}accessories.html">Accessories</a>${SALE_ENABLED ? `<a href="${px}sale.html">Sale</a>` : ""}
  </nav>
  <nav class="footer__col" aria-label="Help"><h4>Help</h4>
    <a href="${px}shipping.html">Shipping</a><a href="${px}returns.html">Returns</a><a href="${px}care.html">Care guide</a><a href="${px}about.html">Our story</a><a href="${px}contact.html">Contact</a>
  </nav>
  <nav class="footer__col" aria-label="Social"><h4>Follow</h4>
    <a href="${esc(IG_URL)}" target="_blank" rel="noopener">Instagram ↗</a>
    <a href="${esc(TT_URL)}" target="_blank" rel="noopener">TikTok ↗</a>
  </nav>
</div><div class="footer__bottom"><span>© <span id="year"></span> Crafting Yarn</span><span>${esc(FOOTER_TAGLINE)}</span></div></footer>`;

const cartDrawer = `<div class="overlay" id="overlay" hidden></div>
<aside class="cart" id="cart" aria-label="Shopping cart" aria-hidden="true">
  <div class="cart__head"><h3>Your bag</h3><button class="cart__x" id="cartClose" aria-label="Close cart">Close</button></div>
  <div class="cart__body" id="cartBody"></div>
  <div class="cart__foot" id="cartFoot">
    <div class="cart__row"><span>Subtotal</span><strong id="cartTotal">AED 0</strong></div>
    <p class="cart__hint">${esc(CART_HINT)}</p>
    <button class="btn btn--solid btn--block" id="checkoutBtn">Checkout</button>
  </div>
</aside>
<div class="toast" id="toast" role="status" aria-live="polite"></div>`;

// Quick-view modal — shared so it works on category pages too (not just the homepage).
const quickModal = `<div class="modal" id="modal" aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="modalName">
  <div class="modal__panel">
    <button class="modal__close" id="modalClose" aria-label="Close">Close</button>
    <div class="modal__media"><img id="modalImg" alt="" /></div>
    <div class="modal__info">
      <p class="modal__cat" id="modalCat"></p>
      <h3 class="modal__name" id="modalName"></h3>
      <div class="modal__price" id="modalPrice"></div>
      <p class="modal__desc" id="modalDesc"></p>
      <ul class="modal__meta">${PRODUCT_META.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
      <button class="btn btn--solid btn--block" id="modalAdd">Add to bag</button>
    </div>
  </div>
</div>`;

const scripts = (px) => `<script src="${px}js/catalog.js"></script>\n<script src="${px}js/app.js"></script>`;

function shell({ px, title, description, canonical, headExtra = "", main }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}" />
<meta name="theme-color" content="#E35D40" />
<link rel="canonical" href="${canonical}" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:type" content="website" />
<link rel="icon" type="image/png" href="${px}assets/brand/logo.png" />
${FONT}
<link rel="stylesheet" href="${px}css/styles.css" />
${headExtra}
</head>
<body>
${ticker}
${header(px)}
${menu(px)}
${main}
${footer(px)}
${cartDrawer}
${quickModal}
${scripts(px)}
</body>
</html>
`;
}

/* =================================================================
   HOMEPAGE (index.html) — fully driven by data/homepage.json
   ================================================================= */
function bannerSection(b, { hero = false } = {}) {
  const tone = b.style === "light" ? "banner--light" : "banner--dark";
  const heroCls = hero ? " banner--hero" : "";
  const inner = hero ? "banner__inner" : "banner__inner banner__inner--bl";
  const titleTag = hero ? "h1" : "h2";
  const alt = esc(b.eyebrow || String(b.title || "Crafting Yarn").split(/\r?\n/)[0]);
  const eyebrow = b.eyebrow ? `\n      <p class="banner__eyebrow">${esc(b.eyebrow)}</p>` : "";
  const href = hero ? "#featured" : catHref("", b.category); // hero -> newest carousel; banners -> their category page
  return `  <section class="banner${heroCls} ${tone}">
    <img class="banner__img" src="${esc(b.image)}" alt="${alt}" ${hero ? "" : 'loading="lazy"'}/>
    <div class="${inner}">${eyebrow}
      <${titleTag} class="banner__title">${lines(b.title)}</${titleTag}>
      <a href="${href}" class="shopnow">${esc(b.button || "Shop now")}</a>
    </div>
  </section>`;
}

// TikTok creator embed — TikTok's official widget; auto-shows her latest posts.
// Only rendered when switched on in the CMS, so the third-party script never
// loads if she turns it off.
function tiktokSection() {
  const t = HOME.tiktok || {};
  const uid = TT_HANDLE.replace(/^@/, "");
  if (t.enabled === false || !uid) return "";
  const heading = String(t.heading || "").trim();
  const h2 = heading ? `\n    <h2 class="tiktok__title">${esc(heading)}</h2>` : ""; // blank = no headline
  return `  <!-- TIKTOK -->
  <section class="tiktok${heading ? "" : " tiktok--bare"}" id="tiktok">${h2}
    <div class="tiktok__embed">
      <blockquote class="tiktok-embed" cite="${esc(TT_URL)}" data-unique-id="${esc(uid)}" data-embed-type="creator" style="max-width:780px; min-width:288px;">
        <section><a target="_blank" rel="noopener" href="${esc(TT_URL)}?refer=creator_embed">${esc(TT_HANDLE)}</a></section>
      </blockquote>
    </div>
    <script async src="https://www.tiktok.com/embed.js"></script>
  </section>`;
}

// Email sign-up box — off unless switched on in the CMS.
function newsletterSection(news) {
  if (news.enabled === false) return "";
  return `
  <!-- NEWSLETTER -->
  <section class="news" id="contact">
    <div class="news__inner">
      <h2 class="news__title">${esc(news.title || "First dibs")}</h2>
      <p class="news__copy">${esc(news.text || "")}</p>
      <form class="news__form" id="newsForm" novalidate>
        <input type="email" id="newsEmail" placeholder="Email address" aria-label="Email address" required />
        <button type="submit" class="btn btn--solid">${esc(news.button || "Join")}</button>
      </form>
      <p class="news__msg" id="newsMsg" role="status"></p>
    </div>
  </section>`;
}

function buildHomepage() {
  const hero = HOME.hero || {};
  const story = HOME.story || {};
  const news = HOME.newsletter || {};
  // story photo is optional — blank means text only, sitting on the left
  const storyImg = String(story.image || "").trim();
  const storyFigure = storyImg
    ? `
    <figure class="story__media">
      <img src="${esc(storyImg)}" alt="${esc(story.eyebrow || "Crafting Yarn")}" loading="lazy"/>
    </figure>`
    : "";
  const seoDesc = (HOME.seo && HOME.seo.description) || FOOTER_BLURB;
  const banners = (HOME.banners || []).map((b) => bannerSection(b)).join("\n\n");
  const modalMeta = PRODUCT_META.map((t) => `<li>${esc(t)}</li>`).join("\n        ");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Crafting Yarn — Handmade crochet, made with love</title>
<meta name="description" content="${esc(seoDesc)}" />
<meta name="theme-color" content="#E35D40" />
<link rel="canonical" href="${SITE}/" />

<meta property="og:title" content="Crafting Yarn — Handmade crochet" />
<meta property="og:description" content="${esc(seoDesc)}" />
<meta property="og:type" content="website" />
<meta property="og:image" content="${SITE}/${esc(hero.image || "assets/brand/hero.jpg")}" />

<link rel="icon" type="image/png" href="assets/brand/logo.png" />
<link rel="apple-touch-icon" href="assets/brand/logo.png" />

${FONT}

<link rel="stylesheet" href="css/styles.css" />
</head>
<body>

<!-- ANNOUNCEMENT -->
${ticker}

<!-- HEADER -->
<header class="site-header" id="siteHeader">
  <div class="header__inner">
    <button class="header__menu" id="menuToggle" aria-label="Open menu" aria-expanded="false">
      <span></span><span></span>
    </button>

    <a href="#top" class="brand" aria-label="Crafting Yarn home">
      <span class="brand__word">Crafting Yarn</span>
    </a>

    <div class="header__actions">
      <button class="icon-btn cart-btn" id="cartToggle" aria-label="Open cart">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 8h12l-1 12H7L6 8Z"/><path d="M9 8a3 3 0 0 1 6 0"/></svg>
        <span class="cart-count" id="cartCount">0</span>
      </button>
    </div>
  </div>
</header>

<!-- MENU OVERLAY -->
${menu("")}

<main id="top">

<!-- HERO BANNER -->
${bannerSection(hero, { hero: true })}

<!-- COLLECTION BANNERS -->
${banners}

  <!-- CAROUSEL -->
  <section class="rail" id="featured">
    <div class="rail__head">
      <h2 class="rail__title">${esc(HOME.featuredHeading || "Fresh off the hook")}</h2>
      <div class="rail__nav">
        <button class="round-btn" id="railPrev" aria-label="Scroll left">←</button>
        <button class="round-btn" id="railNext" aria-label="Scroll right">→</button>
      </div>
    </div>
    <div class="rail__track" id="railTrack"><!-- JS injects featured cards --></div>
  </section>

  <!-- STORY -->
  <section class="story${storyImg ? "" : " story--noimg"}" id="story">${storyFigure}
    <div class="story__copy">
      <p class="story__eyebrow">${esc(story.eyebrow || "Hello friend")}</p>
      <h2 class="story__title">${lines(story.title || "Made by hand.")}</h2>
      <p class="story__line">${esc(story.text || "")}</p>
      <a href="about.html" class="btn">${esc(story.button || "Read my full story")}</a>
    </div>
  </section>

${tiktokSection()}
${newsletterSection(news)}

</main>

<!-- FOOTER -->
${footer("")}

<!-- CART DRAWER -->
${cartDrawer}

<!-- QUICK VIEW MODAL -->
<div class="modal" id="modal" aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="modalName">
  <div class="modal__panel">
    <button class="modal__close" id="modalClose" aria-label="Close">Close</button>
    <div class="modal__media"><img id="modalImg" alt="" /></div>
    <div class="modal__info">
      <p class="modal__cat" id="modalCat"></p>
      <h3 class="modal__name" id="modalName"></h3>
      <div class="modal__price" id="modalPrice"></div>
      <p class="modal__desc" id="modalDesc"></p>
      <ul class="modal__meta">
        ${modalMeta}
      </ul>
      <button class="btn btn--solid btn--block" id="modalAdd">Add to bag</button>
    </div>
  </div>
</div>

<script src="js/catalog.js"></script>
<script src="js/app.js"></script>
</body>
</html>
`;
  fs.writeFileSync(path.join(ROOT, "index.html"), html);
}
buildHomepage();

/* =================================================================
   THANK-YOU PAGE (success.html) — from data/pages/success.json
   ================================================================= */
function buildSuccess() {
  const d = readJSON("data/pages/success.json");
  const main = `<main class="confirm">
  <div class="confirm__inner">
    <p class="confirm__eyebrow">${esc(d.eyebrow || "Order received")}</p>
    <h1 class="confirm__title">${lines(d.title || "Thank you.")}</h1>
    <p class="confirm__lead">${esc(d.lead || "")}</p>
    <p class="confirm__note">${esc(d.note || "")} Questions any time:
      <a href="${esc(IG_URL)}" target="_blank" rel="noopener">${esc(IG_HANDLE)}</a>.</p>
    <a href="index.html" class="btn btn--solid">${esc(d.button || "Continue shopping")}</a>
  </div>
</main>`;
  fs.writeFileSync(path.join(ROOT, "success.html"), shell({
    px: "", title: "Thank you — Crafting Yarn",
    description: "Order received — thank you for shopping handmade with Crafting Yarn.",
    canonical: `${SITE}/success.html`,
    headExtra: `<meta name="robots" content="noindex" />`,
    main,
  }));
}
buildSuccess();

/* =================================================================
   CATEGORY PAGES (bags.html, clothing.html, accessories.html)
   Each shows only its own products; the grid is filled by app.js
   (which reads #grid[data-category]). No all-products page.
   ================================================================= */
for (const cat of CATEGORIES) {
  const n = CATALOG.filter((p) => p.category === cat).length;
  const main = `<main class="shop shop--cat" id="shop">
    <div class="cat-head">
      <h1 class="cat-title">${esc(cat)}</h1>
      ${catNav("", cat)}
    </div>
    <div class="shop__bar shop__bar--cat">
      <span class="shop__count" id="gridCount">${n} ${n === 1 ? "piece" : "pieces"}</span>
      <label for="sortSelect" class="sr-only">Sort products</label>
      <select id="sortSelect">
        <option value="featured">Featured</option>
        <option value="oldest">Old to new</option>
        <option value="newest">New to old</option>
      </select>
    </div>
    <div class="grid" id="grid" data-category="${esc(cat)}"><!-- app.js injects this category's cards --></div>
    <p class="grid__empty" id="gridEmpty" hidden>Nothing here right now — check back soon.</p>
  </main>`;
  fs.writeFileSync(path.join(ROOT, `${catSlug(cat)}.html`), shell({
    px: "", title: `${cat} — Crafting Yarn`,
    description: `Handmade crochet ${cat.toLowerCase()} by Crafting Yarn — made with love in the UAE.`,
    canonical: `${SITE}/${catSlug(cat)}.html`, main,
  }));
}

/* ---------- SALE PAGE (sale.html) — lists every product with a sale price.
   app.js reads #grid[data-category="sale"] and filters to on-sale items. ---------- */
if (SALE_ENABLED) {
  const n = CATALOG.filter((p) => p.sale != null).length;
  const eyebrow = SALE.eyebrow != null ? SALE.eyebrow : "Deals";
  const heading = SALE.heading || "Sale";
  const intro = SALE.intro || "";
  const main = `<main class="shop shop--cat" id="shop">
    <div class="cat-head">
      <div class="cat-headtext">
        ${eyebrow ? `<p class="page__eyebrow">${esc(eyebrow)}</p>` : ""}
        <h1 class="cat-title">${esc(heading)}</h1>
        ${intro ? `<p class="cat-intro">${esc(intro)}</p>` : ""}
      </div>
      ${catNav("", "sale")}
    </div>
    <div class="shop__bar shop__bar--cat">
      <span class="shop__count" id="gridCount">${n} ${n === 1 ? "piece" : "pieces"}</span>
      <label for="sortSelect" class="sr-only">Sort products</label>
      <select id="sortSelect">
        <option value="featured">Featured</option>
        <option value="oldest">Old to new</option>
        <option value="newest">New to old</option>
      </select>
    </div>
    <div class="grid" id="grid" data-category="sale"><!-- app.js injects on-sale items --></div>
    <p class="grid__empty" id="gridEmpty" hidden>Nothing on sale right now — check back soon.</p>
  </main>`;
  fs.writeFileSync(path.join(ROOT, "sale.html"), shell({
    px: "", title: "Sale — Crafting Yarn",
    description: intro || "Handmade crochet on sale at Crafting Yarn — special prices, while stocks last.",
    canonical: `${SITE}/sale.html`, main,
  }));
}

/* ---------- product pages ---------- */
fs.rmSync(path.join(ROOT, "product"), { recursive: true, force: true }); // clear old pages so deleted products don't leave orphan URLs
fs.mkdirSync(path.join(ROOT, "product"), { recursive: true });
let count = 0;
const metaBullets = PRODUCT_META.map((t) => `<li>${esc(t)}</li>`).join("\n          ");
for (const p of CATALOG) {
  const px = "../";
  const sub = p.subcategory ? `${p.category} · ${p.subcategory}` : p.category;
  const off = p.sale != null ? Math.round((1 - p.sale / p.price) * 100) : 0;
  const priceHTML = p.sale != null
    ? `<span class="now">${money(p.sale)}</span><span class="was">${money(p.price)}</span><span class="off">−${off}%</span>`
    : `<span class="now">${money(p.price)}</span>`;
  const imgs = (p.images && p.images.length ? p.images : [p.image, p.image2].filter(Boolean));
  const gallery = imgs
    .map((src, i) => `<figure><img src="${px}${src}" alt="${esc(p.name)}${i ? " — view " + (i + 1) : ""}" ${i ? 'loading="lazy"' : ""}/></figure>`).join("\n        ");

  const ld = {
    "@context": "https://schema.org/", "@type": "Product",
    name: p.name, image: [`${SITE}/${p.image}`], description: p.desc,
    brand: { "@type": "Brand", name: "Crafting Yarn" },
    offers: { "@type": "Offer", priceCurrency: "AED", price: String(priceOf(p)), availability: "https://schema.org/InStock", url: `${SITE}/product/${p.id}.html` },
  };
  const headExtra = `<script type="application/ld+json">${JSON.stringify(ld)}</script>`;

  const backHref = CATEGORIES.includes(p.category) ? `${px}${catSlug(p.category)}.html` : `${px}index.html`;
  const backLabel = CATEGORIES.includes(p.category) ? `← Back to ${p.category}` : "← Back home";
  const main = `<main class="pdp">
    <a class="pdp__back" href="${backHref}">${backLabel}</a>
    <div class="pdp__grid">
      <div class="pdp__media">
        ${gallery}
      </div>
      <div class="pdp__info">
        <p class="pdp__cat">${esc(sub)}</p>
        <h1 class="pdp__name">${esc(p.name)}</h1>
        <div class="pdp__price">${priceHTML}</div>
        <p class="pdp__desc">${esc(p.desc)}</p>
        <ul class="pdp__meta">
          ${metaBullets}
        </ul>
        <button class="btn btn--solid pdp__add" data-add="${p.id}" aria-label="Add ${esc(p.name)} to bag">Add to bag — ${money(priceOf(p))}</button>
      </div>
    </div>
  </main>`;

  fs.writeFileSync(path.join(ROOT, "product", `${p.id}.html`), shell({
    px, title: `${p.name} — Crafting Yarn`, description: p.desc,
    canonical: `${SITE}/product/${p.id}.html`, headExtra, main,
  }));
  count++;
}

/* ---------- content pages (from data/pages/*.md — editable in the CMS) ---------- */
function parseFrontmatter(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: raw.trim() };
  const data = {};
  for (const line of m[1].split("\n")) {
    const mm = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!mm) continue;
    let v = mm[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (v === "true") v = true;
    else if (v === "false") v = false;
    data[mm[1]] = v;
  }
  return { data, body: m[2].trim() };
}

function inlineMd(s) {
  return s
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, t, u) =>
      `<a class="inline" href="${u}"${/^https?:/.test(u) ? ' target="_blank" rel="noopener"' : ""}>${t}</a>`)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
}

// Minimal, dependency-free markdown -> HTML for Freda's page copy (headings, bold/italic, links, lists, paragraphs).
function markdownLite(md) {
  const e = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return md
    .trim()
    .split(/\n\s*\n/)
    .map((blk) => {
      const lines = blk.split("\n");
      if (/^###\s+/.test(blk)) return `<h3>${inlineMd(e(blk.replace(/^###\s+/, "")))}</h3>`;
      if (/^##\s+/.test(blk)) return `<h2>${inlineMd(e(blk.replace(/^##\s+/, "")))}</h2>`;
      if (/^#\s+/.test(blk)) return `<h2>${inlineMd(e(blk.replace(/^#\s+/, "")))}</h2>`;
      if (lines.every((l) => /^[-*]\s+/.test(l.trim())))
        return `<ul>${lines.map((l) => `<li>${inlineMd(e(l.trim().replace(/^[-*]\s+/, "")))}</li>`).join("")}</ul>`;
      return `<p>${inlineMd(e(blk.replace(/\n/g, " ")))}</p>`;
    })
    .join("\n    ");
}

const CONTACT_FORM = `<form class="contact-form" action="https://formspree.io/f/${esc(FORM_ID)}" method="POST">
      <input type="text" name="name" placeholder="Your name" required />
      <input type="email" name="email" placeholder="Your email" required />
      <textarea name="message" placeholder="Your message" required></textarea>
      <button type="submit" class="btn btn--solid">Send message</button>
    </form>`;

const PAGES_DIR = path.join(ROOT, "data/pages");
for (const fileName of fs.readdirSync(PAGES_DIR).filter((f) => f.endsWith(".md"))) {
  const slug = fileName.replace(/\.md$/, "");
  const { data, body } = parseFrontmatter(fs.readFileSync(path.join(PAGES_DIR, fileName), "utf8"));
  const out = ['<main class="page">', '    <a class="page__back" href="index.html">← Back home</a>'];
  if (data.eyebrow) out.push(`    <p class="page__eyebrow">${esc(data.eyebrow)}</p>`);
  out.push(`    <h1>${esc(data.heading || slug)}</h1>`);
  if (data.image) out.push(`    <figure class="page__media"><img src="${esc(data.image)}" alt="${esc(data.heading || "Crafting Yarn")}"/></figure>`);
  out.push(`    ${markdownLite(body)}`);
  if (data.signature) out.push(`    <p class="page__sign">${esc(data.signature)}</p>`);
  if (data.form) out.push(`    ${CONTACT_FORM}`);
  out.push("  </main>");
  fs.writeFileSync(path.join(ROOT, `${slug}.html`), shell({
    px: "", title: `${data.heading || slug} — Crafting Yarn`,
    description: data.description || "", canonical: `${SITE}/${slug}.html`, main: out.join("\n"),
  }));
}

console.log(`Generated homepage + thank-you + ${count} product pages + about/shipping/returns/contact.`);
