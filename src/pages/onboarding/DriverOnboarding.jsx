import OnboardingFlow from '@/components/onboarding/OnboardingFlow'

const DRIVER_SLIDES = [
  {
    icon: '🚗',
    title: 'انضم كسائق في Qotoof',
    variant: 'center',
    lines: [
      'وصّل البضائع في منطقتك',
      'واكسب 10 دراهم ثابتة',
      '+ 5 دراهم لكل كيلومتر',
    ],
  },
  {
    icon: '📋',
    title: 'كيف يعمل النظام؟',
    variant: 'list',
    lines: [
      '1️⃣ حدد منطقتك ونوع بضائعك',
      '2️⃣ تصلك طلبات قريبة منك',
      '3️⃣ اقبل الطلب وانطلق',
      '4️⃣ صوّر المنتج عند الاستلام والتسليم',
      '5️⃣ اقبض أجرتك فور التسليم',
    ],
  },
  {
    icon: '🛡️',
    title: 'حقوقك مضمونة',
    variant: 'list',
    lines: [
      '✅ أجرتك محمية قانونياً',
      '✅ صور التوثيق تحميك من النزاعات',
      '✅ التطبيق يدعمك عند أي خلاف',
    ],
    callout: [
      'ابدأ بإعداد نطاق عملك الآن',
    ],
  },
]

const DriverOnboarding = () => {
  return (
    <OnboardingFlow
      role="driver"
      roleLabel="تهيئة السائق"
      slides={DRIVER_SLIDES}
      completeLabel="إعداد نطاق عملي →"
      completePath="/driver/settings"
    />
  )
}

export default DriverOnboarding