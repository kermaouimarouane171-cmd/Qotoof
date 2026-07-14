import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useCartStore } from '@/modules/cart'
import { Card, LoadingSpinner } from '@/components/ui'
import { useTranslation } from 'react-i18next'
import { hydrateRowsWithProductItems, isProductImagesRelationError } from '@/modules/catalog'
import { supabase } from '@/services/supabase'
import { formatPrice } from '@/utils/currency'
import {
  ClipboardDocumentListIcon,
  PlusIcon,
  TrashIcon,
  ShoppingCartIcon,
  ArrowLeftIcon,
  XMarkIcon,
  CheckIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { logger } from '@/utils/logger'

const SHOPPING_LISTS_KEY = (userId) => ['buyer-shopping-lists', userId]

const ShoppingLists = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { addItem } = useCartStore()
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [newListName, setNewListName] = useState('')

  const { data: lists = [], isLoading: loading } = useQuery({
    queryKey: SHOPPING_LISTS_KEY(user?.id),
    queryFn: async () => {
      const buildQuery = (selectClause) => supabase
        .from('shopping_lists')
        .select(selectClause)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      let result = await buildQuery(`
        *,
        items:shopping_list_items(*, product:products(id, name, price_per_unit, unit_type, images:product_images(url, is_primary)))
      `)

      if (result.error) {
        if (!isProductImagesRelationError(result.error)) throw result.error
        logger.warn('Shopping lists: product_images relation missing, hydrating separately', result.error)
        const fallbackResult = await buildQuery(`
          *,
          items:shopping_list_items(*, product:products(id, name, price_per_unit, unit_type))
        `)
        if (fallbackResult.error) throw fallbackResult.error
        return await hydrateRowsWithProductItems(fallbackResult.data || [])
      }

      return result.data || []
    },
    enabled: Boolean(user?.id),
    staleTime: 2 * 60 * 1000,
  })

  const invalidateLists = () => queryClient.invalidateQueries({ queryKey: SHOPPING_LISTS_KEY(user?.id) })

  const createList = async () => {
    if (!newListName.trim()) {
      toast.error(t('buyer.shoppingLists.notifications.nameRequired', 'Please enter a list name'))
      return
    }

    try {
      const { error } = await supabase
        .from('shopping_lists')
        .insert({ user_id: user.id, name: newListName.trim() })

      if (error) throw error
      invalidateLists()
      setNewListName('')
      setShowForm(false)
      toast.success(t('buyer.shoppingLists.notifications.listCreated', 'List created'))
    } catch (error) {
      logger.error('Error creating list:', error)
      toast.error(t('buyer.shoppingLists.notifications.createFailed', 'Failed to create list'))
    }
  }

  const deleteList = async (id) => {
    try {
      await supabase.from('shopping_list_items').delete().eq('list_id', id)
      await supabase.from('shopping_lists').delete().eq('id', id)
      invalidateLists()
      toast.success(t('buyer.shoppingLists.notifications.listDeleted', 'List deleted'))
    } catch {
      toast.error(t('buyer.shoppingLists.notifications.deleteFailed', 'Failed to delete list'))
    }
  }

  const addAllToCart = async (list) => {
    let addedCount = 0
    for (const item of (list.items || [])) {
      if (!item.product) continue
      const result = addItem({
        id: item.product_id,
        name: item.product.name,
        price_per_unit: item.product.price_per_unit,
        unit_type: item.product.unit_type,
        quantity: item.quantity || 1,
        min_order_quantity: 1,
        is_available: true,
        available_quantity: null,
        image_url: item.product.images?.[0]?.url,
      }, item.quantity || 1)
      if (result) addedCount++
    }
    if (addedCount > 0) {
      toast.success(t('buyer.shoppingLists.notifications.itemsAdded', '{{count}} item(s) added to cart', { count: addedCount }))
      navigate('/cart')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/marketplace')} className="p-2 hover:bg-gray-100 rounded-lg" aria-label={t('buyer.shoppingLists.backToMarketplace', 'Back to marketplace')}>
            <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <ClipboardDocumentListIcon className="w-7 h-7 text-purple-600" />
              {t('buyer.shoppingLists.title', 'Shopping Lists')}
            </h1>
            <p className="text-sm text-gray-500 mt-1">{t('buyer.shoppingLists.subtitle', 'Save and reuse your favorite orders')}</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-xl font-medium text-sm hover:bg-green-700"
        >
          <PlusIcon className="w-5 h-5" />
          {t('buyer.shoppingLists.newList', 'New List')}
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <Card className="p-4 mb-6 border-2 border-green-200 bg-green-50/30">
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createList()}
              placeholder={t('buyer.shoppingLists.placeholder', 'e.g., Weekly Vegetables')}
              className="input flex-1"
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
            />
            <button onClick={createList} className="p-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700">
              <CheckIcon className="w-5 h-5" />
            </button>
            <button onClick={() => setShowForm(false)} className="p-2.5 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200">
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </Card>
      )}

      {/* Lists */}
      {lists.length === 0 ? (
        <Card className="p-12 text-center">
          <ClipboardDocumentListIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('buyer.shoppingLists.emptyTitle', 'No shopping lists')}</h3>
          <p className="text-gray-500 mb-6">{t('buyer.shoppingLists.emptyDesc', 'Create lists for recurring orders to save time')}</p>
          <button onClick={() => setShowForm(true)} className="btn-primary inline-flex items-center gap-2">
            <PlusIcon className="w-5 h-5" />
            {t('buyer.shoppingLists.createFirst', 'Create Your First List')}
          </button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {lists.map(list => (
            <Card key={list.id} className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900 text-lg">{list.name}</h3>
                  <p className="text-xs text-gray-500">
                    {(list.items || []).length} {t('buyer.shoppingLists.itemCount', '{{count}} item(s)', { count: (list.items || []).length })}
                    {list.updated_at && ` · ${t('buyer.shoppingLists.updatedLabel', 'Updated')} ${new Date(list.updated_at).toLocaleDateString()}`}
                  </p>
                </div>
                <button
                  onClick={() => deleteList(list.id)}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  aria-label={t('buyer.shoppingLists.deleteAriaLabel', 'Delete list')}
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>

              {/* Items */}
              {(list.items || []).length > 0 && (
                <div className="space-y-2 mb-4">
                  {list.items.slice(0, 5).map(item => (
                    <div key={item.id} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700 truncate">{item.product?.name || t('buyer.shoppingLists.productFallback', 'Product')}</span>
                      <span className="text-gray-500 ml-2 flex-shrink-0">
                        × {item.quantity || 1}
                      </span>
                    </div>
                  ))}
                  {(list.items || []).length > 5 && (
                    <p className="text-xs text-gray-400">+{(list.items || []).length - 5} {t('buyer.shoppingLists.moreLabel', 'more')}</p>
                  )}
                </div>
              )}

              {/* Total */}
              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <span className="text-sm text-gray-500">
                  {t('buyer.shoppingLists.estLabel', 'Est.')} {formatPrice((list.items || []).reduce((sum, i) => sum + (i.product?.price_per_unit || 0) * (i.quantity || 1), 0))}
                </span>
                <button
                  onClick={() => addAllToCart(list)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
                >
                  <ShoppingCartIcon className="w-4 h-4" />
                  {t('buyer.shoppingLists.addAllToCart', 'Add All to Cart')}
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

export default ShoppingLists
