const OpenAI = require('openai');

let openai;

function getOpenAI() {
  if (!openai) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

const SYSTEM_PROMPT = `You are a helpful customer support agent for a Shopify store.
Your job is to resolve customer issues quickly and accurately.
Be concise, friendly, and solution-focused.
If you cannot resolve an issue, clearly state what the customer needs to do next.`;

/**
 * Main agent pipeline: receives a Shopify event and resolves it.
 * For v0.1, handles basic order-related messages.
 */
async function handleSupportTicket({ topic, shop, payload }) {
  console.log(`[agent] handling topic=${topic} for shop=${shop}`);

  // Build context from webhook payload
  const context = buildContext(topic, payload);
  if (!context) {
    console.log(`[agent] no handler for topic=${topic}, skipping`);
    return;
  }

  // Call LLM to draft a response
  const draft = await draftResponse(context);
  console.log(`[agent] draft response for ${shop}:`, draft);

  // TODO: post draft back via Shopify API or email in v0.2
  return draft;
}

function buildContext(topic, payload) {
  switch (topic) {
    case 'orders/create':
      return `A new order was placed. Order ID: ${payload.id}, Total: ${payload.total_price} ${payload.currency}. Customer: ${payload.email}.`;
    case 'orders/cancelled':
      return `Order ${payload.id} was cancelled. Reason: ${payload.cancel_reason || 'not specified'}. Customer: ${payload.email}.`;
    case 'refunds/create':
      return `A refund was created for order ${payload.order_id}. Amount: ${payload.transactions?.[0]?.amount || 'unknown'}.`;
    default:
      return null;
  }
}

async function draftResponse(context) {
  const ai = getOpenAI();
  const completion = await ai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: context },
    ],
    max_tokens: 300,
  });
  return completion.choices[0].message.content;
}

module.exports = { handleSupportTicket };
