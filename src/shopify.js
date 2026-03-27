const crypto = require('crypto');

/**
 * Verify Shopify webhook HMAC signature.
 * Returns true if valid (or if SHOPIFY_WEBHOOK_SECRET is not set — dev mode).
 */
function verifyWebhookHmac(rawBody, hmacHeader) {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!secret) {
    console.warn('[shopify] SHOPIFY_WEBHOOK_SECRET not set — skipping HMAC check');
    return true;
  }
  const digest = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('base64');
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmacHeader || ''));
}

/**
 * Build a minimal Shopify Admin REST client for a given shop.
 * Uses the access token stored per-shop (to be implemented in auth flow).
 */
function shopifyClient(shop, accessToken) {
  const baseUrl = `https://${shop}/admin/api/2024-01`;

  async function request(method, path, body = null) {
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Shopify API ${method} ${path} → ${res.status}: ${text}`);
    }
    return res.json();
  }

  return {
    getOrder: (orderId) => request('GET', `/orders/${orderId}.json`),
    getCustomer: (customerId) => request('GET', `/customers/${customerId}.json`),
  };
}

module.exports = { verifyWebhookHmac, shopifyClient };
