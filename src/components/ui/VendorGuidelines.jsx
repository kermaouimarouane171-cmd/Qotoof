import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ScaleIcon,
  ClockIcon,
  CubeIcon,
  DocumentCheckIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline'

const VendorGuidelines = ({ onAccept, alreadyAccepted = false }) => {
  const { t } = useTranslation()
  const [agreed, setAgreed] = useState(false)
  const [showFull, setShowFull] = useState(false)

  const guidelines = [
    {
      icon: ScaleIcon,
      title: t('vendor.guidelines.section1.title', '1. أوصاف وأسعار المنتجات الدقيقة'),
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      items: [
        t('vendor.guidelines.section1.item1', 'تقديم أوصاف صادقة ودقيقة لجميع المنتجات المدرجة'),
        t('vendor.guidelines.section1.item2', 'عرض الأسعار بالدرهم المغربي (د.م) شاملة جميع الضرائب المطبقة'),
        t('vendor.guidelines.section1.item3', 'تحديث الأسعار فور تغير التكاليف'),
        t('vendor.guidelines.section1.item4', 'عدم الانخراط في ممارسات تسعير مضللة (القانون 31-08 لحماية المستهلك)'),
        t('vendor.guidelines.section1.item5', 'بيان نوع الوحدة والحد الأدنى لكمية الطلب ومنشأ المنتج بوضوح'),
        t('vendor.guidelines.section1.item6', 'تضمين صور حقيقية وواضحة للمنتجات (وليست صوراً جاهزة)'),
      ],
    },
    {
      icon: CubeIcon,
      title: t('vendor.guidelines.section2.title', '2. إدارة المخزون'),
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      items: [
        t('vendor.guidelines.section2.item1', 'الحفاظ على مستويات مخزون كافية لجميع المنتجات المدرجة'),
        t('vendor.guidelines.section2.item2', 'تحديث كميات المخزون في الوقت الفعلي'),
        t('vendor.guidelines.section2.item3', 'وضع علامة "نفد المخزون" فور عدم توفر المنتج'),
        t('vendor.guidelines.section2.item4', 'عدم إدراج منتجات لا يمكن توفيرها'),
        t('vendor.guidelines.section2.item5', 'إخطار المشترين فوراً إذا نفد المخزون بعد تقديم الطلب'),
        t('vendor.guidelines.section2.item6', 'يُوصى بإجراء جرد دوري للمخزون (أسبوعياً على الأقل)'),
      ],
    },
    {
      icon: ClockIcon,
      title: t('vendor.guidelines.section3.title', '3. المواعيد الزمنية لتنفيذ الطلبات'),
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      items: [
        t('vendor.guidelines.section3.item1', 'تأكيد أو رفض الطلبات خلال 24 ساعة من الاستلام'),
        t('vendor.guidelines.section3.item2', 'تجهيز الطلبات خلال الإطار الزمني المتفق عليه (افتراضياً: 48 ساعة)'),
        t('vendor.guidelines.section3.item3', 'التواصل الاستباقي مع المشترين بشأن التأخيرات'),
        t('vendor.guidelines.section3.item4', 'قبول تعيين سائق التوصيل أو توفير ترتيبات بديلة'),
        t('vendor.guidelines.section3.item5', 'قد يؤدي تكرار إلغاء الطلبات إلى إيقاف الحساب'),
        t('vendor.guidelines.section3.item6', 'الحفاظ على معدل تنفيذ لا يقل عن 95%'),
      ],
    },
    {
      icon: DocumentCheckIcon,
      title: t('vendor.guidelines.section4.title', '4. الامتثال القانوني المغربي'),
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      items: [
        t('vendor.guidelines.section4.item1', 'الامتثال للقانون 31-08 لحماية المستهلك'),
        t('vendor.guidelines.section4.item2', 'اتباع القانون 13-03 لمكافحة الغش والتدليس التجاري'),
        t('vendor.guidelines.section4.item3', 'الالتزام بمعايير سلامة الأغذية (معايير المكتب الوطني للسلامة الصحية للمنتجات الغذائية)'),
        t('vendor.guidelines.section4.item4', 'الحفاظ على تسجيل تجاري ساري المفعول وبطاقة ضريبية'),
        t('vendor.guidelines.section4.item5', 'إصدار فواتير/إيصالات صحيحة لجميع المعاملات'),
        t('vendor.guidelines.section4.item6', 'الامتثال لقانون حماية البيانات 09-08 المتعلق بالبيانات الشخصية'),
        t('vendor.guidelines.section4.item7', 'احترام حقوق الملكية الفكرية وقوانين العلامات التجارية'),
        t('vendor.guidelines.section4.item8', 'اتباع اللوائح البيئية المتعلقة بالتغليف والنفايات'),
      ],
    },
  ]

  const penalties = [
    t('vendor.guidelines.penalties.item1', 'إنذار كتابي للمخالفة الأولى'),
    t('vendor.guidelines.penalties.item2', 'إيقاف مؤقت (7 أيام) للمخالفات المتكررة'),
    t('vendor.guidelines.penalties.item3', 'إنهاء دائم للحساب في حالة المخالفات الخطيرة أو المستمرة'),
    t('vendor.guidelines.penalties.item4', 'قد يتم اتخاذ إجراء قانوني لانتهاكات القانون المغربي'),
    t('vendor.guidelines.penalties.item5', 'قد تُطبق عقوبات مالية في حالة الأنشطة الاحتيالية'),
  ]

  if (alreadyAccepted) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-6 text-white">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircleIcon className="w-8 h-8" />
            <h2 className="text-xl font-bold">{t('vendor.guidelines.accepted', 'تم قبول اتفاقية البائع ✓')}</h2>
          </div>
          <p className="text-green-100 text-sm">
            {t('vendor.guidelines.acceptedDesc', 'لقد وافقت على إرشادات البائع ومتطلبات الامتثال القانوني المغربي.')}
          </p>
        </div>

        <div className="p-6">
          <button
            onClick={() => setShowFull(!showFull)}
            className="text-green-600 font-medium hover:underline text-sm"
          >
            {showFull
              ? t('vendor.guidelines.hide', 'إخفاء')
              : t('vendor.guidelines.view', 'عرض')} {t('vendor.guidelines.fullGuidelines', 'الإرشادات الكاملة')}
          </button>

          {showFull && (
            <div className="mt-4 space-y-6">
              {guidelines.map((section, i) => (
                <div key={i}>
                  <h3 className={`font-semibold ${section.color} mb-2 flex items-center gap-2`}>
                    <section.icon className="w-5 h-5" />
                    {section.title}
                  </h3>
                  <ul className="space-y-1.5">
                    {section.items.map((item, j) => (
                      <li key={j} className="text-sm text-gray-600 flex items-start gap-2">
                        <span className="text-green-500 mt-1">•</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border-2 border-amber-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-6 text-white">
        <div className="flex items-center gap-3 mb-2">
          <ExclamationTriangleIcon className="w-8 h-8" />
          <h2 className="text-xl font-bold">{t('vendor.guidelines.title', 'إرشادات البائع والاتفاقية القانونية')}</h2>
        </div>
        <p className="text-amber-100 text-sm">
          {t('vendor.guidelines.subtitle', 'يرجى قراءة وقبول هذه الإرشادات لمتابعة البيع على قطوف. هذه الإرشادات مبنية على القانون التجاري المغربي وسياسات المنصة.')}
        </p>
      </div>

      {/* Guidelines */}
      <div className="p-6 space-y-6 max-h-96 overflow-y-auto">
        {guidelines.map((section, i) => (
          <div key={i}>
            <h3 className={`font-semibold ${section.color} mb-3 flex items-center gap-2`}>
              <div className={`w-8 h-8 ${section.bgColor} rounded-lg flex items-center justify-center`}>
                <section.icon className={`w-5 h-5 ${section.color}`} />
              </div>
              {section.title}
            </h3>
            <ul className="space-y-2">
              {section.items.map((item, j) => (
                <li key={j} className="text-sm text-gray-700 flex items-start gap-2">
                  <CheckCircleIcon className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}

        {/* Penalties */}
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
          <h3 className="font-semibold text-red-800 mb-2 flex items-center gap-2">
            <ExclamationTriangleIcon className="w-5 h-5" />
            {t('vendor.guidelines.penaltiesTitle', 'عقوبات عدم الامتثال')}
          </h3>
          <ul className="space-y-1.5">
            {penalties.map((penalty, i) => (
              <li key={i} className="text-sm text-red-700 flex items-start gap-2">
                <span className="text-red-500 mt-1">•</span>
                {penalty}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Acceptance */}
      <div className="p-6 border-t border-gray-200 bg-gray-50">
        {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
        <label htmlFor="vendor-guidelines-agree" className="flex items-start gap-3 cursor-pointer">
          <input
            id="vendor-guidelines-agree"
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-1 w-5 h-5 text-green-600 rounded border-gray-300 focus:ring-green-500"
          />
          <div className="text-sm text-gray-700">
            <p className="font-medium text-gray-900 mb-1">
              {t('vendor.guidelines.agreeLabel', 'لقد قرأت وأوافق على إرشادات البائع')}
            </p>
            <p className="text-gray-500">
              {t('vendor.guidelines.agreeDesc', 'ألتزم بتقديم معلومات دقيقة عن المنتجات، والحفاظ على مستويات المخزون، وتنفيذ الطلبات في الوقت المحدد، والامتثال لجميع القوانين واللوائح المغربية بما في ذلك القانون 31-08 (حماية المستهلك)، والقانون 13-03 (مكافحة الغش)، ومعايير المكتب الوطني للسلامة الصحية للمنتجات الغذائية.')}
            </p>
          </div>
        </label>

        <button
          onClick={() => agreed && onAccept?.()}
          disabled={!agreed}
          className={`w-full mt-4 py-3 rounded-xl font-semibold transition-all ${
            agreed
              ? 'bg-green-600 text-white hover:bg-green-700'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          {agreed
            ? t('vendor.guidelines.acceptAndContinue', 'قبول ومتابعة')
            : t('vendor.guidelines.mustAccept', 'يرجى قبول الإرشادات للمتابعة')}
        </button>
      </div>
    </div>
  )
}

export default VendorGuidelines
