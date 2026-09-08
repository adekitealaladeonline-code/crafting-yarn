/* =================================================================
   Shrink oversized photos IN PLACE, inside assets/.

   Why this exists: the CMS media library renders each file at full size as its
   thumbnail, so a folder of 4000px phone photos makes Freda's picture picker
   slow and unreliable. Keeping the stored files web-sized fixes that at source.

   Safe to run repeatedly:
     - never upscales
     - skips anything already small (<=1600px AND <=400 KB)
     - keeps the result only if it's actually smaller
     - same filename + format, so nothing referencing these files changes

   Run: node scripts/optimise-assets.js
   ================================================================= */
const fs = require("fs");
const path = require("path");

let sharp;
try { sharp = require("sharp"); }
catch { console.error("sharp not installed — run: npm install"); process.exit(0); }

const ROOT = path.join(__dirname, "..");
const DIR = path.join(ROOT, "assets");
const MAXW = 1600;      // ample for a 2x retina product page
const QUALITY = 72;
const SKIP_BYTES = 400 * 1024;

const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(d, e.name);
  return e.isDirectory() ? walk(p) : [p];
});

(async () => {
  if (!fs.existsSync(DIR)) return;
  const files = walk(DIR).filter((f) => /\.(jpe?g|png)$/i.test(f));
  let before = 0, after = 0, changed = 0;

  for (const f of files) {
    const orig = fs.statSync(f).size;
    before += orig;
    try {
      const meta = await sharp(f).metadata();
      if (meta.width <= MAXW && orig <= SKIP_BYTES) { after += orig; continue; }

      let pipe = sharp(f, { failOn: "none" });
      if (meta.width > MAXW) pipe = pipe.resize({ width: MAXW, withoutEnlargement: true });
      pipe = /png/i.test(meta.format)
        ? pipe.png({ compressionLevel: 9, palette: true })
        : pipe.jpeg({ quality: QUALITY, mozjpeg: true });

      const buf = await pipe.toBuffer();
      if (buf.length < orig) {
        fs.writeFileSync(f, buf);
        after += buf.length;
        changed++;
        console.log(`  ${(orig / 1024).toFixed(0)}KB -> ${(buf.length / 1024).toFixed(0)}KB  ${path.relative(ROOT, f)}`);
      } else {
        after += orig;
      }
    } catch (e) {
      after += orig; // unreadable/odd file: leave it exactly as it is
    }
  }

  console.log(`optimised ${changed}/${files.length} — ${(before / 1048576).toFixed(1)} MB -> ${(after / 1048576).toFixed(1)} MB`);
})();
