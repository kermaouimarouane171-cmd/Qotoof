# 🚀 المرحلة 5: Staging & Production Deployment

> من التطوير إلى الإنتاج: خطة نشر شاملة وآمنة

---

## 1️⃣ Staging Environment Setup

### الهدف: 
بيئة مطابقة تماماً للإنتاج لاختبار كل شيء قبل النشر الفعلي

### البنية المقترحة:

```
Development       Staging          Production
(localhost:5173)  (staging.qotoof)  (app.qotoof.com)
└─ Local DB       └─ Test DB        └─ Real DB
└─ Fake Stripe    └─ Test Stripe    └─ Live Stripe
└─ Fake Emails    └─ Real Emails    └─ Real Emails
```

### الخطوة 1: إعداد المتغيرات البيئية

**الملف: `.env.staging`**

```bash
# ============================================
# APP CONFIG
# ============================================
VITE_APP_NAME=Qotoof Staging
VITE_API_BASE_URL=https://api-staging.qotoof.com
VITE_ENVIRONMENT=staging

# ============================================
# SUPABASE (Staging Project)
# ============================================
VITE_SUPABASE_URL=https://staging-xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_URL=https://staging-xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# ============================================
# STRIPE (Test Mode)
# ============================================
VITE_STRIPE_PUBLIC_KEY=pk_test_xxx
STRIPE_SECRET_KEY=sk_test_xxx
VITE_PAYMENT_MODE=test

# ============================================
# SENDGRID (Test Email)
# ============================================
SENDGRID_API_KEY=SG.xxx

# ============================================
# SENTRY (Error Tracking)
# ============================================
VITE_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
SENTRY_ENVIRONMENT=staging

# ============================================
# ANALYTICS (Not enabled in staging)
# ============================================
VITE_ANALYTICS_ENABLED=false
```

### الخطوة 2: بناء و نشر Staging

```bash
# بناء التطبيق
npm run build -- --mode staging

# نشر إلى Firebase Staging
firebase deploy --only hosting:staging

# أو إلى Vercel
vercel deploy --prod --env staging
```

---

## 2️⃣ Pre-Production Testing Checklist

### ✅ Functional Testing

```javascript
describe('Staging Validation', () => {
  // ===== Authentication =====
  ✓ Login works
  ✓ Register works
  ✓ Email verification works
  ✓ Password reset works
  ✓ Token refresh works
  ✓ Logout works
  
  // ===== Marketplace =====
  ✓ Product list loads
  ✓ Product search works
  ✓ Filters work
  ✓ Pagination works
  ✓ Product detail loads
  ✓ Reviews load
  ✓ Add to cart works
  
  // ===== Checkout (CRITICAL) =====
  ✓ Checkout process starts
  ✓ Address validation works
  ✓ Stripe payment works (test card)
  ✓ Order confirmation email sent
  ✓ Order appears in dashboard
  ✓ Tracking works
  
  // ===== Vendor =====
  ✓ Vendor login works
  ✓ Dashboard loads
  ✓ Product listing works
  ✓ Order management works
  ✓ Analytics display correctly
  
  // ===== Admin =====
  ✓ Admin login works
  ✓ Admin dashboard loads
  ✓ User management works
  ✓ Product approval works
  
  // ===== Driver =====
  ✓ Driver login works
  ✓ Dashboard loads
  ✓ Order acceptance works
  ✓ Tracking updates work
});
```

### ✅ Performance Testing

```bash
# استخدام Lighthouse
npm install -g lighthouse

lighthouse https://staging.qotoof.com --chrome-flags="--headless" 

# النتائج المتوقعة:
Performance: 90+
Accessibility: 90+
Best Practices: 90+
SEO: 90+
```

### ✅ Security Testing

```
Checklist:
✓ No sensitive data in logs
✓ API keys not exposed
✓ HTTPS enabled
✓ CSP headers configured
✓ CORS configured correctly
✓ SQL injection prevention works
✓ XSS protection works
✓ CSRF tokens work
✓ Rate limiting works
✓ Auth token expiry works
✓ RLS policies enforced
```

### ✅ Load Testing

```bash
# استخدام Apache Bench
ab -n 1000 -c 100 https://staging.qotoof.com

# أو استخدام K6
k6 run load-test.js
```

### ✅ Smoke Testing (Quick Check)

```javascript
// cypress/e2e/smoke.cy.js
describe('Smoke Tests - Staging', () => {
  it('should load homepage', () => {
    cy.visit('https://staging.qotoof.com');
    cy.contains('Qotoof').should('be.visible');
  });

  it('should login', () => {
    cy.login('test@qotoof.com', 'TestPass123');
    cy.url().should('include', '/marketplace');
  });

  it('should add product to cart', () => {
    cy.addToCart('طماطم', 1);
    cy.contains('تمت الإضافة').should('be.visible');
  });

  it('should start checkout', () => {
    cy.visit('https://staging.qotoof.com/cart');
    cy.contains('متابعة الدفع').click();
    cy.url().should('include', '/checkout');
  });
});
```

