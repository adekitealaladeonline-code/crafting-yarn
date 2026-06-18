// Cloudflare Pages Function — POST /api/checkout
// Creates a Stripe Checkout Session and returns its hosted URL.
//
// Security model:
//   • Prices come from the SERVER-side map (functions/_catalog.js), never the
//     browser — the client only sends product ids + quantities.
//   • The Stripe secret key lives in the Cloudflare env var STRIPE_SECRET_KEY,
//     set in the Pages project dashboard. It is never in the code or the client.
//   • Card details only ever touch Stripe's hosted checkout page (PCI-safe).

import { PRODUCTS } from "../_catalog.js";

export async function onRequestPost({ request, env }) {
  const json = (data, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

  if (!env.STRIPE_SECRET_KEY) {
    return json({ error: "Stripe is not configured yet (missing STRIPE_SECRET_KEY)." }, 500);
  }

  let body;
  try { body = await request.json(); } catch { return json({ error: "Invalid request." }, 400); }

  const items = Array.isArray(body && body.items) ? body.items : [];
  if (!items.length) return json({ error: "Your basket is empty." }, 400);

  const origin = new URL(request.url).origin;
  const params = new URLSearchParams();
  params.set("mode", "payment");
  params.set("success_url", `${origin}/success.html?paid=1&session_id={CHECKOUT_SESSION_ID}`);
  params.set("cancel_url", `${origin}/?checkout=cancelled`);
  params.set("phone_number_collection[enabled]", "true");
  // Made to order ships from the UAE; expand this list as the shop grows.
  ["AE", "SA", "OM", "BH", "KW", "QA", "GB", "US"].forEach((c, i) =>
    params.set(`shipping_address_collection[allowed_countries][${i}]`, c)
  );

  let line = 0;
  for (const { id, qty } of items) {
    const p = PRODUCTS[id];
    const quantity = Math.max(1, Math.min(99, parseInt(qty, 10) || 1));
    if (!p) continue; // ignore unknown ids
    params.set(`line_items[${line}][quantity]`, String(quantity));
    params.set(`line_items[${line}][price_data][currency]`, "aed");
    params.set(`line_items[${line}][price_data][unit_amount]`, String(p.amount));
    params.set(`line_items[${line}][price_data][product_data][name]`, p.name);
    if (p.image) {
      const imgUrl = new URL(p.image, origin).href;
      params.set(`line_items[${line}][price_data][product_data][images][0]`, imgUrl);
    }
    line++;
  }
  if (line === 0) return json({ error: "No valid items in basket." }, 400);

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });

  const session = await res.json();
  if (!res.ok) {
    return json({ error: (session.error && session.error.message) || "Could not start checkout." }, 502);
  }
  return json({ url: session.url });
}
