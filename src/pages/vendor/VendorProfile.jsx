/**
 * صفحة بروفايل بائع عامة مع إخفاء بيانات التواصل حتى تأكيد الطلب.
 * افتراض: هذه الصفحة للاطلاع العام، وليست صفحة /vendor/profile الداخلية للبائع.
 */

import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Card, LoadingSpinner } from '@/components/ui'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/services/supabase'
import storeTypeService from '@/services/storeTypeService'

const VendorProfilePublic = () => {
  const { id } = useParams()
  const { user } = useAuthStore()

  const [loading, setLoading] = useState(true)
  const [vendor, setVendor] = useState(null)
  const [canSeeContact, setCanSeeContact] = useState(false)

  useEffect(() => {
    const load = async () => {
      setLoading(true)

      const { data: vendorData } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, store_name, city, phone, email, rating, store_type, delivery_option, active_products_count, preferred_driver_id, partnership_status')
        .eq('id', id)
        .eq('role', 'vendor')
        .single()

      setVendor(vendorData || null)

      if (!user?.id || !vendorData?.id) {
        setCanSeeContact(false)
        setLoading(false)
        return
      }

      const { data: confirmedOrder } = await supabase
        .from('orders')
        .select('id')
        .eq('buyer_id', user.id)
        .eq('vendor_id', vendorData.id)
        .in('status', ['confirmed', 'preparing', 'shipped', 'payment_received', 'delivered'])
        .limit(1)
        .maybeSingle()

      setCanSeeContact(Boolean(confirmedOrder?.id) || user.id === vendorData.id)
      setLoading(false)
    }

    load()
  }, [id, user?.id])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!vendor) {
    return <div className="p-8 text-center text-gray-500">البائع غير موجود</div>
  }

  const vendorSetup = storeTypeService.decorateStoreProfile(vendor)

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-4">
      <Card className="p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{vendor.store_name || `${vendor.first_name} ${vendor.last_name}`}</h1>
        <p className="text-gray-500">المدينة: {vendor.city || 'غير محددة'}</p>
        <p className="text-gray-500">التقييم: {(vendor.rating || 0).toFixed(1)}</p>

        {vendorSetup && (
          <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="inline-flex rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                {vendorSetup.storeTypeLabel}
              </span>
              <span className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
                {vendorSetup.deliveryOptionMeta?.label}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3 text-sm">
              <div>
                <p className="text-gray-500 mb-1">المنتجات النشطة</p>
                <p className="font-semibold text-gray-900">{vendorSetup.activeProductsCountLabel}</p>
              </div>
              <div>
                <p className="text-gray-500 mb-1">خيار التوصيل</p>
                <p className="font-semibold text-gray-900">{vendorSetup.deliveryOptionMeta?.label}</p>
              </div>
              <div>
                <p className="text-gray-500 mb-1">التقدم</p>
                <p className="font-semibold text-gray-900">{vendorSetup.progress.percentage}%</p>
              </div>
            </div>

            <div className="h-2 rounded-full bg-gray-200 overflow-hidden mb-2">
              <div
                className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-600"
                style={{ width: `${vendorSetup.progress.percentage}%` }}
              />
            </div>
            <p className="text-xs text-gray-600 leading-6">{vendorSetup.progress.headline}</p>
          </div>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">بيانات التواصل</h2>

        {canSeeContact ? (
          <div className="space-y-1 text-gray-700">
            <p>الهاتف: {vendor.phone || 'غير متوفر'}</p>
            <p>البريد الإلكتروني: {vendor.email || 'غير متوفر'}</p>
          </div>
        ) : (
          <p className="text-sm text-gray-600">🔒 بيانات الاتصال تظهر بعد تأكيد الطلب</p>
        )}
      </Card>
    </div>
  )
}

export default VendorProfilePublic
