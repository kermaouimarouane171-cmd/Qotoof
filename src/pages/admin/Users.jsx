import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, Badge, Button, Input, Modal, LoadingSpinner } from '@/components/ui'
import {
  MagnifyingGlassIcon,
  PencilIcon,
  TrashIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'
import { supabase } from '@/services/supabase'
import { usersApi } from '@/services/api'
import { auditLogger } from '@/services/auditLogger'
import { logger } from '@/utils/logger'
import toast from 'react-hot-toast'

const ROLES = ['buyer', 'vendor', 'driver', 'admin']
const PAGE_SIZE = 20

const AdminUsers = () => {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [sortBy, setSortBy] = useState('created')
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)

  // Edit modal state
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [editForm, setEditForm] = useState({ role: '', is_approved: false, is_suspended: false })
  const [saving, setSaving] = useState(false)

  // Delete confirmation modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deletingUser, setDeletingUser] = useState(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    loadUsers()
  }, [page, roleFilter, sortBy])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1)
      loadUsers()
    }, 400)
    return () => clearTimeout(timer)
  }, [search])

  const loadUsers = async () => {
    try {
      setLoading(true)
      setError(null)

      const filters = {
        role: roleFilter,
        search: search.trim() || undefined,
        sortBy,
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      }

      const { data, count } = await usersApi.getAll(filters)
      setUsers(data || [])
      setTotalCount(count || 0)
    } catch (err) {
      logger.error('Error loading users:', err)
      setError(t('admin.users.errors.loadFailed', 'Failed to load users'))
      toast.error(t('admin.users.errors.loadFailed', 'Failed to load users'))
    } finally {
      setLoading(false)
    }
  }

  const openEditModal = (user) => {
    setEditingUser(user)
    setEditForm({
      role: user.role || 'buyer',
      is_approved: user.is_approved || false,
      is_suspended: user.is_suspended || false,
    })
    setEditModalOpen(true)
  }

  const handleSaveEdit = async () => {
    if (!editingUser) return

    setSaving(true)
    try {
      const updates = {
        role: editForm.role,
        is_approved: editForm.is_approved,
        is_suspended: editForm.is_suspended,
      }

      const updated = await usersApi.update(editingUser.id, updates)

      // Log audit
      await auditLogger.logProfileAction('USER_UPDATED', {
        id: editingUser.id,
        ...updates,
      }, editingUser)

      toast.success(t('admin.users.notifications.updatedSuccess', 'User updated successfully'))
      setEditModalOpen(false)
      setEditingUser(null)
      await loadUsers()
    } catch (err) {
      logger.error('Error updating user:', err)
      toast.error(t('admin.users.errors.updateFailed', 'Failed to update user'))
    } finally {
      setSaving(false)
    }
  }

  const openDeleteModal = (user) => {
    setDeletingUser(user)
    setDeleteModalOpen(true)
  }

  const handleDelete = async () => {
    if (!deletingUser) return

    setDeleting(true)
    try {
      // Log audit before deletion
      await auditLogger.logProfileAction('USER_DELETED', {
        id: deletingUser.id,
        email: deletingUser.email,
        name: `${deletingUser.first_name} ${deletingUser.last_name}`,
        role: deletingUser.role,
      })

      await usersApi.delete(deletingUser.id)

      toast.success(t('admin.users.notifications.deletedSuccess', 'User deleted successfully'))
      setDeleteModalOpen(false)
      setDeletingUser(null)
      await loadUsers()
    } catch (err) {
      logger.error('Error deleting user:', err)
      toast.error(t('admin.users.errors.deleteFailed', 'Failed to delete user'))
    } finally {
      setDeleting(false)
    }
  }

  const handleToggleSuspend = async (user) => {
    try {
      const newSuspended = !user.is_suspended
      const { error } = await supabase
        .from('profiles')
        .update({ is_suspended: newSuspended })
        .eq('id', user.id)

      if (error) throw error

      await auditLogger.logProfileAction(newSuspended ? 'USER_SUSPENDED' : 'USER_UNSUSPENDED', {
        id: user.id,
        email: user.email,
      })

      toast.success(
        newSuspended
          ? t('admin.users.notifications.suspendedSuccess', 'User suspended')
          : t('admin.users.notifications.unsuspendedSuccess', 'User unsuspended')
      )
      await loadUsers()
    } catch (err) {
      logger.error('Error toggling suspension:', err)
      toast.error(t('admin.users.errors.suspendFailed', 'Failed to update suspension'))
    }
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  const getFullName = (user) => {
    if (user.first_name && user.last_name) return `${user.first_name} ${user.last_name}`
    return user.first_name || user.last_name || user.email || 'N/A'
  }

  const roleColors = {
    buyer: 'badge-primary',
    vendor: 'badge-secondary',
    driver: 'bg-blue-100 text-blue-800 badge',
    admin: 'bg-purple-100 text-purple-800 badge',
  }

  if (loading && users.length === 0) {
    return <LoadingSpinner size="lg" />
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-8">{t('admin.users.title')}</h1>

      {/* Error State */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800">{error}</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={loadUsers}>
            {t('admin.users.errors.retry', 'Retry')}
          </Button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1">
          <Input
            placeholder={t('admin.users.searchPlaceholder', 'Search by name or email...')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<MagnifyingGlassIcon className="w-5 h-5" />}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['all', ...ROLES].map((role) => (
            <button
              key={role}
              onClick={() => { setRoleFilter(role); setPage(1) }}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize ${
                roleFilter === role
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {t(`admin.users.roles.${role}`, role)}
            </button>
          ))}
        </div>
        <select
          value={sortBy}
          onChange={(e) => { setSortBy(e.target.value); setPage(1) }}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 border-0"
        >
          <option value="created">{t('admin.users.sort.newest', 'Newest First')}</option>
          <option value="name">{t('admin.users.sort.name', 'Name A-Z')}</option>
        </select>
      </div>

      {/* Users Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>{t('admin.users.name', 'Name')}</th>
                <th>{t('admin.users.email', 'Email')}</th>
                <th>{t('admin.users.role', 'Role')}</th>
                <th>{t('admin.users.status', 'Status')}</th>
                <th>{t('admin.users.joined', 'Joined')}</th>
                <th>{t('admin.users.actions', 'Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-8 text-gray-500">
                    {t('admin.users.noUsers', 'No users found')}
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id}>
                    <td className="font-medium">{getFullName(user)}</td>
                    <td>{user.email || 'N/A'}</td>
                    <td>
                      <span className={`badge ${roleColors[user.role] || 'badge'}`}>
                        {t(`admin.users.roles.${user.role}`, user.role || 'N/A')}
                      </span>
                    </td>
                    <td>
                      {user.is_suspended ? (
                        <Badge variant="danger">{t('admin.users.suspended', 'Suspended')}</Badge>
                      ) : user.is_approved ? (
                        <Badge variant="success">{t('admin.users.approved', 'Approved')}</Badge>
                      ) : (
                        <Badge variant="warning">{t('admin.users.pending', 'Pending')}</Badge>
                      )}
                    </td>
                    <td className="text-gray-500">
                      {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <button
                          className="p-2 text-gray-600 hover:text-primary-600 hover:bg-primary-50 rounded-lg"
                          onClick={() => openEditModal(user)}
                          title={t('admin.users.edit', 'Edit')}
                        >
                          <PencilIcon className="w-5 h-5" />
                        </button>
                        {user.role !== 'admin' && (
                          <button
                            className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg"
                            onClick={() => openDeleteModal(user)}
                            title={t('admin.users.delete', 'Delete')}
                          >
                            <TrashIcon className="w-5 h-5" />
                          </button>
                        )}
                        <button
                          className={`p-2 rounded-lg ${
                            user.is_suspended
                              ? 'text-green-600 hover:bg-green-50'
                              : 'text-yellow-600 hover:bg-yellow-50'
                          }`}
                          onClick={() => handleToggleSuspend(user)}
                          title={
                            user.is_suspended
                              ? t('admin.users.unsuspend', 'Unsuspend')
                              : t('admin.users.suspend', 'Suspend')
                          }
                        >
                          <ExclamationTriangleIcon className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              {t('admin.users.pagination.info', 'Showing {{from}}-{{to}} of {{total}}', {
                from: (page - 1) * PAGE_SIZE + 1,
                to: Math.min(page * PAGE_SIZE, totalCount),
                total: totalCount,
              })}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                leftIcon={<ChevronLeftIcon className="w-4 h-4" />}
              >
                {t('admin.users.pagination.previous', 'Previous')}
              </Button>
              <span className="text-sm text-gray-600">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                rightIcon={<ChevronRightIcon className="w-4 h-4" />}
              >
                {t('admin.users.pagination.next', 'Next')}
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Edit User Modal */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => { setEditModalOpen(false); setEditingUser(null) }}
        title={t('admin.users.editModal.title', 'Edit User')}
        size="md"
      >
        {editingUser && (
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-900">{getFullName(editingUser)}</p>
              <p className="text-sm text-gray-600">{editingUser.email}</p>
            </div>

            <div>
              <label className="input-label">{t('admin.users.editModal.role', 'Role')}</label>
              <select
                value={editForm.role}
                onChange={(e) => setEditForm((prev) => ({ ...prev, role: e.target.value }))}
                className="input"
              >
                {ROLES.map((role) => (
                  <option key={role} value={role}>
                    {t(`admin.users.roles.${role}`, role)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="edit-is-approved"
                checked={editForm.is_approved}
                onChange={(e) => setEditForm((prev) => ({ ...prev, is_approved: e.target.checked }))}
                className="w-4 h-4 text-primary-600 rounded"
              />
              <label htmlFor="edit-is-approved" className="text-sm text-gray-700">
                {t('admin.users.editModal.isApproved', 'Approved')}
              </label>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="edit-is-suspended"
                checked={editForm.is_suspended}
                onChange={(e) => setEditForm((prev) => ({ ...prev, is_suspended: e.target.checked }))}
                className="w-4 h-4 text-primary-600 rounded"
              />
              <label htmlFor="edit-is-suspended" className="text-sm text-gray-700">
                {t('admin.users.editModal.isSuspended', 'Suspended')}
              </label>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="primary"
                onClick={handleSaveEdit}
                disabled={saving}
                className="flex-1"
              >
                {saving ? (
                  <>
                    <LoadingSpinner size="sm" />
                    {t('admin.users.editModal.saving', 'Saving...')}
                  </>
                ) : (
                  t('admin.users.editModal.save', 'Save Changes')
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => { setEditModalOpen(false); setEditingUser(null) }}
                disabled={saving}
              >
                {t('common.cancel', 'Cancel')}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => { setDeleteModalOpen(false); setDeletingUser(null) }}
        title={t('admin.users.deleteModal.title', 'Delete User')}
        size="md"
      >
        {deletingUser && (
          <div className="space-y-4">
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">
                {t('admin.users.deleteModal.warning', 'You are about to permanently delete the user "{{name}}" ({{email}}). This action cannot be undone.', {
                  name: getFullName(deletingUser),
                  email: deletingUser.email,
                })}
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="primary"
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 bg-red-600 hover:bg-red-700"
              >
                {deleting ? (
                  <>
                    <LoadingSpinner size="sm" />
                    {t('admin.users.deleteModal.deleting', 'Deleting...')}
                  </>
                ) : (
                  t('admin.users.deleteModal.confirmDelete', 'Delete User')
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => { setDeleteModalOpen(false); setDeletingUser(null) }}
                disabled={deleting}
              >
                {t('common.cancel', 'Cancel')}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default AdminUsers
