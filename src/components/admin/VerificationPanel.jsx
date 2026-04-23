/**
 * لوحة تحقق الإدارة للبائعين والسائقين.
 * تعرض حسابات pending وتسمح بالموافقة أو الرفض مباشرة.
 */

import { useEffect, useState } from 'react'
import { supabase } from '@/services/supabase'
import { Card, Button, LoadingSpinner } from '@/components/ui'
import toast from 'react-hot-toast'

const VerificationPanel = () => {
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState([])
  const [processingId, setProcessingId] = useState(null)

  const loadPending = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, phone, role, verification_status, created_at')
      .in('role', ['vendor', 'driver'])
      .eq('verification_status', 'pending')
      .order('created_at', { ascending: true })

    if (error) {
      toast.error('تعذر تحميل طلبات التحقق')
      setRows([])
    } else {
      setRows(data || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    loadPending()
  }, [])

  const updateVerification = async (id, action) => {
    setProcessingId(id)

    const nextStatus = action === 'approve' ? 'verified' : 'rejected'
    const nextActive = action === 'approve'

    const { error } = await supabase
      .from('profiles')
      .update({
        verification_status: nextStatus,
        is_active: nextActive,
      })
      .eq('id', id)

    if (error) {
      toast.error('فشل تحديث حالة التحقق')
    } else {
      toast.success(action === 'approve' ? 'تمت الموافقة بنجاح' : 'تم الرفض بنجاح')
      setRows((prev) => prev.filter((item) => item.id !== id))
    }

    setProcessingId(null)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">لوحة التحقق من الحسابات</h1>
        <p className="text-gray-500 mt-1">طلبات التحقق المعلقة للبائعين والسائقين</p>
      </div>

      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="py-12 flex items-center justify-center">
            <LoadingSpinner size="lg" />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-gray-500">لا توجد طلبات تحقق معلقة حالياً</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {rows.map((item) => (
              <div key={item.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <p className="font-semibold text-gray-900">
                    {item.first_name} {item.last_name}
                  </p>
                  <p className="text-sm text-gray-600">{item.phone || 'بدون رقم هاتف'}</p>
                  <p className="text-xs mt-1 text-gray-500">
                    {item.role === 'vendor' ? 'بائع' : 'سائق'} - قيد المراجعة
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="primary"
                    disabled={processingId === item.id}
                    onClick={() => updateVerification(item.id, 'approve')}
                  >
                    {processingId === item.id ? 'جاري التنفيذ...' : 'Approve'}
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    disabled={processingId === item.id}
                    onClick={() => updateVerification(item.id, 'reject')}
                  >
                    {processingId === item.id ? 'جاري التنفيذ...' : 'Reject'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

export default VerificationPanel
