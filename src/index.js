require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { handleSupportTicket } = require('./agent');
const { verifyWebhookHmac } = require('./shopify');

const app = express();
const PORT = process.env.PORT || 3000;

// Raw body needed for HMAC verification
app.use('/webhooks', bodyParser.raw({ type: 'application/json' }));
app.use(bodyParser.json());

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'shopify-ai-support', version: '0.1.0' });
});

// Shopify webhook: new support ticket / order / customer message
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
