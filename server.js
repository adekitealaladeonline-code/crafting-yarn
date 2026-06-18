/* Minimal static file server for the Crafting Yarn site (preview only). */
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const PORT = process.env.PORT || 5599;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".yml": "text/yaml; charset=utf-8",
  ".yaml": "text/yaml; charset=utf-8",
};

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split("?")[0]);
  if (urlPath.endsWith("/")) urlPath += "index.html";
  const base = path.join(ROOT, path.normalize(urlPath));
  if (!base.startsWith(ROOT)) {
    res.writeHead(403).end("Forbidden");
    return;
  }
  // Try the exact path, then directory index, then clean-URL (.html) — mirrors Cloudflare Pages.
  const candidates = [base, path.join(base, "index.html"), base + ".html"];
  const tryNext = (i) => {
    if (i >= candidates.length) {
      res.writeHead(404, { "Content-Type": "text/html" }).end("<h1>404 — not found</h1>");
      return;
    }
    fs.readFile(candidates[i], (err, data) => {
      if (err) return tryNext(i + 1);
      const ext = path.extname(candidates[i]).toLowerCase();
      res.writeHead(200, { "Content-Type": TYPES[ext] || "application/octet-stream" });
      res.end(data);
    });
  };
  tryNext(0);
});

server.listen(PORT, () => console.log(`Crafting Yarn preview running at http://localhost:${PORT}`));
