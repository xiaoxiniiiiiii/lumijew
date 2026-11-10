import { isAdmin, unauthorized } from '../../../functions-lib/admin-auth.js';
import { errorResponse, json } from '../../../functions-lib/api-shared.js';

export async function onRequestGet({ request, env }) {
  if (!(await isAdmin(request, env))) return unauthorized();
  try {
    if (!env.ORDERS_DB) throw Object.assign(new Error('Order storage is not configured.'), { status: 503 });
    const result = await env.ORDERS_DB.prepare(
      'SELECT order_id AS orderId, capture_id AS captureId, amount, currency, status, items_json AS itemsJson, created_at AS createdAt FROM paid_orders ORDER BY created_at DESC LIMIT 50'
    ).all();
    const orders = (result.results || []).map(row => ({
      ...row,
      items: JSON.parse(row.itemsJson)
    }));
    return json({ orders });
  } catch (error) {
    return errorResponse(error);
  }
}
