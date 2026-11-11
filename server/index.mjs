import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { products } from '../src/catalog.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envFile = path.join(root, '.env');
const orderFile = path.join(root, 'data', 'orders.json');
if (existsSync(envFile)) process.loadEnvFile(envFile);

const managedKeys = ['ADMIN_USERNAME', 'ADMIN_PASSWORD', 'PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET', 'PAYPAL_ENV'];
const defaults = {
  ADMIN_USERNAME: process.env.ADMIN_USERNAME || 'admin@rubaoge.local',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || randomBytes(24).toString('base64url'),
  PAYPAL_CLIENT_ID: process.env.PAYPAL_CLIENT_ID || '',
  PAYPAL_CLIENT_SECRET: process.env.PAYPAL_CLIENT_SECRET || '',
  PAYPAL_ENV: process.env.PAYPAL_ENV === 'live' ? 'live' : 'sandbox'
};
let firstRunPassword = !process.env.ADMIN_PASSWORD;
const createdOrders = new Map();
const apiBase = () => process.env.PAYPAL_ENV === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';

async function saveConfig(values) {
  const existing = existsSync(envFile) ? await readFile(envFile, 'utf8') : '';
  const lines = existing.split(/\r?\n/).filter(line => !managedKeys.some(key => new RegExp(`^\\s*(?:export\\s+)?${key}\\s*=`).test(line)));
  const next = { ...defaults, ...values };
  for (const key of managedKeys) process.env[key] = String(next[key] ?? '');
  for (const key of managedKeys) lines.push(`${key}=${JSON.stringify(String(next[key] ?? ''))}`);
  await writeFile(envFile, `${lines.filter(Boolean).join('\n')}\n`, { encoding: 'utf8', mode: 0o600 });
  Object.assign(defaults, next);
}

if (firstRunPassword || !existsSync(envFile)) await saveConfig({});

function json(res, status, value, extra = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra });
  res.end(JSON.stringify(value));
}

function adminAuthorized(req) {
  const match = /^Basic\s+(.+)$/i.exec(req.headers.authorization || '');
  if (!match) return false;
  let decoded;
  try { decoded = Buffer.from(match[1], 'base64').toString('utf8'); } catch { return false; }
  const divider = decoded.indexOf(':');
  if (divider < 0) return false;
  const username = decoded.slice(0, divider);
  const password = decoded.slice(divider + 1);
  const safeEqual = (a, b) => {
    const left = Buffer.from(String(a));
    const right = Buffer.from(String(b));
    return left.length === right.length && timingSafeEqual(left, right);
  };
  return safeEqual(username, defaults.ADMIN_USERNAME) && safeEqual(password, defaults.ADMIN_PASSWORD);
}

async function readBody(req, limit = 16384) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw Object.assign(new Error('Request body is too large.'), { statusCode: 413 });
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); }
  catch { throw Object.assign(new Error('Invalid JSON request.'), { statusCode: 400 }); }
}

async function paypalToken() {
  if (!defaults.PAYPAL_CLIENT_ID || !defaults.PAYPAL_CLIENT_SECRET) throw Object.assign(new Error('PayPal credentials have not been configured.'), { statusCode: 503 });
  const response = await fetch(`${apiBase()}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${Buffer.from(`${defaults.PAYPAL_CLIENT_ID}:${defaults.PAYPAL_CLIENT_SECRET}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials'
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.access_token) throw Object.assign(new Error('PayPal could not authorize these credentials.'), { statusCode: 502 });
  return body.access_token;
}

function publicPayPalConfig() {
  return { configured: Boolean(defaults.PAYPAL_CLIENT_ID && defaults.PAYPAL_CLIENT_SECRET), clientId: defaults.PAYPAL_CLIENT_ID || '', environment: defaults.PAYPAL_ENV };
}

async function readOrders() {
  try {
    const rows = JSON.parse(await readFile(orderFile, 'utf8'));
    return Array.isArray(rows) ? rows : [];
  } catch { return []; }
}

