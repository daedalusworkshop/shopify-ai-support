const Anthropic = require('@anthropic-ai/sdk');
const { shopifyClient } = require('./shopify');

let anthropic;
function getAnthropic() {
  if (!anthropic) {
    anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropic;
}

const INTENTS = ['order_status', 'return_request', 'general_faq', 'other'];

/**
 * Classify customer intent using Claude Haiku (cheap, fast).
 * Returns one of: order_status | return_request | general_faq | other
 */
async function classifyIntent(message) {
  const ai = getAnthropic();
  const result = await ai.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 20,
    messages: [
      {
        role: 'user',
        content: `Classify this customer support message into exactly one category: order_status, return_request, general_faq, or other.\nRespond with only the category name.\n\nMessage: "${message}"`,
      },
    ],
  });
  const raw = result.content[0].text.trim().toLowerCase();
  return INTENTS.includes(raw) ? raw : 'other';
}

/**
 * Fetch minimal order data from Shopify API if we have access.
 * Returns a brief summary string or null.
 */
async function fetchOrderSummary(orderId, shop) {
  if (!orderId || !shop) return null;

  const tokens = parseEnvJson('SHOPIFY_ACCESS_TOKENS');
  const accessToken = tokens?.[shop];
  if (!accessToken) return null;

  try {
    const client = shopifyClient(shop, accessToken);
    const data = await client.getOrder(orderId);
    const o = data.order;
    if (!o) return null;
    // Extract only the fields we need to keep context short
    return {
      id: o.id,
      name: o.name,
      status: o.fulfillment_status || 'unfulfilled',
      financial_status: o.financial_status,
      total_price: `${o.total_price} ${o.currency}`,
      created_at: o.created_at,
      tracking_url: o.fulfillments?.[0]?.tracking_url || null,
      line_items: (o.line_items || []).map((i) => `${i.quantity}x ${i.name}`).join(', '),
    };
  } catch (err) {
    console.error('[agent] Shopify order fetch failed:', err.message);
    return null;
  }
}

/**
 * Generate a reply using Claude Sonnet (quality model for customer-facing text).
 */
async function generateReply(intent, customerMessage, orderData) {
  const ai = getAnthropic();

  let context = `Customer intent: ${intent}\nCustomer message: "${customerMessage}"`;
  if (orderData) {
    context += `\n\nOrder data:\n${JSON.stringify(orderData, null, 2)}`;
  }

  const result = await ai.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 300,
    system:
      'You are a helpful customer support agent for a Shopify store. ' +
      'Respond concisely and warmly. Resolve the issue if possible. ' +
      'If you lack information to fully resolve it, explain the next step clearly.',
    messages: [{ role: 'user', content: context }],
  });

  return result.content[0].text.trim();
}

/**
 * Handle a direct customer message (used by the /messages API endpoint).
 * Full pipeline: classify → optional order fetch → generate reply → return.
 */
async function handleDirectMessage({ shop, customerMessage, orderId }) {
  const intent = await classifyIntent(customerMessage);
  console.log(`[agent] shop=${shop} intent=${intent}`);

  let orderData = null;
  if (intent === 'order_status' || intent === 'return_request') {
    // Try to extract orderId from message if not provided
    const extractedId = orderId || extractOrderId(customerMessage);
    orderData = await fetchOrderSummary(extractedId, shop);
  }

  const reply = await generateReply(intent, customerMessage, orderData);
  return { intent, reply, orderData };
}

/**
 * Handle an inbound Shopify webhook event.
 */
async function handleSupportTicket({ topic, shop, payload }) {
  console.log(`[agent] webhook topic=${topic} shop=${shop}`);

  const message = buildMessageFromWebhook(topic, payload);
  if (!message) {
    console.log(`[agent] no handler for topic=${topic}, skipping`);
    return;
  }

  const orderId = payload.id ? String(payload.id) : null;
  const result = await handleDirectMessage({ shop, customerMessage: message, orderId });
  console.log(`[agent] reply for ${shop} (${topic}):`, result.reply);
  return result;
}

// --- Helpers ---

function buildMessageFromWebhook(topic, payload) {
  switch (topic) {
    case 'orders/create':
      return `A new order was placed. Order #${payload.id}, total ${payload.total_price} ${payload.currency}. Customer: ${payload.email}.`;
    case 'orders/cancelled':
      return `Order #${payload.id} was cancelled. Reason: ${payload.cancel_reason || 'not specified'}. Customer: ${payload.email}.`;
    case 'refunds/create':
      return `A refund was created for order #${payload.order_id}. Amount: ${payload.transactions?.[0]?.amount || 'unknown'}.`;
    default:
      return null;
  }
}

function extractOrderId(message) {
  const match = message.match(/#?(\d{4,})/);
  return match ? match[1] : null;
}

function parseEnvJson(key) {
  try {
    return process.env[key] ? JSON.parse(process.env[key]) : null;
  } catch {
    return null;
  }
}

module.exports = { handleSupportTicket, handleDirectMessage };
