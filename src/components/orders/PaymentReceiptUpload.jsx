import { useEffect, useMemo, useState } from 'react'
import {
  ArrowTopRightOnSquareIcon,
  ArrowUpTrayIcon,
  CheckCircleIcon,
  ClockIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { Card, LoadingSpinner } from '@/components/ui'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/services/supabase'
import { notificationsApi } from '@/services/notifications'
import { emailService } from '@/services/emailService'
import smsService from '@/services/sms/smsService'
import { formatPrice } from '@/utils/currency'
import { logger } from '@/utils/logger'

const MAX_FILE_SIZE = 10 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']

const stageConfig = {
  first: {
    amountField: 'first_payment_amount',
    statusField: 'first_payment_status',
    receiptField: 'first_payment_receipt_url',
    paidAtField: 'first_payment_paid_at',
    title: 'رفع إيصال الدفعة الأولى',
    description: 'ارفع إيصال التحويل لبدء اعتماد الطلب من طرف البائع.',
    successMessage: 'تم رفع إيصال الدفعة الأولى وإشعار البائع بنجاح.',
    vendorMessage: 'تم رفع إيصال الدفعة الأولى',
  },
  second: {
    amountField: 'second_payment_amount',
    statusField: 'second_payment_status',
    receiptField: 'second_payment_receipt_url',
    paidAtField: 'second_payment_paid_at',
    title: 'رفع إيصال الدفعة الثانية',
    description: 'ارفع إيصال الدفعة النهائية لإغلاق الالتزام المالي على الطلب.',
    successMessage: 'تم رفع إيصال الدفعة الثانية وإشعار البائع بنجاح.',
    vendorMessage: 'تم رفع إيصال الدفعة الثانية',
  },
}

const PaymentReceiptUpload = ({ order, stage = 'first', onUploadComplete }) => {
  const { user } = useAuthStore()
  const [uploading, setUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState('')

  const config = stageConfig[stage] || stageConfig.first
  const amount = Number(order?.[config.amountField] || 0)
  const status = order?.[config.statusField] || 'pending'
  const receiptPath = order?.[config.receiptField] || ''

  const isVerified = status === 'verified'
  const isUploaded = Boolean(receiptPath)
  const canUpload = Boolean(user?.id && order?.buyer_id === user.id && amount > 0 && !isVerified)

  const statusMeta = useMemo(() => {
    if (isVerified) {
      return {
        label: 'تم التحقق من الإيصال',
        className: 'bg-green-100 text-green-800',
      }
    }

    if (status === 'paid') {
      return {
        label: 'بانتظار مراجعة البائع',
        className: 'bg-amber-100 text-amber-800',
      }
    }

    return {
      label: 'لم يتم رفع الإيصال بعد',
      className: 'bg-gray-100 text-gray-700',
    }
  }, [isVerified, status])

  useEffect(() => {
    let active = true

    const resolvePreviewUrl = async () => {
      if (!receiptPath) {
        if (active) setPreviewUrl('')
        return
      }

      if (receiptPath.startsWith('http')) {
        if (active) setPreviewUrl(receiptPath)
        return
      }

      const { data, error } = await supabase.storage
        .from('payment-receipts')
        .createSignedUrl(receiptPath, 60 * 60)

      if (error) {
        logger.error('Failed to resolve payment receipt preview URL:', error)
        return
      }

      if (active) {
        setPreviewUrl(data?.signedUrl || '')
      }
    }

    resolvePreviewUrl()

    return () => {
      active = false
    }
  }, [receiptPath])

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file || !canUpload) return

    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('نوع الملف غير مدعوم. استخدم صورة أو PDF فقط.')
      return
    }

    if (file.size > MAX_FILE_SIZE) {
      toast.error('حجم الملف يجب أن يكون أقل من 10MB.')
      return
    }

    setUploading(true)

    try {
      const fileExtension = file.name.split('.').pop() || 'jpg'
      const storagePath = `${user.id}/${order.id}/${stage}-${Date.now()}.${fileExtension}`

      const { error: uploadError } = await supabase.storage
        .from('payment-receipts')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type,
        })

      if (uploadError) throw uploadError

      const updatePayload = {
        [config.receiptField]: storagePath,
        [config.paidAtField]: new Date().toISOString(),
        [config.statusField]: 'paid',
      }

      const { data: updatedOrder, error: updateError } = await supabase
        .from('orders')
        .update(updatePayload)
        .eq('id', order.id)
        .eq('buyer_id', user.id)
        .select('*')
        .single()

      if (updateError) throw updateError

      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('payment-receipts')
        .createSignedUrl(storagePath, 60 * 60)

      if (!signedUrlError) {
        setPreviewUrl(signedUrlData?.signedUrl || '')
      }

      const { data: vendorProfile } = await supabase
        .from('profiles')
        .select('id, store_name, email, phone')
        .eq('id', order.vendor_id)
        .maybeSingle()

      if (vendorProfile?.id) {
        await notificationsApi.create({
          user_id: vendorProfile.id,
          title: 'إيصال دفع جديد بانتظار المراجعة',
          message: `${config.vendorMessage} للطلب #${order.order_number || order.id.slice(0, 8)}.`,
          type: 'payment_receipt',
          data: {
            order_id: order.id,
            payment_stage: stage,
            payment_type: order.payment_type,
          },
        })
      }

      if (vendorProfile?.email) {
        await emailService.sendEmail({
          to: vendorProfile.email,
          toName: vendorProfile.store_name || 'Vendor',
          subject: `إيصال دفع جديد للطلب #${order.order_number || order.id.slice(0, 8)}`,
          template: 'payment_receipt_review',
          data: {
            message: `${config.vendorMessage} بقيمة ${formatPrice(amount)}. الرجاء مراجعة الطلب داخل لوحة البائع.`,
          },
        })
      }

      if (vendorProfile?.phone) {
        try {
          await smsService.sendVendorNotification(
            vendorProfile.phone,
            `${config.vendorMessage} للطلب #${order.order_number || order.id.slice(0, 8)} بقيمة ${formatPrice(amount)}`
          )
        } catch (smsError) {
          logger.warn('Payment receipt SMS notification failed:', smsError)
        }
      }

      toast.success(config.successMessage)
      onUploadComplete?.({ ...order, ...updatedOrder })
    } catch (error) {
      logger.error('Payment receipt upload failed:', error)
      toast.error(error.message || 'تعذر رفع الإيصال حالياً.')
    } finally {
      setUploading(false)
    }
  }

  if (amount <= 0) {
    return null
  }

  return (
    <Card className="p-5 bg-white">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <DocumentTextIcon className="h-5 w-5 text-gray-600" />
            <h3 className="font-semibold text-gray-900">{config.title}</h3>
          </div>
          <p className="text-sm leading-6 text-gray-600">{config.description}</p>
        </div>

        <span className={`inline-flex self-start rounded-full px-3 py-1 text-xs font-semibold ${statusMeta.className}`}>
          {statusMeta.label}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
          <p className="text-xs text-gray-500 mb-1">المبلغ المطلوب</p>
          <p className="font-semibold text-gray-900">{formatPrice(amount)}</p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
          <p className="text-xs text-gray-500 mb-1">طريقة الدفع</p>
          <p className="font-semibold text-gray-900">{order.payment_type === 'split' ? 'تحويل مرحلي' : 'تحويل بنكي'}</p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
          <p className="text-xs text-gray-500 mb-1">الحالة الحالية</p>
          <p className="font-semibold text-gray-900">{status === 'paid' ? 'تم الرفع وبانتظار المراجعة' : isVerified ? 'تم التحقق' : 'قيد الانتظار'}</p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-4">
        <div className="flex items-start gap-3">
          <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 shrink-0 text-orange-600" />
          <div className="space-y-1 text-sm text-orange-900">
            <p className="font-semibold">تنبيه مهم</p>
            <p>احفظ الإيصال واضحاً ومقروءاً. سيتم استخدامه كمرجع إثبات في حالات النزاع أو التحصيل.</p>
            <p>بعد الرفع، يُخطر البائع تلقائياً عبر الإشعارات والبريد الإلكتروني وSMS عند توفره.</p>
          </div>
        </div>
      </div>

      {previewUrl && (
        <div className="mt-4 rounded-2xl border border-green-200 bg-green-50 px-4 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-green-800">
              <CheckCircleIcon className="h-5 w-5" />
              <span className="font-medium">تم حفظ الإيصال على الطلب</span>
            </div>

            <a
              href={previewUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium text-green-700 hover:text-green-800"
            >
              عرض الإيصال
              <ArrowTopRightOnSquareIcon className="h-4 w-4" />
            </a>
          </div>
        </div>
      )}

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <ClockIcon className="h-4 w-4" />
          <span>يتم تحديث حالة الإيصال فور الرفع، ثم يراجعها البائع داخل صفحة الطلب.</span>
        </div>

        {canUpload && (
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700">
            {uploading ? <LoadingSpinner size="sm" /> : <ArrowUpTrayIcon className="h-4 w-4" />}
            {uploading ? 'جاري الرفع...' : isUploaded ? 'استبدال الإيصال' : 'رفع الإيصال'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={handleFileUpload}
              className="hidden"
              disabled={uploading}
            />
          </label>
        )}
      </div>
    </Card>
  )
}

export default PaymentReceiptUpload