---

## 3️⃣ Production Deployment Pipeline

### البنية الموصى بة (CI/CD):

```
Git Push
   ↓
GitHub Actions / GitLab CI
   ↓
├─ Run Tests (Jest)
├─ Run E2E (Cypress)
├─ Build App
├─ Build Artifacts
├─ Security Scan
└─ Deploy
   ├─ Staging First ← Review & Test
   └─ Production (Manual Approval)
```

### الملف: `.github/workflows/deploy.yml`

```yaml
name: Deploy to Production

on:
  push:
    branches:
      - main
  workflow_dispatch:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run Unit Tests
        run: npm test -- --coverage
      
      - name: Run ESLint
        run: npm run lint
      
      - name: Build Application
        run: npm run build

  e2e:
    runs-on: ubuntu-latest
    needs: test
    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run E2E Tests on Staging
        run: npm run test:cypress:run
        env:
          CYPRESS_BASE_URL: https://staging.qotoof.com

  security:
    runs-on: ubuntu-latest
    needs: test
    steps:
      - uses: actions/checkout@v3
      
      - name: Run Snyk Security Scan
        uses: snyk/actions/node@master
        with:
          args: --severity-threshold=high

  deploy-staging:
    runs-on: ubuntu-latest
    needs: [test, e2e, security]
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy to Staging
        run: |
          npm run build -- --mode staging
          firebase deploy --only hosting:staging --token ${{ secrets.FIREBASE_TOKEN }}

  deploy-production:
    runs-on: ubuntu-latest
    needs: deploy-staging
    environment: production
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy to Production
        run: |
          npm run build
          firebase deploy --only hosting --token ${{ secrets.FIREBASE_TOKEN }}
      
      - name: Notify Team
        uses: actions/github-script@v6
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: '🚀 Deployed to Production successfully!'
            })
```

---

## 4️⃣ Production Deployment Checklist

### قبل النشر (Before Deployment):

```
□ جميع الاختبارات تمر ✓
□ لا توجد أخطاء في الـ console
□ لا توجد warnings في ESLint
□ قاعدة البيانات محدثة (migrations)
□ النسخ الاحتياطية موجودة
□ فريق الدعم مستعد
□ خطة الطوارئ جاهزة
□ جميع الـ env variables معينة
□ DNS مشير إلى الـ production
□ SSL certificate صالح
□ CDN مُعدّ
□ الموارد (bandwidth, storage) كافية
```

### موارد الإنتاج:

```
Database:        Supabase Production
Hosting:         Firebase Hosting / Vercel
CDN:             Cloudflare
DNS:             Cloudflare / Route53
Email:           SendGrid
Payments:        Stripe Live
Monitoring:      Sentry + DataDog
Analytics:       Google Analytics
```

---

## 5️⃣ Production Optimization

### 1. تحسين الأداء

```javascript
// شغّل lighthouse
lighthouse https://app.qotoof.com --chrome-flags="--headless"

// النتائج المتوقعة: 90+ للجميع
```

### 2. تحسين حجم Bundle

```bash
# تحليل حجم Bundle
npm run build
npm install -g source-map-explorer
source-map-explorer 'dist/**/*.js'
```

### 3. تحسين الصور

```javascript
// استخدام WebP + lazy loading
<picture>
  <source srcSet="image.webp" type="image/webp" />
  <img src="image.jpg" loading="lazy" alt="..." />
</picture>
```

### 4. تفعيل Caching

```javascript
// في Firebase:
{
  "hosting": {
    "headers": [
      {
        "source": "/static/**",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "public, max-age=31536000"
          }
        ]
      }
    ]
  }
}
```

### 5. Database Optimization

```sql
-- Create indexes for frequently used queries
CREATE INDEX idx_orders_user_id ON orders(buyer_id);
CREATE INDEX idx_products_vendor_id ON products(vendor_id);
CREATE INDEX idx_products_category ON products(category_id);

-- Enable Read Replicas (if needed)
-- في Supabase: Database > Replicas
```

---

## 6️⃣ Monitoring in Production

### الملف: `src/services/monitoring.js`

