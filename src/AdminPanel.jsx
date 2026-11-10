import { useState } from 'react';
import { ArrowRight, Check, ShieldCheck } from 'lucide-react';

const authHeader = (username, password) => `Basic ${btoa(unescape(encodeURIComponent(`${username}:${password}`)))}`;

export default function AdminPanel() {
  const [username, setUsername] = useState('admin@rubaoge.local');
  const [password, setPassword] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [config, setConfig] = useState(null);
  const [message, setMessage] = useState('');
  const [ordersMessage, setOrdersMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [orders, setOrders] = useState([]);
  const auth = authHeader(username, password);

  const signIn = async event => {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/admin/session', { headers: { Authorization: auth }, cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Sign-in failed. Check the Cloudflare Pages admin variables.');
      setConfig(body); setAuthenticated(true);
      const orderResponse = await fetch('/api/admin/orders', { headers: { Authorization: auth }, cache: 'no-store' });
      const orderBody = await orderResponse.json();
      if (orderResponse.ok) setOrders(orderBody.orders || []);
      else setOrdersMessage(orderBody.error || 'Order storage is not available yet.');
    } catch (error) { setMessage(error.message || 'Could not reach the store server.'); }
    finally { setBusy(false); }
  };

  const signOut = () => { setAuthenticated(false); setPassword(''); setMessage(''); setOrders([]); };
  const environmentName = config?.environment === 'live' ? 'Live' : 'Sandbox';

  return <main className="admin-page section-wrap"><div className="admin-card admin-wide"><div className="eyebrow">STORE MANAGEMENT</div><h1>Payments <i>& orders.</i></h1>{!authenticated ? <><p>Sign in to view the payment connection and captured wholesale orders.</p><form onSubmit={signIn}><label>Admin email<input type="email" autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} required/></label><label>Admin password<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required/></label>{message&&<p className="error" role="alert">{message}</p>}<button className="button-dark" disabled={busy}>{busy?'Signing in…':'Sign in'} <ArrowRight size={16}/></button></form><p className="admin-help">Admin sign-in is configured in Cloudflare Pages under Settings → Variables and Secrets. The password is stored as a Cloudflare Secret.</p></> : <><div className={config?.ready?'gateway-status connected':'gateway-status'}><span>{config?.ready?<Check size={16}/>:<ShieldCheck size={16}/>}</span><div><b>{config?.ready?`PayPal ${environmentName} connection ready`:'PayPal setup needs attention'}</b><small>{config?.ready?`${environmentName} credentials verified · ${config.clientIdHint}`:config?.verificationError||(!config?.configured?'PayPal Client ID and Secret are missing.':'PayPal credentials require verification.')}</small></div></div>{!config?.orderStorageConfigured&&<p className="admin-live-note">The Cloudflare D1 database binding is missing. Add a D1 database with the binding name <code>ORDERS_DB</code> and apply the included orders migration before taking payments.</p>}<div className="admin-security"><ShieldCheck size={16}/><p>PayPal credentials are managed by Cloudflare Pages, not stored through this screen. Set <code>PAYPAL_CLIENT_ID</code> and <code>PAYPAL_ENV=live</code> as variables, and set <code>PAYPAL_CLIENT_SECRET</code> as a Secret. Never place the Secret in frontend code or GitHub. Redeploy after changing settings.</p></div><section className="admin-orders"><h2>Captured orders <span>{orders.length}</span></h2>{ordersMessage&&<p className="error" role="status">{ordersMessage}</p>}{orders.length ? orders.map(order=><div className="admin-order" key={order.orderId}><div><b>${order.amount} {order.currency}</b><small>{new Date(order.createdAt).toLocaleString()} · {order.captureId}</small><small>{order.items.map(item=>`${item.name} × ${item.quantity}`).join(' · ')}</small></div><span>{order.status}</span></div>) : !ordersMessage&&<p>No captured PayPal orders yet.</p>}</section><button className="admin-signout" onClick={signOut}>Sign out</button></>}</div></main>;
}
