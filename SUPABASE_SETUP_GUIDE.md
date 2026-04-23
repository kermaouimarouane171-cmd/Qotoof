# 🚀 Qotoof - Complete Supabase Setup Guide

**Last Updated:** April 11, 2026  
**Estimated Time:** 30-45 minutes  
**Difficulty:** Beginner-Friendly

---

## 📋 Prerequisites

Before starting, ensure you have:
- ✅ A [Supabase](https://supabase.com) account (free tier is sufficient)
- ✅ Node.js and npm installed
- ✅ The project cloned and `npm install` completed

---

## Step 1: Create Supabase Project (5 minutes)

### 1.1 Sign Up / Login

1. Go to [https://supabase.com](https://supabase.com)
2. Click **"Start your project"** or **"Sign In"**
3. Login with GitHub, Google, or email

### 1.2 Create New Project

1. Click **"New Project"**
2. Fill in:
   - **Organization:** Select or create one
   - **Project name:** `qotoof` (or `qotoof-production`)
   - **Database Password:** Click **"Generate a password"** and **SAVE IT SECURELY**
   - **Region:** Choose closest to Morocco (Europe West - `eu-west-1` recommended)
3. Click **"Create new project"**
4. Wait 2-3 minutes for provisioning

### 1.3 Get Project Credentials

1. Go to **Project Settings** (gear icon ⚙️)
2. Click **"API"** in the left sidebar
3. Copy these values:
   ```
   Project URL: https://xxxxxxxxxxxxx.supabase.co
   anon/public key: eyJhbGc... (long string)
   service_role key: eyJhbGc... (SECRET - never expose)
   ```

---

## Step 2: Configure Environment Variables (5 minutes)

### 2.1 Create .env File

1. Open the project in your code editor
2. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

### 2.2 Fill in Supabase Credentials

Open `.env` and update these lines:

```env
# Replace with your actual Supabase URL and keys
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key-here

# For Edge Functions (keep these server-side only)
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

**⚠️ IMPORTANT:**
- `VITE_SUPABASE_URL` → Your Project URL (from Step 1.3)
- `VITE_SUPABASE_ANON_KEY` → anon/public key (from Step 1.3)
- `SUPABASE_SERVICE_ROLE_KEY` → service_role key (from Step 1.3)
- **NEVER** commit `.env` to git (it's already in `.gitignore`)

---

## Step 3: Run Database Migration (10 minutes)

### 3.1 Open SQL Editor

1. In Supabase dashboard, click **"SQL Editor"** (database icon)
2. Click **"New Query"**

### 3.2 Run Migration Script

You have two options:

#### Option A: Use Complete Setup Script (Recommended)

1. Open file: `database/migrations/008-complete-setup.sql`
2. **Copy ALL content** from this file
3. **Paste** into Supabase SQL Editor
4. Click **"Run"** (or press `Ctrl+Enter`)
5. Wait for completion (should show "Success. No rows returned")

#### Option B: Run Individual Migrations

If you prefer step-by-step, run these in order:
1. `database/migrations/001_add_cin_to_profiles.sql`
2. `database/migrations/002_add_driver_assignment.sql`
3. `database/migrations/003_add_vendor_compliance.sql`
4. `database/migrations/004_add_commission_tracking.sql`
5. `database/migrations/007-geographic-delivery-system.sql`
6. `database/migrations/008-complete-setup.sql` (for RLS policies)

### 3.3 Verify Migration

After running, you should see output showing:
- ✅ Tables created (profiles, products, orders, etc.)
- ✅ Row security enabled (rowsecurity = true)
- ✅ Storage buckets created
- ✅ Indexes created

If you see errors:
- **Red text:** Read the error message carefully
- **Common issue:** Table already exists → That's OK, skip to next
- **Permission error:** Make sure you're logged in as project owner

---

## Step 4: Configure Authentication (5 minutes)

### 4.1 Enable Email Auth

1. Go to **Authentication** → **Providers** (in left sidebar)
2. Find **"Email"** and ensure it's **Enabled**
3. Toggle **"Confirm email"** to ON (recommended)
4. Toggle **"Secure email change"** to ON

### 4.2 Configure Email Templates (Optional but Recommended)

1. Go to **Authentication** → **Email Templates**
2. Click **"Confirm signup"**
3. Update the template:
   ```
   Subject: Welcome to Qotoof - Confirm your email
   ```
4. Customize the message if desired
5. Click **"Save"**

Repeat for:
- **"Invite user"**
- **"Magic Link"**
- **"Change Email"**
- **"Reset Password"**

### 4.3 Set Site URL

1. Go to **Authentication** → **URL Configuration**
2. Set **Site URL** to your production URL (or `http://localhost:5173` for development)
3. Add to **Redirect URLs**:
   ```
   http://localhost:5173/**
   https://your-domain.com/**
   ```
4. Click **"Save"**

---

## Step 5: Test User Signup (5 minutes)

### 5.1 Start Development Server

```bash
npm run dev
```

The app should open at `http://localhost:5173`

### 5.2 Create Test Account

1. Click **"Register"** or go to `/register`
2. Fill in:
   - Email: `test@example.com`
   - Password: `Test123456!`
   - First Name: `Test`
   - Last Name: `User`
   - Role: **Buyer**
3. Click **"Sign Up"**
4. Check your email for confirmation link
5. Click the confirmation link

### 5.3 Verify Profile Created

1. After confirming, login at `/login`
2. Go to **Profile** page
3. You should see your profile with:
   - Email: test@example.com
   - Name: Test User
   - Role: buyer

**If signup works:** ✅ Proceed to Step 6  
**If signup fails:** Check browser console for errors (F12 → Console)

---

## Step 6: Create Test Data (5 minutes)

### 6.1 Create Vendor Account

1. Logout from test account
2. Register new account with role: **Vendor/Farmer**
3. Confirm email and login

### 6.2 Add Test Product

1. Go to `/vendor/products` or `/vendor/dashboard`
2. Click **"Add Product"**
3. Fill in:
   - Product Name: `Fresh Tomatoes`
   - Category: `Vegetables`
   - Price: `5 MAD`
   - Unit: `kg`
   - Min Order: `10`
   - Available Quantity: `500`
   - Description: `Fresh organic tomatoes from local farm`
4. Click **"Save"**

### 6.3 Verify Product

1. Go to `/marketplace`
2. You should see your product listed
3. Click on it to view details

---

## Step 7: Deploy Edge Functions (Optional - 10 minutes)

Edge Functions are needed for:
- ✅ Email notifications
- ✅ Payment processing (Stripe)
- ✅ Payment refunds

### 7.1 Install Supabase CLI

```bash
npm install -g supabase
```

### 7.2 Login to Supabase

```bash
supabase login
```

This will open browser for authentication.

### 7.3 Link Project

```bash
supabase link --project-ref your-project-ref
```

Get project ref from: Settings → API → Project ID

### 7.4 Deploy Functions

```bash
# Deploy email function
supabase functions deploy send-email

# Deploy payment function
supabase functions deploy create-payment-intent

# Deploy refund function
supabase functions deploy refund-payment
```

### 7.5 Set Function Secrets

After deploying, set environment variables for each function:

```bash
supabase secrets set SUPABASE_URL=https://your-project.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
supabase secrets set RESEND_API_KEY=re_your_resend_key  # For email
supabase secrets set STRIPE_SECRET_KEY=sk_test_your_key  # For payments
```

---

## Step 8: Enable Realtime (2 minutes)

Realtime is needed for:
- ✅ Live order updates
- ✅ Chat messages
- ✅ Delivery tracking
- ✅ Notifications

### 8.1 Verify Realtime is Enabled

The migration script already enabled realtime for:
- `orders` table
- `deliveries` table
- `messages` table
- `notifications` table

To verify:
1. Go to **Database** → **Replication**
2. Ensure these tables are toggled ON

---

## Step 9: Security Checklist (3 minutes)

### 9.1 Verify RLS Policies

1. Go to **Database** → **Tables**
2. Click on each table
3. Scroll to **"Policies"** section
4. Ensure policies exist for: SELECT, INSERT, UPDATE, DELETE

### 9.2 Test Security

Try these tests:
1. ✅ Login as buyer → Should only see own orders
2. ✅ Login as vendor → Should only see own products
3. ✅ Login as driver → Should only see assigned deliveries
4. ✅ Not logged in → Should see public products only

### 9.3 API Rate Limiting

Rate limiting is configured in `.env`:
```env
RATE_LIMIT_API=100
RATE_LIMIT_LOGIN=5
RATE_LIMIT_REGISTER=3
```

These are enforced by the frontend, not Supabase.

---

## Step 10: Final Verification (5 minutes)

### 10.1 Run Health Check

Open browser console (F12) and run:

```javascript
// Check Supabase connection
const { data, error } = await supabase
  .from('profiles')
  .select('count')
  .limit(1)

console.log('Connection:', error ? 'FAILED' : 'OK')
```

### 10.2 Test Core Flows

Test these complete flows:

#### Buyer Flow:
1. ✅ Register as buyer
2. ✅ Browse marketplace
3. ✅ Add to cart
4. ✅ Checkout
5. ✅ View order in dashboard

#### Vendor Flow:
1. ✅ Register as vendor
2. ✅ Add product
3. ✅ View incoming order
4. ✅ Accept/reject order

#### Driver Flow:
1. ✅ Register as driver
2. ✅ Set availability ON
3. ✅ View available deliveries
4. ✅ Accept delivery

### 10.3 Check Storage

1. Upload a profile photo
2. Upload a product image
3. Verify images load correctly

---

## 🆘 Troubleshooting

### Issue: "JWT expired" Error

**Solution:**
- Logout and login again
- Token refresh is automatic but may fail after very long sessions

### Issue: "relation does not exist"

**Solution:**
- Migration didn't run completely
- Re-run `008-complete-setup.sql`
- Check for errors in SQL Editor output

### Issue: "new row violates row-level security policy"

**Solution:**
- RLS policy is blocking the operation
- Check which table and policy
- Ensure user has correct role and permissions

### Issue: Storage upload fails

**Solution:**
1. Check storage bucket exists (Step 3)
2. Check storage policies are created
3. Verify user is authenticated
4. Check file size (max 5MB on free tier)

### Issue: Email confirmation not received

**Solution:**
1. Check spam folder
2. Verify email provider in Supabase settings
3. For development, disable "Confirm email" temporarily
4. Consider using Resend or SendGrid for production emails

---

## ✅ Setup Complete Checklist

- [x] Supabase project created
- [x] Environment variables configured (`.env`)
- [x] Database migration run successfully
- [x] Authentication configured
- [x] Test user signup works
- [x] Test data created
- [ ] Edge Functions deployed (optional)
- [ ] Realtime verified
- [ ] RLS policies tested
- [ ] Core flows tested

---

## 📚 Next Steps

After completing Supabase setup:

1. **Deploy to Firebase:**
   ```bash
   npm run build
   npm run deploy
   ```

2. **Configure Stripe Payments:**
   - Create Stripe account at https://dashboard.stripe.com
   - Add keys to `.env`
   - Test with Stripe CLI

3. **Setup Email Service:**
   - Create Resend account at https://resend.com
   - Add API key to `.env`
   - Deploy send-email edge function

4. **Setup Error Monitoring:**
   - Create Sentry account at https://sentry.io
   - Add DSN to `.env`
   - Errors will be tracked automatically

5. **Go Live:**
   - Update `.env` with production URLs
   - Build and deploy
   - Monitor logs and errors

---

## 📞 Support

If you encounter issues:

1. Check browser console (F12 → Console)
2. Check Supabase logs (Database → Logs)
3. Check Edge Function logs (if deployed)
4. Review this guide step-by-step
5. Check existing documentation in `/docs` folder

---

**Good luck! 🚀**

Once this setup is complete, your application will be fully functional and ready for production use.
