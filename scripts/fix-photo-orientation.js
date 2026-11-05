/* =================================================================
   One-off repair: photos that shipped sideways.

   Cause: phones store a portrait shot as landscape pixels plus an EXIF
   "Orientation" tag. The optimiser resized them without calling .rotate(),
   and sharp drops the tag on output, so the browser had nothing left telling
   it to turn the picture. Her gallery looked fine because it reads the tag.

   Both optimisers now call .rotate(), so new uploads are correct. This fixes
   the ones already in the repo. Rather than rotating the compressed copy and
   losing more quality, it recovers each ORIGINAL from the commit that first
   added it, applies the rotation, and re-optimises once from source.

   Run:  node scripts/fix-photo-orientation.js          (dry run, lists only)
         node scripts/fix-photo-orientation.js --apply  (writes the fixes)
   ================================================================= */
const fs = require("fs");
const path = require("path");
const { execSync, execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const DIR = path.join(ROOT, "assets");
const APPLY = process.argv.includes("--apply");
const MAXW = 1600, QUALITY = 72;

let sharp;
try { sharp = require("sharp"); }
catch { console.error("sharp is required — run: npm install"); process.exit(1); }

const walk = (d) => fs.existsSync(d)
  ? fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
      const p = path.join(d, e.name);
      return e.isDirectory() ? walk(p) : [p];
    })
  : [];

// the commit that FIRST added the file — that blob still has the camera's EXIF
function firstBlob(rel) {
  try {
    const out = execSync(`git log --diff-filter=A --format=%H -- "${rel}"`,
      { cwd: ROOT, encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] }).trim();
    const sha = out.split("\n").filter(Boolean).pop();
    if (!sha) return null;
    return execFileSync("git", ["show", `${sha}:${rel}`],
      { cwd: ROOT, maxBuffer: 256 * 1024 * 1024 });
  } catch { return null; }
}

(async () => {
  const pics = walk(DIR).filter((f) => /\.(jpe?g|png)$/i.test(f) && !/-poster\.jpg$/i.test(f));
  const fixes = [];

  for (const f of pics) {
    const rel = path.relative(ROOT, f);
    const orig = firstBlob(rel);
    if (!orig) continue;

    let om;
    try { om = await sharp(orig).metadata(); } catch { continue; }
    const o = om.orientation || 1;
    if (o === 1) continue;                      // nothing to correct

    // Did the sideways version actually ship? For orientations 5-8 the display
    // dimensions are swapped, so if the current file still matches the STORED
    // shape rather than the displayed one, the rotation was never applied.
    let cm;
    try { cm = await sharp(f).metadata(); } catch { continue; }
    const turned = o >= 5;
    const curLandscape = cm.width >= cm.height;
    const storedLandscape = om.width >= om.height;
    const needsFix = turned ? (curLandscape === storedLandscape) : true;
    if (!needsFix) continue;

    fixes.push({ f, rel, o, from: `${cm.width}x${cm.height}`, orig });
  }

  if (!fixes.length) { console.log("No sideways photos found."); return; }

  console.log(`${fixes.length} photo(s) need correcting:\n`);
  for (const fx of fixes) {
    let line = `  ${fx.rel}  (${fx.from}, EXIF orientation ${fx.o})`;
    if (APPLY) {
      const isPng = /\.png$/i.test(fx.f);
      let pipe = sharp(fx.orig, { failOn: "none" }).rotate();   // bake the rotation
      const m = await sharp(fx.orig).metadata();
      const dispW = (m.orientation || 1) >= 5 ? m.height : m.width;
      if (dispW > MAXW) pipe = pipe.resize({ width: MAXW, withoutEnlargement: true });
      pipe = isPng ? pipe.png({ compressionLevel: 9, palette: true })
                   : pipe.jpeg({ quality: QUALITY, mozjpeg: true });
      const buf = await pipe.toBuffer();
      fs.writeFileSync(fx.f, buf);
      const after = await sharp(buf).metadata();
      line += `  ->  ${after.width}x${after.height}  ✓`;
    }
    console.log(line);
  }
  console.log(APPLY ? "\nRebuilt from the originals in git history, so no extra compression."
                    : "\nDry run. Re-run with --apply to write them.");
})();
