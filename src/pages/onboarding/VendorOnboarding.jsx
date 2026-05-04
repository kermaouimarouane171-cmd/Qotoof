import OnboardingFlow from '@/components/onboarding/OnboardingFlow'

const VENDOR_SLIDES = [
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
  return (
    <OnboardingFlow
      role="vendor"
      roleLabel="تهيئة البائع"
      slides={VENDOR_SLIDES}
      completeLabel="وقّع العقد وابدأ →"
      completePath="/vendor/digital-contract"
    />
  )
}

export default VendorOnboarding