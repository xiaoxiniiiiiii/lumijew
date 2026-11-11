import { products } from '../src/catalog.js';

const json = (value, status = 200) => Response.json(value, {
  status,
  headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
});

export async function readJson(request, maxBytes = 16_384) {
  if (!request.headers.get('content-type')?.includes('application/json')) {
    throw Object.assign(new Error('Send a JSON request.'), { status: 415 });
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    throw Object.assign(new Error('Request body is too large.'), { status: 413 });
  }
  try {
    return JSON.parse(text || '{}');
  } catch {
    throw Object.assign(new Error('Invalid JSON request.'), { status: 400 });
  }
}

export async function paypalToken(env) {
  if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_CLIENT_SECRET) {
    throw Object.assign(new Error('PayPal is not configured.'), { status: 503 });
  }
  const base = env.PAYPAL_ENV === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
  const basic = btoa(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`);
  const response = await fetch(`${base}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials'
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) {
    throw Object.assign(new Error('PayPal authorization failed.'), { status: 502 });
  }
  return { base, token: payload.access_token };
}

export function getCatalogItems(items) {
  if (!Array.isArray(items) || items.length < 1 || items.length > 80) {
    throw Object.assign(new Error('Your shopping bag is empty or invalid.'), { status: 400 });
  }
  const result = [];
  for (const item of items) {
    const product = products.find(entry => entry.id === item.id);
    const quantity = Number(item.quantity);
    if (!product || !Number.isSafeInteger(quantity) || quantity < product.moq || quantity > 1000 || quantity % product.moq !== 0) {
      throw Object.assign(new Error('An item or its wholesale minimum quantity is invalid.'), { status: 400 });
    }
    result.push({
      name: product.name,
      sku: product.sku,
      quantity,
      unitPrice: product.price.toFixed(2),
      lineTotal: (product.price * quantity).toFixed(2)
    });
  }
  const total = result.reduce((sum, item) => sum + Number(item.lineTotal), 0);
  if (!Number.isFinite(total) || total <= 0) {
    throw Object.assign(new Error('The order total is invalid.'), { status: 400 });
  }
  return { items: result, total: total.toFixed(2) };
}

export function errorResponse(error) {
  const status = Number(error?.status);
  const safeStatus = status >= 400 && status < 600 ? status : 500;
  if (safeStatus >= 500) console.error('Pages API request failed:', error?.message || 'Unknown error');
  return json({ error: safeStatus >= 500 ? 'The payment service is temporarily unavailable. Please retry.' : error.message }, safeStatus);
}

export { json };
