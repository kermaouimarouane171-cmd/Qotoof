import fs from 'fs'
import path from 'path'

const arabicRegex = /[\u0600-\u06FF]/

const arJsonPath = path.resolve(__dirname, '../../../i18n/locales/ar.json')
const enJsonPath = path.resolve(__dirname, '../../../i18n/locales/en.json')
const arJson = JSON.parse(fs.readFileSync(arJsonPath, 'utf-8'))
const enJson = JSON.parse(fs.readFileSync(enJsonPath, 'utf-8'))

const scanForHardcodedArabic = (filePath) => {
  const source = fs.readFileSync(filePath, 'utf-8')
  const lines = source.split('\n')
  const violations = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue
    if (trimmed.startsWith('import ')) continue
    if (arabicRegex.test(line)) {
      violations.push({ line: i + 1, content: line })
    }
  }
  return violations
}

const checkKeyExists = (obj, keyPath) => {
  const parts = keyPath.split('.')
  let current = obj
  for (const part of parts) {
    if (current[part] === undefined) return false
    current = current[part]
  }
  return true
}

describe('Buyer i18n fixes — hardcoded Arabic removal', () => {
  const buyerPages = [
    { name: 'RFQ', file: 'RFQ.jsx' },
    { name: 'Loyalty', file: 'Loyalty.jsx' },
    { name: 'Security', file: 'Security.jsx' },
    { name: 'Settings', file: 'Settings.jsx' },
    { name: 'Dashboard', file: 'Dashboard.jsx' },
    { name: 'Orders', file: 'Orders.jsx' },
  ]

  buyerPages.forEach(({ name, file }) => {
    const filePath = path.resolve(__dirname, `../../../pages/buyer/${file}`)

    test(`${name} page has no hardcoded Arabic text`, () => {
      // Skip gracefully if a buyer page has been removed
      if (!fs.existsSync(filePath)) {
        console.warn(`[BuyerI18nFixes] Skipping ${file} — file no longer exists`)
        return
      }
      const violations = scanForHardcodedArabic(filePath)
      if (violations.length > 0) {
        throw new Error(
          `Found ${violations.length} hardcoded Arabic text(s) in ${file}:\n` +
          violations.map(v => `  Line ${v.line}: ${v.content.trim()}`).join('\n')
        )
      }
    })
  })
})

