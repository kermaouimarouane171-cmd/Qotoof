# 📄 PRD - Home Page (HomePage)

**File:** `src/pages/Home.jsx`  
**Route:** `/`  
**Component:** `HomePage`  
**Last Updated:** 2026-04-11

---

## 1️⃣ OVERVIEW

### 1.1 Purpose
The Home Page serves as the **landing page** for Greenmarket (قطوف - Qotoof), a B2B agricultural wholesale marketplace. It introduces visitors to the platform's value proposition, showcases featured products, and drives conversions (vendor signups and marketplace browsing).

### 1.2 Target Audience
- **Primary:** Wholesale buyers (restaurants, retailers, distributors)
- **Secondary:** Potential vendors (farmers, agricultural producers)
- **Tertiary:** General visitors exploring the platform

### 1.3 Key Objectives
1. Communicate platform value proposition clearly
2. Display live platform statistics (products, vendors, orders)
3. Showcase product categories and featured products
4. Drive user acquisition (vendor registration & buyer signups)
5. Establish trust through platform features and social proof

---

## 2️⃣ PAGE SECTIONS (Top to Bottom)

### 2.1 Hero Section
**Location:** Top of page  
**Background:** Gradient (green-600 → emerald-600 → teal-700) with animated decorative elements

#### Content Elements:
| Element | Type | Description |
|---------|------|-------------|
| Badge | Pill | "🌟 {t('home.badge.text')}" with SparklesIcon |
| H1 Title | Heading | `{t('home.hero.title')}` - 4xl/5xl/6xl responsive |
| H1 Subtitle | Heading | `{t('home.hero.subtitle')}` in yellow-300 |
| Description | Paragraph | `{t('home.hero.description')}` |
| CTA Button 1 | Link | "Browse Marketplace" → `/marketplace` (white bg, green text) |
| CTA Button 2 | Link | "Start Selling" → `/register?role=vendor` (transparent, white border) |
| Stats Counter | 3-column grid | Products count, Vendors count, Orders count (live data) |
| Image Grid | 4 images | 2x2 grid with hover scale effect (Unsplash images) |

#### Data Sources:
- **Stats:** Fetched from Supabase (`products`, `profiles`, `orders` tables)
- **Images:** Unsplash URLs with fallback gradient on error

#### Animations:
- Floating blurred circles (pulse animation)
- SVG wave divider at bottom
- Image hover scale effect

---

### 2.2 Categories Section
**Background:** White  
**Layout:** 5-column grid (responsive: 2 cols mobile, 3 tablet, 5 desktop)

#### Categories List:
| ID | Name (i18n key) | Emoji | Image |
|----|-----------------|-------|-------|
| plants | `home.categories.plants` | 🌱 | Unsplash garden |
| vegetables | `home.categories.vegetables` | 🥬 | Unsplash vegetables |
| fruits | `home.categories.fruits` | 🍊 | Unsplash fruits |
| herbs | `home.categories.herbs` | 🌿 | Unsplash herbs |
| seeds | `home.categories.seeds` | 🌰 | Unsplash seeds |

#### Card Structure:
- Rounded image (aspect-square)
- Gradient overlay (dark bottom)
- Emoji + Category name + Item count
- Link → `/marketplace?category={id}`
- Hover: shadow-xl, -translate-y-1, image scale-110

---

### 2.3 Featured Products Section
**Background:** Gray-50  
**Layout:** 4-column grid (responsive: 1/2/3/4 cols)

#### States:
| State | Display |
|-------|---------|
| Loading | 4 skeleton cards with animate-pulse |
| Has Products | ProductCard components (max 8 products) |
| No Products | Empty state with "Browse Marketplace" CTA |

#### Data Source:
- **Query:** Supabase `products` table
- **Filters:** `is_available = true`
- **Order:** `created_at DESC`
- **Limit:** 8 products
- **Includes:** vendor info (first_name, last_name, city, store_name, is_verified), product images

