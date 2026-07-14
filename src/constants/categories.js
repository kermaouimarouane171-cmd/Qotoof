/**
 * Product categories for the marketplace.
 * Matches the database enum values.
 */

export const PRODUCT_CATEGORIES = [
  { id: 'plants', label: 'Plants & Trees', labelAr: 'نباتات وأشجار', labelFr: 'Plantes et Arbres', icon: '🌿' },
  { id: 'vegetables', label: 'Vegetables', labelAr: 'خضروات', labelFr: 'Légumes', icon: '🥬' },
  { id: 'fruits', label: 'Fruits', labelAr: 'فواكه', labelFr: 'Fruits', icon: '🍎' },
  { id: 'herbs', label: 'Herbs & Spices', labelAr: 'أعشاب وتوابل', labelFr: 'Herbes et Épices', icon: '🌱' },
  { id: 'seeds', label: 'Seeds & Bulbs', labelAr: 'بذور وبصلات', labelFr: 'Graines et Bulbes', icon: '🌰' },
]

// Alias for backward compatibility (used by vendor/Products.jsx)
export const MAIN_CATEGORIES = PRODUCT_CATEGORIES

// Subcategory mapping (each entry: { en, ar, fr })
const SUBCATEGORIES = {
  plants: [
    { en: 'Trees', ar: 'أشجار', fr: 'Arbres' },
    { en: 'Shrubs', ar: 'شجيرات', fr: 'Arbustes' },
    { en: 'Flowers', ar: 'زهور', fr: 'Fleurs' },
    { en: 'Succulents', ar: 'نباتات عصارية', fr: 'Plantes Grasses' },
    { en: 'Indoor Plants', ar: 'نباتات داخلية', fr: 'Plantes d\'Intérieur' },
    { en: 'Outdoor Plants', ar: 'نباتات خارجية', fr: 'Plantes d\'Extérieur' },
  ],
  vegetables: [
    { en: 'Tomatoes', ar: 'طماطم', fr: 'Tomates' },
    { en: 'Peppers', ar: 'فلفل', fr: 'Poivrons' },
    { en: 'Onions', ar: 'بصل', fr: 'Oignons' },
    { en: 'Potatoes', ar: 'بطاطس', fr: 'Pommes de Terre' },
    { en: 'Carrots', ar: 'جزر', fr: 'Carottes' },
    { en: 'Leafy Greens', ar: 'ورقيات خضراء', fr: 'Légumes Feuilles' },
    { en: 'Cucumbers', ar: 'خيار', fr: 'Concombres' },
  ],
  fruits: [
    { en: 'Citrus', ar: 'حمضيات', fr: 'Agrumes' },
    { en: 'Apples', ar: 'تفاح', fr: 'Pommes' },
    { en: 'Bananas', ar: 'موز', fr: 'Bananes' },
    { en: 'Dates', ar: 'تمور', fr: 'Dattes' },
    { en: 'Olives', ar: 'زيتون', fr: 'Olives' },
    { en: 'Grapes', ar: 'عنب', fr: 'Raisins' },
    { en: 'Melons', ar: 'بطيخ', fr: 'Melons' },
    { en: 'Berries', ar: 'توت', fr: 'Baies' },
  ],
  herbs: [
    { en: 'Basil', ar: 'ريحان', fr: 'Basilic' },
    { en: 'Mint', ar: 'نعناع', fr: 'Menthe' },
    { en: 'Rosemary', ar: 'إكليل الجبل', fr: 'Romarin' },
    { en: 'Thyme', ar: 'زعتر', fr: 'Thym' },
    { en: 'Saffron', ar: 'زعفران', fr: 'Safran' },
    { en: 'Cumin', ar: 'كمون', fr: 'Cumin' },
    { en: 'Coriander', ar: 'كزبرة', fr: 'Coriandre' },
  ],
  seeds: [
    { en: 'Vegetable Seeds', ar: 'بذور خضروات', fr: 'Graines de Légumes' },
    { en: 'Fruit Seeds', ar: 'بذور فواكه', fr: 'Graines de Fruits' },
    { en: 'Flower Seeds', ar: 'بذور زهور', fr: 'Graines de Fleurs' },
    { en: 'Herb Seeds', ar: 'بذور أعشاب', fr: 'Graines d\'Herbes' },
    { en: 'Bulbs', ar: 'بصلات', fr: 'Bulbes' },
  ],
}

// Helper: get suggested subcategories for a main category
// Returns array of localized strings based on language
export const getSuggestedSubcategories = (categoryId, lang = 'en') => {
  const subs = SUBCATEGORIES[categoryId]
  if (!subs) return []
  const normalizedLang = String(lang || 'en').slice(0, 2)
  return subs.map(sub => {
    if (normalizedLang === 'ar') return sub.ar
    if (normalizedLang === 'fr') return sub.fr
    return sub.en
  })
}

// Helper: get category by ID
export const getCategoryById = (id) => {
  return PRODUCT_CATEGORIES.find((cat) => cat.id === id) || PRODUCT_CATEGORIES[0]
}

// Helper: get all category IDs
export const getCategoryIds = () => PRODUCT_CATEGORIES.map((cat) => cat.id)

// Helper: get category label (with fallback)
export const getCategoryLabel = (id, lang = 'en') => {
  const cat = getCategoryById(id)
  const normalizedLang = String(lang || 'en').slice(0, 2)
  if (normalizedLang === 'ar') return cat.labelAr
  if (normalizedLang === 'fr') return cat.labelFr || cat.label
  return cat.label
}
