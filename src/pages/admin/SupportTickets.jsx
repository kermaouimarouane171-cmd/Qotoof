import { useEffect, useState } from 'react'
import { supabase } from '@/services/supabase'
import { Card, LoadingSpinner } from '@/components/ui'
import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { logger } from '@/utils/logger'

const STATUS_OPTIONS = ['open', 'in_progress', 'resolved', 'closed']

const AdminSupportTickets = () => {
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState(null)
  const [tickets, setTickets] = useState([])
  const [statusFilter, setStatusFilter] = useState('all')

  const loadTickets = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('support_tickets')
        .select('id, user_id, subject, description, status, priority, created_at, updated_at, admin_response')
        .order('created_at', { ascending: false })

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }

      const { data, error } = await query
      if (error) throw error
      setTickets(data || [])
    } catch (error) {
      logger.error('Error loading support tickets:', error)
      toast.error('تعذر تحميل تذاكر الدعم')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTickets()
  }, [statusFilter])

  const updateTicket = async (ticketId, updates) => {
    setSavingId(ticketId)
    try {
      const { error } = await supabase
        .from('support_tickets')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', ticketId)

      if (error) throw error
      toast.success('تم تحديث التذكرة')
      await loadTickets()
    } catch (error) {
      logger.error('Error updating support ticket:', error)
      toast.error('تعذر تحديث التذكرة')
    } finally {
      setSavingId(null)
    }
  }

  if (loading) {
    return <LoadingSpinner size="lg" />
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <ChatBubbleLeftRightIcon className="w-6 h-6 text-blue-600" />
          لوحة تذاكر الدعم
        </h1>

        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="input w-48"
        >
          <option value="all">كل الحالات</option>
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>
      </div>

      <Card className="overflow-hidden">
        {tickets.length === 0 ? (
          <div className="p-10 text-center text-gray-500">لا توجد تذاكر ضمن هذا الفلتر.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>الموضوع</th>
                  <th>الحالة</th>
                  <th>الأولوية</th>
                  <th>تاريخ الإنشاء</th>
                  <th>رد الإدارة</th>
                  <th>إجراء</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket) => (
                  <tr key={ticket.id}>
                    <td>
                      <div>
                        <p className="font-semibold text-gray-900">{ticket.subject || 'بدون عنوان'}</p>
                        <p className="text-xs text-gray-500 line-clamp-2">{ticket.description || 'لا يوجد وصف'}</p>
                      </div>
                    </td>
                    <td>
                      <select
                        className="input min-w-[140px]"
                        value={ticket.status || 'open'}
                        onChange={(event) => updateTicket(ticket.id, { status: event.target.value })}
                        disabled={savingId === ticket.id}
                      >
                        {STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                    </td>
                    <td>{ticket.priority || 'normal'}</td>
                    <td>{new Date(ticket.created_at).toLocaleString('ar-MA')}</td>
                    <td>
                      <textarea
                        defaultValue={ticket.admin_response || ''}
                        rows="2"
                        className="input min-w-[260px]"
                        placeholder="اكتب رد الإدارة..."
                        onBlur={(event) => {
                          const response = event.target.value.trim()
                          if (response !== (ticket.admin_response || '')) {
                            updateTicket(ticket.id, { admin_response: response || null })
                          }
                        }}
                        disabled={savingId === ticket.id}
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn-outline"
                        onClick={() => updateTicket(ticket.id, { status: 'resolved' })}
                        disabled={savingId === ticket.id}
                      >
                        حلّ التذكرة
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

export default AdminSupportTickets