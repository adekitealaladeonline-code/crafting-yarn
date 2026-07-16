/* =================================================================
   Crafting Yarn — one build to rule them all.

   Single source of truth: data/products.json  (this is what the CMS edits)

   Pipeline:
     1. data/products.json  ->  js/catalog.js   (window.CATALOG)
     2. build-pages.js       ->  product/*.html + about/shipping/returns/contact
     3. assemble dist/       ->  static site + /admin + generated _worker.js

   Run:  npm run build   (or: node build.js)
   Output: dist/  — this is the folder Cloudflare Pages deploys.
   ================================================================= */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = __dirname;
const DIST = path.join(ROOT, "dist");

// 1) data/products/*.json -> js/catalog.js ------------------------------------
//    One file per product (filename = id). The CMS (/admin) edits these.
const PRODUCTS_DIR = path.join(ROOT, "data/products");
const stripSlash = (s) => (typeof s === "string" ? s.replace(/^\/+/, "") : s); // CMS may store /assets/..; site uses relative paths
const products = fs
  .readdirSync(PRODUCTS_DIR)
  .filter((f) => f.endsWith(".json"))
  .map((f) => {
    const data = JSON.parse(fs.readFileSync(path.join(PRODUCTS_DIR, f), "utf8"));
    // photos: prefer the images[] list; fall back to legacy image/image2
    let imgs = Array.isArray(data.images) ? data.images : [data.image, data.image2];
    imgs = imgs.filter(Boolean).map(stripSlash);
    data.images = imgs;
    data.image = imgs[0] || "";       // card + cart + Stripe + first gallery photo
    data.image2 = imgs[1] || null;    // card hover
    return { id: f.replace(/\.json$/, ""), ...data };
  })
  .sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));
if (!products.length) throw new Error("no products found in data/products/");
const catalog = products.map(({ order, ...p }) => p); // 'order' is sort-only; keep it out of the catalogue
const catalogJs =
  "/* AUTO-GENERATED from data/products/*.json by build.js — do not edit here; edit products in the CMS (/admin). */\n" +
  "window.CATALOG = " + JSON.stringify(catalog, null, 2) + ";\n";
fs.writeFileSync(path.join(ROOT, "js/catalog.js"), catalogJs);
console.log("✓ js/catalog.js  (" + catalog.length + " products)");

// 2) generate per-product + content pages -------------------------------------
execSync("node build-pages.js", { cwd: ROOT, stdio: "inherit" });

// 3) assemble dist/ -----------------------------------------------------------
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });

// every generated top-level page (index, success, about, care, …) — dynamic so new
// data/pages/*.md entries ship automatically
const files = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html"));
const dirs = ["css", "js", "assets", "product", "admin"]; // admin copied only if present

for (const f of files) {
  const src = path.join(ROOT, f);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(DIST, f));
}
for (const d of dirs) {
  const src = path.join(ROOT, d);
  if (fs.existsSync(src)) fs.cpSync(src, path.join(DIST, d), { recursive: true });
}

// strip macOS cruft that can sneak into dist
execSync(`find "${DIST}" -name '.DS_Store' -delete`, { stdio: "ignore" });

// generated advanced-mode worker at the dist root (serves assets + /api/*)
execSync(`node build-worker.js "${path.join(DIST, "_worker.js")}"`, { cwd: ROOT, stdio: "inherit" });

const htmlCount = fs.readdirSync(DIST).filter((f) => f.endsWith(".html")).length;
const prodCount = fs.existsSync(path.join(DIST, "product")) ? fs.readdirSync(path.join(DIST, "product")).length : 0;
console.log(`✓ dist/ assembled — ${htmlCount} top-level pages, ${prodCount} product pages, _worker.js ${fs.existsSync(path.join(DIST, "_worker.js")) ? "present" : "MISSING"}`);
console.log("Deploy: upload the dist/ folder (or connect Pages to git with build command 'npm run build', output 'dist').");
