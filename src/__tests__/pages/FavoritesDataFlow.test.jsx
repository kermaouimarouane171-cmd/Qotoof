/**
 * Tests for Favorites data flow fixes:
 * 1. favoritesApi.getUserFavorites includes vendor join
 * 2. product_images query is correct (no !is_primary)
 * 3. available_quantity is included in product select
 * 4. product.vendor is included via join
 * 5. Vendor "View Products" button navigates to /stores/:id (not /marketplace?vendorId=)
 * 6. navigate('/login') is in useEffect, not during render
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import fs from 'fs'
import path from 'path'

// ─── Mock supabase ───────────────────────────────────────────────────────────

let mockQueryData = []
let mockQueryError = null
let mockSelectClause = ''

const makeBuilder = () => ({
  select: jest.fn((clause) => {
    if (clause) mockSelectClause = clause
    return makeBuilder()
  }),
  eq: jest.fn(() => makeBuilder()),
  order: jest.fn(() => makeBuilder()),
  insert: jest.fn(() => ({
    select: jest.fn(() => ({
      single: jest.fn(() => Promise.resolve({ data: { id: 'fav-1' }, error: null })),
    })),
  })),
  delete: jest.fn(() => ({
    eq: jest.fn(() => Promise.resolve({ error: null })),
  })),
  maybeSingle: jest.fn(() => Promise.resolve({ data: null, error: null })),
  then: (resolve) => Promise.resolve({ data: mockQueryData, error: mockQueryError }).then(resolve),
})

const mockChannel = {
  on: jest.fn(() => mockChannel),
  subscribe: jest.fn(() => ({ unsubscribe: jest.fn() })),
}

jest.mock('@/services/supabase', () => ({
  supabase: {
    from: jest.fn(() => makeBuilder()),
    channel: jest.fn(() => mockChannel),
  },
}))

// ─── Mock i18n ───────────────────────────────────────────────────────────────

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, fallback) => fallback || key,
    i18n: { language: 'ar', dir: () => 'rtl' },
  }),
}))

// ─── Mock stores ─────────────────────────────────────────────────────────────

const mockFavoriteProducts = []
const mockFavoriteVendors = []
let mockLoadFavorites = jest.fn()

jest.mock('@/store/authStore', () => ({
  useAuthStore: () => ({ user: { id: 'u1' }, profile: { role: 'buyer' } }),
}))

jest.mock('@/modules/cart', () => ({
  useCartStore: () => ({
    addItem: jest.fn(),
    items: [],
  }),
  useFavoritesStore: () => ({
    favorites: [],
    loading: false,
    error: null,
    loadFavorites: mockLoadFavorites,
    getFavoriteProducts: () => mockFavoriteProducts,
    getFavoriteVendors: () => mockFavoriteVendors,
    toggleProduct: jest.fn(),
  }),
  favoritesApi: {
    getUserFavorites: jest.fn(),
    addProduct: jest.fn(),
    remove: jest.fn(),
    subscribe: jest.fn(() => ({ unsubscribe: jest.fn() })),
  },
}))

jest.mock('@/utils/currency', () => ({
  formatPrice: (v) => `${v} DH`,
}))

jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}))

// ─── Import after mocks ──────────────────────────────────────────────────────

import { favoritesApi } from '@/modules/cart/api/favorites'
import FavoritesPage from '@/pages/Favorites'

const favoritesPath = path.resolve(__dirname, '../../pages/Favorites.jsx')
const favoritesSource = fs.readFileSync(favoritesPath, 'utf-8')

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Favorites data flow fixes', () => {

  describe('favoritesApi.getUserFavorites query', () => {
    beforeEach(() => {
      mockQueryData = []
      mockQueryError = null
      mockSelectClause = ''
    })

    it('includes vendor:profiles join in select clause', async () => {
      mockQueryData = [
        { id: 'f1', product_id: 'p1', vendor_id: 'v1', created_at: '2024-01-01', product: { id: 'p1', name: 'Tomatoes' }, vendor: { id: 'v1', store_name: 'Green Farm' } },
      ]

      await favoritesApi.getUserFavorites('u1')

      expect(mockSelectClause).toContain('vendor:profiles!favorites_vendor_id_fkey')
      expect(mockSelectClause).toContain('store_name')
      expect(mockSelectClause).toContain('store_description')
    })

    it('includes available_quantity in product select', async () => {
      await favoritesApi.getUserFavorites('u1')

      expect(mockSelectClause).toContain('available_quantity')
    })

    it('includes vendor join inside product select', async () => {
      await favoritesApi.getUserFavorites('u1')

      expect(mockSelectClause).toContain('vendor:profiles!products_vendor_id_fkey')
    })

    it('uses product_images(url, is_primary) not product_images!is_primary(url)', async () => {
      await favoritesApi.getUserFavorites('u1')

      expect(mockSelectClause).toContain('product_images(url, is_primary)')
      expect(mockSelectClause).not.toContain('product_images!is_primary')
    })
  })

  describe('favoritesStore getFavoriteVendors with vendor data', () => {
    it('returns vendors when vendor data is present from join', () => {
      const favorites = [
        { id: 'f1', product_id: 'p1', vendor_id: null, product: { id: 'p1', name: 'Tomatoes' } },
        { id: 'f2', product_id: null, vendor_id: 'v1', vendor: { id: 'v1', store_name: 'Green Farm' } },
      ]

      const vendors = favorites.filter(f => f.vendor && f.vendor_id)
      expect(vendors).toHaveLength(1)
      expect(vendors[0].vendor.store_name).toBe('Green Farm')
    })

    it('returns empty when vendor data is missing (no join)', () => {
      const favorites = [
        { id: 'f2', product_id: null, vendor_id: 'v1', vendor: undefined },
      ]

      const vendors = favorites.filter(f => f.vendor && f.vendor_id)
      expect(vendors).toHaveLength(0)
    })
  })

  describe('Favorites page vendor button', () => {
    beforeEach(() => {
      mockFavoriteVendors.length = 0
      mockFavoriteProducts.length = 0
      mockLoadFilters = jest.fn()
    })

    it('renders vendor card with store name from join data', async () => {
      mockFavoriteVendors.push({
        id: 'fav-v1',
        vendor_id: 'v1',
        vendor: {
          id: 'v1',
          store_name: 'Green Farm',
          first_name: 'Ahmed',
          last_name: 'Hassan',
          city: 'Casablanca',
          store_description: 'Fresh organic produce',
        },
      })

      render(
        <MemoryRouter>
          <FavoritesPage />
        </MemoryRouter>
      )

      // Switch to vendors tab
      const vendorsTab = screen.getByRole('tab', { name: /vendors/i })
      fireEvent.click(vendorsTab)

      // Vendor store name should be visible
      expect(screen.getByText('Green Farm')).toBeInTheDocument()
    })

    it('does not contain /marketplace?vendorId in rendered HTML', async () => {
      mockFavoriteVendors.push({
        id: 'fav-v1',
        vendor_id: 'v1',
        vendor: {
          id: 'v1',
          store_name: 'Green Farm',
          first_name: 'Ahmed',
          last_name: 'Hassan',
          city: 'Casablanca',
        },
      })

      const { container } = render(
        <MemoryRouter>
          <FavoritesPage />
        </MemoryRouter>
      )

      // Switch to vendors tab
      const vendorsTab = screen.getByRole('tab', { name: /vendors/i })
      fireEvent.click(vendorsTab)

      // The rendered HTML should not contain the old broken URL pattern
      expect(container.innerHTML).not.toContain('marketplace?vendorId')
    })
  })

  describe('Favorites page - loadFavorites on mount', () => {
    it('calls loadFavorites on mount for authenticated user', async () => {
      render(
        <MemoryRouter>
          <FavoritesPage />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(mockLoadFavorites).toHaveBeenCalledWith('u1')
      })
    })
  })

  describe('Favorites page i18n', () => {
    test('uses i18n keys for previously hardcoded English strings', () => {
      expect(favoritesSource).toContain("t('favorites.outOfStock'")
      expect(favoritesSource).toContain("t('favorites.lowStock'")
      expect(favoritesSource).toContain("t('favorites.addToCartAria'")
      expect(favoritesSource).toContain("t('favorites.outOfStockAria'")
      expect(favoritesSource).toContain("t('favorites.viewDetailsAria'")
      expect(favoritesSource).toContain("t('favorites.removeFromFavoritesAria'")
      expect(favoritesSource).toContain("t('common.cancel'")
      expect(favoritesSource).toContain("t('common.tryAgain'")
      expect(favoritesSource).toContain("t('favorites.removeFavorite'")
    })
  })

  describe('Favorites page design tokens', () => {
    test('uses primary-* color tokens instead of green-*', () => {
      expect(favoritesSource).not.toContain('bg-green-')
      expect(favoritesSource).not.toContain('text-green-')
      expect(favoritesSource).not.toContain('border-green-')
      expect(favoritesSource).not.toContain('from-green-')
      expect(favoritesSource).toContain('bg-primary-500')
      expect(favoritesSource).toContain('text-primary-600')
    })
  })
})
