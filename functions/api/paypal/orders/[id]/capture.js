import { errorResponse, json, paypalToken } from '../../../../../functions-lib/api-shared.js';

function matchesCatalogOrder(purchaseUnit, items, amount) {
  if (!purchaseUnit || purchaseUnit.amount?.currency_code !== 'USD' || purchaseUnit.amount?.value !== amount) return false;
  const paypalItems = purchaseUnit.items || [];
  if (paypalItems.length !== items.length) return false;
  const bySku = new Map(paypalItems.map(item => [item.sku, item]));
  return items.every(item => {
    const match = bySku.get(item.sku);
    return match && match.name === item.name && match.quantity === String(item.quantity)
      && match.unit_amount?.currency_code === 'USD' && match.unit_amount?.value === item.unitPrice;
  });
}

export async function onRequestPost({ request, env, params }) {
  try {
    if (!env.ORDERS_DB) throw Object.assign(new Error('Order storage is not configured.'), { status: 503 });
    const orderId = String(params.id || '');
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(orderId)) throw Object.assign(new Error('Invalid PayPal order.'), { status: 400 });
    const pending = await env.ORDERS_DB.prepare(
      'SELECT amount, items_json, created_at FROM pending_orders WHERE order_id = ?'
    ).bind(orderId).first();
    if (!pending || Date.now() - Date.parse(pending.created_at) > 30 * 60 * 1000) {
      throw Object.assign(new Error('This PayPal order is missing or expired. Please start checkout again.'), { status: 404 });
    }
    const { base, token } = await paypalToken(env);
    const getResponse = await fetch(`${base}/v2/checkout/orders/${encodeURIComponent(orderId)}`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    });
    const order = await getResponse.json().catch(() => ({}));
    const items = JSON.parse(pending.items_json);
    if (!getResponse.ok || order.intent !== 'CAPTURE' || order.status !== 'APPROVED'
      || order.purchase_units?.length !== 1
      || !matchesCatalogOrder(order.purchase_units[0], items, pending.amount)) {
      throw Object.assign(new Error('The approved PayPal order does not match the store order.'), { status: 409 });
    }

    const response = await fetch(`${base}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'PayPal-Request-Id': `capture-${orderId}` }
    });
    const captured = await response.json().catch(() => ({}));
    const capture = captured.purchase_units?.[0]?.payments?.captures?.[0];
    if (!response.ok || captured.status !== 'COMPLETED' || capture?.status !== 'COMPLETED'
      || capture?.amount?.currency_code !== 'USD' || capture?.amount?.value !== pending.amount) {
      throw Object.assign(new Error('PayPal did not complete the payment. Please contact support before retrying.'), { status: 502 });
    }

    await env.ORDERS_DB.batch([
      env.ORDERS_DB.prepare(
        'INSERT INTO paid_orders (order_id, capture_id, amount, currency, status, items_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).bind(orderId, capture.id, pending.amount, 'USD', 'COMPLETED', pending.items_json, new Date().toISOString()),
      env.ORDERS_DB.prepare('DELETE FROM pending_orders WHERE order_id = ?').bind(orderId)
    ]);
    return json({ status: 'COMPLETED', orderId, captureId: capture.id, amount: pending.amount, currency: 'USD' });
  } catch (error) {
    return errorResponse(error);
  }
}
