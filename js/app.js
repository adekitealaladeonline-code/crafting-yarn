/* =================================================================
   Crafting Yarn — interactions
   Renders the live catalogue, handles filtering / sorting, quick-view,
   a persistent cart drawer, search, mobile nav and scroll reveals.
   ================================================================= */
(function () {
  "use strict";
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const CATALOG = window.CATALOG || [];
  const money = (n) => "AED " + (Number.isInteger(n) ? n : n.toFixed(2));
  const byId = (id) => CATALOG.find((p) => p.id === id);
  const priceOf = (p) => (p.sale != null ? p.sale : p.price);
  // live inventory: SOLD is filled from /api/stock. Untracked items (stock null) are always available.
  let SOLD = {};
  const availOf = (p) => (p && p.stock != null ? p.stock - (SOLD[p.id] || 0) : Infinity);
  const soldOut = (p) => availOf(p) <= 0;
  // null-safe event binding (pages other than the homepage omit some elements)
  const on = (sel, evt, fn, opts) => { const el = typeof sel === "string" ? $(sel) : sel; if (el) el.addEventListener(evt, fn, opts); };

  /* ----------------------------------------------------------------
     CART (localStorage)
  ---------------------------------------------------------------- */
  const CART_KEY = "craftingyarn.cart.v1";
  let cart = load();
  function load() { try { return JSON.parse(localStorage.getItem(CART_KEY)) || {}; } catch { return {}; } }
  function save() { localStorage.setItem(CART_KEY, JSON.stringify(cart)); }

  /* ----------------------------------------------------------------
     WISHLIST (localStorage)
  ---------------------------------------------------------------- */
  const WISH_KEY = "craftingyarn.wish.v1";
  let wishlist = new Set(loadWish());
  function loadWish() { try { return JSON.parse(localStorage.getItem(WISH_KEY)) || []; } catch { return []; } }
  function saveWish() { localStorage.setItem(WISH_KEY, JSON.stringify([...wishlist])); }
  function toggleWish(id) {
    const on = !wishlist.has(id);
    if (on) wishlist.add(id); else wishlist.delete(id);
    saveWish();
    $$(`[data-wish="${id}"]`).forEach((b) => {
      b.classList.toggle("is-wished", on);
      b.setAttribute("aria-pressed", on);
    });
    const p = byId(id);
    toast(on ? `Saved <b>${p.name}</b> to your wishlist` : "Removed from wishlist");
  }

  function addToCart(id, qty = 1) {
    const p = byId(id);
    if (!p) return;
    if (soldOut(p)) { toast(`Sorry, <b>${p.name}</b> isn’t available right now`); return; }
    const max = availOf(p);
    if ((cart[id] || 0) + qty > max) {
      cart[id] = max; save(); renderCart(); bumpCount();
      toast(`That’s all we have of <b>${p.name}</b> right now`);
      return;
    }
    cart[id] = (cart[id] || 0) + qty;
    save(); renderCart(); bumpCount();
    toast(`Added <b>${p.name}</b> to your basket`);
  }
  function setQty(id, qty) {
    if (qty <= 0) delete cart[id]; else cart[id] = qty;
    save(); renderCart();
  }
  const cartCount = () => Object.values(cart).reduce((a, b) => a + b, 0);
  const cartTotal = () =>
    Object.entries(cart).reduce((sum, [id, q]) => {
      const p = byId(id); return p ? sum + priceOf(p) * q : sum;
    }, 0);

  function bumpCount() {
    const el = $("#cartCount");
    if (!el) return;
    const n = cartCount();
    el.textContent = n;
    el.style.display = n ? "grid" : "none";
    el.animate(
      [{ transform: "scale(1.6)" }, { transform: "scale(1)" }],
      { duration: 320, easing: "cubic-bezier(.22,.61,.36,1)" }
    );
  }

  function renderCart() {
    const body = $("#cartBody");
    if (!body) { bumpCount(); return; }
    const entries = Object.entries(cart).filter(([id]) => byId(id));
    if (!entries.length) {
      body.innerHTML = `<p class="cart__empty">Your basket is empty.<br/>Every piece is handmade with love.</p>`;
    } else {
      body.innerHTML = entries.map(([id, q]) => {
        const p = byId(id);
        return `<div class="cart-item">
          <img src="${p.image}" alt="${p.name}" loading="lazy"/>
          <div>
            <div class="cart-item__name">${p.name}</div>
            <div class="cart-item__price">${money(priceOf(p))}${p.sale != null ? ` · <span style="color:var(--berry)">sale</span>` : ""}</div>
            <div class="cart-item__qty">
              <button data-dec="${id}" aria-label="Decrease quantity">−</button>
              <span>${q}</span>
              <button data-inc="${id}" aria-label="Increase quantity">+</button>
            </div>
          </div>
          <button class="cart-item__rm" data-rm="${id}">Remove</button>
        </div>`;
      }).join("");
    }
    const total = $("#cartTotal"); if (total) total.textContent = money(cartTotal());
    const foot = $("#cartFoot"); if (foot) foot.style.display = entries.length ? "block" : "none";
    bumpCount();
  }

  /* ----------------------------------------------------------------
     PRODUCT CARD
  ---------------------------------------------------------------- */
  function cardHTML(p) {
    const off = p.sale != null ? Math.round((1 - p.sale / p.price) * 100) : 0;
    const out = soldOut(p);            // still shown, just not buyable
    const badges = [];
    if (out) badges.push(`<span class="tag tag--out">Sold out</span>`);
    else if (p.sale != null) badges.push(`<span class="tag tag--sale">Sale</span>`);
    if (p.isNew && !out) badges.push(`<span class="tag tag--new">New</span>`);
    const price = p.sale != null
      ? `<span class="now">${money(p.sale)}</span><span class="was">${money(p.price)}</span><span class="off">−${off}%</span>`
      : `<span class="now">${money(p.price)}</span>`;
    const sub = p.subcategory ? `${p.category} · ${p.subcategory}` : p.category;
    const hover = p.image2
      ? `<img class="card__img card__img--hover" src="${p.image2}" alt="" aria-hidden="true" loading="lazy"/>`
      : "";
    const wished = wishlist.has(p.id) ? " is-wished" : "";
    const addBtn = out
      ? `<span class="card__addbar card__addbar--out" aria-hidden="true">Sold out</span>`
      : `<button class="card__addbar" data-add="${p.id}" aria-label="Add ${p.name} to basket">Add +</button>`;
    return `<article class="card${p.image2 ? " has-hover" : ""}${out ? " is-out" : ""}" data-id="${p.id}">
      <div class="card__media">
        ${badges.length ? `<div class="card__badges">${badges.join("")}</div>` : ""}
        <button class="card__wish${wished}" data-wish="${p.id}" aria-label="Save ${p.name} to wishlist" aria-pressed="${wishlist.has(p.id)}">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.6-9.3-9C1 7.7 2.6 5 5.6 5c1.9 0 3.2 1.1 4.4 2.6C11.2 6.1 12.5 5 14.4 5c3 0 4.6 2.7 2.9 6-2.3 4.4-9.3 9-9.3 9Z"/></svg>
        </button>
        <img class="card__img" src="${p.image}" alt="${p.name}" loading="lazy"/>
        ${hover}
        <div class="card__actions">
          <button class="card__quick" data-quick="${p.id}">Quick view</button>
          ${addBtn}
        </div>
      </div>
      <div class="card__info">
        <span class="card__cat">${sub}</span>
        <h3 class="card__name"><a href="product/${p.id}.html">${p.name}</a></h3>
        <div class="card__price">${price}</div>
      </div>
    </article>`;
  }

  /* ----------------------------------------------------------------
     SHOP GRID — filter + sort
  ---------------------------------------------------------------- */
  let activeFilter = "all";
  let activeSort = "featured";
  let searchTerm = "";

  function visibleProducts() {
    // Sold-out pieces stay on the page (browse-only, no Add button) — they show
    // the range of Freda's work. They just sort to the end.
    let list = CATALOG.slice();
    // "Sale" is its own category: those items show ONLY on the Sale page, never
    // under Bags/Accessories or in Shop All.
    const isSaleCat = (p) => String(p.category || "").toLowerCase() === "sale";
    if (activeFilter === "sale") list = list.filter((p) => isSaleCat(p) || p.sale != null);
    else if (activeFilter === "all") list = list.filter((p) => !isSaleCat(p));
    else list = list.filter((p) => p.category === activeFilter);
    if (searchTerm) {
      const t = searchTerm.toLowerCase();
      list = list.filter((p) =>
        (p.name + " " + p.category + " " + p.subcategory + " " + p.desc).toLowerCase().includes(t));
    }
    switch (activeSort) {
      case "price-asc": list.sort((a, b) => priceOf(a) - priceOf(b)); break;
      case "price-desc": list.sort((a, b) => priceOf(b) - priceOf(a)); break;
      case "oldest": list.sort((a, b) => String(a.created || "").localeCompare(String(b.created || ""))); break;
      case "newest": list.sort((a, b) => String(b.created || "9999").localeCompare(String(a.created || "9999"))); break;
      default: list.sort((a, b) => (b.featured === true) - (a.featured === true)); break;
    }
    // whatever the sort, what you can actually buy comes first
    list.sort((a, b) => (soldOut(a) ? 1 : 0) - (soldOut(b) ? 1 : 0));
    return list;
  }

  function renderGrid() {
    const grid = $("#grid");
    if (!grid) return;
    const list = visibleProducts();
    grid.innerHTML = list.map(cardHTML).join("");
    const empty = $("#gridEmpty"); if (empty) empty.hidden = list.length > 0;
    const count = $("#gridCount");
    if (count) count.textContent = `${list.length} ${list.length === 1 ? "piece" : "pieces"}`;
    observeReveals(grid);
  }

  function setFilter(f) {
    activeFilter = f;
    $$("#filters .chip").forEach((c) => {
      const on = c.dataset.filter === f;
      c.classList.toggle("is-active", on);
      c.setAttribute("aria-selected", on);
    });
    renderGrid();
  }

  /* ----------------------------------------------------------------
     FEATURED RAIL
  ---------------------------------------------------------------- */
  function renderRail() {
    const track = $("#railTrack");
    if (!track) return;
    // "Fresh off the hook" = the newest products (by date added), in stock. Auto-updates.
    // Sale-category pieces are left out — they live only on the Sale page.
    const feat = CATALOG.filter((p) => !soldOut(p) && String(p.category || "").toLowerCase() !== "sale")
      .slice()
      .sort((a, b) => String(b.created || "9999").localeCompare(String(a.created || "9999")))
      .slice(0, 10);
    track.innerHTML = feat.map(cardHTML).join("");
  }

  /* ----------------------------------------------------------------
     LIVE STOCK — invisible. No storefront badges; this only quietly
     keeps the basket within what's actually available (the server-side
     checkout guard is the real source of truth).
  ---------------------------------------------------------------- */
  function reconcileCart() {
    let changed = false;
    for (const id of Object.keys(cart)) {
      const p = byId(id);
      if (!p || p.stock == null) continue;
      const max = Math.max(0, availOf(p));
      if (cart[id] > max) { if (max === 0) delete cart[id]; else cart[id] = max; changed = true; }
    }
    if (changed) { save(); renderCart(); bumpCount(); toast("Your basket was updated"); }
  }

  async function loadStock() {
    try {
      const res = await fetch("/api/stock", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      SOLD = (data && data.sold) || {};
      renderGrid();   // re-filter the shop now that we know what's actually available
      renderRail();
      reconcileCart();
      // a sold-out product reached by a direct link: disable its add button
      $$("[data-add]").forEach((btn) => {
        if (btn.closest(".card")) return;
        const p = byId(btn.dataset.add);
        if (p && soldOut(p)) { btn.disabled = true; btn.setAttribute("aria-disabled", "true"); btn.textContent = "Sold out"; }
      });
    } catch {}
  }

  /* ----------------------------------------------------------------
     QUICK VIEW MODAL
  ---------------------------------------------------------------- */
  let modalId = null;
  function openModal(id) {
    const p = byId(id); if (!p) return;
    if (!$("#modal")) return;
    modalId = id;
    const off = p.sale != null ? Math.round((1 - p.sale / p.price) * 100) : 0;
    $("#modalImg").src = p.image;
    $("#modalImg").alt = p.name;
    $("#modalCat").textContent = p.subcategory ? `${p.category} · ${p.subcategory}` : p.category;
    $("#modalName").textContent = p.name;
    $("#modalPrice").innerHTML = p.sale != null
      ? `<span class="now">${money(p.sale)}</span><span class="was">${money(p.price)}</span><span class="off">Save ${off}%</span>`
      : `<span class="now">${money(p.price)}</span>`;
    $("#modalDesc").textContent = p.desc;
    // sold out -> browse-only, so the modal's Add button is disabled too
    const mAdd = $("#modalAdd");
    if (mAdd) {
      const out = soldOut(p);
      mAdd.disabled = out;
      mAdd.setAttribute("aria-disabled", String(out));
      mAdd.textContent = out ? "Sold out" : "Add to bag";
    }
    const m = $("#modal");
    m.classList.add("is-open");
    m.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    $("#modalClose").focus();
  }
  function closeModal() {
    const m = $("#modal"); if (!m) return;
    m.classList.remove("is-open");
    m.setAttribute("aria-hidden", "true");
    const c = $("#cart");
    if (!c || !c.classList.contains("is-open")) document.body.style.overflow = "";
    modalId = null;
  }

  /* ----------------------------------------------------------------
     CART / OVERLAY open + close
  ---------------------------------------------------------------- */
  function openCart() {
    const c = $("#cart"); if (!c) return;
    c.classList.add("is-open");
    c.setAttribute("aria-hidden", "false");
    const ov = $("#overlay"); if (ov) ov.hidden = false;
    document.body.style.overflow = "hidden";
  }
  function closeCart() {
    const c = $("#cart"); if (!c) return;
    c.classList.remove("is-open");
    c.setAttribute("aria-hidden", "true");
    const m = $("#modal");
    if (!m || !m.classList.contains("is-open")) {
      const ov = $("#overlay"); if (ov) ov.hidden = true;
      document.body.style.overflow = "";
    }
  }

  /* ----------------------------------------------------------------
     TIKTOK EMBED WATCHDOG
     TikTok's creator embed needs cookie consent it can't get inside a
     third-party iframe. When that happens its script sets the iframe height to
     ~1px and renders nothing, which left a tall blank gap on the homepage.
     If the embed hasn't produced real content shortly after load, swap in the
     "watch on TikTok" card instead.
  ---------------------------------------------------------------- */
  function watchTikTok() {
    const wrap = $("#tiktokEmbed");
    const fallback = $("#tiktokFallback");
    if (!wrap || !fallback) return;
    const COLLAPSED = 120; // a real creator feed is 400px+; 1px means it gave up
    const rendered = () => {
      const f = wrap.querySelector("iframe");
      if (!f) return 0;
      // trust the height TikTok's script set, not our CSS min-height
      const inline = parseInt(f.style.height, 10);
      return Number.isFinite(inline) ? inline : Math.round(f.getBoundingClientRect().height);
    };
    // Keep watching for a while rather than deciding once: a slow connection can
    // deliver a perfectly good embed after the fallback has already shown, and
    // in that case we put the real feed back.
    let tries = 0;
    const timer = setInterval(() => {
      const good = rendered() > COLLAPSED;
      if (good && wrap.hidden) {          // embed recovered — restore it
        wrap.hidden = false;
        fallback.hidden = true;
      } else if (!good && !wrap.hidden && tries >= 4) { // ~3s with no content
        wrap.hidden = true;
        fallback.hidden = false;
      }
      if (++tries >= 27) clearInterval(timer); // stop after ~20s
    }, 750);
  }

  /* ----------------------------------------------------------------
     TOAST
  ---------------------------------------------------------------- */
  let toastTimer;
  function toast(html) {
    const t = $("#toast");
    if (!t) return;
    t.innerHTML = html;
    t.classList.add("is-show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("is-show"), 2600);
  }

  /* ----------------------------------------------------------------
     SCROLL REVEALS + thread draw
  ---------------------------------------------------------------- */
  let io;
  function observeReveals(scope = document) {
    if (!("IntersectionObserver" in window)) {
      $$(".reveal", scope).forEach((el) => el.classList.add("in-view"));
      return;
    }
    if (!io) {
      io = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) { e.target.classList.add("in-view"); io.unobserve(e.target); }
        });
      }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    }
    $$(".reveal:not(.in-view), .thread:not(.in-view)", scope).forEach((el) => io.observe(el));
  }

  /* ----------------------------------------------------------------
     EVENT WIRING
  ---------------------------------------------------------------- */
  function wire() {
    // delegated clicks across the document (works on every page)
    document.addEventListener("click", (e) => {
      const add = e.target.closest("[data-add]");
      const quick = e.target.closest("[data-quick]");
      const wish = e.target.closest("[data-wish]");
      const card = e.target.closest(".card");
      const filterLink = e.target.closest("[data-filter]");
      const soon = e.target.closest("[data-soon]");

      if (add) { e.preventDefault(); addToCart(add.dataset.add); return; }
      if (wish) { e.preventDefault(); toggleWish(wish.dataset.wish); return; }
      if (quick) { e.preventDefault(); openModal(quick.dataset.quick); return; }
      if (soon) { e.preventDefault(); toast(soon.dataset.soon || "Coming soon"); return; }

      // nav / footer links that carry a data-filter -> jump to shop + filter (homepage only)
      if (filterLink && !filterLink.classList.contains("chip")) {
        const shop = $("#shop");
        if (shop) {
          setFilter(filterLink.dataset.filter);
          closeMobile();
          shop.scrollIntoView({ behavior: "smooth", block: "start" });
          e.preventDefault();
        } // else: not on the homepage — let the link navigate normally
        return;
      }

      // clicking the card image (not a button) -> open the product page
      if (card && !e.target.closest("button") && e.target.closest(".card__media")) {
        window.location.href = `product/${card.dataset.id}.html`;
      }
    });

    on("#filters", "click", (e) => {
      const chip = e.target.closest(".chip");
      if (chip) setFilter(chip.dataset.filter);
    });

    on("#sortSelect", "change", (e) => { activeSort = e.target.value; renderGrid(); });

    on("#cartBody", "click", (e) => {
      const inc = e.target.closest("[data-inc]");
      const dec = e.target.closest("[data-dec]");
      const rm = e.target.closest("[data-rm]");
      if (inc) {
        const p = byId(inc.dataset.inc); const next = (cart[inc.dataset.inc] || 0) + 1;
        if (p && next > availOf(p)) toast(`That’s all we have of <b>${p.name}</b> right now`); else setQty(inc.dataset.inc, next);
      }
      if (dec) setQty(dec.dataset.dec, (cart[dec.dataset.dec] || 0) - 1);
      if (rm) { setQty(rm.dataset.rm, 0); toast("Removed from basket"); }
    });

    on("#modalAdd", "click", () => { if (modalId) { addToCart(modalId); closeModal(); openCart(); } });

    on("#cartToggle", "click", openCart);
    on("#cartClose", "click", closeCart);
    on("#modalClose", "click", closeModal);
    on("#overlay", "click", () => { closeCart(); });
    on("#modal", "click", (e) => { if (e.target.id === "modal") closeModal(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") { closeModal(); closeCart(); closeSearch(); } });

    on("#checkoutBtn", "click", checkout);

    // header scroll state
    const header = $("#siteHeader");
    if (header) {
      const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 12);
      onScroll(); window.addEventListener("scroll", onScroll, { passive: true });
    }

    on("#menuToggle", "click", () => {
      const nav = $("#mobileNav"); if (!nav) return;
      const open = nav.hidden;
      nav.hidden = !open;
      $("#menuToggle").setAttribute("aria-expanded", open);
      document.body.style.overflow = open ? "hidden" : "";
    });
    on("#mobileNav", "click", (e) => { if (e.target.closest("a")) closeMobile(); });

    on("#searchToggle", "click", () => {
      const bar = $("#searchbar"); if (!bar) return;
      bar.hidden = !bar.hidden;
      if (!bar.hidden) $("#searchInput").focus();
    });
    on("#searchClose", "click", closeSearch);
    on("#searchInput", "input", (e) => {
      searchTerm = e.target.value.trim();
      if (searchTerm && activeFilter !== "all") setFilter("all"); else renderGrid();
      const shop = $("#shop");
      if (searchTerm && shop) shop.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    const track = $("#railTrack");
    if (track) {
      const step = () => Math.min(track.clientWidth * 0.8, 640);
      on("#railNext", "click", () => track.scrollBy({ left: step(), behavior: "smooth" }));
      on("#railPrev", "click", () => track.scrollBy({ left: -step(), behavior: "smooth" }));
    }

    on("#newsForm", "submit", (e) => {
      e.preventDefault();
      const email = $("#newsEmail").value.trim();
      const ok = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
      const msg = $("#newsMsg");
      if (msg) {
        msg.textContent = ok ? "You're on the list — welcome, friend ♥" : "Hmm, that email doesn't look right.";
        msg.style.color = ok ? "var(--terra)" : "#c0392b";
      }
      if (ok) $("#newsForm").reset();
    });

    // Contact form -> open WhatsApp with the enquiry pre-filled
    on("#contactForm", "submit", (e) => {
      e.preventDefault();
      const form = e.currentTarget;
      const wa = (form.dataset.wa || "").replace(/[^0-9]/g, "");
      const name = ($("#cfName") && $("#cfName").value.trim()) || "";
      const email = ($("#cfEmail") && $("#cfEmail").value.trim()) || "";
      const msg = ($("#cfMsg") && $("#cfMsg").value.trim()) || "";
      if (!wa) { toast("Sorry, messaging is unavailable right now."); return; }
      const text = `Hi Crafting Yarn! 🧶\n\nName: ${name}\nEmail: ${email}\n\n${msg}`;
      window.open(`https://wa.me/${wa}?text=${encodeURIComponent(text)}`, "_blank", "noopener");
      toast("Opening WhatsApp — send your message to reach us ♥");
    });

    $$("#year").forEach((el) => (el.textContent = new Date().getFullYear()));
  }

  /* ----------------------------------------------------------------
     CHECKOUT — hands off to a Stripe Checkout Session created
     server-side by the Cloudflare Pages Function at /api/checkout.
     Falls back gracefully on the local static preview.
  ---------------------------------------------------------------- */
  async function checkout() {
    if (!cartCount()) { toast("Your basket is empty"); return; }
    const btn = $("#checkoutBtn");
    const original = btn ? btn.textContent : "";
    if (btn) { btn.disabled = true; btn.textContent = "Taking you to checkout…"; }
    const items = Object.entries(cart).map(([id, qty]) => ({ id, qty }));
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data && data.url) { window.location.href = data.url; return; }
      if (res.status === 409) { // an item sold out (or not enough left) while browsing
        toast(data.error || "Some items just sold out — your basket was updated");
        loadStock();
        if (btn) { btn.disabled = false; btn.textContent = original; }
        return;
      }
      throw new Error("checkout unavailable (" + res.status + ")");
    } catch (err) {
      toast(`Online checkout opens very soon — to order now, message us <b>@craftingyarn</b> on Instagram ♥`);
      if (btn) { btn.disabled = false; btn.textContent = original; }
    }
  }

  function closeMobile() {
    const nav = $("#mobileNav"); if (!nav) return;
    nav.hidden = true;
    const t = $("#menuToggle"); if (t) t.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
  }
  function closeSearch() {
    const bar = $("#searchbar"); if (!bar) return;
    bar.hidden = true;
    const input = $("#searchInput");
    if (input && input.value) { input.value = ""; searchTerm = ""; renderGrid(); }
  }

  /* ----------------------------------------------------------------
     INIT
  ---------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    // returning from a successful Stripe Checkout -> empty the basket
    if (/[?&]paid=1\b/.test(location.search)) { cart = {}; save(); }
    // category page (bags/clothing/accessories) -> lock the grid to that category
    const gridEl = $("#grid");
    if (gridEl && gridEl.dataset.category) activeFilter = gridEl.dataset.category;
    renderRail();
    renderGrid();
    renderCart();
    wire();
    loadStock();
    watchTikTok();
    // arriving from another page with ?cat=Bags -> preselect that filter
    const cat = new URLSearchParams(location.search).get("cat");
    if (cat && $(`#filters .chip[data-filter="${cat}"]`)) setFilter(cat);
    observeReveals(document);
  });
})();
