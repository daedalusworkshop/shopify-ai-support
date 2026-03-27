require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { handleSupportTicket, handleDirectMessage } = require('./agent');
const { verifyWebhookHmac } = require('./shopify');
const { storeApiKeyAuth } = require('./auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Raw body needed for HMAC verification on webhook route
app.use('/webhooks', bodyParser.raw({ type: 'application/json' }));
app.use(bodyParser.json());

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'shopify-ai-support', version: '0.1.0' });
});

// -------------------------------------------------------------------
// POST /messages — Direct customer message → AI reply (end-to-end test)
//
// Headers:
//   X-Store-Api-Key: <per-store key>
//   X-Store-Shop: <shop-domain>        (or pass "shop" in body)
//
// Body:
//   { "customerMessage": "Where is my order #1234?", "orderId": "1234" }
//
// Response:
//   { "intent": "order_status", "reply": "...", "orderData": {...} | null }
// -------------------------------------------------------------------
app.post('/messages', storeApiKeyAuth, async (req, res) => {
  const { customerMessage, orderId } = req.body;

  if (!customerMessage) {
    return res.status(400).json({ error: 'customerMessage is required' });
  }

  try {
    const result = await handleDirectMessage({
      shop: req.shop,
      customerMessage,
      orderId: orderId || null,
    });
    res.json(result);
  } catch (err) {
    console.error('[messages] error:', err.message);
    res.status(500).json({ error: 'Agent pipeline failed', detail: err.message });
  }
});

// -------------------------------------------------------------------
// POST /webhooks/shopify — Shopify webhook receiver
// -------------------------------------------------------------------
app.post('/webhooks/shopify', async (req, res) => {
  const hmacHeader = req.headers['x-shopify-hmac-sha256'];

  if (!verifyWebhookHmac(req.body, hmacHeader)) {
    return res.status(401).json({ error: 'Invalid HMAC' });
  }

  // Acknowledge immediately — Shopify expects <5s response
  res.status(200).json({ received: true });

  try {
    const payload = JSON.parse(req.body.toString('utf8'));
    const topic = req.headers['x-shopify-topic'];
    const shop = req.headers['x-shopify-shop-domain'];

    console.log(`[webhook] topic=${topic} shop=${shop}`);
    await handleSupportTicket({ topic, shop, payload });
  } catch (err) {
    console.error('[webhook] processing error:', err.message);
  }
});

app.listen(PORT, () => {
  console.log(`shopify-ai-support listening on port ${PORT}`);
});
