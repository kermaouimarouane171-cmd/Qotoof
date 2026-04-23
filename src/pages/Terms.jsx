import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { APP_CONFIG } from '@/config/appConfig'

const TermsPage = () => {
  const { t, i18n } = useTranslation()
  const language = i18n.resolvedLanguage?.startsWith('fr')
    ? 'fr'
    : i18n.resolvedLanguage?.startsWith('ar')
      ? 'ar'
      : 'en'
  const locale = language === 'fr' ? 'fr-MA' : language === 'ar' ? 'ar-MA' : 'en-MA'
  const pick = (values) => values[language] || values.en
  const lastUpdated = new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(new Date())

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">{t('terms.title', 'Terms of Service')}</h1>

      <div className="prose prose-lg max-w-none">
        <p className="text-gray-600 mb-6">
          {pick({
            ar: `آخر تحديث: ${lastUpdated}`,
            fr: `Derniere mise a jour : ${lastUpdated}`,
            en: `Last updated: ${lastUpdated}`,
          })}
        </p>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('terms.section1.title', '1. Acceptance of Terms')}</h2>
          <p className="text-gray-600 leading-relaxed">
            {t('terms.section1.content', 'By accessing and using Qotoof ("the Platform"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Platform.')}
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('terms.section2.title', '2. Description of Service')}</h2>
          <p className="text-gray-600 leading-relaxed">
            {t('terms.section2.content', 'Qotoof is a B2B wholesale marketplace connecting buyers, vendors, and drivers for the trade of plants, vegetables, and fruits in Morocco. The Platform facilitates transactions between independent parties.')}
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('terms.section3.title', '3. User Accounts')}</h2>
          <p className="text-gray-600 leading-relaxed mb-4">{t('terms.section3.intro', 'You must:')}</p>
          <ul className="list-disc pl-6 text-gray-600 space-y-2">
            <li>{t('terms.section3.item1', 'Be at least 18 years old')}</li>
            <li>{t('terms.section3.item2', 'Provide accurate and complete registration information')}</li>
            <li>{t('terms.section3.item3', 'Maintain the security of your account credentials')}</li>
            <li>{t('terms.section3.item4', 'Notify us immediately of any unauthorized access')}</li>
            <li>{t('terms.section3.item5', 'Accept responsibility for all activities under your account')}</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('terms.section4.title', '4. Platform Fees and Commissions')}</h2>
          <p className="text-gray-600 leading-relaxed mb-4">{t('terms.section4.intro', 'Qotoof charges:')}</p>
          <ul className="list-disc pl-6 text-gray-600 space-y-2">
            <li>{t('terms.section4.item1', 'A commission of 3% on each transaction processed through the Platform')}</li>
            <li>{t('terms.section4.item2', 'Payment processing fees as applicable')}</li>
            <li>{t('terms.section4.item3', 'Delivery fees set by drivers based on distance and time')}</li>
          </ul>
          <p className="text-gray-600 leading-relaxed mt-4">
            {t('terms.section4.outro', 'All fees are displayed transparently before order confirmation.')}
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('terms.section5.title', '5. Orders and Payments')}</h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            {t('terms.section5.intro', 'Orders placed through the Platform are binding contracts between buyers and vendors. Payment methods include:')}
          </p>
          <ul className="list-disc pl-6 text-gray-600 space-y-2">
            <li>{pick({ ar: 'الدفع الكامل مقدماً للبائع', fr: 'Paiement integral anticipe au vendeur', en: 'Full upfront payment to the vendor' })}</li>
            <li>{pick({ ar: 'الدفع المرحلي: دفعة اولى ثم دفعة نهائية', fr: 'Paiement fractionne : acompte puis solde final', en: 'Split payment: initial installment then final balance' })}</li>
            <li>{pick({ ar: 'الدفع الكامل عند الاستلام للسائق عندما يكون متاحاً', fr: 'Paiement integral a la livraison lorsque disponible', en: 'Full payment on delivery when eligible' })}</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            {pick({
              ar: '6. التزامات المشتري والدفع والالغاء والنزاعات',
              fr: '6. Obligations de l acheteur, paiement, annulation et litiges',
              en: '6. Buyer Obligations, Payment, Cancellation, and Disputes',
            })}
          </h2>
          <ul className="list-disc pl-6 text-gray-600 space-y-2">
            <li>{pick({ ar: 'يلتزم المشتري بتقديم بيانات صحيحة، واحترام الحد الادنى للطلب، وعدم استخدام الدفع عند الاستلام او الدفع المرحلي بشكل تحايلي.', fr: 'L acheteur doit fournir des informations exactes, respecter les minimums de commande et ne pas abuser du paiement a la livraison ou fractionne.', en: 'Buyers must provide accurate information, respect minimum order requirements, and not abuse COD or split-payment options.' })}</li>
            <li>{pick({ ar: 'خيارات الدفع المعروضة داخل الطلب فقط هي المعتمدة تعاقدياً، ويشترط قبول التحذيرات القانونية قبل تاكيد الطلب.', fr: 'Seules les options de paiement affichees dans la commande sont contractuellement valables, avec acceptation obligatoire des avertissements juridiques.', en: 'Only the payment options displayed within the order are contractually valid, and legal warnings must be accepted before confirmation.' })}</li>
            <li>{pick({ ar: 'في حال عدم السداد دون مبرر مشروع، يجوز خفض درجة الثقة، تقييد وسيلة الدفع عند الاستلام، فتح نزاع تحصيل، واتخاذ اجراءات قانونية داخل المملكة المغربية.', fr: 'En cas de non-paiement sans motif legitime, la plateforme peut reduire le score de confiance, restreindre le paiement a la livraison, ouvrir un litige de recouvrement et engager des procedures legales au Maroc.', en: 'If payment is withheld without legitimate cause, the platform may reduce trust score, restrict COD, open a collection dispute, and pursue legal remedies in Morocco.' })}</li>
            <li>{pick({ ar: 'يجوز الغاء الطلب وفق سياسة البائع قبل بدء التنفيذ اللوجستي او ضمن الحالات المحددة في المنصة، وقد تطبق رسوم او قيود عند الالغاء المتكرر او المتاخر.', fr: 'Order cancellation follows the vendor policy before logistics execution starts or in platform-defined cases, and repeated or late cancellations may trigger fees or restrictions.', en: 'Order cancellation follows the vendor policy before logistics execution starts or in platform-defined cases, and repeated or late cancellations may trigger fees or restrictions.' })}</li>
            <li>{pick({ ar: 'تدار النزاعات عبر المنصة، ويجوز للمتضرر طلب الدعم القانوني، كما يمكن الافصاح عن الحد الادنى الضروري من البيانات بعد حسم النزاع لصالحه ولاغراض الاثبات والتحصيل.', fr: 'Disputes are managed through the platform. The harmed party may request legal support, and the minimum necessary data may be disclosed after resolution in its favor for proof or collection purposes.', en: 'Disputes are managed through the platform. The harmed party may request legal support, and the minimum necessary data may be disclosed after resolution in its favor for proof or collection purposes.' })}</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('terms.section6.title', '6. Vendor Obligations')}</h2>
          <p className="text-gray-600 leading-relaxed mb-4">{t('terms.section6.intro', 'Vendors must:')}</p>
          <ul className="list-disc pl-6 text-gray-600 space-y-2">
            <li>{t('terms.section6.item1', 'Provide accurate product descriptions and pricing')}</li>
            <li>{t('terms.section6.item2', 'Maintain adequate inventory for listed products')}</li>
            <li>{t('terms.section6.item3', 'Fulfill orders within the agreed timeframe')}</li>
            <li>{t('terms.section6.item4', 'Comply with all applicable Moroccan laws and regulations')}</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('terms.section7.title', '7. Driver Obligations')}</h2>
          <p className="text-gray-600 leading-relaxed mb-4">{t('terms.section7.intro', 'Drivers must:')}</p>
          <ul className="list-disc pl-6 text-gray-600 space-y-2">
            <li>{t('terms.section7.item1', 'Deliver orders within the estimated delivery time')}</li>
            <li>{t('terms.section7.item2', 'Maintain accurate location tracking during deliveries')}</li>
            <li>{t('terms.section7.item3', 'Handle products with care')}</li>
            <li>{t('terms.section7.item4', 'Hold valid driving licenses and vehicle insurance')}</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('terms.section8.title', '8. Prohibited Conduct')}</h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            {t('terms.section8.intro', 'The following actions are strictly prohibited and may result in immediate account suspension or termination:')}
          </p>

          <div className="space-y-6">
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
              <h3 className="font-semibold text-red-900 mb-2 flex items-center gap-2">
                <span className="text-red-600">🚫</span>
                {t('terms.section8.illegal.title', '8.1 Illegal Activities')}
              </h3>
              <ul className="list-disc pl-6 text-red-800 space-y-1 text-sm">
                <li>{t('terms.section8.illegal.item1', 'Using the Platform for any unlawful purpose under Moroccan law')}</li>
                <li>{t('terms.section8.illegal.item2', 'Selling prohibited, counterfeit, or stolen goods')}</li>
                <li>{t('terms.section8.illegal.item3', 'Money laundering, fraud, or financial crimes')}</li>
                <li>{t('terms.section8.illegal.item4', 'Violating intellectual property rights')}</li>
                <li>{t('terms.section8.illegal.item5', 'Engaging in activities that violate international trade sanctions')}</li>
              </ul>
            </div>

            <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl">
              <h3 className="font-semibold text-orange-900 mb-2 flex items-center gap-2">
                <span className="text-orange-600">⚠️</span>
                {t('terms.section8.falseInfo.title', '8.2 False or Misleading Information')}
              </h3>
              <ul className="list-disc pl-6 text-orange-800 space-y-1 text-sm">
                <li>{t('terms.section8.falseInfo.item1', 'Posting false product descriptions, prices, or availability')}</li>
                <li>{t('terms.section8.falseInfo.item2', 'Using manipulated or misleading product images')}</li>
                <li>{t('terms.section8.falseInfo.item3', 'Misrepresenting product origin, quality, or certifications')}</li>
                <li>{t('terms.section8.falseInfo.item4', 'Creating fake reviews or ratings')}</li>
                <li>{t('terms.section8.falseInfo.item5', 'Providing false identity or business information during registration')}</li>
              </ul>
            </div>

            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
              <h3 className="font-semibold text-yellow-900 mb-2 flex items-center gap-2">
                <span className="text-yellow-600">💰</span>
                {t('terms.section8.circumvent.title', '8.3 Circumventing Platform Fees')}
              </h3>
              <ul className="list-disc pl-6 text-yellow-800 space-y-1 text-sm">
                <li>{t('terms.section8.circumvent.item1', 'Attempting to conduct transactions outside the Platform to avoid the 3% commission')}</li>
                <li>{t('terms.section8.circumvent.item2', 'Using fake accounts or multiple accounts to evade fees')}</li>
                <li>{t('terms.section8.circumvent.item3', 'Manipulating order amounts or splitting orders to reduce commission')}</li>
                <li>{t('terms.section8.circumvent.item4', 'Encouraging buyers or vendors to deal directly outside the Platform')}</li>
                <li>{t('terms.section8.circumvent.item5', 'Using technical exploits to bypass payment systems')}</li>
              </ul>
            </div>

            <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl">
              <h3 className="font-semibold text-purple-900 mb-2 flex items-center gap-2">
                <span className="text-purple-600">👥</span>
                {t('terms.section8.harassment.title', '8.4 Harassment and Abuse')}
              </h3>
              <ul className="list-disc pl-6 text-purple-800 space-y-1 text-sm">
                <li>{t('terms.section8.harassment.item1', 'Harassing, threatening, or intimidating other users')}</li>
                <li>{t('terms.section8.harassment.item2', 'Using discriminatory, racist, or hate speech')}</li>
                <li>{t('terms.section8.harassment.item3', 'Sending unsolicited spam messages or advertisements')}</li>
                <li>{t('terms.section8.harassment.item4', 'Impersonating other users, staff, or authorities')}</li>
                <li>{t('terms.section8.harassment.item5', 'Sharing personal information of other users without consent')}</li>
              </ul>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
              <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                <span className="text-blue-600">🔒</span>
                {t('terms.section8.security.title', '8.5 Interfering with Security')}
              </h3>
              <ul className="list-disc pl-6 text-blue-800 space-y-1 text-sm">
                <li>{t('terms.section8.security.item1', 'Attempting to hack, exploit, or bypass Platform security measures')}</li>
                <li>{t('terms.section8.security.item2', 'Using automated bots or scripts to scrape data or manipulate the Platform')}</li>
                <li>{t('terms.section8.security.item3', 'Attempting to access other users\' accounts or data')}</li>
                <li>{t('terms.section8.security.item4', 'Interfering with MFA, session management, or audit logging')}</li>
                <li>{t('terms.section8.security.item5', 'Reverse engineering, decompiling, or modifying Platform software')}</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('terms.section9.title', '9. Intellectual Property')}</h2>
          <p className="text-gray-600 leading-relaxed">
            {t('terms.section9.content', 'All content on the Platform, including text, graphics, logos, and software, is the property of Qotoof and protected by Moroccan and international intellectual property laws.')}
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('terms.section10.title', '10. Limitation of Liability')}</h2>
          <p className="text-gray-600 leading-relaxed">
            {t('terms.section10.content', 'Qotoof acts as an intermediary and is not liable for the quality, safety, or legality of products listed or sold. We do not guarantee uninterrupted or error-free service.')}
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('terms.section11.title', '11. Termination')}</h2>
          <p className="text-gray-600 leading-relaxed">
            {t('terms.section11.content', 'We reserve the right to suspend or terminate accounts that violate these Terms without prior notice. Users may terminate their accounts at any time through the settings page.')}
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('terms.section12.title', '12. Governing Law')}</h2>
          <p className="text-gray-600 leading-relaxed">
            {t('terms.section12.content', 'These Terms are governed by the laws of the Kingdom of Morocco. Any disputes shall be resolved in the competent courts of Casablanca.')}
          </p>
        </section>

        <section className="mb-8 rounded-2xl border border-orange-200 bg-orange-50 p-6" dir="rtl">
          <h2 className="text-xl font-semibold text-orange-900 mb-4">سياسة الدفع والتحصيل</h2>
          <div className="space-y-4 text-sm leading-7 text-orange-900">
            <p>
              يلتزم كل مستخدم باستخدام وسيلة الدفع التي تظهر له داخل الطلب وفق سياسات البائع، ويقر بأن توفر الدفع عند الاستلام أو الدفع المرحلي يخضع لتقييم أهلية المنصة ودرجة الثقة والسجل السابق للالتزام بالسداد.
            </p>
            <p>
              في حالات الدفع الكامل أو المرحلي، لا يعد رفع إيصال التحويل مجرد إجراء شكلي، بل يمثل مستند إثبات تعاقدي يمكن الرجوع إليه عند اعتماد الطلب أو مراجعته أو الفصل في أي نزاع لاحق. يحق للبائع رفض بدء التنفيذ حتى يتم رفع الإيصال والتحقق منه على المنصة.
            </p>
            <p>
              في حالات الدفع المرحلي، تبقى الدفعة الثانية التزاماً مالياً قائماً على المشتري، ويجوز للمنصة أو البائع تعليق الإقفال النهائي للطلب أو فتح نزاع إذا لم يتم سدادها ضمن الإطار المتفق عليه أو بعد ثبوت التسليم أو التنفيذ الجزئي أو الكلي بحسب حالة الطلب.
            </p>
            <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-4 text-red-900">
              <p className="font-semibold mb-2">تحذير مهم بخصوص الدفع عند الاستلام</p>
              <p>
                إذا تم تفعيل الدفع عند الاستلام للمشتري ثم ثبت أن الطلب نُفذ أو سُلِّم أو خُصص له مورد لوجستي بشكل صحيح، فإن رفض السداد دون مبرر مشروع قد يؤدي إلى خفض درجة الثقة، وتقييد وسيلة الدفع عند الاستلام مستقبلاً، وفتح نزاع تحصيل، واتخاذ إجراءات قانونية أو تعاقدية عند الاقتضاء.
              </p>
            </div>
            <p>
              يوافق المستخدم كذلك على أن المنصة قد تفصح عن الحد الأدنى الضروري من البيانات المرتبطة بالطلب عند حسم النزاع لصالح الطرف المتضرر، وذلك حصراً لأغراض الإثبات أو التحصيل أو الامتثال للمتطلبات القانونية والتنظيمية السارية.
            </p>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('terms.section13.title', '13. Contact')}</h2>
          <p className="text-gray-600 leading-relaxed">
            {t('terms.section13.intro', 'For questions about these Terms, contact us at:')}
          </p>
          <ul className="list-none pl-6 text-gray-600 space-y-1 mt-2">
            <li>{t('terms.section13.email', `Email: ${APP_CONFIG.supportEmail}`)}</li>
            <li>{t('terms.section13.phone', `Phone: ${APP_CONFIG.supportPhoneDisplay}`)}</li>
            <li>{t('terms.section13.address', 'Address: Casablanca, Morocco')}</li>
          </ul>
        </section>

        <div className="mt-12 pt-8 border-t border-gray-200">
          <Link to="/privacy" className="text-green-600 hover:text-green-700 font-medium">
            {t('terms.backToPrivacy', 'Back to Privacy Policy')}
          </Link>
        </div>
      </div>
    </div>
  )
}

export default TermsPage
