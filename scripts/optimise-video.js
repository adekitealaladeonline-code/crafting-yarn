/* =================================================================
   Shrink uploaded product videos IN PLACE, inside assets/, and make a
   poster frame for each one.

   Freda records on her phone, so a 10 second clip arrives as 4K and tens of
   megabytes. Nobody needs 4K on a product page, and the poster frame is what
   lets us show the video without downloading a single byte until it is tapped.

   Safe to run repeatedly:
     - skips anything already 720p or smaller AND already small
     - drops the audio track (these are silent texture clips)
     - keeps the result only if it is actually smaller
     - same filename, so nothing referencing the file changes

   Run: node scripts/optimise-video.js
   ================================================================= */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const DIR = path.join(ROOT, "assets");
const MAXH = 720;            // plenty on a phone or a product page
const CRF = 28;              // visually fine for fabric texture
const SKIP_BYTES = 2 * 1024 * 1024;

function ffmpegBin() {
  // CI runners have ffmpeg on PATH; locally we fall back to the one bundled
  // with the python imageio-ffmpeg package.
  try { execFileSync("ffmpeg", ["-version"], { stdio: "ignore" }); return "ffmpeg"; } catch {}
  try {
    return execFileSync("python3",
      ["-c", "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"],
      { encoding: "utf8" }).trim();
  } catch { return null; }
}
function ffprobeBin(ff) {
  try { execFileSync("ffprobe", ["-version"], { stdio: "ignore" }); return "ffprobe"; } catch {}
  return null; // we can live without it; ffmpeg alone still re-encodes fine
}

const walk = (d) => fs.existsSync(d)
  ? fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
      const p = path.join(d, e.name);
      return e.isDirectory() ? walk(p) : [p];
    })
  : [];

const FF = ffmpegBin();
if (!FF) { console.warn("⚠ ffmpeg not available — skipping video optimisation"); process.exit(0); }
const FP = ffprobeBin(FF);

const heightOf = (f) => {
  if (!FP) return null;
  try {
    return parseInt(execFileSync(FP, ["-v", "error", "-select_streams", "v:0",
      "-show_entries", "stream=height", "-of", "csv=p=0", f], { encoding: "utf8" }).trim(), 10);
  } catch { return null; }
};

const vids = walk(DIR).filter((f) => /\.(mp4|mov|m4v|webm)$/i.test(f));
if (!vids.length) { console.log("no videos to optimise"); process.exit(0); }

let before = 0, after = 0, changed = 0, posters = 0;

for (const f of vids) {
  const orig = fs.statSync(f).size;
  before += orig;
  const h = heightOf(f);
  const alreadySmall = orig <= SKIP_BYTES && (h === null || h <= MAXH);

  if (!alreadySmall) {
    const tmp = f.replace(/\.[^.]+$/, "") + ".tmp.mp4";
    try {
      execFileSync(FF, [
        "-y", "-i", f,
        "-vf", `scale=-2:'min(${MAXH},ih)'`,
        "-c:v", "libx264", "-crf", String(CRF), "-preset", "veryfast",
        "-pix_fmt", "yuv420p",
        "-an",                       // silent clips: drop audio entirely
        "-movflags", "+faststart",   // starts playing before fully downloaded
        tmp,
      ], { stdio: "ignore" });
      const size = fs.statSync(tmp).size;
      if (size < orig) {
        fs.renameSync(tmp, f.replace(/\.[^.]+$/, ".mp4"));
        if (!/\.mp4$/i.test(f)) fs.unlinkSync(f); // .mov became .mp4
        after += size; changed++;
        console.log(`  ${(orig / 1048576).toFixed(1)}MB -> ${(size / 1048576).toFixed(2)}MB  ${path.relative(ROOT, f)}`);
      } else { fs.unlinkSync(tmp); after += orig; }
    } catch (e) { try { fs.unlinkSync(tmp); } catch {} after += orig; }
  } else {
    after += orig;
  }

  // poster frame: this is what makes the video free until it is tapped
  const final = f.replace(/\.[^.]+$/, ".mp4");
  const poster = final.replace(/\.mp4$/i, "-poster.jpg");
  if (fs.existsSync(final) && !fs.existsSync(poster)) {
    try {
      execFileSync(FF, ["-y", "-i", final, "-ss", "00:00:00.5", "-vframes", "1",
        "-vf", `scale=-2:'min(${MAXH},ih)'`, "-q:v", "4", poster], { stdio: "ignore" });
      posters++;
    } catch {}
  }
}

console.log(`videos: ${changed}/${vids.length} shrunk, ${posters} poster frame(s) made — ` +
  `${(before / 1048576).toFixed(1)} MB -> ${(after / 1048576).toFixed(1)} MB`);
