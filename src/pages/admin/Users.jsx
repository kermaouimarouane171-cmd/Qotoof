import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { Button, Input, LoadingSpinner, Modal } from '@/components/ui'
import { supabase } from '@/services/supabase'
import { useAuthStore } from '@/store/authStore'
import { logger } from '@/utils/logger'

const PAGE_SIZE = 20
const ROLE_FILTERS = ['all', 'buyer', 'vendor', 'driver']

const createEmptyModalState = () => ({
  open: false,
  type: '',
  targetUser: null,
  selectedIds: [],
})

const formatDateTime = (value, locale = 'ar-MA') => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString(locale)
}

const getName = (user) => {
  const first = user.first_name || ''
  const last = user.last_name || ''
  const full = `${first} ${last}`.trim()
  return full || user.email || user.id
}

const AdminUsersPage = () => {
  const { t, i18n } = useTranslation()

  const authLoading = useAuthStore((s) => s.loading)
  const authProfile = useAuthStore((s) => s.profile)

  const [users, setUsers] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [page, setPage] = useState(1)

  const [selectedIds, setSelectedIds] = useState([])
  const [busyAction, setBusyAction] = useState(false)

  const [confirmModal, setConfirmModal] = useState(createEmptyModalState())
  const [profileModalUser, setProfileModalUser] = useState(null)

  const isAdmin = authProfile?.role === 'admin'

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const loadUsers = async () => {
    if (!isAdmin) return

    setLoading(true)
    try {
      let query = supabase
        .from('profiles')
        .select('id, first_name, last_name, email, role, created_at, is_suspended, avatar_url, phone, city', { count: 'exact' })

      if (roleFilter !== 'all') {
        query = query.eq('role', roleFilter)
      }

      if (debouncedSearch) {
        const safeSearch = debouncedSearch.replace(/[%_]/g, '')
        query = query.or(`first_name.ilike.%${safeSearch}%,last_name.ilike.%${safeSearch}%,email.ilike.%${safeSearch}%`)
      }

      const from = (page - 1) * PAGE_SIZE
      const to = from + PAGE_SIZE - 1

      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(from, to)

      if (error) throw error

      setUsers(data || [])
      setTotalCount(count || 0)

      const currentPageIds = new Set((data || []).map((item) => item.id))
      setSelectedIds((prev) => prev.filter((id) => currentPageIds.has(id)))
    } catch (error) {
      logger.error('Failed to load users:', error)
      toast.error(t('admin.users.loadFailed', 'تعذر تحميل المستخدمين'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isAdmin) return
    loadUsers()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, roleFilter, debouncedSearch, page])

  const allRowsSelected = useMemo(() => {
    if (!users.length) return false
    return users.every((user) => selectedIds.includes(user.id))
  }, [users, selectedIds])

  const openConfirm = (type, targetUser = null, ids = []) => {
    setConfirmModal({
      open: true,
      type,
      targetUser,
      selectedIds: ids,
    })
  }

  const closeConfirm = () => {
    if (busyAction) return
    setConfirmModal(createEmptyModalState())
  }

  const toggleSelectAll = () => {
    if (allRowsSelected) {
      setSelectedIds([])
      return
    }
    setSelectedIds(users.map((u) => u.id))
  }

  const toggleSelectOne = (id) => {
    setSelectedIds((prev) => (
      prev.includes(id)
        ? prev.filter((item) => item !== id)
        : [...prev, id]
    ))
  }

  const runAction = async () => {
    const { type, targetUser, selectedIds: ids } = confirmModal
    if (!type) return

    setBusyAction(true)
    try {
      if (type === 'toggle-suspend' && targetUser) {
        const { error } = await supabase
          .from('profiles')
          .update({ is_suspended: !targetUser.is_suspended })
          .eq('id', targetUser.id)

        if (error) throw error
        toast.success(
          !targetUser.is_suspended
            ? t('admin.users.suspendSuccess', 'تم تعليق المستخدم')
            : t('admin.users.activateSuccess', 'تم تفعيل المستخدم')
        )
      }

      if (type === 'delete-user' && targetUser) {
        const { error } = await supabase
          .from('profiles')
          .delete()
          .eq('id', targetUser.id)

        if (error) throw error
        toast.success(t('admin.users.deleteSuccess', 'تم حذف المستخدم'))
      }

      if (type === 'bulk-suspend' && ids.length > 0) {
        const { error } = await supabase
          .from('profiles')
          .update({ is_suspended: true })
          .in('id', ids)

        if (error) throw error
        toast.success(t('admin.users.bulkSuspendSuccess', 'تم تعليق المستخدمين المحددين'))
        setSelectedIds([])
      }

      closeConfirm()
      await loadUsers()
    } catch (error) {
      logger.error('Admin users action failed:', error)
      toast.error(t('admin.users.actionFailed', 'فشل تنفيذ الإجراء'))
    } finally {
      setBusyAction(false)
    }
  }

  const confirmTitle = useMemo(() => {
    if (confirmModal.type === 'toggle-suspend' && confirmModal.targetUser?.is_suspended) {
      return t('admin.users.confirmActivateTitle', 'تأكيد تفعيل المستخدم')
    }
    if (confirmModal.type === 'toggle-suspend') {
      return t('admin.users.confirmSuspendTitle', 'تأكيد تعليق المستخدم')
    }
    if (confirmModal.type === 'delete-user') {
      return t('admin.users.confirmDeleteTitle', 'تأكيد حذف المستخدم')
    }
    if (confirmModal.type === 'bulk-suspend') {
      return t('admin.users.confirmBulkSuspendTitle', 'تأكيد تعليق مجموعة مستخدمين')
    }
    return t('admin.users.confirmTitle', 'تأكيد')
  }, [confirmModal, t])

  const confirmDescription = useMemo(() => {
    if (confirmModal.type === 'toggle-suspend' && confirmModal.targetUser?.is_suspended) {
      return t('admin.users.confirmActivateMessage', 'هل تريد تفعيل هذا المستخدم؟')
    }
    if (confirmModal.type === 'toggle-suspend') {
      return t('admin.users.confirmSuspendMessage', 'هل تريد تعليق هذا المستخدم؟')
    }
    if (confirmModal.type === 'delete-user') {
      return t('admin.users.confirmDeleteMessage', 'هذا الإجراء لا يمكن التراجع عنه. هل تريد المتابعة؟')
    }
    if (confirmModal.type === 'bulk-suspend') {
      return t('admin.users.confirmBulkSuspendMessage', 'سيتم تعليق جميع المستخدمين المحددين. هل تريد المتابعة؟')
    }
    return ''
  }, [confirmModal, t])

  if (authLoading) {
    return (
      <div className="flex justify-center py-10" data-cy="admin-users-auth-loading">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4" data-cy="admin-users-forbidden" dir="rtl">
        <h2 className="text-lg font-semibold text-red-800 mb-1">
          {t('admin.users.forbiddenTitle', 'غير مصرح بالوصول')}
        </h2>
        <p className="text-sm text-red-700">
          {t('admin.users.forbiddenMessage', 'هذه الصفحة مخصصة للمشرفين فقط.')}
        </p>
      </div>
    )
  }

  return (
    <div dir="rtl" data-cy="admin-users-page">
      <div className="flex flex-col gap-4 mb-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" data-cy="admin-users-title">
            {t('admin.users.title', 'إدارة المستخدمين')}
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            {t('admin.users.subtitle', 'إدارة الحسابات، التعليق، والحذف')}
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          disabled={!selectedIds.length}
          onClick={() => openConfirm('bulk-suspend', null, selectedIds)}
          data-cy="admin-users-bulk-suspend-button"
        >
          {t('admin.users.bulkSuspend', 'تعليق المحدد')} ({selectedIds.length})
        </Button>
      </div>

      <div className="grid gap-3 mb-4 md:grid-cols-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('admin.users.searchPlaceholder', 'ابحث بالاسم أو البريد الإلكتروني')}
          data-cy="admin-users-search-input"
        />

        <select
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value)
            setPage(1)
          }}
          className="input"
          data-cy="admin-users-role-filter"
        >
          {ROLE_FILTERS.map((role) => (
            <option key={role} value={role}>
              {t(`admin.users.roles.${role}`, role)}
            </option>
          ))}
        </select>

        <div className="text-sm text-gray-600 self-center" data-cy="admin-users-total-count">
          {t('admin.users.totalCount', 'إجمالي المستخدمين')}: {totalCount}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white" data-cy="admin-users-table-wrapper">
        <table className="min-w-full table-auto" data-cy="admin-users-table">
          <thead className="bg-gray-50 text-gray-700 text-sm">
            <tr>
              <th className="px-3 py-3 text-right w-10">
                <input
                  type="checkbox"
                  checked={allRowsSelected}
                  onChange={toggleSelectAll}
                  data-cy="admin-users-select-all"
                />
              </th>
              <th className="px-3 py-3 text-right">{t('admin.users.columns.name', 'الاسم')}</th>
              <th className="px-3 py-3 text-right">{t('admin.users.columns.email', 'البريد الإلكتروني')}</th>
              <th className="px-3 py-3 text-right">{t('admin.users.columns.role', 'الدور')}</th>
              <th className="px-3 py-3 text-right">{t('admin.users.columns.createdAt', 'تاريخ الإنشاء')}</th>
              <th className="px-3 py-3 text-right">{t('admin.users.columns.status', 'الحالة')}</th>
              <th className="px-3 py-3 text-right">{t('admin.users.columns.actions', 'الإجراءات')}</th>
            </tr>
          </thead>

          <tbody className="text-sm">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center" data-cy="admin-users-loading">
                  <LoadingSpinner size="md" />
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-gray-500" data-cy="admin-users-empty">
                  {t('admin.users.empty', 'لا توجد نتائج مطابقة')}
                </td>
              </tr>
            ) : (
              users.map((user) => {
                const selected = selectedIds.includes(user.id)
                const suspended = Boolean(user.is_suspended)

                return (
                  <tr key={user.id} className="border-t border-gray-100" data-cy={`admin-users-row-${user.id}`}>
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleSelectOne(user.id)}
                        data-cy={`admin-users-select-${user.id}`}
                      />
                    </td>

                    <td className="px-3 py-3 font-medium text-gray-900" data-cy={`admin-users-name-${user.id}`}>
                      {getName(user)}
                    </td>

                    <td className="px-3 py-3" data-cy={`admin-users-email-${user.id}`}>
                      {user.email || '-'}
                    </td>

                    <td className="px-3 py-3" data-cy={`admin-users-role-${user.id}`}>
                      {t(`admin.users.roles.${user.role}`, user.role || '-')}
                    </td>

                    <td className="px-3 py-3" data-cy={`admin-users-created-at-${user.id}`}>
                      {formatDateTime(user.created_at, i18n.language === 'ar' ? 'ar-MA' : 'en-US')}
                    </td>

                    <td className="px-3 py-3" data-cy={`admin-users-status-${user.id}`}>
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                        suspended
                          ? 'bg-red-100 text-red-700'
                          : 'bg-green-100 text-green-700'
                      }`}>
                        {suspended
                          ? t('admin.users.status.suspended', 'معلق')
                          : t('admin.users.status.active', 'نشط')}
                      </span>
                    </td>

                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setProfileModalUser(user)}
                          data-cy={`admin-users-view-profile-${user.id}`}
                        >
                          {t('admin.users.actions.viewProfile', 'عرض الملف')}
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openConfirm('toggle-suspend', user)}
                          data-cy={`admin-users-toggle-suspend-${user.id}`}
                        >
                          {suspended
                            ? t('admin.users.actions.activate', 'تفعيل')
                            : t('admin.users.actions.suspend', 'تعليق')}
                        </Button>

                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => openConfirm('delete-user', user)}
                          disabled={user.id === authProfile?.id}
                          data-cy={`admin-users-delete-${user.id}`}
                        >
                          {t('admin.users.actions.delete', 'حذف')}
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-4" data-cy="admin-users-pagination">
        <Button
          variant="outline"
          disabled={page <= 1}
          onClick={() => setPage((prev) => Math.max(1, prev - 1))}
          data-cy="admin-users-prev-page"
        >
          {t('admin.users.pagination.prev', 'السابق')}
        </Button>

        <span className="text-sm text-gray-600" data-cy="admin-users-page-indicator">
          {page} / {totalPages}
        </span>

        <Button
          variant="outline"
          disabled={page >= totalPages}
          onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
          data-cy="admin-users-next-page"
        >
          {t('admin.users.pagination.next', 'التالي')}
        </Button>
      </div>

      <Modal
        isOpen={confirmModal.open}
        onClose={closeConfirm}
        title={confirmTitle}
        size="md"
      >
        <div className="space-y-4" dir="rtl" data-cy="admin-users-confirm-modal">
          <p className="text-sm text-gray-700" data-cy="admin-users-confirm-message">{confirmDescription}</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={closeConfirm} disabled={busyAction} data-cy="admin-users-confirm-cancel">
              {t('common.cancel', 'إلغاء')}
            </Button>
            <Button variant="danger" onClick={runAction} isLoading={busyAction} data-cy="admin-users-confirm-submit">
              {t('common.confirm', 'تأكيد')}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(profileModalUser)}
        onClose={() => setProfileModalUser(null)}
        title={t('admin.users.profileModal.title', 'ملف المستخدم')}
        size="md"
      >
        {profileModalUser && (
          <div className="space-y-2 text-sm" dir="rtl" data-cy="admin-users-profile-modal">
            <p><span className="font-semibold">{t('admin.users.columns.name', 'الاسم')}:</span> {getName(profileModalUser)}</p>
            <p><span className="font-semibold">{t('admin.users.columns.email', 'البريد الإلكتروني')}:</span> {profileModalUser.email || '-'}</p>
            <p><span className="font-semibold">{t('admin.users.columns.role', 'الدور')}:</span> {t(`admin.users.roles.${profileModalUser.role}`, profileModalUser.role)}</p>
            <p><span className="font-semibold">{t('admin.users.columns.createdAt', 'تاريخ الإنشاء')}:</span> {formatDateTime(profileModalUser.created_at, i18n.language === 'ar' ? 'ar-MA' : 'en-US')}</p>
            <p><span className="font-semibold">{t('admin.users.phone', 'الهاتف')}:</span> {profileModalUser.phone || '-'}</p>
            <p><span className="font-semibold">{t('admin.users.city', 'المدينة')}:</span> {profileModalUser.city || '-'}</p>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default AdminUsersPage
