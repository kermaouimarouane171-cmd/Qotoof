import { useTranslation } from 'react-i18next'
import OnboardingFlow from '@/components/onboarding/OnboardingFlow'

const FALLBACK_SLIDES = [
  {
    icon: '🛒',
    title: 'مرحباً في Qotoof',
    variant: 'center',
    lines: [
      'سوق الجملة المغربي الأول',
      'للخضار والفواكه والنباتات',
      'اشترِ مباشرة من المزارعين',
      'والبائعين بأسعار الجملة',
    ],
  },
  {
    icon: '🔍',
    title: 'ابحث واختر وادفع',
    variant: 'list',
    lines: [
      '1️⃣ ابحث عن منتجك',
      '2️⃣ اختر البائع المناسب',
      '3️⃣ ادفع بالطريقة التي تريد',
      '4️⃣ استلم طلبك وقيّم التجربة',
    ],
  },
  {
    icon: '🛡️',
    title: 'حماية كاملة لك',
    variant: 'list',
    lines: [
      '✅ كل معاملة موثّقة رقمياً',
      '✅ صور حالة المنتج قبل وبعد',
      '✅ إبلاغ فوري عن أي مشكلة',
      '✅ دعم قانوني كامل عند الحاجة',
    ],
  },
]

const BuyerOnboarding = () => {
  const { t } = useTranslation()

  const slides = FALLBACK_SLIDES.map((slide, idx) => {
    const n = idx + 1
    const titleKey = `onboarding.buyer.slides.s${n}.title`
    const linesKey = `onboarding.buyer.slides.s${n}.lines`
    const translatedTitle = t(titleKey, slide.title)
    const translatedLines = t(linesKey, { returnObjects: true })
    return {
      ...slide,
      title: translatedTitle,
      lines: Array.isArray(translatedLines) ? translatedLines : slide.lines,
    }
  })

  return (
    <OnboardingFlow
      // eslint-disable-next-line jsx-a11y/aria-role
      role="buyer"
      roleLabel={t('onboarding.buyer.roleLabel', 'تهيئة المشتري')}
      slides={slides}
      completeLabel={t('onboarding.buyer.completeLabel', 'ابدأ التسوق الآن 🚀')}
      completePath="/marketplace"
    />
  )
}

export default BuyerOnboarding
