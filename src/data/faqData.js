export const FAQS = {
  ar: [
    {
      category: 'الطلبات',
      questions: [
        { q: 'كيف أطلب من السوق؟', a: 'اختر المنتجات، أضفها إلى السلة، ثم أكمل الدفع مع اختيار طريقة التوصيل المناسبة.' },
        { q: 'هل يمكن إلغاء الطلب؟', a: 'يمكن الإلغاء قبل قبول البائع للطلب، وبعدها تطبق سياسة الإلغاء والاسترجاع الخاصة بالمتجر.' },
        { q: 'كيف أتتبع الطلب؟', a: 'عند اعتماد الطلب وإسناده لسائق يمكنك التتبع المباشر من صفحة الطلبات.' },
      ],
    },
    {
      category: 'التوصيل',
      questions: [
        { q: 'كم يستغرق التوصيل؟', a: 'غالباً بين 24 و48 ساعة بعد قبول الطلب، بحسب المدينة وتوفر السائقين.' },
        { q: 'هل أستطيع تغيير العنوان؟', a: 'نعم قبل خروج الطلب للتسليم، عبر التواصل مع البائع أو الدعم.' },
        { q: 'ماذا إذا لم أكن متواجداً؟', a: 'سيتم التواصل عبر الهاتف، ويمكنك ترك ملاحظات مسبقة للسائق.' },
      ],
    },
    {
      category: 'الاسترجاع والاسترداد',
      questions: [
        { q: 'كيف أطلب إرجاع منتج؟', a: 'من صفحة الطلبات اختر الطلب المستلم ثم أنشئ طلب إرجاع ضمن نافذة الإرجاع المحددة.' },
        { q: 'متى يصل الاسترداد؟', a: 'عادة خلال 3 إلى 5 أيام عمل بعد قبول طلب الإرجاع.' },
        { q: 'هل كل المنتجات قابلة للإرجاع؟', a: 'ليس دائماً. راجع سياسة الاسترجاع الظاهرة في صفحة المنتج قبل الشراء.' },
      ],
    },
    {
      category: 'الدفع',
      questions: [
        { q: 'ما طرق الدفع المتاحة؟', a: 'الدفع عند الاستلام، CMI، والتحويل البنكي المغربي بحسب إعدادات البائع.' },
        { q: 'هل بيانات الدفع آمنة؟', a: 'نعم، تتم معالجة المدفوعات عبر قنوات مشفرة ومزودي دفع موثوقين.' },
      ],
    },
  ],
  fr: [
    {
      category: 'Commandes',
      questions: [
        { q: 'Comment commander sur le marché ?', a: 'Choisissez vos produits, ajoutez-les au panier puis terminez le paiement avec le mode de livraison adapté.' },
        { q: 'Puis-je annuler une commande ?', a: 'Oui, avant que le vendeur accepte la commande. Ensuite, la politique d’annulation et de retour du magasin s’applique.' },
        { q: 'Comment suivre ma commande ?', a: 'Dès que la commande est confirmée et affectée à un chauffeur, vous pouvez suivre la livraison depuis vos commandes.' },
      ],
    },
    {
      category: 'Livraison',
      questions: [
        { q: 'Combien de temps prend la livraison ?', a: 'En général entre 24 et 48 heures après acceptation de la commande, selon la ville et la disponibilité des chauffeurs.' },
        { q: 'Puis-je modifier mon adresse ?', a: 'Oui, avant le départ en livraison, en contactant le vendeur ou le support.' },
        { q: 'Que faire si je suis absent ?', a: 'Le chauffeur vous contactera par téléphone et vous pouvez laisser une note à l’avance.' },
      ],
    },
    {
      category: 'Retours et remboursements',
      questions: [
        { q: 'Comment demander un retour ?', a: 'Depuis vos commandes, ouvrez la commande livrée puis créez une demande de retour dans la fenêtre autorisée.' },
        { q: 'Quand le remboursement arrive-t-il ?', a: 'Le remboursement arrive généralement sous 3 à 5 jours ouvrés après validation du retour.' },
        { q: 'Tous les produits sont-ils retournables ?', a: 'Pas toujours. Vérifiez la politique de retour affichée sur la fiche produit avant l’achat.' },
      ],
    },
    {
      category: 'Paiement',
      questions: [
        { q: 'Quels moyens de paiement sont disponibles ?', a: 'Paiement à la livraison, CMI et virement bancaire marocain selon la configuration du vendeur.' },
        { q: 'Les données de paiement sont-elles sécurisées ?', a: 'Oui, les paiements passent par des canaux chiffrés et des prestataires fiables.' },
      ],
    },
  ],
  en: [
    {
      category: 'Orders',
      questions: [
        { q: 'How do I place an order?', a: 'Choose your products, add them to the cart, then complete checkout with the delivery option that fits your order.' },
        { q: 'Can I cancel an order?', a: 'Yes, before the vendor accepts it. After that, the store cancellation and return policy applies.' },
        { q: 'How do I track my order?', a: 'Once the order is approved and assigned to a driver, you can track it from your orders page.' },
      ],
    },
    {
      category: 'Delivery',
      questions: [
        { q: 'How long does delivery take?', a: 'Usually 24 to 48 hours after the order is accepted, depending on the city and driver availability.' },
        { q: 'Can I change the address?', a: 'Yes, before the order leaves for delivery, by contacting the vendor or support.' },
        { q: 'What if I am not available?', a: 'The driver will contact you by phone, and you can leave delivery notes in advance.' },
      ],
    },
    {
      category: 'Returns and refunds',
      questions: [
        { q: 'How do I request a return?', a: 'Open the delivered order from your orders page and create a return request within the allowed return window.' },
        { q: 'When will I receive my refund?', a: 'Refunds usually arrive within 3 to 5 business days after the return is approved.' },
        { q: 'Are all products returnable?', a: 'Not always. Review the return policy shown on the product page before purchasing.' },
      ],
    },
    {
      category: 'Payments',
      questions: [
        { q: 'Which payment methods are available?', a: 'Cash on delivery, CMI, and Moroccan bank transfer depending on the vendor setup.' },
        { q: 'Is payment data secure?', a: 'Yes. Payments are handled through encrypted channels and trusted payment providers.' },
      ],
    },
  ],
}

const normalizeLocale = (locale = 'en') => String(locale).toLowerCase().split('-')[0]

export const getFaqsForLocale = (locale) => FAQS[normalizeLocale(locale)] || FAQS.en

export default FAQS