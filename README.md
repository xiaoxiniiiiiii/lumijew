# Rubaoge Wholesale Accessories

React + Vite wholesale storefront for women's accessories. The Cloudflare Pages Functions under `functions/api` provide the server-side PayPal Orders API; the PayPal Client Secret is never included in the browser build.

## Local development

```sh
npm i
npm run dev
```

The local Node API reads private settings from `.env`. Keep that file out of Git. Local-only PayPal settings are independent of the Cloudflare Pages production settings.

## Cloudflare Pages setup

Configure the Pages project with the repository root as its root directory, `npm run build` as the build command, and `dist` as the build output directory. Pages Functions are discovered from the root `functions` directory and deploy with the site.

### 1. Create the order database

Create a Cloudflare D1 database for the store. In the Pages project, open **Settings → Bindings → Add → D1 database binding** and use the exact variable name `ORDERS_DB`. Select the new database. In its D1 console, run the SQL in `migrations/0001_orders.sql` to create the pending and paid order tables.

### 2. Configure Production variables and secrets

In the Pages project, open **Settings → Variables and Secrets** and add these to the **Production** environment:

| Name | Cloudflare type | Value |
| --- | --- | --- |
| `PAYPAL_ENV` | Variable | `live` |
| `PAYPAL_CLIENT_ID` | Variable | Live app Client ID from PayPal Developer Dashboard |
| `PAYPAL_CLIENT_SECRET` | Secret | Live app Client Secret from the same app |
| `ADMIN_USERNAME` | Variable | Your chosen admin email or username |
| `ADMIN_PASSWORD` | Secret | A unique, long password |

Do not set the real PayPal Secret in Preview deployments. Save the settings and redeploy so the Pages Functions receive the D1 binding and variables.

The Store Admin page verifies the PayPal credentials against the selected PayPal API environment and shows captured order records from D1. The Client ID is public in the PayPal browser SDK; the Client Secret is only read by the server-side Functions.

## Payment behavior

- The backend recalculates prices from `src/catalog.js`, enforces wholesale minimum quantities, and creates/captures PayPal Orders server-side.
- Before capture, the backend checks the approved PayPal order against the stored catalog items and total.
- Captured order summaries are saved to the D1 `paid_orders` table. Pending order data expires logically after 30 minutes.
- Credit/debit card funding is presented through PayPal where the merchant and buyer are eligible; a separate card processor is not configured.
- Product prices and MOQ are sample wholesale offers. Confirm supplier costs, materials, inventory, shipping, taxes, and legal terms before taking real orders.

## Other notes

- Product images in `public/products` are unbranded WebP assets.
- Company identity and contact details were supplied by the site owner and should be verified for legal use.
- `.env`, `.dev.vars*`, `.wrangler/`, and local order data are excluded from Git.