async function recordOrder(order) {
  const existing = await readOrders();
  if (!existing.some(item => item.orderId === order.orderId)) {
    await mkdir(path.dirname(orderFile), { recursive: true });
    existing.unshift(order);
    await writeFile(orderFile, `${JSON.stringify(existing, null, 2)}\n`, 'utf8');
  }
}

async function handleApi(req, res, url) {
  if (req.method === 'OPTIONS') return json(res, 204, {}, { 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' });
  if (url.pathname === '/api/paypal/config' && req.method === 'GET') return json(res, 200, publicPayPalConfig());

  if (url.pathname === '/api/admin/session' && req.method === 'GET') {
    if (!adminAuthorized(req)) return json(res, 401, { error: 'Admin sign-in required.' });
    return json(res, 200, { username: defaults.ADMIN_USERNAME, ...publicPayPalConfig(), clientIdHint: defaults.PAYPAL_CLIENT_ID ? `••••${defaults.PAYPAL_CLIENT_ID.slice(-6)}` : '' });
  }

  if (url.pathname === '/api/admin/orders' && req.method === 'GET') {
    if (!adminAuthorized(req)) return json(res, 401, { error: 'Admin sign-in required.' });
    return json(res, 200, { orders: await readOrders() });
  }

  if (url.pathname === '/api/admin/paypal' && req.method === 'POST') {
    if (!adminAuthorized(req)) return json(res, 401, { error: 'Admin sign-in required.' });
    if (!req.headers['content-type']?.includes('application/json')) return json(res, 415, { error: 'Use a JSON request.' });
    const payload = await readBody(req);
    const clientId = String(payload.clientId || '').trim();
    const clientSecret = String(payload.clientSecret || '').trim();
    const environment = payload.environment === 'live' ? 'live' : 'sandbox';
    if (!clientId || !clientSecret || clientId.length > 512 || clientSecret.length > 512) return json(res, 400, { error: 'Enter a valid PayPal Client ID and Secret.' });
    const old = { ...defaults };
    Object.assign(defaults, { PAYPAL_CLIENT_ID: clientId, PAYPAL_CLIENT_SECRET: clientSecret, PAYPAL_ENV: environment });
    try {
      await paypalToken();
      await saveConfig({ PAYPAL_CLIENT_ID: clientId, PAYPAL_CLIENT_SECRET: clientSecret, PAYPAL_ENV: environment });
      return json(res, 200, { saved: true, ...publicPayPalConfig(), clientIdHint: `••••${clientId.slice(-6)}` });
    } catch (error) {
      Object.assign(defaults, old);
      return json(res, error.statusCode || 502, { error: error.statusCode === 503 ? error.message : 'PayPal could not verify these credentials. Check the environment and try again.' });
    }
  }

  if (url.pathname === '/api/paypal/orders' && req.method === 'POST') {
    if (!req.headers['content-type']?.includes('application/json')) return json(res, 415, { error: 'Use a JSON request.' });
    const payload = await readBody(req);
    if (!Array.isArray(payload.items) || payload.items.length < 1 || payload.items.length > 80) return json(res, 400, { error: 'Your shopping bag is empty or invalid.' });
    const purchaseItems = [];
    for (const item of payload.items) {
      const product = products.find(entry => entry.id === item.id);
      const quantity = Number(item.quantity);
      if (!product || !Number.isSafeInteger(quantity) || quantity < product.moq || quantity > 1000 || quantity % product.moq !== 0) return json(res, 400, { error: 'An item or its wholesale minimum quantity is invalid.' });
      purchaseItems.push({ name: product.name, sku: product.sku, quantity: String(quantity), unit_amount: { currency_code: 'USD', value: product.price.toFixed(2) }, category: 'PHYSICAL_GOODS' });
    }
    const total = purchaseItems.reduce((sum, item) => sum + Number(item.unit_amount.value) * Number(item.quantity), 0);
    if (!Number.isFinite(total) || total <= 0) return json(res, 400, { error: 'The order total is invalid.' });
    try {
      const token = await paypalToken();
      const response = await fetch(`${apiBase()}/v2/checkout/orders`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'PayPal-Request-Id': randomBytes(16).toString('hex') },
        body: JSON.stringify({ intent: 'CAPTURE', purchase_units: [{ reference_id: `RB-${Date.now()}`, description: 'Rubaoge wholesale accessories', amount: { currency_code: 'USD', value: total.toFixed(2), breakdown: { item_total: { currency_code: 'USD', value: total.toFixed(2) } } }, items: purchaseItems }], application_context: { brand_name: 'Rubaoge Wholesale Accessories', user_action: 'PAY_NOW', shipping_preference: 'GET_FROM_FILE' } })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.id) return json(res, 502, { error: 'PayPal could not create this order. Please retry or contact support.' });
      createdOrders.set(body.id, { total: total.toFixed(2), at: Date.now(), items: purchaseItems.map(item => ({ name: item.name, sku: item.sku, quantity: Number(item.quantity), unitPrice: item.unit_amount.value })) });
      return json(res, 201, { id: body.id });
    } catch (error) { return json(res, error.statusCode || 502, { error: error.statusCode === 503 ? error.message : 'PayPal is temporarily unavailable. Please retry.' }); }
  }

  const capture = /^\/api\/paypal\/orders\/([A-Za-z0-9_-]+)\/capture$/.exec(url.pathname);
  if (capture && req.method === 'POST') {
    const expected = createdOrders.get(capture[1]);
    if (!expected || Date.now() - expected.at > 30 * 60 * 1000) return json(res, 404, { error: 'This PayPal order is missing or expired. Please start checkout again.' });
    try {
      const token = await paypalToken();
      const response = await fetch(`${apiBase()}/v2/checkout/orders/${encodeURIComponent(capture[1])}/capture`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) return json(res, 502, { error: 'PayPal did not complete the payment. Please retry or use another payment method.' });
      const captureInfo = body.purchase_units?.[0]?.payments?.captures?.[0];
      if (body.status !== 'COMPLETED' || captureInfo?.status !== 'COMPLETED' || captureInfo?.amount?.currency_code !== 'USD' || captureInfo?.amount?.value !== expected.total) return json(res, 409, { error: 'The completed PayPal payment did not match this order.' });
      try { await recordOrder({ orderId: capture[1], captureId: captureInfo.id, amount: expected.total, currency: 'USD', status: 'COMPLETED', items: expected.items, createdAt: new Date().toISOString() }); }
      catch (error) { console.error('Could not write the completed order record:', error.message); }
      createdOrders.delete(capture[1]);
      return json(res, 200, { status: 'COMPLETED', orderId: capture[1], captureId: captureInfo.id, amount: expected.total, currency: 'USD' });
    } catch (error) { return json(res, error.statusCode || 502, { error: error.statusCode === 503 ? error.message : 'PayPal capture failed. Please contact support before retrying.' }); }
  }
  return json(res, 404, { error: 'Not found.' });
}

async function serveFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
  try {
    const body = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' });
    res.end(body);
  } catch { res.writeHead(404); res.end('Not found'); }
}

const production = process.env.NODE_ENV === 'production';
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    if (!production) return json(res, 404, { error: 'Not found.' });
    const safePath = path.normalize(decodeURIComponent(url.pathname)).replace(/^([/\\]*\.\.[/\\])+/, '');
    const filePath = path.join(root, 'dist', safePath);
    if (existsSync(filePath) && !filePath.endsWith(path.sep)) return await serveFile(res, filePath);
    return await serveFile(res, path.join(root, 'dist', 'index.html'));
  } catch (error) {
    if (!res.headersSent) json(res, error.statusCode || 500, { error: error.statusCode ? error.message : 'The server could not complete this request.' });
    else res.end();
  }
});

const port = Number(process.env.PORT || (production ? 3000 : 3001));
server.listen(port, '0.0.0.0', () => {
  console.log(`Rubaoge ${production ? 'production' : 'API'} server listening on port ${port}. PayPal: ${publicPayPalConfig().configured ? defaults.PAYPAL_ENV : 'not configured'}.`);
  if (firstRunPassword) console.log(`Initial admin account: ${defaults.ADMIN_USERNAME}\nInitial admin password: ${defaults.ADMIN_PASSWORD}\nSet a new password in .env after signing in.`);
});
