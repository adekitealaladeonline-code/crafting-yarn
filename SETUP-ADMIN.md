# Crafting Yarn — Admin panel (CMS) setup

Freda gets a friendly editor at **`craftingyarn.com/admin`** to add/edit/hide/reorder products,
change prices, and upload photos herself. No code, no monthly fee.

## How it works

```
Freda edits in /admin  ──commit──▶  GitHub repo  ──push triggers──▶  GitHub Action
                                                                         │
                                              npm run build (data/products/*.json → dist/)
                                                                         │
                                              wrangler deploys dist/ to the crafting-yarn
                                              Pages project  ──▶  live on craftingyarn.com (~1 min)
```

**Single source of truth:** `data/products/<id>.json` (one file per product).
`build.js` turns those into `js/catalog.js`, all the `/product/*.html` pages, **and** the
server-side price map inside `_worker.js` — so when Freda changes a price, the displayed price
*and* the amount Stripe charges update together. Never edit `js/catalog.js` by hand.

---

## Try it RIGHT NOW, locally, with zero setup
1. Run the site: `npm run dev` (serves on :5599), open `http://localhost:5599/admin/`.
2. Click **"Work with Local Repository"** → pick the `craftingyarn_site` folder.
3. Edit a product / add one / drag in a photo → it writes the files locally.
4. `npm run build` → refresh the site to see it. (This is for *your* testing; Freda uses the live flow below.)

---

## Make it live for Freda (one-time, ~20 min)

### 1. Put the site in its own GitHub repo
Push the **contents of `craftingyarn_site/`** as the repo root (so `build.js`, `data/`, `admin/`,
`.github/` are at the top level). E.g. repo name `crafting-yarn`.

### 2. Point the CMS at the repo
In `admin/config.yml`, set:
```yaml
backend:
  repo: YOUR-GH-USERNAME/crafting-yarn
```

### 3. Give the GitHub Action permission to deploy
The workflow (`.github/workflows/deploy.yml`) deploys to the **existing** `crafting-yarn` Pages
project (keeps the domain + `STRIPE_SECRET_KEY` — nothing to migrate). It needs two secrets:

- **Create a Cloudflare API token:** dash.cloudflare.com → **My Profile → API Tokens → Create Token**
  → permission **Account › Cloudflare Pages › Edit** → create, copy it.
- In the **GitHub repo → Settings → Secrets and variables → Actions → New repository secret**, add:
  - `CLOUDFLARE_API_TOKEN` = the token above
  - `CLOUDFLARE_ACCOUNT_ID` = `931e79fd4f6b0f44cf65c9eaaacdcca9`

### 4. Give Freda a login (simplest = access token)
She signs in via **"Sign In Using Access Token"** with a GitHub **fine-grained personal access token**:
- The token must come from a GitHub account that can write to the repo (add her GitHub as a
  **collaborator**, or make her a dedicated account).
- GitHub → **Settings → Developer settings → Fine-grained tokens → Generate**:
  - Repository access: **Only select repositories → crafting-yarn**
  - Permissions: **Contents → Read and write**
- She pastes that token once at `craftingyarn.com/admin`; the browser remembers it.

*(Optional nicer "Sign In with GitHub" button instead of a token: deploy the
[`sveltia-cms-auth`](https://github.com/sveltia/sveltia-cms-auth) Cloudflare Worker + a GitHub
OAuth App, then add its URL as `base_url` under `backend` in config.yml.)*

### 5. Push
On push to `main`, the Action builds and deploys. Visit `craftingyarn.com/admin` → log in → done.

---

## How Freda uses it
- **Edit a product:** Products → click one → change price/photo/text → **Publish**.
- **Add a product:** Products → **New Product** → fill in, drag a photo → **Publish**.
- **Hide/sell out:** for now, delete it (or drop its price/availability) — a dedicated
  "available" toggle can be added later if she wants one.
- **Reorder:** lower **Sort order** number = shown earlier.
- Changes go live ~1 minute after **Publish** (the Action runs the build + deploy).

## Notes
- This is product **content** management (add/edit/photos/price/order). It is not live stock-count
  tracking — fine for made-to-order. If she ever needs real decrementing inventory, that's the
  Shopify-class route.
- Rollback is just git history (every Publish is a commit).
