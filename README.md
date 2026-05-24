# Qotoof - B2B Wholesale Marketplace

A production-ready B2B marketplace web application for wholesale plants, vegetables, and fruits with multi-role support including drivers.

![Qotoof](https://img.shields.io/badge/version-1.0.0-green)
![License](https://img.shields.io/badge/license-MIT-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)
![Tests](https://img.shields.io/badge/tests-67%20passing-brightgreen)

## 🌟 Features

### Multi-Role System
- **Admin** - Full platform management
- **Vendor** - Store management, products, orders, driver assignment
- **Buyer** - Browse, cart, orders, live delivery tracking
- **Driver** - Delivery management, real-time location tracking

### Core Features
- Complete order lifecycle (pending → delivered)
- Real-time delivery tracking with Leaflet maps
- Driver assignment workflow
- Photo proof for deliveries
- Live location updates via Supabase real-time
- Multi-language (EN, FR, AR with RTL)
- PWA support
- **TypeScript support** - Type-safe development

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd greenmarket
npm install
```

### 2. Set Up Supabase (Required for full functionality)

1. Create a project at [supabase.com](https://supabase.com)
2. Go to SQL Editor
3. Run the schema from `database/schema-extended.sql`
4. Copy your project URL and anon key
5. Update `.env` file:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 3. Start Development Server
```bash
npm run dev
```

The app will open at `http://localhost:3000`

## 🌐 Deployment on Firebase Hosting

### Pre-Deployment Check
Before deploying, run the pre-deployment verification:
```bash
npm run deploy:check
```

This verifies:
- ✅ All required deployment files exist (`firebase.json`, `.env.example`, `vite.config.js`)
- ✅ `.gitignore` is configured correctly
- ✅ Required environment variables are available from `.env` or injected CI secrets
- ✅ Package.json has required build scripts

### Deployment Steps

1. **Configure GitHub Actions secrets:**
    - Add the repository secrets listed in `.github/SECRETS_REQUIRED.md`
    - At minimum configure Firebase deploy credentials and the public client variables used at build time

2. **Run the readiness check locally before shipping:**
```bash
npm run deploy:check
```

3. **Push code to GitHub:**
```bash
git add .
git commit -m "Ready for production deployment"
git push
```

4. **CI validates the release automatically:**
    - The `CI` workflow runs lint, tests, and a production build on `pull_request` and `push`
    - The `CD — Deploy to Firebase Hosting` workflow only deploys after `CI` succeeds on `main`

5. **Use PR previews before merging:**
    - Opening a pull request triggers `PR Preview — Firebase Hosting`
    - GitHub posts a temporary preview URL for review

6. **Enable production monitoring:**
    - Set `PRODUCTION_APP_URL`
    - Optionally set `PRODUCTION_API_HEALTHCHECK_URL`
    - The `Monitoring — Production Health` workflow checks availability every 30 minutes

### Build / Hosting Configuration
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Node Version in GitHub Actions:** `20`
- **Hosting Target:** Firebase Hosting via `firebase.json`

The `firebase.json` file configures:
- SPA rewrites (all routes → `index.html`)

The repository still contains `vercel.json` as an optional alternate hosting config, but the maintained production deployment path is Firebase Hosting via GitHub Actions.

## 📘 TypeScript Support

This project now supports TypeScript! You can create `.ts` and `.tsx` files alongside existing JavaScript files.

```bash
# Type checking
npm run type-check

# See TYPESCRIPT_SETUP.md for detailed guide
```

## 📁 Project Structure

```
greenmarket/
├── database/
│   └── schema-extended.sql    # Full schema with all roles
├── src/
│   ├── components/
│   │   ├── auth/
│   │   │   └── ProtectedRoute.jsx
│   │   └── ui/                # Reusable components
│   ├── layouts/
│   │   ├── MainLayout.jsx
│   │   ├── DashboardLayout.jsx
│   │   └── AuthLayout.jsx
│   ├── pages/
│   │   ├── auth/              # Login, Register
│   │   ├── buyer/             # Buyer orders & tracking
│   │   ├── vendor/            # Vendor dashboard
│   │   ├── driver/            # Driver delivery workflow
│   │   └── admin/             # Admin panel
│   ├── services/
│   │   ├── supabase.ts
│   │   └── deliveries.js      # Delivery API + real-time
│   ├── store/
│   │   └── authStore.js       # Auth with role management
│   └── App.jsx                # Routes for all roles
├── tests/                     # Unit & integration tests
├── cypress/                   # E2E tests
├── tsconfig.json              # TypeScript configuration
└── .env                       # Environment variables
```

## 🔐 Role Routes

| Role | Path | Description |
|------|------|-------------|
| Public | `/`, `/marketplace`, `/product/:id` | Browse products |
| Buyer | `/buyer/orders` | Order tracking |
| Vendor | `/vendor/dashboard`, `/vendor/products`, `/vendor/orders` | Store management |
| Driver | `/driver/dashboard`, `/driver/delivery/:id` | Delivery workflow |
| Admin | `/admin/dashboard`, `/admin/users`, `/admin/vendors` | Platform management |

## 🔄 Order Flow

```
Buyer places order
    ↓
Vendor accepts/rejects
    ↓
Vendor assigns driver
    ↓
Driver accepts delivery
    ↓
Driver picks up from vendor
    ↓
Driver delivers to buyer
    ↓
Order completed
```

## 📦 Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run type-check` | TypeScript type checking |
| `npm test` | Run Jest unit tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage |
| `npm run test:cypress` | Open Cypress E2E tests |
| `npm run test:cypress:run` | Run Cypress tests |
| `npm run test:all` | Run all tests |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Fix ESLint errors |
| `npm run commission:check` | Validate 3% commission system setup |
| `npm run deploy` | Deploy to Firebase |

## 💸 Commission Cron (3%)

The project includes a scheduled edge function at `supabase/functions/commission-cron/index.ts`.

### Deploy function
```bash
supabase functions deploy commission-cron
```

### Set secret (recommended)
```bash
supabase secrets set COMMISSION_CRON_SECRET=your-secret-value
```

### Example scheduler call
```bash
curl -X POST "https://<project-ref>.supabase.co/functions/v1/commission-cron" \
    -H "Authorization: Bearer your-secret-value"
```

Run this daily. On month start, it will also close previous month commissions and generate payment deadlines.

## PayPal Reconciliation Worker

The project includes a scheduled edge function at `supabase/functions/reconcile-paypal-payments/index.ts`.

### Deploy function
```bash
supabase functions deploy reconcile-paypal-payments
```

### Set secret (recommended)
```bash
supabase secrets set PAYPAL_RECONCILIATION_SECRET=your-secret-value
```

### Example scheduler call
```bash
curl -X POST "https://<project-ref>.supabase.co/functions/v1/reconcile-paypal-payments" \
    -H "Authorization: Bearer your-secret-value"
```

### Example single-order recovery call
```bash
curl -X POST "https://<project-ref>.supabase.co/functions/v1/reconcile-paypal-payments" \
    -H "Authorization: Bearer <user-jwt-or-secret>" \
    -H "Content-Type: application/json" \
    -d '{"orderId":"<order-id>"}'
```

Run this on a short schedule to recover abandoned or delayed PayPal returns. The worker inspects pending PayPal payments, captures approved orders server-side, and re-syncs `payments.status` with `orders.payment_status`.

## 🧪 Testing

```bash
# Unit tests
npm test

# E2E tests
npm run test:cypress

# All tests
npm run test:all
```

## 📚 Documentation

- **[DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md)** - Development guide with utilities and best practices
- **[TYPESCRIPT_SETUP.md](./TYPESCRIPT_SETUP.md)** - TypeScript setup and usage guide
- **[LAUNCH_CHECKLIST.md](./LAUNCH_CHECKLIST.md)** - Pre-launch checklist

## ⚠️ Note

The app works with placeholder Supabase credentials for UI testing. For full functionality (auth, orders, real-time), set up a real Supabase project and update the `.env` file.

## 🛠️ Tech Stack

- **Frontend**: React 18, Vite 6, Tailwind CSS
- **State Management**: Zustand
- **Database**: Supabase (PostgreSQL)
- **Real-time**: Supabase Realtime
- **Maps**: Leaflet + React Leaflet
- **Testing**: Jest, Cypress
- **Type Checking**: TypeScript 5.9
- **Deployment**: Firebase Hosting
- **Monitoring**: Sentry
- **Payments**: Stripe
