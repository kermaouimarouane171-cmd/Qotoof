import { useTranslation } from 'react-i18next'
import { APP_CONFIG } from '@/config/appConfig'

const Privacy = () => {
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
      <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('privacy.title', 'Privacy Policy')}</h1>
      <p className="text-sm text-gray-500 mb-8">
        {pick({
          ar: `آخر تحديث: ${lastUpdated}`,
          fr: `Derniere mise a jour : ${lastUpdated}`,
          en: `Last updated: ${lastUpdated}`,
        })}
      </p>

      <div className="space-y-8">
        {/* 1. Information We Collect */}
        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">{t('privacy.section1.title', '1. Information We Collect')}</h2>
          <p className="text-gray-600 mb-3">{t('privacy.section1.intro', 'We collect information you provide directly, including:')}</p>
          <ul className="list-disc list-inside text-gray-600 space-y-1">
            <li><strong>{t('privacy.section1.items.identity.label', 'Personal Identity:')}</strong> {t('privacy.section1.items.identity.desc', 'Name, email address, and phone number')}</li>
            <li><strong>{t('privacy.section1.items.addresses.label', 'Addresses:')}</strong> {t('privacy.section1.items.addresses.desc', 'Shipping and billing addresses')}</li>
            <li><strong>{t('privacy.section1.items.payment.label', 'Payment Information:')}</strong> {t('privacy.section1.items.payment.desc', 'Processed securely by third-party providers (we do not store card details)')}</li>
            <li><strong>{t('privacy.section1.items.profile.label', 'Profile Information:')}</strong> {t('privacy.section1.items.profile.desc', 'Store details, preferences, business information')}</li>
            <li><strong>{t('privacy.section1.items.transaction.label', 'Transaction Data:')}</strong> {t('privacy.section1.items.transaction.desc', 'Order history, purchase records')}</li>
            <li><strong>{t('privacy.section1.items.location.label', 'Location Data:')}</strong> {t('privacy.section1.items.location.desc', 'Delivery locations, GPS coordinates for drivers')}</li>
            <li><strong>{t('privacy.section1.items.device.label', 'Device Information:')}</strong> {t('privacy.section1.items.device.desc', 'IP address, browser type, device identifiers')}</li>
          </ul>
        </section>

        {/* 2. How We Use Your Information */}
        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">{t('privacy.section2.title', '2. How We Use Your Information')}</h2>
          <p className="text-gray-600 mb-3">{t('privacy.section2.intro', 'We use the collected information to:')}</p>
          <ul className="list-disc list-inside text-gray-600 space-y-1">
            <li><strong>{t('privacy.section2.items.orders.label', 'Process Orders:')}</strong> {t('privacy.section2.items.orders.desc', 'Fulfill and deliver your purchases')}</li>
            <li><strong>{t('privacy.section2.items.connect.label', 'Connect Users:')}</strong> {t('privacy.section2.items.connect.desc', 'Link buyers with vendors and drivers for seamless transactions')}</li>
            <li><strong>{t('privacy.section2.items.updates.label', 'Send Updates:')}</strong> {t('privacy.section2.items.updates.desc', 'Order confirmations, shipping notifications, and delivery status')}</li>
            <li><strong>{t('privacy.section2.items.improve.label', 'Improve Services:')}</strong> {t('privacy.section2.items.improve.desc', 'Enhance user experience, analyze usage patterns, develop new features')}</li>
            <li><strong>{t('privacy.section2.items.legal.label', 'Legal Compliance:')}</strong> {t('privacy.section2.items.legal.desc', 'Meet regulatory requirements, resolve disputes, enforce terms')}</li>
            <li><strong>{t('privacy.section2.items.security.label', 'Security:')}</strong> {t('privacy.section2.items.security.desc', 'Prevent fraud, verify identity, protect platform integrity')}</li>
            <li><strong>{t('privacy.section2.items.communication.label', 'Communication:')}</strong> {t('privacy.section2.items.communication.desc', 'Respond to inquiries, send promotional content (with consent)')}</li>
          </ul>
        </section>

        {/* 3. Information Sharing */}
        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">{t('privacy.section3.title', '3. Information Sharing')}</h2>
          <p className="text-gray-600 mb-3">
            {t('privacy.section3.intro', 'We share your information only with other platform users necessary to complete transactions:')}
          </p>
          <ul className="list-disc list-inside text-gray-600 space-y-1">
            <li>{t('privacy.section3.items.vendors', 'Vendors receive buyer shipping addresses for delivery purposes')}</li>
            <li>{t('privacy.section3.items.drivers', 'Drivers receive pickup and delivery locations')}</li>
            <li>{t('privacy.section3.items.payment', 'Payment processors receive transaction details (we do not store card data)')}</li>
          </ul>
          <p className="text-gray-600 mt-3">
            <strong>{t('privacy.section3.noSell', 'We do not sell your personal information to third parties.')}</strong>
          </p>
        </section>

        {/* 4. Data Security */}
        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">{t('privacy.section4.title', '4. Data Security')}</h2>
          <p className="text-gray-600 mb-3">
            {t('privacy.section4.intro', 'We implement industry-standard security measures to protect your personal information:')}
          </p>
          <ul className="list-disc list-inside text-gray-600 space-y-1">
            <li>{t('privacy.section4.items.encryption', 'Encryption of sensitive data in transit and at rest')}</li>
            <li>{t('privacy.section4.items.servers', 'Secure servers with regular security audits')}</li>
            <li>{t('privacy.section4.items.mfa', 'Multi-factor authentication for account access')}</li>
            <li>{t('privacy.section4.items.rls', 'Row-level security policies on all database tables')}</li>
            <li>{t('privacy.section4.items.ratelimit', 'Rate limiting to prevent unauthorized access attempts')}</li>
            <li>{t('privacy.section4.items.testing', 'Regular penetration testing and vulnerability assessments')}</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">
            {pick({
              ar: '5. التخزين والاطراف الثالثة',
              fr: '5. Stockage et tiers',
              en: '5. Storage and Third Parties',
            })}
          </h2>
          <ul className="list-disc list-inside text-gray-600 space-y-1">
            <li>{pick({ ar: 'يتم تخزين بيانات المنصة التشغيلية والملفات ذات الصلة في Supabase والبنية المرتبطة به.', fr: 'Platform operational data and related files are stored in Supabase and its associated infrastructure.', en: 'Platform operational data and related files are stored in Supabase and its associated infrastructure.' })}</li>
            <li>{pick({ ar: 'قد نستخدم PayPal او CMI لمعالجة المدفوعات وResend لارسال الرسائل البريدية، مع مشاركة الحد الادنى الضروري من البيانات فقط.', fr: 'We may use PayPal or CMI for payment processing and Resend for email delivery, sharing only the minimum necessary data.', en: 'We may use PayPal or CMI for payment processing and Resend for email delivery, sharing only the minimum necessary data.' })}</li>
            <li>{pick({ ar: 'لا يتم بيع البيانات الشخصية لاي طرف ثالث، ولا يتم كشفها خارج غرض المعاملة او الامتثال او النزاع المشروع.', fr: 'Personal data is not sold to third parties and is not disclosed beyond the transaction, compliance, or legitimate dispute scope.', en: 'Personal data is not sold to third parties and is not disclosed beyond the transaction, compliance, or legitimate dispute scope.' })}</li>
          </ul>
        </section>

        {/* 5. Your Rights */}
        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">{t('privacy.section5.title', '5. Your Rights')}</h2>
          <p className="text-gray-600 mb-3">{t('privacy.section5.intro', 'You have the right to:')}</p>
          <ul className="list-disc list-inside text-gray-600 space-y-1">
            <li><strong>{t('privacy.section5.items.access.label', 'Access:')}</strong> {t('privacy.section5.items.access.desc', 'Request a copy of your personal data')}</li>
            <li><strong>{t('privacy.section5.items.correction.label', 'Correction:')}</strong> {t('privacy.section5.items.correction.desc', 'Update inaccurate or incomplete information')}</li>
            <li><strong>{t('privacy.section5.items.deletion.label', 'Deletion:')}</strong> {t('privacy.section5.items.deletion.desc', 'Request deletion of your data (subject to legal retention requirements)')}</li>
            <li><strong>{t('privacy.section5.items.export.label', 'Export:')}</strong> {t('privacy.section5.items.export.desc', 'Download your data in a portable format')}</li>
            <li><strong>{t('privacy.section5.items.optout.label', 'Opt-out:')}</strong> {t('privacy.section5.items.optout.desc', 'Unsubscribe from marketing communications at any time')}</li>
            <li><strong>{t('privacy.section5.items.restrict.label', 'Restrict Processing:')}</strong> {t('privacy.section5.items.restrict.desc', 'Limit how we use your data in certain circumstances')}</li>
          </ul>
          <p className="text-gray-600 mt-3">
            {t('privacy.section5.exercise', 'To exercise these rights, visit your')} <a href="/privacy-settings" className="text-green-600 hover:underline">{t('privacy.section5.privacySettings', 'Privacy Settings')}</a> {t('privacy.section5.orContact', 'or contact us below.')}
          </p>
        </section>

        {/* 6. Cookies */}
        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">{t('privacy.section6.title', '6. Cookies')}</h2>
          <p className="text-gray-600">
            {t('privacy.section6.content', 'We use cookies and similar technologies to enhance your experience, analyze usage, and deliver targeted content. You can manage cookie preferences through the cookie banner at the bottom of the page or your browser settings.')}
          </p>
        </section>

        {/* 7. Data Retention */}
        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">{t('privacy.section7.title', '7. Data Retention')}</h2>
          <p className="text-gray-600">
            {pick({
              ar: 'نحتفظ ببياناتك طالما كان الحساب نشطاً او بقدر الحاجة لتقديم الخدمة. نحتفظ بالسجلات المالية والفواتير والبيانات المرتبطة بالامتثال لمدة تصل الى 7 سنوات عند الاقتضاء، بينما يمكن حذف بيانات تتبع السائقين التشغيلية بعد 7 ايام ما لم ترتبط بنزاع او تحقيق او التزام قانوني.',
              fr: 'We retain your data while your account remains active or as needed to provide the service. Financial records, invoices, and compliance-related data may be retained for up to 7 years when required, while operational driver tracking data may be deleted after 7 days unless tied to a dispute, investigation, or legal obligation.',
              en: 'We retain your data while your account remains active or as needed to provide the service. Financial records, invoices, and compliance-related data may be retained for up to 7 years when required, while operational driver tracking data may be deleted after 7 days unless tied to a dispute, investigation, or legal obligation.',
            })}
          </p>
        </section>

        <section className="rounded-2xl border border-red-200 bg-red-50 p-6" dir="rtl">
          <h2 className="text-xl font-bold text-red-900 mb-3">سياسة البيانات في حالات النزاع والتحصيل</h2>
          <div className="space-y-4 text-sm leading-7 text-red-900">
            <p>
              عند وقوع نزاع يتعلق بعدم السداد، أو الامتناع عن إتمام الدفعة النهائية، أو الادعاء الكاذب بعدم الاستلام رغم ثبوت التنفيذ أو التسليم، تحتفظ المنصة بحقها في معالجة بيانات الطلب والبيانات المرتبطة بالمستخدمين المعنيين بهدف حماية الحقوق التعاقدية والمالية لجميع الأطراف.
            </p>
            <p>
              تشمل البيانات التي قد تتم معالجتها أو الاحتفاظ بها في هذا السياق: بيانات الهوية الأساسية، أرقام الهاتف، عناوين التسليم، سجلات الإيصالات المرفوعة، تفاصيل الطلب، سجلات المحادثات داخل المنصة، بيانات التتبع اللوجستي، وسجلات الإشعارات أو التأكيدات المرتبطة بالطلب.
            </p>
            <p>
              في حال حسم النزاع لصالح البائع أو ثبوت امتناع المشتري عن السداد دون مبرر مشروع، يجوز للمنصة الإفصاح عن القدر الضروري من بيانات المشتري للبائع أو لجهات التحصيل أو المستشارين القانونيين المعتمدين، وذلك بالحد الأدنى اللازم للمطالبة بالحق أو متابعة الإجراءات النظامية داخل المملكة المغربية.
            </p>
            <p>
              يتم الاحتفاظ بملفات الإثبات وسجلات الدفع والنزاع لفترة أطول من المدد التشغيلية المعتادة متى كان ذلك ضرورياً للامتثال القانوني، أو لحماية المنصة من الاحتيال، أو للرد على طلبات الجهات المختصة، أو للدفاع عن الحقوق في أي إجراء قضائي أو شبه قضائي.
            </p>
            <div className="rounded-xl border border-orange-300 bg-orange-50 px-4 py-4 text-orange-900">
              <p className="font-semibold mb-2">تنبيه قانوني</p>
              <p>
                استخدام الدفع عند الاستلام أو الدفع المرحلي يعني إقرارك بأن سجلات الإيصالات والتوصيل والاتصالات قد تستخدم كأدلة إثبات، وأن المنصة قد تتخذ إجراءات تقنية أو قانونية أو تشغيلية تشمل خفض درجة الثقة أو تقييد بعض وسائل الدفع أو مشاركة بيانات محددة عند الضرورة النظامية.
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">
            {pick({
              ar: '8. القانون المغربي والدعم القانوني',
              fr: '8. Droit marocain et soutien juridique',
              en: '8. Moroccan Law and Legal Support',
            })}
          </h2>
          <p className="text-gray-600 mb-3">
            {pick({
              ar: 'تعالج البيانات وفق القوانين المغربية المعمول بها، بما في ذلك القانون 09-08 المتعلق بحماية الاشخاص الذاتيين تجاه معالجة المعطيات ذات الطابع الشخصي. وعند وقوع ضرر او نزاع مثبت، يمكن للطرف المتضرر طلب دعم قانوني عبر المنصة.',
              fr: 'Data is processed in accordance with applicable Moroccan law, including Law 09-08 on the protection of individuals with regard to the processing of personal data. When a proven harm or dispute occurs, the affected party may request legal support through the platform.',
              en: 'Data is processed in accordance with applicable Moroccan law, including Law 09-08 on the protection of individuals with regard to the processing of personal data. When a proven harm or dispute occurs, the affected party may request legal support through the platform.',
            })}
          </p>
          <p className="text-gray-600">
            {pick({
              ar: 'قد يحصل البائع على بيانات المشتري بالقدر الضروري فقط بعد حسم النزاع لصالحه او عند الحاجة للتحصيل او الاثبات او الامتثال لقرار قانوني او قضائي.',
              fr: 'A vendor may receive buyer data only to the extent strictly necessary after a dispute is resolved in its favor or when needed for collection, proof, or compliance with a legal or judicial decision.',
              en: 'A vendor may receive buyer data only to the extent strictly necessary after a dispute is resolved in its favor or when needed for collection, proof, or compliance with a legal or judicial decision.',
            })}
          </p>
        </section>

        {/* 8. Contact */}
        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">{t('privacy.section8.title', '8. Contact')}</h2>
          <p className="text-gray-600">
            {t('privacy.section8.intro', 'For privacy-related questions or to exercise your rights, contact us at:')}
          </p>
          <div className="mt-3 p-4 bg-gray-50 rounded-lg">
            <p className="text-gray-600"><strong>{t('privacy.section8.emailLabel', 'Email:')}</strong> {APP_CONFIG.supportEmail}</p>
            <p className="text-gray-600"><strong>{pick({ ar: 'الهاتف:', fr: 'Telephone :', en: 'Phone:' })}</strong> {APP_CONFIG.supportPhoneDisplay}</p>
            <p className="text-gray-600"><strong>{t('privacy.section8.addressLabel', 'Address:')}</strong> {t('privacy.section8.addressValue', 'Casablanca, Morocco')}</p>
          </div>
        </section>
      </div>
    </div>
  )
}

export default Privacy
