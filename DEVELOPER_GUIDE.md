# Qotoof Developer Guide

A comprehensive guide for developers working on the Qotoof B2B wholesale marketplace platform.

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Development Environment Setup](#2-development-environment-setup)
3. [Project Structure](#3-project-structure)
4. [Conventions](#4-conventions)
5. [How to Add a New Feature](#5-how-to-add-a-new-feature)
6. [How to Write Tests](#6-how-to-write-tests)
7. [How to Add New Translations](#7-how-to-add-new-translations)
8. [How to Create a New Migration](#8-how-to-create-a-new-migration)
9. [How to Deploy Edge Functions](#9-how-to-deploy-edge-functions)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Introduction

### What is Qotoof?

Qotoof (قطوف) is a **B2B wholesale marketplace** for plants, vegetables, and fruits operating in Morocco. It connects professional buyers (restaurants, retailers, caterers) with verified vendors (farmers, wholesalers, distributors) and manages the entire order lifecycle including driver-assisted delivery with real-time GPS tracking.

### Four Platform Roles

| Role | Description | Key Paths |
|------|-------------|-----------|
| **Buyer** | Browse marketplace, manage cart, place orders, track deliveries | `/buyer/orders`, `/buyer/dashboard` |
| **Vendor** | Manage store, list products, fulfill orders, assign drivers | `/vendor/dashboard`, `/vendor/products`, `/vendor/orders` |
| **Driver** | Accept deliveries, update status, share live location | `/driver/dashboard`, `/driver/delivery/:id` |
| **Admin** | Full platform oversight: users, vendors, disputes, analytics | `/admin/dashboard`, `/admin/users`, `/admin/vendors` |

### Tech Stack

| Layer | Technology |
|-------|------------|
| **Framework** | React 18 |
| **Build Tool** | Vite 6 |
| **Database** | Supabase (PostgreSQL) |
| **State Management** | Zustand |
| **Styling** | Tailwind CSS (with dark mode) |
| **Routing** | React Router v6 |
| **i18n** | i18next + react-i18next (en, fr, ar with RTL) |
| **Testing** | Jest + React Testing Library, Cypress (E2E) |
| **Maps** | Leaflet + React Leaflet |
| **Error Monitoring** | Sentry |
| **Payments** | Stripe, CMI (Moroccan gateway), Bank Transfer |
| **Deployment** | Firebase Hosting |
| **Charts** | Chart.js, Recharts |
| **Validation** | Zod |
| **PDF** | @react-pdf/renderer |

### Order Lifecycle

```
Buyer places order
    -> Vendor accepts or rejects
        -> Vendor assigns a driver
            -> Driver accepts the delivery
                -> Driver picks up from vendor
                    -> Driver delivers to buyer (live tracking)
                        -> Order completed
```

---

## 2. Development Environment Setup

### Requirements

- **Node.js** 18 or higher
- **npm** 9 or higher
- **Supabase** account (free tier is fine for development)
- **Firebase** account (for hosting deployment)

### Installation

```bash
# 1. Clone the repository
git clone <repo-url>
cd greenmarket

# 2. Install dependencies
npm install

# 3. Copy environment template
cp .env.example .env

# 4. Edit .env with your actual values
#    At minimum, set these Supabase variables:
#    VITE_SUPABASE_URL=https://your-project-id.supabase.co
#    VITE_SUPABASE_ANON_KEY=your-supabase-anon-key

# 5. Set up the Supabase database
#    - Create a project at https://app.supabase.com
#    - Run the SQL migrations in database/migrations/ (in order)
#    - Or run database/schema.sql for the base schema

# 6. Start the development server
npm run dev
```

The app will be available at `http://localhost:5173`.

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server (Vite) |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build locally |
| `npm run type-check` | Run TypeScript type checking |
| `npm test` | Run Jest unit tests |
| `npm run test:watch` | Run Jest in watch mode |
| `npm run test:coverage` | Run Jest with coverage report |
| `npm run test:cypress` | Open Cypress test runner |
| `npm run test:cypress:run` | Run Cypress E2E tests headless |
| `npm run test:e2e` | Run Cypress in Chrome |
| `npm run test:all` | Run Jest + Cypress headless |
| `npm run lint` | Run ESLint (zero warnings policy) |
| `npm run lint:fix` | Run ESLint with auto-fix |
| `npm run deploy` | Build + deploy to Firebase Hosting |
| `npm run deploy:all` | Build + full Firebase deploy |
| `npm run analyze` | Analyze bundle size |

### Supabase Setup Checklist

1. Create a Supabase project at https://app.supabase.com
2. Run SQL migrations from `database/migrations/` in numerical order
3. Enable Realtime on tables that need live updates (orders, deliveries, messages)
4. Create storage buckets: `product-images`, `return-images`, `profile-photos`, `store-logos`, `chat-attachments`
5. Deploy Edge Functions (see [section 9](#9-how-to-deploy-edge-functions))
6. Configure the `.env` file with your Supabase credentials

---

## 3. Project Structure

```
greenmarket/
├── src/
│   ├── components/        # Reusable UI components
│   │   ├── ui/            # Base UI primitives (Button, Input, Modal, etc.)
│   │   ├── auth/          # Auth-related components (ProtectedRoute, etc.)
│   │   ├── layout/        # Structural components (Header, Sidebar, Footer)
│   │   ├── marketplace/   # Marketplace-specific components
│   │   ├── orders/        # Order-related components
│   │   ├── delivery/      # Delivery & tracking components
│   │   └── chat/          # Messaging components
│   ├── pages/             # Route pages organized by role
│   │   ├── auth/          # Login, Register
│   │   ├── buyer/         # Buyer dashboard, orders, tracking
│   │   ├── vendor/        # Vendor dashboard, products, orders
│   │   ├── driver/        # Driver dashboard, delivery workflow
│   │   └── admin/         # Admin panel, user/vendor management
│   ├── services/          # API & business logic
│   │   ├── supabase.ts    # Supabase client & query helpers
│   │   ├── api.js         # Main API service layer
│   │   ├── deliveries.js  # Delivery management
│   │   ├── notifications.js
│   │   ├── paymentGateway.js
│   │   ├── chatService.jsx
│   │   └── ...
│   ├── store/             # Zustand state stores
│   │   ├── authStore.js   # Authentication & user role
│   │   ├── cartStore.js   # Shopping cart
│   │   ├── favoritesStore.js
│   │   └── languageStore.js
│   ├── hooks/             # Custom React hooks
│   ├── utils/             # Utility functions
│   │   ├── withRetry.js   # Retry wrapper with exponential backoff
│   │   ├── logger.js      # Structured logging
│   │   └── ...
│   ├── i18n/              # Internationalization
│   │   ├── index.js       # i18next configuration
│   │   └── locales/       # Translation files
│   │       ├── en.json
│   │       ├── fr.json
│   │       └── ar.json
│   ├── layouts/           # Page layouts
│   │   ├── MainLayout.jsx       # Public pages (home, marketplace)
│   │   ├── DashboardLayout.jsx  # Role dashboards
│   │   └── AuthLayout.jsx       # Login/Register pages
│   ├── constants/         # Shared constants & config
│   ├── App.jsx            # Main app component & routing
│   ├── main.jsx           # Entry point
│   └── index.css          # Global styles & Tailwind directives
├── database/              # SQL migrations & scripts
│   ├── migrations/        # Numbered migration files (001-*.sql, 002-*.sql, ...)
│   ├── scripts/           # Helper scripts (seed.js, hash-backup-codes.js)
│   └── schema.sql         # Base schema
├── supabase/              # Supabase Edge Functions
│   ├── functions/
│   │   ├── create-payment-intent/
│   │   ├── refund-payment/
│   │   ├── stripe-checkout/
│   │   ├── stripe-webhook/
│   │   ├── create-cmi-session/
│   │   ├── verify-cmi-callback/
│   │   ├── refund-cmi-payment/
│   │   ├── confirm-bank-transfer/
│   │   ├── get-bank-details/
│   │   └── send-email/
│   └── migrations/
├── cypress/               # E2E tests
│   ├── e2e/               # Test specs (*.cy.js)
│   └── support/           # Cypress support files
├── src/__tests__/         # Unit & integration tests
│   ├── components/
│   ├── hooks/
│   ├── integration/
│   ├── layouts/
│   ├── services/
│   ├── stores/
│   └── utils/
├── public/                # Static assets (favicon, manifest, etc.)
├── .env                   # Environment variables (DO NOT COMMIT)
├── .env.example           # Environment template
└── package.json
```

---

## 4. Conventions

### File Naming

| Type | Convention | Example |
|------|------------|---------|
| React components | **PascalCase** | `ProductCard.jsx`, `OrderTable.jsx` |
| Utility modules | **camelCase** | `formatDate.js`, `withRetry.js` |
| Service files | **camelCase** | `api.js`, `deliveries.js` |
| Store files | **camelCase** with `Store` suffix | `authStore.js`, `cartStore.js` |
| Test files | Same name as source + `.test` | `Button.test.jsx` |
| E2E test files | **camelCase** + `.cy.js` | `auth.cy.js`, `buyer.cy.js` |
| Migration files | `NNN-description.sql` | `001-add-favorites-table.sql` |
| Edge Functions | **kebab-case** | `create-payment-intent` |

### Variable & Function Naming

- Use **camelCase** for all variables, functions, and object properties
- Use **PascalCase** for React component names
- Use **UPPER_SNAKE_CASE** for constants
- Use **descriptive names** -- prefer `getUserOrders` over `getOrders`

### Translation Keys

Use the `namespace.section.key` format:

```
common.button.submit
common.error.network
auth.login.title
auth.register.validation.email
buyer.orders.empty
vendor.products.add.success
admin.users.table.header
```

### API Calls -- Always Use `withRetry`

All Supabase/API calls must be wrapped in `withRetry` to handle transient network errors:

```javascript
import { withRetry } from '@/utils/withRetry'

// In a service file
export const getProducts = withRetry(async (filters = {}) => {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
})
```

The `withRetry` utility provides:
- **3 retry attempts** by default
- **Exponential backoff** with jitter (1s, 2s, 4s + random)
- **Smart retry** only on network errors, timeouts, and 5xx responses
- **Structured logging** of failures

### Soft Deletes

Never hard-delete records that have business significance. Use soft deletes:

```sql
-- Add a deleted_at column
ALTER TABLE products ADD COLUMN deleted_at TIMESTAMPTZ;

-- Soft delete query
UPDATE products SET deleted_at = NOW() WHERE id = $1;

-- Query excluding soft-deleted records
SELECT * FROM products WHERE deleted_at IS NULL;
```

In service code, always filter out soft-deleted records:

```javascript
const { data } = await supabase
  .from('products')
  .select('*')
  .is('deleted_at', null)  // Always exclude soft-deleted
```

### Dark Mode

Always include `dark:` variants for all Tailwind color classes:

```jsx
// Good
<div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">

// Bad -- will look broken in dark mode
<div className="bg-white text-gray-900">
```

Common dark mode patterns:

```jsx
// Card
className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"

// Text
className="text-gray-600 dark:text-gray-400"

// Input
className="bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"

// Hover
className="hover:bg-gray-100 dark:hover:bg-gray-700"
```

### Path Aliases

The project uses `@/` path aliases pointing to `src/`:

```javascript
import { authStore } from '@/store/authStore'
import { withRetry } from '@/utils/withRetry'
import Button from '@/components/ui/Button'
```

---

## 5. How to Add a New Feature

Follow these steps to add a complete feature from concept to deployment.

### Step 1: Plan the Feature

- Identify which role(s) the feature affects
- Determine if new database tables or columns are needed
- Plan the UI layout and user flow

### Step 2: Create the Database Migration

Create a new migration file in `database/migrations/`:

```bash
# Use the next sequential number
touch database/migrations/026-your-feature-name.sql
```

Write the SQL with:
- Table/column definitions
- Indexes for query performance
- RLS (Row Level Security) policies
- Soft delete column if applicable

See [Section 8](#8-how-to-create-a-new-migration) for details.

### Step 3: Create the Page

Create a new page component in the appropriate role directory:

```
src/pages/
  buyer/    -> for buyer features
  vendor/   -> for vendor features
  driver/   -> for driver features
  admin/    -> for admin features
```

```jsx
// src/pages/vendor/NewFeature.jsx
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/authStore'

export default function NewFeature() {
  const { t } = useTranslation()
  const { user } = useAuthStore()

  return (
    <div className="p-6 bg-white dark:bg-gray-900 min-h-screen">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
        {t('vendor.newFeature.title')}
      </h1>
      {/* Feature content */}
    </div>
  )
}
```

### Step 4: Add the Route

Register the route in `App.jsx`:

```jsx
// Import your new page
import NewFeature from './pages/vendor/NewFeature'

// Add the route inside the vendor-protected section
<Route path="/vendor/new-feature" element={
  <ProtectedRoute requiredRole="vendor">
    <DashboardLayout>
      <NewFeature />
    </DashboardLayout>
  </ProtectedRoute>
} />
```

### Step 5: Create the Service Layer

If the feature needs API calls, create or update a service file in `src/services/`:

```javascript
// src/services/newFeature.js
import { supabase } from './supabase'
import { withRetry } from '@/utils/withRetry'

export const newFeatureService = {
  getAll: withRetry(async (vendorId) => {
    const { data, error } = await supabase
      .from('new_feature_table')
      .select('*')
      .eq('vendor_id', vendorId)
      .is('deleted_at', null)

    if (error) throw error
    return data
  }),

  create: withRetry(async (payload) => {
    const { data, error } = await supabase
      .from('new_feature_table')
      .insert(payload)
      .select()
      .single()

    if (error) throw error
    return data
  }),

  update: withRetry(async (id, payload) => {
    const { data, error } = await supabase
      .from('new_feature_table')
      .update(payload)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  }),

  delete: withRetry(async (id) => {
    // Soft delete
    const { error } = await supabase
      .from('new_feature_table')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)

    if (error) throw error
  })
}
```

### Step 6: Add Translations

Add translation keys to all three locale files:

```json
// src/i18n/locales/en.json
{
  "vendor": {
    "newFeature": {
      "title": "New Feature",
      "description": "Manage your new feature",
      "create": "Create",
      "edit": "Edit",
      "delete": "Delete",
      "confirmDelete": "Are you sure you want to delete this?",
      "success": "Operation completed successfully",
      "error": "An error occurred"
    }
  }
}
```

Repeat for `fr.json` and `ar.json` with appropriate translations.

### Step 7: Create Reusable Components (if needed)

If the feature has complex UI, extract reusable components:

```
src/components/newFeature/
  NewFeatureCard.jsx
  NewFeatureForm.jsx
  NewFeatureList.jsx
```

### Step 8: Write Tests

- **Unit tests** for components and utilities in `src/__tests__/`
- **Integration tests** for service-layer logic in `src/__tests__/integration/`
- **E2E tests** for user flows in `cypress/e2e/`

See [Section 6](#6-how-to-write-tests) for examples.

### Step 9: Test Locally

```bash
# Run linting
npm run lint

# Run type checking
npm run type-check

# Run unit tests
npm test

# Run E2E tests
npm run test:cypress:run
```

### Step 10: Deploy

```bash
# Build for production
npm run build

# Deploy to Firebase Hosting
npm run deploy

# Or deploy everything (including Edge Functions)
npm run deploy:all
```

---

## 6. How to Write Tests

Qotoof uses a three-tier testing strategy:

| Tier | Tool | Purpose | Location |
|------|------|---------|----------|
| Unit | Jest + React Testing Library | Individual components, utilities, hooks | `src/__tests__/` |
| Integration | Jest | Service-layer logic, store interactions | `src/__tests__/integration/` |
| E2E | Cypress | Full user flows in browser | `cypress/e2e/` |

### Unit Tests (Jest + React Testing Library)

Test individual components in isolation.

```jsx
// src/__tests__/components/ProductCard.test.jsx
import { render, screen, fireEvent } from '@testing-library/react'
import ProductCard from '@/components/marketplace/ProductCard'

describe('ProductCard', () => {
  const mockProduct = {
    id: '1',
    name: 'Fresh Tomatoes',
    price: 5.99,
    unit: 'kg',
    vendor: { name: 'Green Farm' },
    image_url: '/tomatoes.jpg',
    min_order_qty: 10,
  }

  it('renders product information correctly', () => {
    render(<ProductCard product={mockProduct} />)

    expect(screen.getByText('Fresh Tomatoes')).toBeInTheDocument()
    expect(screen.getByText('5.99 MAD/kg')).toBeInTheDocument()
    expect(screen.getByText('Green Farm')).toBeInTheDocument()
    expect(screen.getByText('Min. 10 kg')).toBeInTheDocument()
  })

  it('calls onAddToCart when add button is clicked', () => {
    const handleAddToCart = jest.fn()
    render(
      <ProductCard
        product={mockProduct}
        onAddToCart={handleAddToCart}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /add to cart/i }))
    expect(handleAddToCart).toHaveBeenCalledWith(mockProduct)
    expect(handleAddToCart).toHaveBeenCalledTimes(1)
  })

  it('shows out of stock message when quantity is 0', () => {
    const outOfStockProduct = { ...mockProduct, stock_quantity: 0 }
    render(<ProductCard product={outOfStockProduct} />)

    expect(screen.getByText(/out of stock/i)).toBeInTheDocument()
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('applies dark mode classes', () => {
    render(<ProductCard product={mockProduct} />)
    const card = screen.getByRole('article')

    expect(card).toHaveClass('dark:bg-gray-800')
  })
})
```

**Testing utilities:**

```jsx
// src/__tests__/utils/withRetry.test.js
import { withRetry } from '@/utils/withRetry'

describe('withRetry', () => {
  it('returns result on first success', async () => {
    const fn = jest.fn().mockResolvedValue('success')
    const result = await withRetry(fn)
    expect(result).toBe('success')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('retries on network error', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce('success')

    const result = await withRetry(fn, { baseDelay: 10 })
    expect(result).toBe('success')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('throws after max retries', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('network error'))

    await expect(
      withRetry(fn, { maxRetries: 2, baseDelay: 10 })
    ).rejects.toThrow('network error')

    expect(fn).toHaveBeenCalledTimes(3) // initial + 2 retries
  })
})
```

### Integration Tests

Test interactions between services, stores, and components.

```jsx
// src/__tests__/integration/orderFlow.test.jsx
import { render, screen, waitFor } from '@testing-library/react'
import { useCartStore } from '@/store/cartStore'
import { orderService } from '@/services/api'

describe('Order Flow Integration', () => {
  beforeEach(() => {
    useCartStore.getState().clearCart()
  })

  it('adds items to cart and creates an order', async () => {
    const { addToCart, getCartTotal } = useCartStore.getState()

    // Add items to cart
    addToCart({ id: '1', name: 'Tomatoes', price: 5.99, quantity: 10 })
    addToCart({ id: '2', name: 'Onions', price: 3.50, quantity: 5 })

    expect(getCartTotal()).toBe(77.40) // (5.99 * 10) + (3.50 * 5)

    // Create order (mocked service)
    jest.spyOn(orderService, 'create').mockResolvedValue({
      id: 'order-123',
      status: 'pending',
      total: 77.40,
    })

    const order = await orderService.create({
      items: useCartStore.getState().getItems(),
      total: getCartTotal(),
    })

    expect(order.status).toBe('pending')
    expect(order.total).toBe(77.40)
  })
})
```

### E2E Tests (Cypress)

Test complete user flows in a real browser.

```javascript
// cypress/e2e/buyerOrderFlow.cy.js

describe('Buyer Order Flow', () => {
  beforeEach(() => {
    cy.visit('/marketplace')
  })

  it('browses products, adds to cart, and places an order', () => {
    // Browse marketplace
    cy.url().should('include', '/marketplace')

    // Search for a product
    cy.get('input[placeholder*="Search"]').type('Tomatoes')
    cy.get('[data-testid="product-card"]').first().should('be.visible')

    // Click on product
    cy.get('[data-testid="product-card"]').first().click()
    cy.url().should('include', '/product/')

    // Add to cart
    cy.get('input[type="number"]').clear().type('10')
    cy.contains('button', /add to cart/i).click()

    // Verify cart badge updates
    cy.get('[data-testid="cart-badge"]').should('be.visible')

    // Go to cart
    cy.get('[data-testid="cart-button"]').click()
    cy.url().should('include', '/cart')

    // Verify item in cart
    cy.contains('Tomatoes').should('be.visible')

    // Proceed to checkout
    cy.contains('button', /checkout/i).click()

    // Fill shipping info
    cy.get('input[name="address"]').type('123 Market St, Casablanca')
    cy.get('input[name="phone"]').type('+212600000000')

    // Select payment method
    cy.get('select[name="paymentMethod"]').select('bank_transfer')

    // Place order
    cy.contains('button', /place order/i).click()

    // Verify order confirmation
    cy.url().should('include', '/order-confirmation')
    cy.contains(/order placed successfully/i).should('be.visible')
  })

  it('filters products by category', () => {
    cy.visit('/marketplace')

    // Click category filter
    cy.contains('button', 'Vegetables').click()

    // Verify only vegetable products shown
    cy.get('[data-testid="product-card"]').each(($card) => {
      cy.wrap($card).within(() => {
        cy.get('[data-testid="product-category"]').should('contain', 'Vegetables')
      })
    })
  })
})
```

**Cypress best practices:**
- Use `data-testid` attributes for stable selectors
- Test one user flow per `it` block
- Use `beforeEach` for common setup
- Use environment variables for test credentials (`Cypress.env()`)
- Test both happy path and error scenarios

### Running Tests

```bash
# Run all unit tests
npm test

# Run specific test file
npm test -- src/__tests__/components/ProductCard.test.jsx

# Run tests in watch mode (during development)
npm run test:watch

# Run with coverage report
npm run test:coverage

# Open Cypress interactive runner
npm run test:cypress

# Run Cypress headless
npm run test:cypress:run

# Run all tests
npm run test:all
```

---

## 7. How to Add New Translations

Qotoof supports three languages: English, French, and Arabic (with RTL support).

### Step 1: Add Keys to All Locale Files

Add the same key structure to each language file with the appropriate translation:

```json
// src/i18n/locales/en.json
{
  "vendor": {
    "schedules": {
      "title": "Store Schedule",
      "addHours": "Add Operating Hours",
      "monday": "Monday",
      "closed": "Closed",
      "save": "Save Schedule"
    }
  }
}
```

```json
// src/i18n/locales/fr.json
{
  "vendor": {
    "schedules": {
      "title": "Horaire du magasin",
      "addHours": "Ajouter les heures d'ouverture",
      "monday": "Lundi",
      "closed": "Fermé",
      "save": "Enregistrer"
    }
  }
}
```

```json
// src/i18n/locales/ar.json
{
  "vendor": {
    "schedules": {
      "title": "جدول المتجر",
      "addHours": "إضافة ساعات العمل",
      "monday": "الاثنين",
      "closed": "مغلق",
      "save": "حفظ الجدول"
    }
  }
}
```

### Step 2: Use the `t()` Function in Components

```jsx
import { useTranslation } from 'react-i18next'

export default function StoreSchedule() {
  const { t } = useTranslation()

  return (
    <div>
      <h1>{t('vendor.schedules.title')}</h1>
      <button>{t('vendor.schedules.addHours')}</button>
      <span>{t('vendor.schedules.monday')}: {t('vendor.schedules.closed')}</span>
      <button>{t('vendor.schedules.save')}</button>
    </div>
  )
}
```

### Step 3: Use with Interpolation (Dynamic Values)

```json
// en.json
{
  "common": {
    "items": "{{count}} items",
    "price": "{{amount}} {{currency}}"
  }
}
```

```jsx
<span>{t('common.items', { count: 5 })}</span>
{/* Renders: "5 items" */}

<span>{t('common.price', { amount: 29.99, currency: 'MAD' })}</span>
{/* Renders: "29.99 MAD" */}
```

### Important Notes

- **Always add keys to all three files** (en.json, fr.json, ar.json) -- missing keys in one language will show the fallback (English)
- Arabic uses **RTL layout** -- the i18n setup automatically switches `dir="rtl"` when Arabic is selected
- Keep keys **consistent** across all files -- same key paths, different values
- Use the `namespace.section.key` convention for organization

---

## 8. How to Create a New Migration

Migrations are SQL files that modify the database schema. They live in `database/migrations/`.

### Naming Convention

```
NNN-description.sql
```

Where `NNN` is the next sequential number. Examples:
- `026-add-coupons-table.sql`
- `027-add-vendor-ratings.sql`
- `028-add-product-reviews.sql`

### Migration Template

```sql
-- =====================================================
-- Migration: NNN - Description of what this migration does
-- Date: YYYY-MM-DD
-- Author: Your Name
-- =====================================================

-- 1. Create the table
CREATE TABLE IF NOT EXISTS your_table_name (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,  -- Soft delete

  -- Your columns
  name TEXT NOT NULL,
  description TEXT,
  vendor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Constraints
  CONSTRAINT unique_name_per_vendor UNIQUE (vendor_id, name)
);

-- 2. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_your_table_vendor ON your_table_name(vendor_id);
CREATE INDEX IF NOT EXISTS idx_your_table_created ON your_table_name(created_at);
CREATE INDEX IF NOT EXISTS idx_your_table_deleted ON your_table_name(deleted_at) WHERE deleted_at IS NULL;

-- 3. Enable Row Level Security
ALTER TABLE your_table_name ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS policies
CREATE POLICY "Vendors can view own records"
  ON your_table_name FOR SELECT
  USING (vendor_id = auth.uid());

CREATE POLICY "Vendors can insert own records"
  ON your_table_name FOR INSERT
  WITH CHECK (vendor_id = auth.uid());

CREATE POLICY "Vendors can update own records"
  ON your_table_name FOR UPDATE
  USING (vendor_id = auth.uid());

CREATE POLICY "Vendors can soft-delete own records"
  ON your_table_name FOR UPDATE
  USING (vendor_id = auth.uid())
  WITH CHECK (deleted_at IS NOT NULL);

-- 5. Add comments for documentation
COMMENT ON TABLE your_table_name IS 'Description of what this table stores';
COMMENT ON COLUMN your_table_name.deleted_at IS 'Soft delete timestamp';
```

### Adding Columns to Existing Tables

```sql
-- Add new columns
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS featured_until TIMESTAMPTZ;

-- Add index
CREATE INDEX IF NOT EXISTS idx_products_featured ON products(is_featured) WHERE is_featured = true AND deleted_at IS NULL;
```

### Running Migrations

```bash
# Option 1: Run via Supabase Dashboard
# - Open https://app.supabase.com
# - Go to SQL Editor
# - Paste and run the migration file

# Option 2: Run via Supabase CLI
npx supabase db push

# Option 3: Run via the project's migration script
node database/run-migrations.js
```

### Migration Best Practices

1. **Always use `IF NOT EXISTS`** to make migrations idempotent
2. **Always add indexes** on foreign keys and frequently queried columns
3. **Always add RLS policies** -- never leave a table without security policies
4. **Always include soft delete** (`deleted_at`) for business-critical tables
5. **Always include `created_at` and `updated_at`** timestamps
6. **Test migrations** on a local/dev database before running on production
7. **Never modify existing migration files** that have been run -- create a new one instead
8. **Use partial indexes** where appropriate (e.g., `WHERE deleted_at IS NULL`)

---

## 9. How to Deploy Edge Functions

Edge Functions are serverless functions that run on Supabase's edge network. They handle sensitive operations like payment processing and email sending.

### Existing Edge Functions

| Function | Purpose |
|----------|---------|
| `create-payment-intent` | Stripe payment intent creation |
| `refund-payment` | Process payment refunds |
| `stripe-checkout` | Stripe checkout session |
| `stripe-webhook` | Handle Stripe webhook events |
| `create-cmi-session` | CMI payment session (Moroccan gateway) |
| `verify-cmi-callback` | Verify CMI payment callback |
| `refund-cmi-payment` | Refund CMI payments |
| `confirm-bank-transfer` | Confirm bank transfer payments |
| `get-bank-details` | Return bank account details |
| `send-email` | Send transactional emails |

### Deploying a Single Function

```bash
supabase functions deploy function-name --project-ref your-project-ref
```

For functions that don't require JWT verification (public endpoints):

```bash
supabase functions deploy create-payment-intent --no-verify-jwt
supabase functions deploy send-email --no-verify-jwt
```

### Deploying All Functions

```bash
# Deploy all functions at once
supabase functions deploy --project-ref your-project-ref
```

### Creating a New Edge Function

```bash
# Create a new function
supabase functions new my-new-function

# This creates:
# supabase/functions/my-new-function/index.ts

# Write your function code
# Then deploy:
supabase functions deploy my-new-function --project-ref your-project-ref
```

### Edge Function Template

```typescript
// supabase/functions/my-function/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    // Parse request body
    const body = await req.json()

    // Create Supabase client (use service role key for admin access)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Your business logic here
    const result = await doSomething(body)

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
```

### Calling Edge Functions from the Frontend

```javascript
import { supabase } from '@/services/supabase'

const { data, error } = await supabase.functions.invoke('my-function', {
  body: { key: 'value' },
})

if (error) throw error
return data
```

---

## 10. Troubleshooting

### Common Issues and Solutions

#### Supabase Connection Errors

**Problem:** `Failed to fetch` or `network error` when making Supabase calls.

**Solutions:**
1. Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env` are correct
2. Check that your Supabase project is active at https://app.supabase.com
3. Ensure the database tables exist (run migrations)
4. Check browser console for CORS errors
5. The `withRetry` utility will automatically retry transient failures

#### RLS Policy Blocking Access

**Problem:** Queries return empty results or `permission denied` errors.

**Solutions:**
1. Verify RLS policies exist for the table:
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'your_table';
   ```
2. Ensure the policy matches the authenticated user's ID (`auth.uid()`)
3. Check that the user has the correct role in their profile
4. For testing, temporarily disable RLS to isolate the issue:
   ```sql
   ALTER TABLE your_table DISABLE ROW LEVEL SECURITY;
   -- Test, then re-enable!
   ALTER TABLE your_table ENABLE ROW LEVEL SECURITY;
   ```

#### Dark Mode Not Working

**Problem:** Dark mode styles are not applied.

**Solutions:**
1. Ensure `dark:` variants are present on all color classes
2. Check that Tailwind's dark mode is configured in `tailwind.config.js`:
   ```js
   module.exports = {
     darkMode: 'class', // or 'media'
   }
   ```
3. Verify the `dark` class is being toggled on the `<html>` element

#### Translation Keys Showing as Raw Text

**Problem:** Seeing `vendor.schedules.title` instead of the translated text.

**Solutions:**
1. Verify the key exists in all three locale files (en.json, fr.json, ar.json)
2. Check for typos in the key path
3. Ensure `useTranslation()` hook is called inside the component
4. Restart the dev server if you just added new keys

#### Build Failures

**Problem:** `npm run build` fails.

**Solutions:**
1. Run `npm run lint` to check for linting errors
2. Run `npm run type-check` to check for TypeScript errors
3. Check for unused imports or variables
4. Ensure all environment variables referenced in the code are prefixed with `VITE_` (Vite requirement)

#### Cypress Tests Failing

**Problem:** E2E tests fail with element not found errors.

**Solutions:**
1. Ensure the dev server is running (`npm run dev`)
2. Check that test data exists in the database (use seed data)
3. Use `data-testid` attributes for stable selectors instead of CSS classes
4. Add `cy.wait()` or `cy.intercept()` for async operations
5. Run Cypress in headed mode to see what's happening: `npm run test:cypress`

#### Payment Integration Issues

**Problem:** Payments not processing correctly.

**Solutions:**
1. Verify `VITE_PAYMENT_MODE` is set to `test` for development
2. Check that Edge Functions are deployed: `supabase functions list`
3. Verify Stripe/CMI API keys in `.env` are correct
4. Check Edge Function logs in Supabase dashboard
5. For CMI, ensure the merchant callback URLs are whitelisted

#### Real-time Updates Not Working

**Problem:** Live order status or location updates not appearing.

**Solutions:**
1. Enable Realtime for the relevant tables in Supabase dashboard
2. Verify the subscription is set up correctly:
   ```javascript
   const channel = supabase
     .channel('orders')
     .on('postgres_changes', {
       event: 'UPDATE',
       schema: 'public',
       table: 'orders',
       filter: `id=eq.${orderId}`,
     }, (payload) => {
       console.log('Order updated:', payload)
     })
     .subscribe()
   ```
3. Check browser network tab for WebSocket connection
4. Ensure the user has SELECT permission via RLS for the table

#### Arabic RTL Layout Issues

**Problem:** Arabic text or layout is misaligned.

**Solutions:**
1. Verify the language is set to `ar` in the language store
2. Check that `document.documentElement.dir` is set to `rtl`
3. Use logical CSS properties (`start`/`end` instead of `left`/`right`):
   ```jsx
   // Good -- works for both LTR and RTL
   className="ms-4 me-2" // margin-start, margin-end

   // Bad -- breaks in RTL
   className="ml-4 mr-2"
   ```
4. Tailwind CSS handles most RTL automatically when `dir="rtl"` is set

#### Port Already in Use

**Problem:** `npm run dev` fails with `EADDRINUSE`.

**Solutions:**
```bash
# Kill the process using port 5173
lsof -ti:5173 | xargs kill

# Or start on a different port
npm run dev -- --port 3001
```

#### Missing Environment Variables

**Problem:** `undefined` values when accessing `import.meta.env.VITE_*`.

**Solutions:**
1. Vite only exposes variables prefixed with `VITE_`
2. Server-side variables (without `VITE_` prefix) are only available in Edge Functions
3. Restart the dev server after changing `.env`
4. Verify `.env` is in the project root (same level as `vite.config.js`)

---

## Quick Reference

### Useful Links

| Resource | URL |
|----------|-----|
| Supabase Dashboard | https://app.supabase.com |
| Stripe Dashboard | https://dashboard.stripe.com |
| Firebase Console | https://console.firebase.google.com |
| Sentry Dashboard | https://sentry.io |
| Resend (Email) | https://resend.com |
| CMI (Moroccan Payments) | https://www.cmi.co.ma |

### Key Files

| File | Purpose |
|------|---------|
| `src/App.jsx` | Main routing configuration |
| `src/main.jsx` | Application entry point |
| `src/store/authStore.js` | Authentication state & role management |
| `src/services/supabase.ts` | Supabase client & retry logic |
| `src/services/api.js` | Main API service layer |
| `src/i18n/index.js` | i18next configuration |
| `src/utils/withRetry.js` | Retry utility with exponential backoff |
| `database/schema.sql` | Base database schema |
| `.env` | Environment variables |

### Environment Variable Prefixes

| Prefix | Visibility | Purpose |
|--------|------------|---------|
| `VITE_` | Client-side | Available in browser bundle |
| No prefix | Server-side | Only available in Edge Functions |

---

*This guide is a living document. Update it as the project evolves.*
