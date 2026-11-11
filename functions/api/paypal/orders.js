import { errorResponse, getCatalogItems, json, paypalToken, readJson } from '../../../functions-lib/api-shared.js';

export async function onRequestPost({ request, env }) {
  try {
    if (!env.ORDERS_DB) throw Object.assign(new Error('Order storage is not configured.'), { status: 503 });
    const input = await readJson(request);
    const { items, total } = getCatalogItems(input.items);
    const { base, token } = await paypalToken(env);
    const paypalItems = items.map(item => ({
      name: item.name,
      sku: item.sku,
      quantity: String(item.quantity),
      unit_amount: { currency_code: 'USD', value: item.unitPrice },
      category: 'PHYSICAL_GOODS'
    }));
    const response = await fetch(`${base}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': crypto.randomUUID()
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          reference_id: crypto.randomUUID(),
          description: 'Rubaoge wholesale accessories',
          amount: { currency_code: 'USD', value: total, breakdown: { item_total: { currency_code: 'USD', value: total } } },
          items: paypalItems
        }],
        application_context: { brand_name: 'Rubaoge Wholesale Accessories', user_action: 'PAY_NOW', shipping_preference: 'GET_FROM_FILE' }
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.id) throw Object.assign(new Error('PayPal could not create this order.'), { status: 502 });

    await env.ORDERS_DB.prepare(
      'INSERT INTO pending_orders (order_id, amount, items_json, created_at) VALUES (?, ?, ?, ?)'
    ).bind(payload.id, total, JSON.stringify(items), new Date().toISOString()).run();
    return json({ id: payload.id }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
