# KACHI Admin

Back office for the KACHI marketplace. It talks to the Laravel API's admin portal
(`backend/kachi`, Docker, port 8002) with Sanctum bearer tokens.

## Run it

```bash
cp .env.example .env.local   # NEXT_PUBLIC_ADMIN_API_URL=http://localhost:8002/api/v1
npm install
npm run dev                  # http://localhost:3001
```

`npm run build && npm start` serves the production build on port 3001.

Sign in with a staff account (seeded: `superadmin@kachi.test` / `password`). Accounts that must use
two-factor authentication (the Super Admin, and any role with finance access) are sent to a setup
screen first; add the key to an authenticator app and confirm a code.

## How it is put together

- `src/lib/api/client.ts`: fetch wrapper. Adds the bearer token, unwraps the `{success, message, data, meta}`
  envelope, throws `ApiError` (status + field errors). 401 clears the session; 403 with `errors.two_factor`
  sends the user to `/two-factor`. No cookies (`credentials` is never sent).
- `src/lib/api/<area>.ts`: one module per API area. `src/types/api.ts`: types from `GET /docs/admin.json`,
  corrected where the live API differs (see comments).
- `src/store/auth.ts`: zustand store persisted to localStorage (token, expiry, user). `useCan()` checks the
  user's `permissions` to hide navigation and actions; the API still enforces them.
- `src/components/layout/auth-guard.tsx`: client-side guard for the `(dashboard)` routes. Re-reads `/auth/me`
  once per session and rotates the 12-hour token in its last hour.
- `src/lib/schemas/*`: zod schemas mirroring the backend's form requests; 422 errors from the API are mapped
  back onto the form fields.
- Data pages are client components (the token lives in the browser). List filters live in the URL.
