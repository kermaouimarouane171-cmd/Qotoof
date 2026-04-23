import OnboardingFlow from '@/components/onboarding/OnboardingFlow'

const BUYER_SLIDES = [
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
  return (
    <OnboardingFlow
      role="buyer"
      roleLabel="تهيئة المشتري"
      slides={BUYER_SLIDES}
      completeLabel="ابدأ التسوق الآن 🚀"
      completePath="/buyer/dashboard"
    />
  )
}

export default BuyerOnboarding