#### Component:
- Uses `ProductCard` reusable component

---

### 2.4 Features Section
**Background:** White  
**Layout:** 4-column grid (responsive: 1/2/4 cols)

#### Features List:
| Icon | Title (i18n key) | Color Scheme |
|------|------------------|--------------|
| 🚚 TruckIcon | `home.features.directFromFarm.title` | Blue (bg-blue-100, text-blue-600) |
| 💵 CurrencyDollarIcon | `home.features.wholesalePrices.title` | Green (bg-green-100, text-green-600) |
| 🛡️ ShieldCheckIcon | `home.features.qualityVerified.title` | Purple (bg-purple-100, text-purple-600) |
| ⏰ ClockIcon | `home.features.fastDelivery.title` | Orange (bg-orange-100, text-orange-600) |

#### Card Structure:
- Icon in colored rounded square
- Title (font-semibold)
- Description (text-gray-500)
- Hover: shadow-xl, -translate-y-1, icon scale-110

---

### 2.5 CTA Section
**Background:** Gray-50  
**Layout:** Centered content with gradient card

#### Elements:
| Element | Type | Description |
|---------|------|-------------|
| MoroccoNotice | Component | Regional notice component (variant="default") |
| H2 Title | Heading | `{t('home.cta.readyToGrow')}` |
| Description | Paragraph | `{t('home.cta.joinThousands')}` |
| CTA Button 1 | Link | "Become a Vendor" → `/register?role=vendor` |
| CTA Button 2 | Link | "Start Buying" → `/marketplace` |

#### Design:
- Gradient card (green-600 → emerald-600)
- Decorative circles (top-right, bottom-left)
- White text with backdrop blur effects

---

### 2.6 Footer
**Background:** Gray-900 (dark)  
**Layout:** 4-column grid + bottom bar

#### Sections:
| Column | Content |
|--------|---------|
| Brand | Logo (Q icon + "قطوف - Qotoof"), description |
| Marketplace | Links: All Products, Plants, Vegetables, Fruits |
| Company | Links: About Us, Become Vendor, Contact |
| Support | Links: Help Center, Terms, Privacy |

#### Social Links:
- Facebook → `https://facebook.com/qotoof`
- Instagram → `https://instagram.com/qotoof`
- WhatsApp → `https://wa.me/212522123456`

#### Bottom Bar:
- Copyright text (dynamic year)
- Social media icons (SVG)

---

## 3️⃣ DATA FLOW

### 3.1 Supabase Queries

#### Query 1: Load Stats
```javascript
// Parallel queries for performance
Promise.all([
  supabase.from('products').select('*', { count: 'exact', head: true }).eq('is_available', true),
  supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'vendor'),
  supabase.from('orders').select('*', { count: 'exact', head: true }),
])
```

#### Query 2: Load Featured Products
```javascript
supabase
  .from('products')
  .select(`
    *,
    vendor:profiles(first_name, last_name, city, store_name, is_verified),
    images:product_images(url, is_primary)
  `)
  .eq('is_available', true)
  .order('created_at', { ascending: false })
  .limit(8)
```

### 3.2 State Management
| State | Type | Default | Purpose |
|-------|------|---------|---------|
| products | Array | `[]` | Featured products list |
| loading | Boolean | `true` | Loading indicator flag |
| stats | Object | `{ products: 0, vendors: 0, orders: 0 }` | Platform statistics |

### 3.3 Lifecycle
```
useEffect (on mount)
  ├── loadFeaturedProducts()
  └── loadStats()
```

---

## 4️⃣ DEPENDENCIES

### 4.1 External Libraries
| Library | Usage |
|---------|-------|
| `react-router-dom` | Link component for navigation |
| `react-i18next` | Internationalization (useTranslation hook) |
| `@heroicons/react/24/outline` | Icons (TruckIcon, ShieldCheckIcon, etc.) |

### 4.2 Internal Components
| Component | Source | Usage |
|-----------|--------|-------|
| ProductCard | `@/components/ui` | Product display in featured section |
| MoroccoNotice | `@/components/ui` | Regional notice in CTA section |

