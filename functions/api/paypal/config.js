export async function onRequestGet({ env }) {
  const credentialsConfigured = Boolean(env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET);
  const configured = credentialsConfigured && Boolean(env.ORDERS_DB);
  return Response.json(
    {
      configured,
      clientId: credentialsConfigured ? env.PAYPAL_CLIENT_ID : '',
      credentialsConfigured,
      orderStorageConfigured: Boolean(env.ORDERS_DB),
      environment: env.PAYPAL_ENV === 'live' ? 'live' : 'sandbox'
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