```javascript
import * as Sentry from '@sentry/react';
import { BrowserTracing } from '@sentry/tracing';

// Initialize Sentry
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.VITE_ENVIRONMENT,
  integrations: [
    new BrowserTracing(),
    new Sentry.Replay({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});

// Monitor custom events
export const trackEvent = (eventName, properties = {}) => {
  if (window.gtag) {
    gtag('event', eventName, properties);
  }
  
  // Also track in Sentry
  Sentry.captureMessage(`Event: ${eventName}`, 'info');
};

// Monitor errors
export const captureError = (error) => {
  Sentry.captureException(error);
};

// Performance monitoring
export const trackPageView = (path) => {
  Sentry.captureMessage(`Page View: ${path}`);
};
```

### Key Metrics to Monitor:

```
✓ API Response Time (Target: < 500ms)
✓ Page Load Time (Target: < 3s)
✓ Error Rate (Target: < 0.1%)
✓ Uptime (Target: 99.9%)
✓ Database Query Time (Target: < 100ms)
✓ User Sessions Active
✓ Checkout Completion Rate (Target: > 70%)
✓ Payment Success Rate (Target: > 98%)
```

---

## 7️⃣ การข้อมูลสำรองและการกู้คืน

Backup Strategy:

```
Daily Backups:
├─ Database (Supabase automatic)
├─ Storage (S3 / Google Cloud Storage)
└─ Code (GitHub)

Weekly Backups:
├─ Full database export
└─ Full S3 export

Monthly Backups:
└─ Long-term archive
```

Recovery Plan:

```
If Database is Down:
1. Check Supabase status
2. Restore from latest backup
3. Verify data integrity
4. Notify users

If Storage is Down:
1. Check S3 / Cloud Storage status
2. Restore from backup
3. Verify file integrity

If Application is Down:
1. Rollback to previous version
2. Check error logs
3. Fix issue + redeploy
```

---

## 8️⃣ Hotfix Process

### في حالة المشاكل الحرجة:

```
1. Create Hotfix Branch
   git checkout -b hotfix/issue-name

2. Fix the Issue
   (minimal, focused changes)

3. Test Locally
   npm test

4. Deploy to Staging
   npm run build:staging
   firebase deploy --only hosting:staging

5. Test on Staging
   (quick smoke tests)

6. Merge to Main
   git merge hotfix/issue-name

7. Deploy to Production
   npm run build
   firebase deploy --only hosting

8. Monitor Closely
   (watch Sentry + metrics)
```

---

## 9️⃣ Post-Deployment Verification

```javascript
// Smoke tests بعد النشر
describe('Post-Deployment Checks', () => {
  it('should be accessible', () => {
    cy.visit('https://app.qotoof.com', { failOnStatusCode: false });
    cy.request('https://app.qotoof.com').its('status').should('eq', 200);
  });

  it('should have correct environment', () => {
    cy.visit('https://app.qotoof.com');
    cy.window().then((win) => {
      expect(win.__ENVIRONMENT__).to.equal('production');
    });
  });

  it('should connect to API', () => {
    cy.request('https://app.qotoof.com/api/health').its('status').should('eq', 200);
  });

  it('should load main page', () => {
    cy.visit('https://app.qotoof.com');
    cy.contains('Qotoof').should('be.visible');
  });
});
```

---

## 🔟 Announcement & Communication

بعد النشر الناجح:

```
□ أرسل بريد إلى الفريق
□ حدّث الصفحة الرئيسية
□ اعلن على وسائل التواصل
□ أخطر Customer Support
□ اطلب تقييمات من المستخدمين
□ راقب المقاييس لمدة 24 ساعة
```

---

## ✅ Production Readiness Checklist

- [ ] جميع المراحل 1-4 اكتملت
- [ ] Staging deployment ناجح
- [ ] جميع E2E tests تمرت
- [ ] Performance benchmarks تمت
- [ ] Security audit اكتمل
- [ ] Monitoring مفعّل
- [ ] Backup strategy موجودة
- [ ] Rollback plan جاهزة
- [ ] فريق الدعم مستعد
- [ ] تواصل الفريق أُنجز
- [ ] Domain / DNS معين
- [ ] SSL certificate سارية
- [ ] CDN مُعدّ
- [ ] Analytics مُهيأ
- [ ] Sentry configured

---

## 📊 Success Metrics (30 days post-launch)

```
├─ Uptime: 99.9%+
├─ Average Response Time: < 500ms
├─ Error Rate: < 0.1%
├─ User Satisfaction: > 4/5
├─ Checkout Success Rate: > 70%
├─ Payment Success Rate: > 98%
├─ Daily Active Users: (target)
└─ Revenue per Transaction: (target)
```

---

## 🎯 نجاح التطبيق يأتي من:

✅ تخطيط دقيق  
✅ اختبارات شاملة  
✅ توثيق جيد  
✅ مراقبة منتظمة  
✅ دعم سريع  
✅ تحسين مستمر  

---

**🚀 مبروك! تطبيقك الآن جاهز للإنتاج!**