### 4.3 Services
| Service | Source | Usage |
|---------|--------|-------|
| supabase | `@/services/supabase` | Database queries |
| logger | `@/utils/logger` | Error logging |

---

## 5️⃣ INTERNATIONALIZATION (i18n)

### 5.1 Translation Keys Used
```
home.badge.text
home.hero.title
home.hero.subtitle
home.hero.description
home.hero.cta
home.hero.sellCta
home.stats.products
home.stats.vendors
home.stats.orders
home.categories.title
home.categories.subtitle
home.categories.plants
home.categories.vegetables
home.categories.fruits
home.categories.herbs
home.categories.seeds
home.categories.items
home.products.featured
home.products.subtitle
home.products.seeAll
home.products.noProducts
home.products.browseMarketplace
home.features.title
home.features.subtitle
home.features.directFromFarm.title
home.features.directFromFarm.description
home.features.wholesalePrices.title
home.features.wholesalePrices.description
home.features.qualityVerified.title
home.features.qualityVerified.description
home.features.fastDelivery.title
home.features.fastDelivery.description
home.cta.readyToGrow
home.cta.joinThousands
home.cta.becomeVendor
home.cta.startBuying
home.footer.description
home.footer.marketplace
home.footer.allProducts
home.footer.plants
home.footer.vegetables
home.footer.fruits
home.footer.company
home.footer.aboutUs
home.footer.becomeVendor
home.footer.contact
home.footer.support
home.footer.helpCenter
home.footer.terms
home.footer.privacy
home.footer.copyright
common.viewAll
```

### 5.2 Supported Languages
- Determined by i18n configuration (likely Arabic + French + English based on Moroccan market)

---

## 6️⃣ RESPONSIVE DESIGN

### 6.1 Breakpoints
| Breakpoint | Tailwind | Usage |
|------------|----------|-------|
| Mobile | Default | Single column layouts |
| sm | 640px | 2-column grids |
| lg | 1024px | 3-5 column grids, hero image grid |
| xl | 1280px | 4-column product grids |

### 6.2 Responsive Elements
| Element | Mobile | Tablet | Desktop |
|---------|--------|--------|---------|
| Hero Title | 4xl | 5xl | 6xl |
| Hero Layout | Single column | Single column | 2-column (text + images) |
| Categories Grid | 2 cols | 3 cols | 5 cols |
| Products Grid | 1 col | 2 cols | 3-4 cols |
| Features Grid | 1 col | 2 cols | 4 cols |
| Footer | 2 cols | 4 cols | 4 cols |

---

## 7️⃣ NAVIGATION LINKS

### 7.1 Internal Routes
| Route | Location in Page |
|-------|------------------|
| `/` | Home (logo/brand) |
| `/marketplace` | Hero CTA, Categories header, Products header, Footer, CTA section |
| `/marketplace?category={id}` | Category cards (5 links) |
| `/register?role=vendor` | Hero CTA, CTA section |
| `/about` | Footer |
| `/contact` | Footer |
| `/terms` | Footer |
| `/privacy` | Footer |
| `/help` | Footer |

### 7.2 External Links
| URL | Location |
|-----|----------|
| `https://facebook.com/qotoof` | Footer social icon |
| `https://instagram.com/qotoof` | Footer social icon |
| `https://wa.me/212522123456` | Footer social icon |

---

## 8️⃣ ERROR HANDLING

### 8.1 Data Loading Errors
- **Stats Error:** Logged via `logger.error()`, stats default to 0
- **Products Error:** Logged via `logger.error()`, products default to empty array

### 8.2 Image Errors
- **Fallback:** Gradient background replaces failed image
- **Implementation:** `onError` handler on all `<img>` tags

---

## 9️⃣ PERFORMANCE CONSIDERATIONS

