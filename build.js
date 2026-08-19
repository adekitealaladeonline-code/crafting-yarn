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
// "date added" for a product, from git history (the commit that first added the file).
// Robust: survives CMS saves that drop a `created` field. Needs full git history in CI.
const gitCreated = (file) => {
  try {
    const out = execSync(`git log --diff-filter=A --format=%aI -- "data/products/${file}"`, {
      cwd: ROOT, encoding: "utf8", stdio: ["pipe", "pipe", "ignore"],
    }).trim();
    const lines = out.split("\n").filter(Boolean);
    return lines[lines.length - 1] || ""; // earliest = when it was first added
  } catch { return ""; }
};
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
    // date for newest/oldest sorting: CMS value if set, else derived from git, else a base date
    data.created = data.created || gitCreated(f) || "2026-06-01T00:00:00Z";
    return { id: f.replace(/\.json$/, ""), ...data };
  })
  .sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));
if (!products.length) throw new Error("no products found in data/products/");

// 1b) guard: never ship a product photo that doesn't exist --------------------
//     Deleting a photo from the CMS media library does NOT check whether a
//     product still uses it, so a media cleanup can silently leave products
//     pointing at deleted files. Those render as broken images on the live shop
//     (and Cloudflare answers 200 with the fallback HTML, so they don't even
//     look like 404s). Drop dead references; stop the build outright if that
//     would leave a product with no photo at all.
const imgExists = (rel) => !!rel && fs.existsSync(path.join(ROOT, rel));
const photoWarn = [];
const photoFatal = [];
for (const p of products) {
  if (!p.images.length) { // no photos listed at all
    photoFatal.push(`  ✗ ${p.name}  [data/products/${p.id}.json]\n      (no photos added to this product)`);
    continue;
  }
  const missing = p.images.filter((rel) => !imgExists(rel));
  if (!missing.length) continue;
  const kept = p.images.filter(imgExists);
  const list = missing.map((m) => `      ${m}`).join("\n");
  if (!kept.length) {
    photoFatal.push(`  ✗ ${p.name}  [data/products/${p.id}.json]\n${list}`);
    continue;
  }
  photoWarn.push(`  ! ${p.name}  [data/products/${p.id}.json] — ${kept.length} photo(s) still shown\n${list}`);
  p.images = kept;
  p.image = kept[0];
  p.image2 = kept[1] || null;
}
if (photoWarn.length) {
  console.warn("\n⚠ Missing product photos — these references were skipped:\n" + photoWarn.join("\n"));
  console.warn("  Fix in /admin: re-upload the photo, or remove it from that product's Photos list.\n");
}
if (photoFatal.length) {
  console.error("\n✗ BUILD STOPPED — product(s) left with no usable photo:\n" + photoFatal.join("\n"));
  console.error("\n  These would appear blank/broken to customers, so the site was not rebuilt.");
  console.error("  Fix in /admin (Products → the item → Photos): re-upload the photo(s),");
  console.error("  or delete the product if it is no longer sold.");
  console.error("  Note: deleting a photo from the media library does NOT remove it from products.\n");
  process.exit(1);
}

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
// non-HTML root files that must ship (generated by build-pages.js)
for (const f of ["robots.txt", "sitemap.xml", "feed.xml"]) {
  const src = path.join(ROOT, f);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(DIST, f));
}
for (const d of dirs) {
  const src = path.join(ROOT, d);
  if (fs.existsSync(src)) fs.cpSync(src, path.join(DIST, d), { recursive: true });
}

// strip macOS cruft that can sneak into dist
execSync(`find "${DIST}" -name '.DS_Store' -delete`, { stdio: "ignore" });

/* 3b) shrink photos for the web — automatically, every build ------------------
   Freda shoots and uploads straight from her phone, so the originals are ~4000px
   and several MB each. Rather than asking her to resize anything (she won't, and
   shouldn't have to), we optimise on the way out: the ORIGINALS stay untouched in
   assets/ as the archive, and only the copies inside dist/ (what visitors
   download) get resized. Fully non-destructive and idempotent.
   sharp is optional — if it's ever unavailable the build still succeeds, it just
   ships the photos as-is. */
(function optimiseDistImages() {
  let sharp;
  try { sharp = require("sharp"); }
  catch { console.warn("⚠ sharp not installed — shipping photos uncompressed (run: npm install)"); return; }

  const MAXW = 1600;      // plenty for a 2x retina product page
  const QUALITY = 72;
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });

  const assetsDir = path.join(DIST, "assets");
  if (!fs.existsSync(assetsDir)) return;
  const pics = walk(assetsDir).filter((f) => /\.(jpe?g|png)$/i.test(f));

  if (!pics.length) return;
  // sharp's API is promise-based; run it in a short child process so this build
  // script stays a simple top-to-bottom sequential file.
  const { execFileSync } = require("child_process");
  const script = `
    const sharp=require(${JSON.stringify(require.resolve("sharp"))});
    const fs=require("fs");
    const files=JSON.parse(process.argv[1]);
    const MAXW=${MAXW}, Q=${QUALITY};
    (async()=>{
      let before=0, after=0, changed=0;
      for(const f of files){
        const o=fs.statSync(f).size; before+=o;
        try{
          const im=sharp(f,{failOn:"none"});
          const m=await im.metadata();
          const isPng=/png$/i.test(m.format||"");
          let pipe=im;
          if(m.width>MAXW) pipe=pipe.resize({width:MAXW,withoutEnlargement:true});
          pipe = isPng ? pipe.png({compressionLevel:9,palette:true})
                       : pipe.jpeg({quality:Q,mozjpeg:true});
          const buf=await pipe.toBuffer();
          if(buf.length < o){ fs.writeFileSync(f,buf); after+=buf.length; changed++; }
          else after+=o;
        }catch(e){ after+=o; }
      }
      console.log(JSON.stringify({before,after,changed,total:files.length}));
    })();
  `;
  try {
    const out = execFileSync(process.execPath, ["-e", script, JSON.stringify(pics)], { encoding: "utf8" });
    const r = JSON.parse(out.trim().split("\n").pop());
    const savedMb = (r.before - r.after) / 1048576;
    console.log(
      `✓ photos optimised for the web — ${r.changed}/${r.total} shrunk, ` +
      `${(r.before / 1048576).toFixed(1)} MB → ${(r.after / 1048576).toFixed(1)} MB ` +
      `(saved ${savedMb.toFixed(1)} MB). Originals in assets/ untouched.`
    );
  } catch (e) {
    console.warn("⚠ photo optimisation skipped:", String(e.message || e).slice(0, 120));
  }
})();

// generated advanced-mode worker at the dist root (serves assets + /api/*)
execSync(`node build-worker.js "${path.join(DIST, "_worker.js")}"`, { cwd: ROOT, stdio: "inherit" });

const htmlCount = fs.readdirSync(DIST).filter((f) => f.endsWith(".html")).length;
const prodCount = fs.existsSync(path.join(DIST, "product")) ? fs.readdirSync(path.join(DIST, "product")).length : 0;
console.log(`✓ dist/ assembled — ${htmlCount} top-level pages, ${prodCount} product pages, _worker.js ${fs.existsSync(path.join(DIST, "_worker.js")) ? "present" : "MISSING"}`);
console.log("Deploy: upload the dist/ folder (or connect Pages to git with build command 'npm run build', output 'dist').");
