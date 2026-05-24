import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  CameraIcon,
  CheckCircleIcon,
  ClockIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { Card, LoadingSpinner } from '@/components/ui'
import LegalCamera from '@/components/shared/LegalCamera'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/services/supabase'
import {
  getConditionStageSummary,
  getOrderConditionPhotos,
  getProductConditionStageLabel,
  PRODUCT_CONDITION_STAGE_ORDER,
  PRODUCT_CONDITION_STAGES,
  saveProductConditionCapture,
} from '@/services/legalCameraService'
import { logger } from '@/utils/logger'

const resolveActorRole = ({ order, userId, profileRole }) => {
  if (profileRole === 'admin') return 'admin'
  if (order?.vendor_id === userId) return 'vendor'
  if (order?.buyer_id === userId) return 'buyer'
  if (order?.driver_id === userId || order?.preferred_driver_id === userId) return 'driver'
  return null
}

const ProductConditionPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user, profile } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [order, setOrder] = useState(null)
  const [delivery, setDelivery] = useState(null)
  const [photos, setPhotos] = useState([])
  const [actorRole, setActorRole] = useState(null)
  const [activeStage, setActiveStage] = useState('')
  const [notes, setNotes] = useState('')

  const requestedStage = searchParams.get('stage')
  const nextPath = searchParams.get('next')

  const loadConditionCase = useCallback(async () => {
    if (!user?.id) {
      navigate('/login', { state: { from: `/orders/${id}/condition` } })
      return
    }

    try {
      setLoading(true)

      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          status,
          legal_capture_required,
          legal_capture_completed,
          buyer_id,
          vendor_id,
          driver_id,
          preferred_driver_id,
          buyer:profiles!orders_buyer_id_fkey(id, first_name, last_name, phone),
          vendor:profiles!orders_vendor_id_fkey(id, first_name, last_name, store_name, phone),
          driver:profiles!orders_driver_id_fkey(id, first_name, last_name, phone)
        `)
        .eq('id', id)
        .single()

      if (orderError) throw orderError

      const resolvedRole = resolveActorRole({
        order: orderData,
        userId: user.id,
        profileRole: profile?.role,
      })

      if (!resolvedRole) {
        navigate('/unauthorized')
        return
      }

      const { data: deliveryData, error: deliveryError } = await supabase
        .from('deliveries')
        .select('id, status, delivery_number, driver_id, order_id')
        .eq('order_id', id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (deliveryError && deliveryError.code !== 'PGRST116') {
        throw deliveryError
      }

      const conditionPhotos = await getOrderConditionPhotos(id)

      setOrder(orderData)
      setDelivery(deliveryData || null)
      setPhotos(conditionPhotos)
      setActorRole(resolvedRole)
    } catch (error) {
      logger.error('Failed to load product condition case:', error)
      toast.error('تعذر تحميل سجل حالة المنتج حالياً')
      navigate(`/orders/${id}`)
    } finally {
      setLoading(false)
    }
  }, [id, navigate, profile?.role, user?.id])

  useEffect(() => {
    loadConditionCase()
  }, [loadConditionCase])

  const allowedStages = useMemo(() => {
    if (!actorRole) return []
    return PRODUCT_CONDITION_STAGE_ORDER.filter((stage) => PRODUCT_CONDITION_STAGES[stage].allowedRoles.includes(actorRole))
  }, [actorRole])

  useEffect(() => {
    if (!allowedStages.length) return

    const nextStage = allowedStages.includes(requestedStage)
      ? requestedStage
      : allowedStages[0]

    setActiveStage((currentStage) => currentStage || nextStage)
  }, [allowedStages, requestedStage])

  const summary = useMemo(() => getConditionStageSummary(photos), [photos])

  const handleSaveCapture = async (payload) => {
    if (!order || !actorRole || !activeStage) return

    setSaving(true)
    try {
      const savedPhoto = await saveProductConditionCapture({
        orderId: order.id,
        deliveryId: delivery?.id || null,
        vendorId: order.vendor_id,
        driverId: delivery?.driver_id || order.driver_id || order.preferred_driver_id || null,
        buyerId: order.buyer_id,
        capturedBy: user.id,
        actorRole,
        captureStage: activeStage,
        blob: payload.blob,
        capturedAt: payload.capturedAt,
        latitude: payload.latitude,
        longitude: payload.longitude,
        address: payload.address,
        watermarkText: payload.watermarkLines,
        notes,
        metadata: payload.metadata,
      })

      setPhotos((currentPhotos) => [savedPhoto, ...currentPhotos])
      setNotes('')
      toast.success(`تم حفظ ${getProductConditionStageLabel(activeStage)} بنجاح`)

      if (nextPath) {
        window.setTimeout(() => navigate(nextPath), 700)
      }
    } catch (error) {
      logger.error('Failed to save product condition capture:', error)
      toast.error(error.message || 'تعذر حفظ الصورة القانونية')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!order) return null

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-gray-100">
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">سجل حالة المنتج</h1>
            <p className="text-gray-500 mt-1">الطلب #{order.order_number || order.id.slice(0, 8)}</p>
          </div>
        </div>

        <button type="button" onClick={loadConditionCase} className="btn-outline inline-flex items-center gap-2">
          <ArrowPathIcon className="h-4 w-4" />
          تحديث السجل
        </button>
      </div>

      <Card className="p-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${order.legal_capture_completed ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
            {order.legal_capture_completed ? 'السجل القانوني مكتمل' : 'السجل القانوني غير مكتمل'}
          </span>
          {delivery?.delivery_number ? (
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
              {delivery.delivery_number}
            </span>
          ) : null}
        </div>
        <p className="mt-3 text-sm leading-6 text-gray-600">
          يجب توثيق كل مرحلة بصورة مباشرة من الكاميرا مع توقيت وموقع مائيين. يستطيع كل طرف رؤية الصور المرتبطة بالطلب واستخدامها في المراجعة أو النزاع.
        </p>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <Card className="p-5">
          <h2 className="font-semibold text-gray-900 mb-4">مراحل التوثيق</h2>
          <div className="space-y-3">
            {PRODUCT_CONDITION_STAGE_ORDER.map((stage) => {
              const stageConfig = PRODUCT_CONDITION_STAGES[stage]
              const stageSummary = summary[stage]
              const allowed = stageConfig.allowedRoles.includes(actorRole)
              const active = activeStage === stage

              return (
                <button
                  key={stage}
                  type="button"
                  onClick={() => allowed && setActiveStage(stage)}
                  disabled={!allowed}
                  className={`w-full rounded-2xl border px-4 py-4 text-left transition-colors ${active ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-white'} ${allowed ? 'hover:border-green-300' : 'opacity-60 cursor-not-allowed'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-gray-900">{stageConfig.label}</p>
                      <p className="text-xs text-gray-500 mt-1 leading-5">{stageConfig.description}</p>
                    </div>
                    {stageSummary?.exists ? (
                      <CheckCircleIcon className="h-5 w-5 text-green-600" />
                    ) : (
                      <ClockIcon className="h-5 w-5 text-amber-600" />
                    )}
                  </div>
                  <p className="mt-3 text-xs text-gray-500">
                    {allowed ? 'يمكنك التوثيق في هذه المرحلة.' : 'هذه المرحلة مخصصة لطرف آخر.'}
                  </p>
                </button>
              )
            })}
          </div>
        </Card>

        <div className="space-y-6">
          {activeStage && PRODUCT_CONDITION_STAGES[activeStage]?.allowedRoles.includes(actorRole) ? (
            <Card className="p-6">
              <div className="mb-5">
                <h2 className="text-lg font-semibold text-gray-900">{getProductConditionStageLabel(activeStage)}</h2>
                <p className="text-sm text-gray-500 mt-1">{PRODUCT_CONDITION_STAGES[activeStage].description}</p>
              </div>

              <div className="mb-5">
                {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
                <label className="input-label">ملاحظات إضافية</label>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  className="input min-h-24 resize-y"
                  placeholder="دوّن ملاحظات مختصرة عن حالة الحمولة أو أي فرق ظاهر."
                />
              </div>

              <LegalCamera
                orderNumber={order.order_number || order.id.slice(0, 8)}
                captureStage={activeStage}
                actorRole={actorRole}
                onCapture={handleSaveCapture}
                submitting={saving}
              />
            </Card>
          ) : (
            <Card className="p-6">
              <div className="flex items-start gap-3">
                <CameraIcon className="h-5 w-5 text-slate-500 mt-0.5" />
                <div>
                  <h2 className="font-semibold text-slate-900">عرض فقط</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    المرحلة المحددة ليست ضمن صلاحيات دورك الحالي، لكن يمكنك الاطلاع على الصور القانونية المسجلة أدناه.
                  </p>
                </div>
              </div>
            </Card>
          )}

          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">الصور القانونية المسجلة</h2>
            {photos.length === 0 ? (
              <p className="text-sm text-gray-500">لا توجد صور قانونية مسجلة لهذا الطلب بعد.</p>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {photos.map((photo) => (
                  <div key={photo.id} className="rounded-2xl border border-gray-200 overflow-hidden bg-white">
                    {photo.signed_url ? (
                      <img src={photo.signed_url} alt={photo.capture_stage} className="aspect-video w-full object-cover" />
                    ) : null}
                    <div className="p-4">
                      <p className="font-semibold text-gray-900">{getProductConditionStageLabel(photo.capture_stage)}</p>
                      <p className="text-xs text-gray-500 mt-1">{new Date(photo.captured_at).toLocaleString('ar-MA')}</p>
                      {photo.captured_address ? <p className="text-xs text-gray-500 mt-2 leading-5">{photo.captured_address}</p> : null}
                      {photo.notes ? <p className="text-sm text-gray-700 mt-3 leading-6">{photo.notes}</p> : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}

export default ProductConditionPage
