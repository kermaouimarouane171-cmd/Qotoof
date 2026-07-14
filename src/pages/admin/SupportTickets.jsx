import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/services/supabase'
import { Card, LoadingSpinner } from '@/components/ui'
import {
  ChatBubbleLeftRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowPathIcon,
  UserIcon,
  ClockIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { logger } from '@/utils/logger'

const PAGE_SIZE = 20

const STATUS_OPTIONS = ['open', 'in_progress', 'resolved', 'closed']

const STATUS_STYLE = {
  open:        'bg-red-100 text-red-700',
  in_progress: 'bg-amber-100 text-amber-700',
  resolved:    'bg-green-100 text-green-700',
  closed:      'bg-gray-100 text-gray-600',
}

const PRIORITY_STYLE = {
  low:    'bg-gray-100 text-gray-600',
  normal: 'bg-blue-100 text-blue-700',
  high:   'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
}

const timeAgo = (dateStr) => {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

const AdminSupportTickets = () => {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState(null)
  const [tickets, setTickets] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('all')

  const loadTickets = useCallback(async (pageNum = 1, status = statusFilter) => {
    setLoading(true)
    try {
      const from = (pageNum - 1) * PAGE_SIZE
      const to = from + PAGE_SIZE - 1

      let query = supabase
        .from('support_tickets')
        .select(`
          id,
          user_id,
          subject,
          description,
          status,
          priority,
          created_at,
          updated_at,
          user:profiles!support_tickets_user_id_fkey(id, first_name, last_name, email, avatar_url)
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to)

      if (status !== 'all') {
        query = query.eq('status', status)
      }

      const { data, error, count } = await query
      if (error) throw error
      setTickets(data || [])
      setTotalCount(count || 0)
      setPage(pageNum)
    } catch (error) {
      logger.error('Error loading support tickets:', error)
      toast.error(t('admin.supportTickets.loadFailed', 'Failed to load support tickets'))
    } finally {
      setLoading(false)
    }
  }, [statusFilter, t])

  useEffect(() => {
    loadTickets(1, statusFilter)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter])

  const updateTicket = async (ticketId, updates) => {
    setSavingId(ticketId)
    try {
      const { error } = await supabase
        .from('support_tickets')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', ticketId)

      if (error) throw error
      toast.success(t('admin.supportTickets.updateSuccess', 'Ticket updated'))
      await loadTickets(page, statusFilter)
    } catch (error) {
      logger.error('Error updating support ticket:', error)
      toast.error(t('admin.supportTickets.updateFailed', 'Failed to update ticket'))
    } finally {
      setSavingId(null)
    }
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  const getStatusLabel = (status) => {
    const map = {
      open:        t('admin.supportTickets.status.open', 'Open'),
      in_progress: t('admin.supportTickets.status.inProgress', 'In Progress'),
      resolved:    t('admin.supportTickets.status.resolved', 'Resolved'),
      closed:      t('admin.supportTickets.status.closed', 'Closed'),
    }
    return map[status] || status
  }

  const getPriorityLabel = (priority) => {
    const map = {
      low:    t('admin.supportTickets.priority.low', 'Low'),
      normal: t('admin.supportTickets.priority.normal', 'Normal'),
      high:   t('admin.supportTickets.priority.high', 'High'),
      urgent: t('admin.supportTickets.priority.urgent', 'Urgent'),
    }
    return map[priority] || priority
  }

  const statusCounts = STATUS_OPTIONS.reduce((acc, s) => {
    acc[s] = tickets.filter(tk => tk.status === s).length
    return acc
  }, {})

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ChatBubbleLeftRightIcon className="w-6 h-6 text-blue-600" />
            {t('admin.supportTickets.title', 'Support Tickets')}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {t('admin.supportTickets.total', '{{count}} total tickets', { count: totalCount })}
          </p>
        </div>
        <button
          onClick={() => loadTickets(page, statusFilter)}
          className="btn-outline text-sm flex items-center gap-2"
        >
          <ArrowPathIcon className="w-4 h-4" />
          {t('common.refresh', 'Refresh')}
        </button>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setStatusFilter('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            statusFilter === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {t('admin.supportTickets.filterAll', 'All')} ({totalCount})
        </button>
        {STATUS_OPTIONS.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === s
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {getStatusLabel(s)}
            {statusFilter === 'all' && statusCounts[s] > 0 && (
              <span className="ml-1.5 text-xs opacity-75">({statusCounts[s]})</span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : tickets.length === 0 ? (
          <div className="p-12 text-center">
            <ChatBubbleLeftRightIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">{t('admin.supportTickets.empty', 'No tickets match this filter.')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('admin.supportTickets.col.user', 'User')}</th>
                  <th>{t('admin.supportTickets.col.subject', 'Subject')}</th>
                  <th>{t('admin.supportTickets.col.priority', 'Priority')}</th>
                  <th>{t('admin.supportTickets.col.status', 'Status')}</th>
                  <th>{t('admin.supportTickets.col.created', 'Created')}</th>
                  <th>{t('admin.supportTickets.col.actions', 'Actions')}</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket) => {
                  const user = ticket.user
                  const userName = user
                    ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email
                    : ticket.user_id?.slice(0, 8)
                  return (
                    <tr key={ticket.id}>
                      {/* User */}
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                            {user?.avatar_url ? (
                              <img src={user.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                            ) : (
                              <UserIcon className="w-4 h-4 text-gray-500" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{userName || t('common.unknown', 'Unknown')}</p>
                            {user?.email && (
                              <p className="text-xs text-gray-500 truncate">{user.email}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Subject */}
                      <td>
                        <p className="font-medium text-gray-900 text-sm">
                          {ticket.subject || t('admin.supportTickets.noSubject', 'No subject')}
                        </p>
                        {ticket.description && (
                          <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">{ticket.description}</p>
                        )}
                      </td>

                      {/* Priority */}
                      <td>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${PRIORITY_STYLE[ticket.priority] || PRIORITY_STYLE.normal}`}>
                          {getPriorityLabel(ticket.priority || 'normal')}
                        </span>
                      </td>

                      {/* Status */}
                      <td>
                        <select
                          className={`text-xs font-medium rounded-full px-2 py-1 border-0 cursor-pointer ${STATUS_STYLE[ticket.status] || STATUS_STYLE.open}`}
                          value={ticket.status || 'open'}
                          onChange={(e) => updateTicket(ticket.id, { status: e.target.value })}
                          disabled={savingId === ticket.id}
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>{getStatusLabel(s)}</option>
                          ))}
                        </select>
                      </td>

                      {/* Created */}
                      <td>
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <ClockIcon className="w-3 h-3" />
                          {timeAgo(ticket.created_at)}
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(ticket.created_at).toLocaleDateString()}
                        </p>
                      </td>

                      {/* Actions */}
                      <td>
                        {ticket.status !== 'resolved' && ticket.status !== 'closed' && (
                          <button
                            type="button"
                            className="flex items-center gap-1 text-xs text-green-700 bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                            onClick={() => updateTicket(ticket.id, { status: 'resolved' })}
                            disabled={savingId === ticket.id}
                          >
                            <CheckCircleIcon className="w-3.5 h-3.5" />
                            {t('admin.supportTickets.resolve', 'Resolve')}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">
            {t('admin.supportTickets.pageInfo', 'Page {{page}} of {{total}}', { page, total: totalPages })}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => loadTickets(page - 1, statusFilter)}
              disabled={page === 1}
              className="btn-outline text-sm flex items-center gap-1 disabled:opacity-40"
            >
              <ChevronLeftIcon className="w-4 h-4" />
              {t('common.previous', 'Previous')}
            </button>
            <button
              onClick={() => loadTickets(page + 1, statusFilter)}
              disabled={page === totalPages}
              className="btn-outline text-sm flex items-center gap-1 disabled:opacity-40"
            >
              {t('common.next', 'Next')}
              <ChevronRightIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminSupportTickets