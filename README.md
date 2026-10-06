# KACHI Seller Centre

Where vendors run their store on the KACHI marketplace: sign up with business documents, accept the
vendor agreement, then manage products, stock, orders and returns. It talks to the Laravel API's
Seller Centre portal (`backend/kachi`, Docker, port 8001) with Sanctum bearer tokens.

## Run it

```bash
cp .env.example .env.local   # NEXT_PUBLIC_SELLER_API_URL=http://localhost:8001/api/v1
npm install
npm run dev                  # http://localhost:3002
```

`npm run build && npm start` serves the production build on port 3002.

Sign in with a vendor account (seeded: `demo.vendor@kachi.test` / `password`), or register a new store at
`/register`.

| Variable | What it is |
| --- | --- |
| `NEXT_PUBLIC_SELLER_API_URL` | The Seller Centre portal (local `:8001`, live `https://seller-api.kachiii.com/api/v1`) |
| `NEXT_PUBLIC_SHOP_API_URL` | The shop portal, read for the public category and brand lists (the Seller Centre does not serve them) |
| `NEXT_PUBLIC_SHOP_URL` | The storefront, for "view in shop" links |

## How it is put together

- `src/lib/api/client.ts`: fetch wrapper. Adds the bearer token, unwraps the `{success, message, data, meta}`
  envelope, throws `ApiError` (status + field errors). 401 clears the session. `shopApi()` reads the shop
  portal's public catalogue without a token: each portal only accepts tokens it issued.
- `src/lib/api/<area>.ts`: one module per API area; types in `src/types/`.
- `src/store/auth.ts`: zustand store persisted to localStorage (token, expiry, user). `isVendor()` is any account
  with a vendor application; `hasStore()` is an approved (or suspended, read-only) vendor.
- `src/components/layout/auth-guard.tsx`: client-side guard. Accounts without a vendor application are signed
  out; with `requireStore` (the dashboard), applicants whose store is not open yet go to `/application`.
  It rotates the 7-day token in its last day.
- Route groups: `(auth)` login, register and two-factor; `(onboarding)` the application and the agreement;
  `(dashboard)` everything that needs an open store.
- Data pages are client components (the token lives in the browser). List filters live in the URL.
