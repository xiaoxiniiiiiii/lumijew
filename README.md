# Rubaoge Wholesale Accessories

React + Vite wholesale storefront for women's accessories. PayPal order creation and capture run in Cloudflare Pages Functions; the Client Secret stays server side.

## Local development

```sh
npm i
npm run dev
```

The local Node API reads private settings from `.env`. Keep `.env`, `.dev.vars*`, and `.wrangler/` out of Git. Local settings are separate from Cloudflare production settings.

## Cloudflare Pages production

- Build with `npm run build` and deploy the `dist` output with the Pages Functions in `functions/`.
- Bind the D1 database as `ORDERS_DB` and apply `migrations/0001_orders.sql`.
- Set non-secret variables `PAYPAL_ENV=live`, `PAYPAL_CLIENT_ID`, and `ADMIN_USERNAME` in the Pages project.
- Store `PAYPAL_CLIENT_SECRET` and `ADMIN_PASSWORD` as encrypted Pages secrets. Never place either value in frontend code or commit them to Git.
- The production checkout recalculates product prices and minimum quantities on the server, verifies PayPal orders before capture, and stores captured orders in D1.

## Store and legal notes

- Product photos in `public/products` are unbranded WebP assets.
- Verify supplier cost, materials, inventory, shipping, tax, and legal wording before accepting orders.
- Company identity and contact details were supplied by the site owner and should be verified for legal use.
- Card funding availability depends on PayPal and buyer eligibility; no separate card processor is configured.
