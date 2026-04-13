# 🔐 Vantage Travel - Secure Backend Setup

## ✅ WHAT'S BEEN BUILT

All backend code is in the `/backend` folder. **Everything stays server-side** - no secrets in the browser!

### Backend Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  FRONTEND (React App)                                       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  - "Sign in with Google" button                     │   │
│  │  - "Upgrade to Pro" button                        │   │
│  │  - NO API keys, NO secrets                        │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  CLOUDFLARE WORKER (Backend)                                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  /api/auth/google          → Start OAuth flow       │   │
│  │  /api/auth/google/callback → Handle OAuth return  │   │
│  │  /api/auth/refresh         → Refresh JWT tokens   │   │
│  │  /api/auth/logout          → Revoke session       │   │
│  │  /api/auth/me              → Get user info        │   │
│  │                                                      │   │
│  │  /api/payments/checkout    → Stripe checkout       │   │
│  │  /api/payments/webhook     → Stripe events         │   │
│  │  /api/payments/subscription → Get/cancel sub     │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  🔐 Secrets stored here:                                    │
│  - Google OAuth credentials                                 │
│  - Stripe API keys                                        │
│  - JWT signing secret                                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ SQL
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  CLOUDFLARE D1 DATABASE                                     │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  users table        → Accounts & Google IDs         │   │
│  │  subscriptions      → Stripe status & tiers         │   │
│  │  sessions           → Refresh token tracking        │   │
│  │  oauth_states       → CSRF protection             │   │
│  │  audit_log          → Security events               │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Security Features

| Feature | Implementation |
|---------|---------------|
| **Passwords** | ❌ No passwords stored! Google OAuth only |
| **Token Storage** | JWT tokens stored in httpOnly cookies |
| **Session Management** | Refresh tokens hashed in database (SHA-256) |
| **CSRF Protection** | State parameter validation for OAuth |
| **Rate Limiting** | 60 req/min per IP, 10 OAuth attempts/min |
| **Webhook Security** | Stripe signature verification (HMAC) |
| **Data Validation** | All inputs validated before processing |
| **Audit Logging** | All auth/payment events logged |

---

## 📋 WHAT YOU NEED TO PROVIDE

### 1. Google OAuth Credentials

**How to get:**
1. Go to https://console.cloud.google.com/apis/credentials
2. Create project → "Vantage Travel"
3. "Create Credentials" → "OAuth client ID"
4. Application type: **Web application**
5. Authorized redirect URIs:
   ```
   https://vantagetravel.pages.dev/api/auth/google/callback
   ```
6. Copy **Client ID** and **Client Secret**

**You give me:**
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

---

### 2. Stripe Account Setup

**How to get:**
1. Go to https://dashboard.stripe.com/register
2. Create a product: "Vantage Pro Subscription"
3. Add recurring price: $9.99/month (or your price)
4. Copy the **Price ID** (looks like `price_1234567890`)
5. Go to Developers → API keys
6. Copy **Secret key** (starts with `sk_test_` or `sk_live_`)
7. Copy **Publishable key** (starts with `pk_test_` or `pk_live_`)
8. Go to Developers → Webhooks → Add endpoint
9. Endpoint URL: `https://your-worker.workers.dev/api/payments/webhook`
10. Select events:
    - `checkout.session.completed`
    - `invoice.payment_succeeded`
    - `invoice.payment_failed`
    - `customer.subscription.deleted`
    - `customer.subscription.updated`
11. Copy **Webhook signing secret** (starts with `whsec_`)

**You give me:**
- `STRIPE_SECRET_KEY`
- `STRIPE_PUBLISHABLE_KEY`
- `STRIPE_PRICE_ID`
- `STRIPE_WEBHOOK_SECRET`

---

### 3. JWT Secret

**How to generate:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Or use any random 64+ character string.

**You give me:**
- `JWT_SECRET`

---

### 4. D1 Database ID

**How to create:**
1. Go to https://dash.cloudflare.com/
2. Workers & Pages → D1
3. "Create database"
4. Name: `vantagetravel_db`
5. Copy the **Database ID**

**You give me:**
- `DB_DATABASE_ID`

---

## 🚀 SETUP STEPS

### Step 1: Get All Credentials
Collect all the values above from Google, Stripe, and Cloudflare.

### Step 2: Create D1 Database
Run the schema file in the D1 console:

```sql
-- Copy contents of backend/db-schema.sql
-- Paste into: Cloudflare Dashboard → D1 → [Your DB] → Console → Run
```

### Step 3: Deploy Backend Worker
1. Create new Worker in Cloudflare Dashboard
2. Upload the files from `/backend` folder
3. Add environment variables (from .env.backend.example)
4. Bind the D1 database

### Step 4: Update Frontend
Connect the React app to the backend (I'll do this once you provide credentials).

### Step 5: Test
- Sign in with Google
- Check subscription status
- Upgrade to Pro
- Verify Stripe webhook works

---

## 📁 Backend File Structure

```
backend/
├── index.ts              # Main worker entry point
├── auth.ts               # Google OAuth + JWT authentication
├── payments.ts           # Stripe integration
├── crypto.ts             # Cryptographic utilities
├── types.ts              # TypeScript types
└── db-schema.sql         # Database schema
```

---

## 🔐 Security Checklist

- [ ] No API keys in frontend code
- [ ] No secrets committed to git
- [ ] D1 database created and schema applied
- [ ] Environment variables set in Cloudflare
- [ ] Google OAuth redirect URIs configured
- [ ] Stripe webhook endpoint configured
- [ ] HTTPS enforced on all endpoints
- [ ] Rate limiting tested

---

## 🆘 Ready When You Are!

**Send me these values and I'll set everything up:**

```
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
JWT_SECRET=
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
STRIPE_PRICE_ID=
STRIPE_WEBHOOK_SECRET=
DB_DATABASE_ID=
```

Or just say **"use test values"** and I'll create a working demo with placeholder credentials that you can replace later!
