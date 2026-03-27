# shopify-ai-support

AI Customer Support Agent for Shopify SMBs. Auto-resolves store support tickets using Claude.

**Target:** Store owners doing $5K–$100K/month
**Price:** $199/month
**Token cost target:** <$20/month per store

## Stack

| Layer | Choice | Why |
|---|---|---|
| Runtime | Node.js 18+ | Fast startup, easy Railway deploy |
| Framework | Express | Minimal, production-proven webhook handling |
| LLM (classify) | Claude Haiku | Cheap intent classification — <$1/month per store |
| LLM (reply) | Claude Sonnet | Quality customer-facing replies |
| Deploy | Railway | One-click deploys from GitHub, free tier available |

## Project Structure

```
src/
  index.js    — Express app, /messages endpoint + webhook receiver
  agent.js    — LLM pipeline: classify intent → fetch order → draft reply
  shopify.js  — Shopify HMAC verification + Admin API client
  auth.js     — Per-store API key authentication middleware
```

## How it works

1. Customer message arrives (via `/messages` API or Shopify webhook)
2. **Claude Haiku** classifies intent: `order_status`, `return_request`, `general_faq`, `other`
3. If `order_status` or `return_request`: fetch live order data from Shopify Admin API
4. **Claude Sonnet** generates a reply using the intent + order context
5. Reply is returned / logged (webhook reply delivery coming in v0.2)

## Local Development

```bash
cp .env.example .env
# fill in your keys

npm install
npm run dev
```

## Environment Variables

```env
ANTHROPIC_API_KEY=sk-ant-...

# Optional: Shopify HMAC verification (webhook security)
SHOPIFY_WEBHOOK_SECRET=your-secret

# Optional: Per-store API keys for /messages endpoint (JSON)
STORE_API_KEYS={"mystore.myshopify.com":"sk_live_abc123"}

# Optional: Shopify access tokens for order lookups (JSON)
SHOPIFY_ACCESS_TOKENS={"mystore.myshopify.com":"shpat_xxx"}
```

## Test the /messages endpoint

```bash
# Basic FAQ
curl -X POST http://localhost:3000/messages \
  -H "Content-Type: application/json" \
  -H "X-Store-Api-Key: sk_live_abc123" \
  -H "X-Store-Shop: mystore.myshopify.com" \
  -d '{"customerMessage": "What is your return policy?"}'

# Order status (with orderId)
curl -X POST http://localhost:3000/messages \
  -H "Content-Type: application/json" \
  -H "X-Store-Api-Key: sk_live_abc123" \
  -H "X-Store-Shop: mystore.myshopify.com" \
  -d '{"customerMessage": "Where is my order #1234?", "orderId": "1234"}'

# Dev mode (no STORE_API_KEYS set) — auth skipped
curl -X POST http://localhost:3000/messages \
  -H "Content-Type: application/json" \
  -H "X-Store-Api-Key: any" \
  -H "X-Store-Shop: mystore.myshopify.com" \
  -d '{"customerMessage": "I want to return my purchase"}'
```

## Test the Shopify webhook

```bash
curl -X POST http://localhost:3000/webhooks/shopify \
  -H "Content-Type: application/json" \
  -H "x-shopify-topic: orders/create" \
  -H "x-shopify-shop-domain: mystore.myshopify.com" \
  -d '{"id":1234,"total_price":"59.99","currency":"USD","email":"buyer@example.com"}'
```

## Deploy to Railway

1. Push this repo to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub repo
3. Set env vars: `ANTHROPIC_API_KEY`, `SHOPIFY_WEBHOOK_SECRET`, `STORE_API_KEYS`
4. Railway auto-detects Node.js and deploys — get your public URL

## Webhook Setup in Shopify

In your Shopify Partner Dashboard or store admin, add webhooks pointing to:
```
https://<your-railway-url>/webhooks/shopify
```

Recommended topics:
- `orders/create`
- `orders/cancelled`
- `refunds/create`

## Roadmap

- v0.1: Full agent pipeline — classify → order lookup → reply (this release)
- v0.2: Post reply back via Shopify email / helpdesk API
- v0.3: OAuth per-store auth flow, multi-tenant storage
- v0.4: Stripe billing at $199/month
