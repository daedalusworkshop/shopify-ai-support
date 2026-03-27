# shopify-ai-support

AI Customer Support Agent for Shopify SMBs. Auto-resolves store support tickets using GPT-4o-mini.

**Target:** Store owners doing $5K–$100K/month
**Price:** $199/month
**Token cost target:** <$20/month per store

## Stack

| Layer | Choice | Why |
|---|---|---|
| Runtime | Node.js 18+ | Fast startup, huge npm ecosystem, easy Railway deploy |
| Framework | Express | Minimal, production-proven webhook handling |
| LLM | OpenAI gpt-4o-mini | Cheapest capable model — hits <$20/mo token target |
| Deploy | Railway | One-click deploys from GitHub, free tier available |

## Project Structure

```
src/
  index.js    — Express app, webhook receiver endpoint
  agent.js    — LLM pipeline: build context → draft response
  shopify.js  — Shopify HMAC verification + Admin API client
```

## Local Development

```bash
cp .env.example .env
# fill in your keys

npm install
npm run dev
```

Test the webhook endpoint:
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
3. Set env vars: `OPENAI_API_KEY`, `SHOPIFY_WEBHOOK_SECRET`
4. Railway auto-detects Node.js and deploys — get your public URL

## Webhook Setup in Shopify

In your Shopify Partner Dashboard or store admin, add webhooks pointing to:
```
https://<your-railway-url>/webhooks/shopify
```

Recommended topics to subscribe to:
- `orders/create`
- `orders/cancelled`
- `refunds/create`

## Roadmap

- v0.1: Webhook receiver + LLM draft response (this PR)
- v0.2: Post response back via Shopify email / helpdesk API
- v0.3: Per-store auth flow (OAuth), multi-tenant storage
- v0.4: Stripe billing at $199/month
