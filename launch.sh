#!/bin/bash
# ============================================
# QOTOOF - Final Launch Script
# ============================================
# This script performs all setup steps for production launch
# Run: chmod +x launch.sh && ./launch.sh

set -e  # Exit on error

echo "🚀 QOTOOF PRODUCTION LAUNCH SCRIPT"
echo "===================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============================================
# PRE-FLIGHT CHECKS
# ============================================
echo -e "${BLUE}📋 Step 1: Pre-flight checks${NC}"
echo "-----------------------------------"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed${NC}"
    echo "Install from: https://nodejs.org"
    exit 1
fi
echo -e "${GREEN}✅ Node.js $(node -v)${NC}"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm is not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✅ npm $(npm -v)${NC}"

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo -e "${YELLOW}⚠️  Supabase CLI not installed (optional)${NC}"
    echo "Install: brew install supabase/tap/supabase"
else
    echo -e "${GREEN}✅ Supabase CLI$(supabase --version)${NC}"
fi

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo -e "${YELLOW}⚠️  Firebase CLI not installed (optional)${NC}"
    echo "Install: npm install -g firebase-tools"
else
    echo -e "${GREEN}✅ Firebase CLI$(firebase --version)${NC}"
fi

echo ""

# ============================================
# ENVIRONMENT SETUP
# ============================================
echo -e "${BLUE}📝 Step 2: Environment setup${NC}"
echo "-----------------------------------"

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  .env file not found${NC}"
    echo "Creating from .env.example..."
    cp .env.example .env
    echo -e "${RED}🔴 IMPORTANT: Edit .env file with your actual values!${NC}"
    echo "Press Enter to continue after editing .env..."
    read
else
    echo -e "${GREEN}✅ .env file exists${NC}"
fi

echo ""

# ============================================
# INSTALL DEPENDENCIES
# ============================================
echo -e "${BLUE}📦 Step 3: Install dependencies${NC}"
echo "-----------------------------------"

echo "Installing npm packages..."
npm install

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Dependencies installed${NC}"
else
    echo -e "${RED}❌ Failed to install dependencies${NC}"
    exit 1
fi

echo ""

# ============================================
# RUN LINTER
# ============================================
echo -e "${BLUE}🔍 Step 4: Code quality check${NC}"
echo "-----------------------------------"

echo "Running linter..."
npm run lint || echo -e "${YELLOW}⚠️  Linter found warnings (non-blocking)${NC}"

echo ""

# ============================================
# RUN TESTS
# ============================================
echo -e "${BLUE}🧪 Step 5: Run tests${NC}"
echo "-----------------------------------"

echo "Running unit tests..."
npm run test || echo -e "${YELLOW}⚠️  Some tests failed (review recommended)${NC}"

echo ""

# ============================================
# BUILD APPLICATION
# ============================================
echo -e "${BLUE}🏗️  Step 6: Build application${NC}"
echo "-----------------------------------"

echo "Building for production..."
npm run build

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Build successful${NC}"
else
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi

echo ""

# ============================================
# SUPABASE SETUP
# ============================================
echo -e "${BLUE}🗄️  Step 7: Supabase setup${NC}"
echo "-----------------------------------"

echo "Please complete the following in Supabase Dashboard:"
echo ""
echo -e "${YELLOW}1. Run database migrations:${NC}"
echo "   - Copy contents of supabase/setup-storage.sql"
echo "   - Run in Supabase SQL Editor"
echo ""
echo -e "${YELLOW}2. Enable Realtime for tables:${NC}"
echo "   - Go to Database → Replication"
echo "   - Enable for: orders, notifications, deliveries, products, messages"
echo ""
echo -e "${YELLOW}3. Deploy Edge Functions:${NC}"
echo "   - supabase functions deploy send-email"
echo "   - supabase functions deploy create-payment-intent"
echo "   - supabase functions deploy refund-payment"
echo ""
echo -e "${YELLOW}4. Configure environment variables in Supabase:${NC}"
echo "   - Go to Project Settings → Edge Functions"
echo "   - Add: RESEND_API_KEY, STRIPE_SECRET_KEY, etc."
echo ""

