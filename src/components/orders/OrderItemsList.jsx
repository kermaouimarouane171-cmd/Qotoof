import { useTranslation } from 'react-i18next'
import { ShoppingBagIcon, TagIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline'
import { StarIcon as StarSolid } from '@heroicons/react/24/solid'
import { Card, OptimizedImage } from '@/components/ui'
import { formatPrice } from '@/utils/currency'

/**
 * OrderItemsList
 *
 * Displays the list of order items with optional per-item notes,
 * plus the financial summary (subtotal, fees, total, commissions).
 *
 * Props:
 *  items                   – order.items array
 *  expandedProductNotes    – { [itemId]: boolean }
 *  productNotes            – { [itemId]: string }
 *  onToggleNote            – (itemId) => void
 *  onNoteChange            – (itemId, text) => void
 *  onRateProduct           – (item) => void
 *  canRate                 – boolean
 *  subtotal                – number
 *  platformFee             – number
 *  shippingCost            – number
 *  commission              – number (vendor commission)
 *  driverCommission        – number
 *  vendorAmount            – number
 *  total                   – number
 */
export default function OrderItemsList({
  items = [],
  expandedProductNotes = {},
  productNotes = {},
  onToggleNote,
  onNoteChange,
  onRateProduct,
  canRate,
  subtotal,
  platformFee,
  shippingCost,
  commission,
  driverCommission,
  vendorAmount,
  total,
}) {
  const { t } = useTranslation()

  return (
    <Card className="bg-white mb-6 overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-gray-100">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
          <TagIcon className="w-5 h-5 text-green-600" />
          {t('orderDetail.orderItems', 'Order Items')}
          <span className="ml-auto text-sm text-gray-500 font-normal">
            {items.length} {t('orderDetail.items', 'items')}
          </span>
        </h2>
      </div>

      <div className="divide-y divide-gray-100">
        {items.map((item) => {
          const productImage = item.product?.images?.[0]?.url || item.product?.image_url
          const productName = item.product?.name || t('orderDetail.unknownProduct', 'Unknown Product')
          const itemTotal = item.quantity * item.unit_price
          const isExpanded = expandedProductNotes[item.id]

          return (
            <div key={item.id} className="p-4 sm:p-5 hover:bg-gray-50 transition-colors">
              <div className="flex gap-3 sm:gap-4">
                {/* Product Image */}
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                  {productImage ? (
                    <OptimizedImage
                      src={productImage}
                      alt={productName}
                      className="w-full h-full"
                      placeholder="blur"
                      objectFit="cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ShoppingBagIcon className="w-6 h-6 text-gray-300" />
                    </div>
                  )}
                </div>

                {/* Product Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-gray-900 text-sm sm:text-base truncate">
                        {productName}
                      </h3>
                      {item.product?.unit && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          {t('orderDetail.pricePerUnit', '{{price}} / {{unit}}', {
                            price: formatPrice(item.unit_price),
                            unit: item.product.unit,
                          })}
                        </p>
                      )}
                    </div>
                    <p className="font-bold text-gray-900 text-sm sm:text-base flex-shrink-0">
                      {formatPrice(itemTotal)}
                    </p>
                  </div>

                  {/* Quantity & Price Details */}
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                    <span>{t('orderDetail.quantity', 'Qty')}: {item.quantity}</span>
                    <span>{formatPrice(item.unit_price)} {t('common.each', 'each')}</span>
                  </div>

                  {/* Product Actions */}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {canRate && (
                      <button
                        onClick={() => onRateProduct?.(item)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg hover:bg-yellow-100 transition-colors min-h-[40px]"
                      >
                        <StarSolid className="w-3.5 h-3.5 text-yellow-500" />
                        {t('orderDetail.actions.rateProduct', 'Rate')}
                      </button>
                    )}
                    <button
                      onClick={() => onToggleNote?.(item.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors min-h-[40px]"
                    >
                      {isExpanded ? (
                        <ChevronUpIcon className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDownIcon className="w-3.5 h-3.5" />
                      )}
                      {isExpanded
                        ? t('orderDetail.actions.hideNote', 'Hide Note')
                        : t('orderDetail.actions.addNote', 'Add Note')}
                    </button>
                  </div>

                  {/* Product Note Input */}
                  {isExpanded && (
                    <div className="mt-3">
                      <textarea
                        value={productNotes[item.id] || ''}
                        onChange={(e) => onNoteChange?.(item.id, e.target.value)}
                        placeholder={t('orderDetail.productNotePlaceholder', 'Add a note about this product...')}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                        rows={2}
                        maxLength={500}
                      />
                      <p className="text-xs text-gray-400 mt-1 text-right">
                        {(productNotes[item.id] || '').length}/500
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Financial Summary */}
      <div className="p-4 sm:p-5 bg-gray-50 border-t border-gray-100">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">{t('orderDetail.subtotal', 'Subtotal')}</span>
            <span className="font-medium text-gray-900">{formatPrice(subtotal)}</span>
          </div>

          {platformFee > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">{t('orderDetail.platformFee', 'Platform Fee')}</span>
              <span className="font-medium text-gray-900">{formatPrice(platformFee)}</span>
            </div>
          )}

          {shippingCost > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">{t('orderDetail.shipping', 'Shipping')}</span>
              <span className="font-medium text-gray-900">{formatPrice(shippingCost)}</span>
            </div>
          )}

          {commission > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">{t('orderDetail.vendorCommission', 'Vendor Commission')}</span>
              <span className="font-medium text-red-600">- {formatPrice(commission)}</span>
            </div>
          )}

          {driverCommission > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">{t('orderDetail.driverCommission', 'Driver Commission')}</span>
              <span className="font-medium text-red-600">- {formatPrice(driverCommission)}</span>
            </div>
          )}

          <div className="flex justify-between text-base font-bold border-t border-gray-200 pt-3 mt-3">
            <span className="text-gray-900">{t('orderDetail.totalPaid', 'Total Paid')}</span>
            <span className="text-green-600">{formatPrice(total)}</span>
          </div>

          {vendorAmount > 0 && (
            <div className="flex justify-between text-sm pt-1">
              <span className="text-gray-500 italic">{t('orderDetail.vendorReceives', 'Vendor Receives')}</span>
              <span className="font-semibold text-green-600">{formatPrice(vendorAmount)}</span>
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
