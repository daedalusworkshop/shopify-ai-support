/**
 * Per-store API key authentication middleware.
 *
 * Store keys are defined in env var STORE_API_KEYS as JSON:
 *   STORE_API_KEYS={"mystore.myshopify.com":"sk_live_xxx","other.myshopify.com":"sk_live_yyy"}
 *
 * Requests must include:
 *   X-Store-Api-Key: <key>
 *   X-Store-Shop: <shop-domain>  (or pass shop in request body)
 */
function storeApiKeyAuth(req, res, next) {
  const apiKey = req.headers['x-store-api-key'];
  const shop = req.headers['x-store-shop'] || req.body?.shop;

  if (!apiKey || !shop) {
    return res.status(401).json({ error: 'Missing X-Store-Api-Key or shop identifier' });
  }

  const keys = parseStoreKeys();
  if (!keys) {
    // No keys configured — dev mode, allow through
    console.warn('[auth] STORE_API_KEYS not set — skipping auth (dev mode)');
    req.shop = shop;
    return next();
  }

  if (keys[shop] !== apiKey) {
    return res.status(403).json({ error: 'Invalid API key for shop' });
  }

  req.shop = shop;
  next();
}

function parseStoreKeys() {
  try {
    return process.env.STORE_API_KEYS ? JSON.parse(process.env.STORE_API_KEYS) : null;
  } catch {
    console.error('[auth] Failed to parse STORE_API_KEYS — must be valid JSON');
    return null;
  }
}

module.exports = { storeApiKeyAuth };