describe('Buyer i18n fixes — translation key existence', () => {
  const keysToCheck = [
    // RFQ
    { key: 'buyer.rfq.title', en: 'Request for Quotes', ar: 'طلبات عروض الأسعار' },
    { key: 'buyer.rfq.subtitle', en: null, ar: null },
    { key: 'buyer.rfq.newRequest', en: 'New Request', ar: 'طلب جديد' },
    { key: 'buyer.rfq.status.open', en: 'Open', ar: 'مفتوح' },
    { key: 'buyer.rfq.status.closed', en: 'Closed', ar: 'مغلق' },
    { key: 'buyer.rfq.status.expired', en: 'Expired', ar: 'منتهي' },
    { key: 'buyer.rfq.status.cancelled', en: 'Cancelled', ar: 'ملغى' },
    { key: 'buyer.rfq.offerStatus.pending', en: 'Pending', ar: 'قيد الانتظار' },
    { key: 'buyer.rfq.offerStatus.accepted', en: 'Accepted', ar: 'مقبول' },
    { key: 'buyer.rfq.offerStatus.rejected', en: 'Rejected', ar: 'مرفوض' },
    { key: 'buyer.rfq.offerStatus.withdrawn', en: 'Withdrawn', ar: 'مسحوب' },
    { key: 'buyer.rfq.summary.total', en: 'Total Requests', ar: 'إجمالي الطلبات' },
    { key: 'buyer.rfq.summary.open', en: 'Open', ar: 'مفتوحة' },
    { key: 'buyer.rfq.summary.completed', en: 'Completed', ar: 'مكتملة' },
    { key: 'buyer.rfq.empty.title', en: 'No requests yet', ar: 'لا توجد طلبات بعد' },
    { key: 'buyer.rfq.modal.title', en: 'New Quote Request', ar: 'طلب عرض أسعار جديد' },
    { key: 'buyer.rfq.form.title', en: 'Request Title', ar: 'عنوان الطلب' },
    { key: 'buyer.rfq.form.quantity', en: 'Quantity', ar: 'الكمية' },
    { key: 'buyer.rfq.form.category', en: 'Category', ar: 'الفئة' },
    { key: 'buyer.rfq.form.city', en: 'City', ar: 'المدينة' },
    { key: 'buyer.rfq.form.deadline', en: 'Offer Deadline', ar: 'آخر أجل للعروض' },
    { key: 'buyer.rfq.form.description', en: 'Additional Details', ar: 'تفاصيل إضافية' },
    { key: 'buyer.rfq.form.submit', en: 'Publish Request', ar: 'نشر الطلب' },
    { key: 'buyer.rfq.errors.loadFailed', en: null, ar: null },
    { key: 'buyer.rfq.errors.createFailed', en: null, ar: null },
    { key: 'buyer.rfq.success.offerAccepted', en: null, ar: null },
    { key: 'buyer.rfq.success.created', en: null, ar: null },
    // Loyalty
    { key: 'buyer.loyalty.lifetimePoints', en: 'Lifetime Points', ar: 'إجمالي النقاط المكتسبة' },
    { key: 'buyer.loyalty.referralBonus', en: 'Referral Bonus', ar: 'مكافآت الإحالة' },
    { key: 'buyer.loyalty.registeredReferrals', en: 'Registered Referrals', ar: 'الدعوات المسجلة' },
    { key: 'buyer.loyalty.activeRewards', en: 'Active Rewards', ar: 'المكافآت النشطة' },
    { key: 'buyer.loyalty.referralProgram', en: 'Referral Program', ar: 'برنامج الإحالات' },
    { key: 'buyer.loyalty.rewardsTitle', en: 'Points Rewards', ar: 'مكافآت النقاط' },
    { key: 'buyer.loyalty.reasons.orderCompleted', en: null, ar: 'نقاط مكتسبة من طلب مكتمل' },
    { key: 'buyer.loyalty.reasons.referralBonus', en: null, ar: 'مكافأة إحالة' },
    { key: 'buyer.loyalty.reasons.rewardRedeemed', en: null, ar: 'استبدال نقاط مقابل مكافأة' },
    { key: 'buyer.loyalty.errors.loadFailed', en: null, ar: null },
    { key: 'buyer.loyalty.success.couponCreated', en: null, ar: null },
    // Security
    { key: 'buyerSecurity.title', en: 'Security Settings', ar: 'إعدادات الأمان' },
    { key: 'buyerSecurity.subtitle', en: null, ar: 'إدارة أمان حسابك وخصوصيتك' },
    { key: 'buyerSecurity.personalInfo.title', en: 'Personal Information', ar: 'المعلومات الشخصية' },
    { key: 'buyerSecurity.personalInfo.name', en: 'Name', ar: 'الاسم' },
    { key: 'buyerSecurity.personalInfo.email', en: 'Email', ar: 'البريد الإلكتروني' },
    { key: 'buyerSecurity.personalInfo.phone', en: 'Phone', ar: 'رقم الهاتف' },
    { key: 'buyerSecurity.personalInfo.city', en: 'City', ar: 'المدينة' },
    { key: 'buyerSecurity.mfa.title', en: 'Two-Factor Authentication', ar: 'المصادقة الثنائية' },
    { key: 'buyerSecurity.mfa.enabled', en: 'Enabled', ar: 'مفعّلة' },
    { key: 'buyerSecurity.mfa.disabledBadge', en: 'Disabled', ar: 'معطلة' },
    { key: 'buyerSecurity.mfa.protected', en: null, ar: 'حسابك محمي' },
    { key: 'buyerSecurity.mfa.enable', en: null, ar: 'تفعيل المصادقة الثنائية' },
    { key: 'buyerSecurity.mfa.disable', en: null, ar: 'تعطيل المصادقة الثنائية' },
    { key: 'buyerSecurity.sessions.title', en: 'Active Sessions', ar: 'الجلسات النشطة' },
    { key: 'buyerSecurity.sessions.signOutOthers', en: null, ar: 'تسجيل الخروج من الأجهزة الأخرى' },
    { key: 'buyerSecurity.sessions.confirmRevokeAll', en: null, ar: null },
    { key: 'buyerSecurity.activity.title', en: 'Recent Activity', ar: 'النشاط الأخير' },
    { key: 'buyerSecurity.activity.empty', en: 'No activity', ar: 'لا يوجد نشاط' },
    { key: 'buyerSecurity.phoneVerify.title', en: null, ar: 'تأكيد تغيير كلمة المرور' },
    { key: 'buyerSecurity.errors.phoneRequired', en: null, ar: null },
    // Settings
    { key: 'buyerSettings.deletePhoneVerify.title', en: 'Confirm Account Deletion', ar: 'تأكيد حذف الحساب' },
    { key: 'privacySettings.addPhoneFirst', en: null, ar: 'أضف رقم هاتف إلى الحساب قبل طلب حذفه' },
    // Mobile nav
    { key: 'layout.buyer.mobileTabs.home', en: 'Home', ar: 'الرئيسية' },
    { key: 'layout.buyer.mobileTabs.marketplace', en: 'Market', ar: 'السوق' },
    { key: 'layout.buyer.mobileTabs.orders', en: 'Orders', ar: 'طلباتي' },
    { key: 'layout.buyer.mobileTabs.more', en: 'More', ar: 'المزيد' },
    { key: 'layout.admin.mobileTabs.home', en: 'Home', ar: 'الرئيسية' },
    { key: 'layout.vendor.mobileTabs.home', en: 'Home', ar: 'الرئيسية' },
    { key: 'layout.driver.mobileTabs.home', en: 'Home', ar: 'الرئيسية' },
  ]

  keysToCheck.forEach(({ key, en, ar }) => {
    test(`key "${key}" exists in en.json`, () => {
      expect(checkKeyExists(enJson, key)).toBe(true)
    })

    test(`key "${key}" exists in ar.json`, () => {
      expect(checkKeyExists(arJson, key)).toBe(true)
    })

    if (en) {
      test(`key "${key}" has correct English value`, () => {
        const parts = key.split('.')
        let val = enJson
        for (const p of parts) val = val[p]
        expect(val).toBe(en)
      })
    }

    if (ar) {
      test(`key "${key}" has correct Arabic value`, () => {
        const parts = key.split('.')
        let val = arJson
        for (const p of parts) val = val[p]
        expect(val).toBe(ar)
      })
    }
  })
})