echo "Press Enter when Supabase setup is complete..."
read

echo ""

# ============================================
# FIREBASE SETUP
# ============================================
echo -e "${BLUE}🔥 Step 8: Firebase setup${NC}"
echo "-----------------------------------"

echo "Please complete the following in Firebase Console:"
echo ""
echo -e "${YELLOW}1. Initialize Firebase (if not done):${NC}"
echo "   - firebase login"
echo "   - firebase init hosting"
echo ""
echo -e "${YELLOW}2. Set environment variables:${NC}"
echo "   - firebase functions:config:set supabase.url=\"YOUR_URL\""
echo "   - firebase functions:config:set supabase.key=\"YOUR_KEY\""
echo ""

echo "Press Enter when Firebase setup is complete..."
read

echo ""

# ============================================
# DEPLOY TO FIREBASE
# ============================================
echo -e "${BLUE}🚀 Step 9: Deploy to Firebase${NC}"
echo "-----------------------------------"

echo "Deploying to Firebase Hosting..."
npm run deploy

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Deployment successful!${NC}"
else
    echo -e "${RED}❌ Deployment failed${NC}"
    exit 1
fi

echo ""

# ============================================
# POST-DEPLOYMENT CHECKS
# ============================================
echo -e "${BLUE}✅ Step 10: Post-deployment verification${NC}"
echo "-----------------------------------"

echo "Please verify the following:"
echo ""
echo "1. ✅ Application loads: https://your-project.web.app"
echo "2. ✅ Marketplace page works"
echo "3. ✅ Login/Register works"
echo "4. ✅ Real-time updates work"
echo "5. ✅ Email notifications work"
echo "6. ✅ Payment gateway works"
echo "7. ✅ Error monitoring (Sentry) receives events"
echo ""

echo "Press Enter when verification is complete..."
read

echo ""

# ============================================
# LAUNCH COMPLETE
# ============================================
echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                                                        ║${NC}"
echo -e "${GREEN}║           🎉 LAUNCH SUCCESSFUL! 🎉                    ║${NC}"
echo -e "${GREEN}║                                                        ║${NC}"
echo -e "${GREEN}║  Your Qotoof application is now LIVE!                  ║${NC}"
echo -e "${GREEN}║                                                        ║${NC}"
echo -e "${GREEN}║  Next steps:                                           ║${NC}"
echo -e "${GREEN}║  1. Monitor errors: https://sentry.io                  ║${NC}"
echo -e "${GREEN}║  2. Check analytics: Google Analytics / Plausible      ║${NC}"
echo -e "${GREEN}║  3. Monitor emails: Resend dashboard                   ║${NC}"
echo -e "${GREEN}║  4. Monitor payments: Stripe dashboard                 ║${NC}"
echo -e "${GREEN}║                                                        ║${NC}"
echo -e "${GREEN}║  Support:                                              ║${NC}"
echo -e "${GREEN}║  - Documentation: ./DEVELOPER_GUIDE.md                 ║${NC}"
echo -e "${GREEN}║  - Environment: .env.example                           ║${NC}"
echo -e "${GREEN}║  - Database: supabase/setup-storage.sql                ║${NC}"
echo -e "${GREEN}║                                                        ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}"

echo ""
echo -e "${BLUE}📊 Quick Stats:${NC}"
echo "-----------------------------------"
echo "Build size: $(du -sh dist/ | cut -f1)"
echo "Dependencies: $(npm ls --depth=0 2>/dev/null | tail -n +2 | wc -l | tr -d ' ') packages"
echo ""
echo -e "${GREEN}🚀 Happy selling! 🌿${NC}"
