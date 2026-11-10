import { useEffect, useRef, useState } from 'react';
import { ShieldCheck } from 'lucide-react';

export default function PayPalCheckout({ items, fundingSource = 'paypal', onComplete }) {
  const host = useRef(null);
  const [config, setConfig] = useState(null);
  const [error, setError] = useState('');
  const basketKey = items.map(item => `${item.id}:${item.qty}`).join('|');

  useEffect(() => {
    let active = true;
    const load = () => fetch('/api/paypal/config', { cache: 'no-store' }).then(response => response.json()).then(data => { if (active) setConfig(data); }).catch(() => { if (active) setConfig({ configured: false }); });
    load();
    window.addEventListener('paypal-config-updated', load);
    return () => { active = false; window.removeEventListener('paypal-config-updated', load); };
  }, []);

  useEffect(() => {
    if (!config?.configured || !host.current) return;
    let active = true;
    let rendered = false;
    setError('');
    host.current.innerHTML = '';
    const mountButtons = () => {
      if (!active || rendered || !window.paypal?.Buttons) return;
      rendered = true;
      const source = fundingSource === 'card' ? window.paypal.FUNDING?.CARD : window.paypal.FUNDING?.PAYPAL;
      if (!source) { setError('This PayPal payment method is not available for the connected account.'); return; }
      window.paypal.Buttons({
        fundingSource: source,
        style: { layout: 'vertical', shape: 'rect', label: 'paypal', height: 44 },
        createOrder: async () => {
          const response = await fetch('/api/paypal/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: items.map(({ id, qty }) => ({ id, quantity: qty })) }) });
          const body = await response.json();
          if (!response.ok || !body.id) throw new Error(body.error || 'Unable to start PayPal checkout.');
          return body.id;
        },
        onApprove: async data => {
          const response = await fetch(`/api/paypal/orders/${encodeURIComponent(data.orderID)}/capture`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
          const body = await response.json();
          if (!response.ok || body.status !== 'COMPLETED') throw new Error(body.error || 'Payment could not be confirmed.');
          onComplete(body);
        },
        onError: error => setError(error?.message || 'PayPal could not complete checkout. Please retry.'),
        onCancel: () => setError('PayPal checkout was cancelled. Your shopping bag is still saved.')
      }).render(host.current).catch(error => setError(error?.message || 'PayPal buttons could not be loaded.'));
    };
    let script = document.getElementById('rubaoge-paypal-sdk');
    if (script && script.dataset.clientId !== config.clientId) { script.remove(); script = null; }
    if (!script) {
      script = document.createElement('script');
      script.id = 'rubaoge-paypal-sdk';
      script.dataset.clientId = config.clientId;
      script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(config.clientId)}&currency=USD&intent=capture&components=buttons&enable-funding=card`;
      script.async = true;
      script.addEventListener('load', mountButtons, { once: true });
      script.addEventListener('error', () => setError('Could not connect to PayPal. Refresh and try again.'), { once: true });
      document.head.appendChild(script);
    } else if (window.paypal?.Buttons) mountButtons();
    else script.addEventListener('load', mountButtons, { once: true });
    return () => { active = false; if (host.current) host.current.innerHTML = ''; };
  }, [config, basketKey, fundingSource, onComplete]);

  if (config === null) return <p className="demo-note"><ShieldCheck size={14}/> Checking PayPal checkout configuration…</p>;
  if (!config.configured) return <div className="gateway-pending"><b>PayPal checkout setup is not finished</b><span>The store administrator must configure PayPal credentials and Cloudflare order storage before checkout is available.</span></div>;
  return <div className="paypal-live"><div ref={host}/>{error && <p className="paypal-error" role="alert">{error}</p>}<p className="demo-note"><ShieldCheck size={14}/> Secured by PayPal. Your payment is captured after PayPal approval.</p></div>;
}
