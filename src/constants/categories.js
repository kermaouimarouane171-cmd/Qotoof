/**
 * Product categories for the marketplace.
 * Matches the database enum values.
 */

export const PRODUCT_CATEGORIES = [
  { id: 'plants', label: 'Plants & Trees', labelAr: 'نباتات وأشجار', icon: '🌿' },
  { id: 'vegetables', label: 'Vegetables', labelAr: 'خضروات', icon: '🥬' },
  { id: 'fruits', label: 'Fruits', labelAr: 'فواكه', icon: '🍎' },
  { id: 'herbs', label: 'Herbs & Spices', labelAr: 'أعشاب وتوابل', icon: '🌱' },
  { id: 'seeds', label: 'Seeds & Bulbs', labelAr: 'بذور وبصلات', icon: '🌰' },
]

// Alias for backward compatibility (used by vendor/Products.jsx)
export const MAIN_CATEGORIES = PRODUCT_CATEGORIES

// Subcategory mapping
const SUBCATEGORIES = {
  plants: ['Trees', 'Shrubs', 'Flowers', 'Succulents', 'Indoor Plants', 'Outdoor Plants'],
  vegetables: ['Tomatoes', 'Peppers', 'Onions', 'Potatoes', 'Carrots', 'Leafy Greens', 'Cucumbers'],
  fruits: ['Citrus', 'Apples', 'Bananas', 'Dates', 'Olives', 'Grapes', 'Melons', 'Berries'],
  herbs: ['Basil', 'Mint', 'Rosemary', 'Thyme', 'Saffron', 'Cumin', 'Coriander'],
  seeds: ['Vegetable Seeds', 'Fruit Seeds', 'Flower Seeds', 'Herb Seeds', 'Bulbs'],
}

// Helper: get suggested subcategories for a main category
export const getSuggestedSubcategories = (categoryId) => {
  return SUBCATEGORIES[categoryId] || []
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
  if (lang === 'ar') return cat.labelAr
  return cat.label
}
