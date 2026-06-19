-- Crafting Yarn — inventory counter.
-- One row per product, tracking how many have sold. Available = (CMS stock) - sold.
-- Run once in the Cloudflare D1 console (or: wrangler d1 execute crafting-yarn-db --file schema.sql).
CREATE TABLE IF NOT EXISTS sales (
  product_id TEXT PRIMARY KEY,
  sold       INTEGER NOT NULL DEFAULT 0
);
