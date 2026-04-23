import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, LoadingSpinner } from '@/components/ui'
import { partnershipService } from '@/services/partnershipService'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { ArrowPathIcon } from '@heroicons/react/24/outline'

const formatDate = (value, locale) => {
  if (!value) return '-'
  return new Date(value).toLocaleDateString(locale === 'ar' ? 'ar-MA' : locale === 'fr' ? 'fr-MA' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

const getProfileName = (profile, t) => {
  if (!profile) return t('marketplaceFeatures.partnershipRequests.common.user')
  return profile.store_name || `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || t('marketplaceFeatures.partnershipRequests.common.user')
}

const statusClass = {
  pending: 'bg-amber-100 text-amber-700',
  accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-700',
}

const PartnershipRequests = ({ currentUserId, currentRole, className = '' }) => {
  const { i18n, t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [incoming, setIncoming] = useState([])
  const [outgoing, setOutgoing] = useState([])
  const [actioningId, setActioningId] = useState(null)

  const loadRequests = useCallback(async () => {
    if (!currentUserId) return

    setLoading(true)
    try {
      const [incomingData, outgoingData] = await Promise.all([
        partnershipService.getIncomingRequests(currentUserId),
        partnershipService.getOutgoingRequests(currentUserId),
      ])

      setIncoming(incomingData)
      setOutgoing(outgoingData)
    } catch (error) {
      toast.error(error.message || t('marketplaceFeatures.partnershipRequests.errors.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [currentUserId, t])

  useEffect(() => {
    loadRequests()
  }, [loadRequests])

  const incomingPending = useMemo(
    () => incoming.filter((request) => request.status === 'pending'),
    [incoming]
  )

  const sortedIncoming = useMemo(
    () => [...incoming].sort((left, right) => {
      if (left.status === 'pending' && right.status !== 'pending') return -1
      if (left.status !== 'pending' && right.status === 'pending') return 1
      return new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
    }),
    [incoming]
  )

  const sortedOutgoing = useMemo(
    () => [...outgoing].sort((left, right) => {
      if (left.status === 'pending' && right.status !== 'pending') return -1
      if (left.status !== 'pending' && right.status === 'pending') return 1
      return new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
    }),
    [outgoing]
  )

  const statusLabel = useMemo(() => ({
    pending: t('marketplaceFeatures.partnershipRequests.status.pending'),
    accepted: t('marketplaceFeatures.partnershipRequests.status.accepted'),
    rejected: t('marketplaceFeatures.partnershipRequests.status.rejected'),
    cancelled: t('marketplaceFeatures.partnershipRequests.status.cancelled'),
  }), [t])

  const handleRespond = async (requestId, status) => {
    setActioningId(requestId)
    try {
      await partnershipService.respondToRequest(requestId, currentUserId, status)
      toast.success(
        status === 'accepted'
          ? t('marketplaceFeatures.partnershipRequests.success.accepted')
          : t('marketplaceFeatures.partnershipRequests.success.rejected')
      )
      await loadRequests()
    } catch (error) {
      toast.error(error.message || t('marketplaceFeatures.partnershipRequests.errors.respondFailed'))
    } finally {
      setActioningId(null)
    }
  }

  const handleCancel = async (requestId) => {
    setActioningId(requestId)
    try {
      await partnershipService.cancelRequest(requestId, currentUserId)
      toast.success(t('marketplaceFeatures.partnershipRequests.success.cancelled'))
      await loadRequests()
    } catch (error) {
      toast.error(error.message || t('marketplaceFeatures.partnershipRequests.errors.cancelFailed'))
    } finally {
      setActioningId(null)
    }
  }

  if (!currentUserId) return null

  return (
    <div className={`grid grid-cols-1 xl:grid-cols-2 gap-6 ${className}`}>
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900">{t('marketplaceFeatures.partnershipRequests.incoming.title')}</h3>
            <p className="text-sm text-gray-500">{t('marketplaceFeatures.partnershipRequests.incoming.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">
              {t('marketplaceFeatures.partnershipRequests.incoming.pendingBadge', { count: incomingPending.length })}
            </span>
            <button
              type="button"
              onClick={loadRequests}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
            >
              <ArrowPathIcon className="w-4 h-4" />
              {t('marketplaceFeatures.partnershipRequests.common.refresh')}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-8 flex justify-center">
            <LoadingSpinner size="md" />
          </div>
          ) : incoming.length === 0 ? (
          <p className="text-sm text-gray-500">{t('marketplaceFeatures.partnershipRequests.incoming.empty')}</p>
        ) : (
          <div className="space-y-3">
            {sortedIncoming.map((request) => (
              <div key={request.id} className="rounded-xl border border-gray-200 p-4 bg-white">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <p className="font-semibold text-gray-900">{getProfileName(request.requester, t)}</p>
                    <p className="text-xs text-gray-500">
                      {request.requester_role === 'vendor'
                        ? t('marketplaceFeatures.partnershipRequests.roles.vendor')
                        : t('marketplaceFeatures.partnershipRequests.roles.driver')} • {formatDate(request.created_at, i18n.language)}
                    </p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusClass[request.status] || 'bg-gray-100 text-gray-700'}`}>
                    {statusLabel[request.status] || request.status}
                  </span>
                </div>

                <p className="text-sm text-gray-600 mb-3 leading-6">
                  {request.message || t('marketplaceFeatures.partnershipRequests.common.noMessage')}
                </p>

                {request.status !== 'pending' && (
                  <p className="text-xs text-gray-500 mb-3">
                    {t('marketplaceFeatures.partnershipRequests.incoming.updatedAt', {
                      date: formatDate(request.responded_at || request.created_at, i18n.language),
                    })}
                  </p>
                )}

                {request.status === 'pending' && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleRespond(request.id, 'accepted')}
                      disabled={actioningId === request.id}
                      className="px-3 py-2 rounded-lg bg-green-600 text-white text-sm hover:bg-green-700 disabled:opacity-50"
                    >
                      {t('marketplaceFeatures.partnershipRequests.actions.accept')}
                    </button>
                    <button
                      onClick={() => handleRespond(request.id, 'rejected')}
                      disabled={actioningId === request.id}
                      className="px-3 py-2 rounded-lg border border-red-300 text-red-600 text-sm hover:bg-red-50 disabled:opacity-50"
                    >
                      {t('marketplaceFeatures.partnershipRequests.actions.reject')}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900">{t('marketplaceFeatures.partnershipRequests.outgoing.title')}</h3>
            <p className="text-sm text-gray-500">{t('marketplaceFeatures.partnershipRequests.outgoing.subtitle')}</p>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
            {currentRole === 'vendor'
              ? t('marketplaceFeatures.partnershipRequests.roles.vendor')
              : t('marketplaceFeatures.partnershipRequests.roles.driver')}
          </span>
        </div>

        {loading ? (
          <div className="py-8 flex justify-center">
            <LoadingSpinner size="md" />
          </div>
          ) : outgoing.length === 0 ? (
          <p className="text-sm text-gray-500">{t('marketplaceFeatures.partnershipRequests.outgoing.empty')}</p>
        ) : (
          <div className="space-y-3">
            {sortedOutgoing.map((request) => (
              <div key={request.id} className="rounded-xl border border-gray-200 p-4 bg-white">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <p className="font-semibold text-gray-900">{getProfileName(request.target, t)}</p>
                    <p className="text-xs text-gray-500">
                      {t('marketplaceFeatures.partnershipRequests.outgoing.to')} {request.target_role === 'vendor'
                        ? t('marketplaceFeatures.partnershipRequests.roles.vendor')
                        : t('marketplaceFeatures.partnershipRequests.roles.driver')} • {formatDate(request.created_at, i18n.language)}
                    </p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusClass[request.status] || 'bg-gray-100 text-gray-700'}`}>
                    {statusLabel[request.status] || request.status}
                  </span>
                </div>

                <p className="text-sm text-gray-600 mb-3 leading-6">
                  {request.message || t('marketplaceFeatures.partnershipRequests.common.noMessage')}
                </p>

                {request.status !== 'pending' && (
                  <p className="text-xs text-gray-500 mb-3">
                    {t('marketplaceFeatures.partnershipRequests.outgoing.lastUpdate', {
                      date: formatDate(request.responded_at || request.created_at, i18n.language),
                    })}
                  </p>
                )}

                {request.status === 'pending' && (
                  <button
                    onClick={() => handleCancel(request.id)}
                    disabled={actioningId === request.id}
                    className="px-3 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm hover:bg-gray-50 disabled:opacity-50"
                  >
                    {t('marketplaceFeatures.partnershipRequests.actions.cancel')}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

export default PartnershipRequests