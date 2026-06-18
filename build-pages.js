/* =================================================================
   Crafting Yarn — static page generator (dev tool)
   Generates per-product pages + the About/Contact/Shipping/Returns
   pages from the single source of truth (js/catalog.js), so they all
   share one header/footer/cart and never drift out of sync.

   Run:  node build-pages.js
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

/* ---------- shared chrome (prefix = "" for root, "../" for /product/) ---------- */
const FONT = `<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,300;12..96,400;12..96,500;12..96,600;12..96,700;12..96,800&display=swap" rel="stylesheet" />`;

const ticker = `<div class="ticker" aria-hidden="true"><div class="ticker__track">
  <span>Handmade with love in the UAE</span><i>✶</i><span>Free UAE delivery over AED 250</span><i>✶</i><span>Every piece made to order</span><i>✶</i><span>No two are ever the same</span><i>✶</i>
  <span>Handmade with love in the UAE</span><i>✶</i><span>Free UAE delivery over AED 250</span><i>✶</i><span>Every piece made to order</span><i>✶</i><span>No two are ever the same</span><i>✶</i>
</div></div>`;

const header = (px) => `<header class="site-header" id="siteHeader"><div class="header__inner">
  <button class="header__menu" id="menuToggle" aria-label="Open menu" aria-expanded="false"><span></span><span></span></button>
  <a href="${px}index.html" class="brand" aria-label="Crafting Yarn home"><img src="${px}assets/brand/logo.png" alt="Crafting Yarn" class="brand__logo" /></a>
  <div class="header__actions">
    <button class="icon-btn cart-btn" id="cartToggle" aria-label="Open cart"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 8h12l-1 12H7L6 8Z"/><path d="M9 8a3 3 0 0 1 6 0"/></svg><span class="cart-count" id="cartCount">0</span></button>
  </div>
</div></header>`;

const menu = (px) => `<div class="menu" id="mobileNav" hidden>
  <nav aria-label="Main">
    <a href="${px}index.html"><span>01</span> Home</a>
    <a href="${px}index.html#shop"><span>02</span> Shop all</a>
    <a href="${px}index.html?cat=Plushies#shop"><span>03</span> Plushies</a>
    <a href="${px}index.html?cat=Bags#shop"><span>04</span> Bags</a>
    <a href="${px}index.html?cat=Clothing#shop"><span>05</span> Clothing</a>
    <a href="${px}index.html?cat=Accessories#shop"><span>06</span> Accessories</a>
    <a href="${px}about.html"><span>07</span> Our story</a>
    <a href="${px}contact.html"><span>08</span> Contact</a>
  </nav>
  <a class="menu__ig" href="https://www.instagram.com/craftingyarn/" target="_blank" rel="noopener">Instagram @craftingyarn ↗</a>
</div>`;

const footer = (px) => `<footer class="site-footer"><div class="footer__top">
  <div class="footer__brand"><img src="${px}assets/brand/logo.png" alt="Crafting Yarn" class="footer__logo"/><p>Handmade crochet, made with love in the UAE by Freda.</p></div>
  <nav class="footer__col" aria-label="Shop"><h4>Shop</h4>
    <a href="${px}index.html?cat=Plushies#shop">Plushies</a><a href="${px}index.html?cat=Bags#shop">Bags</a><a href="${px}index.html?cat=Clothing#shop">Clothing</a><a href="${px}index.html?cat=Accessories#shop">Accessories</a><a href="${px}index.html?cat=sale#shop">Sale</a>
  </nav>
  <nav class="footer__col" aria-label="Help"><h4>Help</h4>
    <a href="${px}shipping.html">Shipping</a><a href="${px}returns.html">Returns</a><a href="${px}about.html">Our story</a><a href="${px}contact.html">Contact</a>
  </nav>
  <nav class="footer__col" aria-label="Social"><h4>Follow</h4>
    <a href="https://www.instagram.com/craftingyarn/" target="_blank" rel="noopener">Instagram ↗</a>
  </nav>
</div><div class="footer__bottom"><span>© <span id="year"></span> Crafting Yarn</span><span>Every stitch tells a story</span></div></footer>`;

const cartDrawer = `<div class="overlay" id="overlay" hidden></div>
<aside class="cart" id="cart" aria-label="Shopping cart" aria-hidden="true">
  <div class="cart__head"><h3>Your bag</h3><button class="cart__x" id="cartClose" aria-label="Close cart">Close</button></div>
  <div class="cart__body" id="cartBody"></div>
  <div class="cart__foot" id="cartFoot">
    <div class="cart__row"><span>Subtotal</span><strong id="cartTotal">AED 0</strong></div>
    <p class="cart__hint">Shipping calculated at checkout · Made to order</p>
    <button class="btn btn--solid btn--block" id="checkoutBtn">Checkout</button>
  </div>
</aside>
<div class="toast" id="toast" role="status" aria-live="polite"></div>`;

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
${scripts(px)}
</body>
</html>
`;
}

/* ---------- product pages ---------- */
fs.mkdirSync(path.join(ROOT, "product"), { recursive: true });
let count = 0;
for (const p of CATALOG) {
  const px = "../";
  const sub = p.subcategory ? `${p.category} · ${p.subcategory}` : p.category;
  const off = p.sale != null ? Math.round((1 - p.sale / p.price) * 100) : 0;
  const priceHTML = p.sale != null
    ? `<span class="now">${money(p.sale)}</span><span class="was">${money(p.price)}</span><span class="off">−${off}%</span>`
    : `<span class="now">${money(p.price)}</span>`;
  const gallery = [p.image, p.image2].filter(Boolean)
    .map((src, i) => `<figure><img src="${px}${src}" alt="${esc(p.name)}${i ? " — detail" : ""}" ${i ? 'loading="lazy"' : ""}/></figure>`).join("\n        ");

  const ld = {
    "@context": "https://schema.org/", "@type": "Product",
    name: p.name, image: [`${SITE}/${p.image}`], description: p.desc,
    brand: { "@type": "Brand", name: "Crafting Yarn" },
    offers: { "@type": "Offer", priceCurrency: "AED", price: String(priceOf(p)), availability: "https://schema.org/InStock", url: `${SITE}/product/${p.id}.html` },
  };
  const headExtra = `<script type="application/ld+json">${JSON.stringify(ld)}</script>`;

  const main = `<main class="pdp">
    <a class="pdp__back" href="${px}index.html#shop">← Back to shop</a>
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
          <li>Made to order, crocheted just for you</li>
          <li>Hand-crocheted — no two are ever identical</li>
          <li>Ships from the UAE · free local delivery over AED 250</li>
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

const CONTACT_FORM = `<form class="contact-form" action="https://formspree.io/f/your-form-id" method="POST">
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

console.log(`Generated ${count} product pages + about/shipping/returns/contact.`);
