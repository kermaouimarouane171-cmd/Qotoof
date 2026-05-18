import { useState, useEffect } from 'react'
import { sessionService } from '@/services/authServices'
import {
  ComputerDesktopIcon,
  DevicePhoneMobileIcon,
  XMarkIcon,
  TrashIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { logger } from '@/utils/logger'

const SessionManager = ({ isOpen, onClose }) => {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [revoking, setRevoking] = useState(null)

  useEffect(() => {
    if (isOpen) {
      loadSessions()
    }
  }, [isOpen])

  const loadSessions = async () => {
    try {
      setLoading(true)
      const data = await sessionService.getActiveSessions()
      setSessions(data)
    } catch (error) {
      logger.error('Load sessions error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRevokeSession = async (sessionId) => {
    try {
      setRevoking(sessionId)
      const result = await sessionService.revokeSession(sessionId)

      if (result.success) {
        toast.success('Session revoked')
        await loadSessions()
      } else {
        toast.error(result.error || 'Failed to revoke session')
      }
    } catch (_error) {
      toast.error('Failed to revoke session')
    } finally {
      setRevoking(null)
    }
  }

  const handleRevokeAll = async () => {
    if (!confirm('Are you sure you want to sign out all other devices?')) {
      return
    }

    try {
      const result = await sessionService.revokeAllOtherSessions()

      if (result.success) {
        toast.success('All other sessions revoked')
        await loadSessions()
      } else {
        toast.error(result.error || 'Failed to revoke sessions')
      }
    } catch (_error) {
      toast.error('Failed to revoke sessions')
    }
  }

  const getDeviceIcon = (deviceInfo) => {
    const deviceType = deviceInfo?.deviceType || 'desktop'

    switch (deviceType) {
      case 'mobile':
        return <DevicePhoneMobileIcon className="w-6 h-6" />
      case 'tablet':
        return <DevicePhoneMobileIcon className="w-6 h-6" />
      default:
        return <ComputerDesktopIcon className="w-6 h-6" />
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Active Sessions</h2>
              <p className="text-sm text-gray-600 mt-1">
                Manage your active sessions across devices
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading sessions...</p>
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-12">
              <ComputerDesktopIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">No active sessions found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Current Session */}
              {sessions.filter(s => s.is_current).map(session => (
                <div
                  key={session.id}
                  className="p-4 bg-green-50 border-2 border-green-200 rounded-xl"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      {getDeviceIcon(session.device_info)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-gray-900">
                          {session.device_info?.browser || 'Unknown Browser'}
                        </span>
                        <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                          Current Session
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">
                        {session.device_info?.os || 'Unknown OS'} • {session.device_info?.deviceType || 'Unknown Device'}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <span>Last active: {formatLastActive(session.last_active)}</span>
                        <span>Expires: {formatExpires(session.expires_at)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Other Sessions */}
              {sessions.filter(s => !s.is_current).map(session => (
                <div
                  key={session.id}
                  className="p-4 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                      {getDeviceIcon(session.device_info)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-gray-900">
                          {session.device_info?.browser || 'Unknown Browser'}
                        </span>
                        <button
                          onClick={() => handleRevokeSession(session.id)}
                          disabled={revoking === session.id}
                          className="text-red-600 hover:text-red-700 disabled:opacity-50"
                        >
                          {revoking === session.id ? (
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-red-600"></div>
                          ) : (
                            <TrashIcon className="w-5 h-5" />
                          )}
                        </button>
                      </div>
                      <p className="text-sm text-gray-600">
                        {session.device_info?.os || 'Unknown OS'} • {session.device_info?.deviceType || 'Unknown Device'}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <span>Last active: {formatLastActive(session.last_active)}</span>
                        <span>Created: {formatDate(session.created_at)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 space-y-3">
          {/* Warning */}
          {sessions.length > 3 && (
            <div className="flex items-start gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-yellow-900">Too many active sessions?</p>
                <p className="text-yellow-700">
                  If you don't recognize some of these sessions, revoke all other sessions immediately.
                </p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleRevokeAll}
              disabled={sessions.length <= 1}
              className="btn-secondary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Sign Out All Other Devices
            </button>
            <button
              onClick={onClose}
              className="btn-primary flex-1"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Helper functions
function formatLastActive(timestamp) {
  if (!timestamp) return 'Unknown'
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now - date
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

function formatExpires(timestamp) {
  if (!timestamp) return 'Unknown'
  const date = new Date(timestamp)
  return date.toLocaleDateString()
}

function formatDate(timestamp) {
  if (!timestamp) return 'Unknown'
  const date = new Date(timestamp)
  return date.toLocaleDateString()
}

export default SessionManager