describe('Buyer i18n fixes — t() usage in source', () => {
  const rfqPath = path.resolve(__dirname, '../../../pages/buyer/RFQ.jsx')
  const rfqSource = fs.readFileSync(rfqPath, 'utf-8')

  test('RFQ page uses useTranslation', () => {
    expect(rfqSource).toContain('useTranslation')
  })

  test('RFQ page uses t() for title', () => {
    expect(rfqSource).toContain("t('buyer.rfq.title'")
  })

  test('RFQ page uses t() for status badges', () => {
    expect(rfqSource).toContain('labelKey')
  })

  test('RFQ page uses t() for form labels', () => {
    expect(rfqSource).toContain("t('buyer.rfq.form.title'")
    expect(rfqSource).toContain("t('buyer.rfq.form.quantity'")
  })

  const loyaltyPath = path.resolve(__dirname, '../../../pages/buyer/Loyalty.jsx')
  const loyaltySource = fs.readFileSync(loyaltyPath, 'utf-8')

  test('Loyalty page uses t() for referral program', () => {
    expect(loyaltySource).toContain("t('buyer.loyalty.referralProgram'")
  })

  test('Loyalty page uses t() for rewards title', () => {
    expect(loyaltySource).toContain("t('buyer.loyalty.rewardsTitle'")
  })

  test('Loyalty page uses t() for reason labels', () => {
    expect(loyaltySource).toContain('reasonLabelMap')
  })

  const securityPath = path.resolve(__dirname, '../../../pages/buyer/Security.jsx')
  const securitySource = fs.readFileSync(securityPath, 'utf-8')

  test('Security page uses t() for title', () => {
    expect(securitySource).toContain("t('buyerSecurity.title'")
  })

  test('Security page uses t() for MFA section', () => {
    expect(securitySource).toContain("t('buyerSecurity.mfa.title'")
    expect(securitySource).toContain("t('buyerSecurity.mfa.enable'")
  })

  test('Security page uses t() for sessions section', () => {
    expect(securitySource).toContain("t('buyerSecurity.sessions.title'")
  })

  test('Security page uses t() for phone verify dialog', () => {
    expect(securitySource).toContain("t('buyerSecurity.phoneVerify.title'")
  })

  const protectedRoutePath = path.resolve(__dirname, '../../../components/ProtectedRoute.jsx')
  const protectedRouteSource = fs.readFileSync(protectedRoutePath, 'utf-8')

  test('ProtectedRoute uses t() for buyer mobile tabs', () => {
    expect(protectedRouteSource).toContain("t('layout.buyer.mobileTabs")
  })

  test('ProtectedRoute uses t() for admin mobile tabs', () => {
    expect(protectedRouteSource).toContain("t('layout.admin.mobileTabs")
  })

  test('ProtectedRoute uses t() for vendor mobile tabs', () => {
    expect(protectedRouteSource).toContain("t('layout.vendor.mobileTabs")
  })

  test('ProtectedRoute uses t() for driver mobile tabs', () => {
    expect(protectedRouteSource).toContain("t('layout.driver.mobileTabs")
  })
})
