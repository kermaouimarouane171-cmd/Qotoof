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

## 🌐 Deployment on Vercel

### Pre-Deployment Check
Before deploying, run the pre-deployment verification:
```bash
npm run deploy:check
```

This verifies:
- ✅ All required files exist (`vercel.json`, `.env.example`, `vite.config.js`)
- ✅ `.gitignore` is configured correctly
- ✅ Required environment variables are set
- ✅ Package.json has required build scripts

### Deployment Steps

1. **Push code to GitHub:**
```bash
git add .
git commit -m "Ready for Vercel deployment"
git push
```

2. **Link project to Vercel:**
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Select your GitHub repository
   - Import the project

3. **Configure Environment Variables:**
   - In Vercel Project Settings → Environment Variables
   - Add all variables from `.env.example`:
     - `VITE_SUPABASE_URL`
     - `VITE_SUPABASE_ANON_KEY`
     - `VITE_STRIPE_PUBLIC_KEY`
     - `VITE_SENTRY_DSN`
     - `RESEND_API_KEY`
     - `VITE_GOOGLE_MAPS_KEY`
     - And other vars from `.env.example`

4. **Deploy:**
   - Click "Deploy"
   - Vercel will automatically run `npm run build`
   - Your app will be live at `https://your-project.vercel.app`

### Build Configuration
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Node Version:** 18.x (default)

The `vercel.json` file automatically configures:
- SPA rewrites (all routes → `index.html`)
- Security headers (CSP, X-Frame-Options, etc.)
- Static asset caching (1 year for `/assets`)

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
│   │   ├── supabase.js
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
