import { isAdmin, unauthorized } from '../../../functions-lib/admin-auth.js';
import { errorResponse, json, paypalToken } from '../../../functions-lib/api-shared.js';

export async function onRequestGet({ request, env }) {
  if (!(await isAdmin(request, env))) return unauthorized();
  let verified = false;
  let verificationError = '';
  if (env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET) {
    try {
      await paypalToken(env);
      verified = true;
    } catch {
      verificationError = 'PayPal could not authorize the configured credentials.';
    }
  }
  const orderStorageConfigured = Boolean(env.ORDERS_DB);
  return json({
    username: env.ADMIN_USERNAME,
    configured: Boolean(env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET),
    verified,
    orderStorageConfigured,
    ready: verified && orderStorageConfigured,
    verificationError,
    environment: env.PAYPAL_ENV === 'live' ? 'live' : 'sandbox',
    clientIdHint: env.PAYPAL_CLIENT_ID ? `••••${env.PAYPAL_CLIENT_ID.slice(-6)}` : ''
  });
}