### 9.1 Optimizations
- **Parallel Queries:** Stats loaded via `Promise.all()`
- **Limited Results:** Products limited to 8 items
- **Head Queries:** Stats use `head: true` (no data transfer, only count)
- **Image Optimization:** External Unsplash images with `?w=400` parameter

### 9.2 Potential Improvements
- [ ] Implement React.lazy for below-fold sections
- [ ] Add image lazy loading
- [ ] Cache stats data (currently refetched on every mount)
- [ ] Add pagination/infinite scroll for products
- [ ] Use Supabase real-time for live stats updates

---

## 🔟 ACCESSIBILITY (a11y)

### 10.1 Current Implementation
- ✅ Semantic HTML (h1, h2, h3, h4, section, footer)
- ✅ ARIA labels on social links
- ✅ Alt text on images (with fallbacks)
- ✅ Link components for navigation (not buttons)

### 10.2 Potential Improvements
- [ ] Add skip-to-content link
- [ ] Ensure color contrast ratios meet WCAG AA
- [ ] Add focus visible styles
- [ ] Test with screen readers

---

## 1️⃣1️⃣ TESTING REQUIREMENTS

### 11.1 Unit Tests
- [ ] Stats loading success
- [ ] Stats loading failure
- [ ] Products loading success
- [ ] Products loading failure
- [ ] Empty products state
- [ ] Category rendering
- [ ] Feature cards rendering

### 11.2 Integration Tests
- [ ] Navigation links work correctly
- [ ] Supabase queries return expected data
- [ ] i18n translations render

### 11.3 E2E Tests
- [ ] Page loads without errors
- [ ] All CTAs navigate correctly
- [ ] Stats display updates
- [ ] Responsive breakpoints work
- [ ] Images load (or fallback gracefully)

---

## 1️⃣2️⃣ METRICS & KPIs

### 12.1 Success Metrics
| Metric | Target | Measurement |
|--------|--------|-------------|
| Bounce Rate | < 40% | Analytics |
| CTA Click-through | > 5% | Event tracking |
| Page Load Time | < 2s | Performance monitoring |
| Vendor Signups | Track | Conversion funnel |

### 12.2 Events to Track
- Hero CTA clicks (Browse Marketplace)
- Hero CTA clicks (Start Selling)
- Category clicks
- Featured product clicks
- Footer link clicks
- Social link clicks

---

## 1️⃣3️⃣ CHANGELOG

| Date | Change | Author |
|------|--------|--------|
| 2026-04-11 | Initial PRD created | Qwen Code |

---

## 📎 APPENDIX

### A. Component Tree
```
HomePage
├── Hero Section
│   ├── Badge
│   ├── H1 Title + Subtitle
│   ├── Description
│   ├── CTA Buttons (2x Link)
│   ├── Stats Counter (3 items)
│   └── Image Grid (4 images)
├── Categories Section
│   ├── Section Header (Title + Subtitle + View All Link)
│   └── Category Cards (5x Link)
├── Featured Products Section
│   ├── Section Header (Title + Subtitle + See All Link)
│   └── Products Grid (ProductCard x8 or Skeletons or Empty State)
├── Features Section
│   ├── Section Header (Title + Subtitle)
│   └── Feature Cards (4x)
├── CTA Section
│   ├── MoroccoNotice
│   ├── Title + Description
│   └── CTA Buttons (2x Link)
└── Footer
    ├── Brand Column
    ├── Marketplace Links
    ├── Company Links
    ├── Support Links
    └── Bottom Bar (Copyright + Social Icons)
```

### B. Color Palette
| Color | Hex | Usage |
|-------|-----|-------|
| Green-600 | #16a34a | Primary brand, gradients |
| Emerald-600 | #059669 | Gradients |
| Teal-700 | #0f766e | Hero gradient |
| Yellow-300 | #fde047 | Accent text |
| Gray-50 | #f9fafb | Section backgrounds |
| Gray-900 | #111827 | Footer background |
| White | #ffffff | Text on dark, cards |

---

**END OF PRD**
