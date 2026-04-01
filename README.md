# Coinfession Backend API (Express + MongoDB)

Backend for Coinfession mobile app. Provides Clerk-authenticated APIs for bank linking/sync (Plaid), normalized transactions, subscriptions, rule-based insights, and budget caps.

## Stack

- Node.js + Express 5 + TypeScript
- MongoDB + Mongoose
- Clerk backend SDK for JWT verification
- Plaid Node SDK
- Optional Stripe routes (feature-flagged by env)
- `node-cron` for daily background sync
- `zod` for environment validation

## Implemented Features

- Clerk JWT auth middleware with user scoping via `clerkUserId`.
- Mongo bootstrap + secure middleware:
  - helmet
  - CORS allowlist
  - rate limiting
  - morgan logs
- Plaid provider flow:
  - create link token (`/api/bank/link-token`)
  - exchange public token (`/api/bank/exchange-token`)
  - sync transactions (`/api/bank/sync`)
  - list linked connections (`/api/bank/connections`)
- Incremental transaction sync with Plaid cursor (`transactions/sync`) and idempotent expense upserts.
- Rule-based insights engine (weighted probability matrix) and snapshot persistence.
- Insights recompute endpoint and enriched summary payload:
  - base insight item(s)
  - `insightsUpdatedAt`
  - bank cashflow summary
  - top categories and merchants
  - budget cap statuses (`ok` / `warning` / `over`)
- Budget caps API:
  - list budgets
  - upsert budget cap
  - delete budget cap
- Daily cron sync for all active Plaid connections (06:00 server time).
- Optional Plaid access token encryption at rest via `PLAID_ACCESS_TOKEN_KEY`.

## Key Models

- `ConnectedBankAccount`
- `Expense`
- `Subscription`
- `InsightCategory`
- `InsightFeature`
- `InsightSnapshot`
- `Budget`

## API Routes (Primary)

- Health: `GET /api/health`
- Bank (Plaid):
  - `POST /api/bank/link-token`
  - `POST /api/bank/exchange-token`
  - `POST /api/bank/sync`
  - `GET /api/bank/connections`
  - `GET /api/bank/providers`
- Transactions:
  - `GET /api/transactions`
- Expenses:
  - `GET /api/expenses`
  - `POST /api/expenses`
- Subscriptions:
  - `GET /api/subscriptions`
  - `POST /api/subscriptions`
- Insights:
  - `GET /api/insights/summary`
  - `POST /api/insights/recompute`
- Budgets:
  - `GET /api/budgets`
  - `POST /api/budgets`
  - `DELETE /api/budgets/:id`

Stripe endpoints are mounted only when Stripe env vars are configured.

## Environment Variables

Use `api-coinfession/.env`:

```env
NODE_ENV=development
PORT=4000
MONGODB_URI=mongodb://...
CLERK_SECRET_KEY=sk_test_xxx

# Optional unless enabling Stripe routes
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

PLAID_CLIENT_ID=plaid_client_id_xxx
PLAID_SECRET=plaid_secret_xxx
PLAID_ENV=sandbox
PLAID_REDIRECT_URI=https://your-app.example.com/plaid/oauth

# Optional in local dev. Recommended in production.
# Base64-encoded 32-byte key for AES-256-GCM encryption.
PLAID_ACCESS_TOKEN_KEY=

CORS_ORIGINS=http://localhost:8081,http://<YOUR_LOCAL_IPV4>:8081
```

Generate `PLAID_ACCESS_TOKEN_KEY`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Important: `PLAID_ACCESS_TOKEN_KEY` is app-owned encryption material, not provided by Plaid.

## Run Locally

```bash
npm install
npm run dev
```

Typecheck:

```bash
npm run typecheck
```

## Background Jobs

- Plaid daily sync runs automatically when server starts.
- Schedule: `0 6 * * *` (06:00 local server time).

## Data Flow Summary

1. Frontend requests link token.
2. User completes Plaid Link.
3. Frontend sends `public_token`.
4. Backend exchanges to `access_token`, stores linked item metadata.
5. Backend syncs transactions into normalized `Expense` records.
6. Insights engine computes weighted score and stores snapshots.
7. Frontend reads summary from backend only.

## Security Notes

- No provider secrets in frontend.
- Plaid long-lived tokens stay server-side.
- `/api/bank/connections` excludes access tokens from response.
- Per-user auth scoping is enforced on protected routes.
- Token encryption at rest is supported when `PLAID_ACCESS_TOKEN_KEY` is configured.
