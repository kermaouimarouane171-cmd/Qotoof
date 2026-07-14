import { useTranslation } from 'react-i18next'
import OnboardingFlow from '@/components/onboarding/OnboardingFlow'

const FALLBACK_SLIDES = [
  {
    icon: '🏪',
    title: 'ابدأ البيع في 4 خطوات',
    variant: 'center',
    lines: [
      'وصل لآلاف المشترين في المغرب',
      'بدون رسوم مسبقة',
      'عمولة مرنة على ما تبيعه فقط',
    ],
  },
  {
    icon: '📝',
    title: 'أكمل ملفك التجاري',
    variant: 'list',
    lines: [
      '1️⃣ وقّع العقد الرقمي',
      '2️⃣ أضف بيانات متجرك',
      '3️⃣ حدد طريقة التوصيل',
      '4️⃣ أضف منتجاتك',
    ],
  },
  {
    icon: '💰',
    title: 'كيف تعمل العمولة؟',
    variant: 'list',
    lines: [
      '• تبيع منتجاتك وتستلم المال مباشرة',
      '• نهاية كل شهر نرسل لك فاتورة بعمولة المنصة من إجمالي مبيعاتك',
      '• تدفع خلال 7 أيام',
      '• عدم الدفع = تجميد مؤقت للحساب',
    ],
  },
  {
    icon: '🚀',
    title: 'أنت جاهز للبدء!',
    variant: 'list',
    lines: [
      '✅ متجرك محمي قانونياً',
      '✅ مدفوعاتك مضمونة',
      '✅ دعم كامل عند أي مشكلة',
    ],
    callout: [
      'الخطوة الأولى:',
      'وقّع العقد الرقمي لتبدأ البيع',
    ],
  },
]

const VendorOnboarding = () => {
  const { t } = useTranslation()

  const slides = FALLBACK_SLIDES.map((slide, idx) => {
    const n = idx + 1
    const titleKey = `onboarding.vendor.slides.s${n}.title`
    const linesKey = `onboarding.vendor.slides.s${n}.lines`
    const calloutKey = `onboarding.vendor.slides.s${n}.callout`
    const translatedTitle = t(titleKey, slide.title)
    const translatedLines = t(linesKey, { returnObjects: true })
    const translatedCallout = slide.callout ? t(calloutKey, { returnObjects: true }) : undefined
    return {
      ...slide,
      title: translatedTitle,
      lines: Array.isArray(translatedLines) ? translatedLines : slide.lines,
      callout: Array.isArray(translatedCallout) ? translatedCallout : slide.callout,
    }
  })

  return (
    <OnboardingFlow
      // eslint-disable-next-line jsx-a11y/aria-role
      role="vendor"
      roleLabel={t('onboarding.vendor.roleLabel', 'تهيئة البائع')}
      slides={slides}
      completeLabel={t('onboarding.vendor.completeLabel', 'وقّع العقد وابدأ →')}
      completePath="/vendor/digital-contract"
    />
  )
}

export default VendorOnboarding
