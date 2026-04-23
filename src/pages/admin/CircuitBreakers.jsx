import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, LoadingSpinner } from '@/components/ui'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/services/supabase'
import { auditLogger } from '@/services/auditLogger'
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  ArrowPathIcon,
  ClockIcon,
  BoltIcon,
  EyeIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

// Service definitions with health check methods
const SERVICES = [
  {
    id: 'database',
    name: 'Database (Supabase)',
    description: 'Primary database and API',
    icon: '🗄️',
    checkMethod: 'query',
    checkQuery: async () => {
      const { error } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).limit(1)
      return !error
    },
  },
  {
    id: 'storage',
    name: 'Storage Service',
    description: 'File storage (images, documents)',
    icon: '📦',
    checkMethod: 'query',
    checkQuery: async () => {
      const { error } = await supabase.storage.listBuckets()
      return !error
    },
  },
  {
    id: 'auth',
    name: 'Auth Service',
    description: 'Authentication & session management',
    icon: '🔐',
    checkMethod: 'query',
    checkQuery: async () => {
      const { data: { user }, error } = await supabase.auth.getUser()
      return !!user && !error
    },
  },
  {
    id: 'realtime',
    name: 'Realtime (WebSockets)',
    description: 'Live updates and subscriptions',
    icon: '⚡',
    checkMethod: 'query',
    checkQuery: async () => {
      const channel = supabase.channel('health-check-ping')
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          supabase.removeChannel(channel)
          resolve(false)
        }, 5000)

        channel
          .on('system', { event: 'connected' }, () => {
            clearTimeout(timeout)
            supabase.removeChannel(channel)
            resolve(true)
          })
          .subscribe((status) => {
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              clearTimeout(timeout)
              resolve(false)
            }
          })
      })
    },
  },
  {
    id: 'notifications',
    name: 'Notification Service',
    description: 'In-app notifications and alerts',
    icon: '🔔',
    checkMethod: 'query',
    checkQuery: async () => {
      const { error } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).limit(1)
      return !error
    },
  },
  {
    id: 'orders',
    name: 'Orders Service',
    description: 'Order processing and management',
    icon: '🛒',
    checkMethod: 'query',
    checkQuery: async () => {
      const { error } = await supabase.from('orders').select('id', { count: 'exact', head: true }).limit(1)
      return !error
    },
  },
]

const STATUS_CONFIG = {
  healthy: { label: 'Healthy', color: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircleIcon, dot: 'bg-green-500' },
  degraded: { label: 'Degraded', color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: ExclamationTriangleIcon, dot: 'bg-yellow-500' },
  unhealthy: { label: 'Down', color: 'bg-red-100 text-red-700 border-red-200', icon: XCircleIcon, dot: 'bg-red-500' },
  unknown: { label: 'Unknown', color: 'bg-gray-100 text-gray-500 border-gray-200', icon: ClockIcon, dot: 'bg-gray-400' },
}

const CircuitBreakers = () => {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const channelRef = useRef(null)
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const [services, setServices] = useState(() =>
    SERVICES.map(s => ({ ...s, status: 'unknown', latency: null, lastCheck: null, circuitOpen: false }))
  )
  const [history, setHistory] = useState([])
  const [selectedService, setSelectedService] = useState(null)
  const [showHistory, setShowHistory] = useState(false)

  // Run health checks for all services
  const runHealthChecks = useCallback(async () => {
    setChecking(true)
    const results = await Promise.allSettled(
      services.map(async (service) => {
        const startTime = Date.now()
        try {
          const healthy = await service.checkQuery()
          const latency = Date.now() - startTime
          return { ...service, status: healthy ? 'healthy' : 'unhealthy', latency, lastCheck: new Date().toISOString() }
        } catch {
          const latency = Date.now() - startTime
          return { ...service, status: 'unhealthy', latency, lastCheck: new Date().toISOString() }
        }
      })
    )

    const updatedServices = results.map(r => r.status === 'fulfilled' ? r.value : { ...r.reason, status: 'unhealthy', latency: 0, lastCheck: new Date().toISOString() })
    setServices(updatedServices)
    setChecking(false)
    setLoading(false)

    // Log health check summary to audit log
    const summary = updatedServices.map(s => ({ id: s.id, status: s.status, latency: s.latency }))
    await auditLogger.log({
      action: 'HEALTH_CHECK',
      entityType: 'circuit_breaker',
      entityId: 'all_services',
      newValues: { services: summary },
      userId: user?.id,
      metadata: { triggeredBy: 'manual_check' }
    })
  }, [services, user?.id])

  // Toggle circuit breaker for a service
  const toggleCircuitBreaker = async (serviceId, openCircuit) => {
    const service = services.find(s => s.id === serviceId)
    if (!service) return

    const oldState = { circuitOpen: service.circuitOpen }
    const newState = { circuitOpen: openCircuit }

    // Update local state
    setServices(prev =>
      prev.map(s => s.id === serviceId ? { ...s, circuitOpen: openCircuit } : s)
    )

    // Log to audit trail
    await auditLogger.log({
      action: openCircuit ? 'CIRCUIT_OPENED' : 'CIRCUIT_CLOSED',
      entityType: 'circuit_breaker',
      entityId: serviceId,
      oldValues: oldState,
      newValues: newState,
      userId: user?.id,
      metadata: {
        serviceName: service.name,
        previousStatus: service.status,
        triggeredBy: user?.email || 'admin'
      }
    })

    toast.success(
      openCircuit
        ? t('admin.circuitBreakers.circuitOpened', 'Circuit opened for {{name}} — traffic blocked', { name: service.name })
        : t('admin.circuitBreakers.circuitClosed', 'Circuit closed for {{name}} — traffic restored', { name: service.name })
    )

    // Add to history
    setHistory(prev => [{
      id: crypto.randomUUID(),
      serviceId,
      serviceName: service.name,
      action: openCircuit ? 'CIRCUIT_OPENED' : 'CIRCUIT_CLOSED',
      timestamp: new Date().toISOString(),
      adminId: user?.id,
    }, ...prev].slice(0, 50))
  }

  // Initial health check
  useEffect(() => {
    runHealthChecks()
  }, [runHealthChecks])

  // Periodic health check every 30s
  useEffect(() => {
    const interval = setInterval(runHealthChecks, 30000)
    return () => clearInterval(interval)
  }, [runHealthChecks])

  // Real-time subscription for circuit breaker state changes
  useEffect(() => {
    // We use a lightweight realtime subscription to detect any external changes
    // Since we don't have a dedicated circuit_breakers table yet,
    // we monitor the health_monitor channel via Supabase presence
    const channel = supabase
      .channel('circuit-breaker-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'audit_logs' },
        (payload) => {
          if (payload.new.entity_type === 'circuit_breaker') {
            // Refresh history when circuit breaker changes occur
            setHistory(prev => {
              const entry = {
                id: crypto.randomUUID(),
                serviceId: payload.new.entity_id,
                serviceName: payload.new.new_values?.serviceName || payload.new.entity_id,
                action: payload.new.action,
                timestamp: payload.new.timestamp,
                adminId: payload.new.user_id,
              }
              return [entry, ...prev].slice(0, 50)
            })
          }
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // Overall system health
  const healthyCount = services.filter(s => s.status === 'healthy').length
  const degradedCount = services.filter(s => s.status === 'degraded').length
  const unhealthyCount = services.filter(s => s.status === 'unhealthy').length
  const overallStatus = unhealthyCount > 0 ? 'unhealthy' : degradedCount > 0 ? 'degraded' : 'healthy'
  const overallConfig = STATUS_CONFIG[overallStatus]
  const OverallIcon = overallConfig.icon

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('admin.circuitBreakers.title', 'Circuit Breakers & Health')}</h1>
          <p className="text-gray-500">{t('admin.circuitBreakers.subtitle', 'Monitor service health and manage circuit breakers')}</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <ClockIcon className="w-5 h-5" />
            {t('admin.circuitBreakers.history', 'History')}
          </button>
          <button
            onClick={runHealthChecks}
            disabled={checking}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <ArrowPathIcon className={`w-5 h-5 ${checking ? 'animate-spin' : ''}`} />
            {checking ? t('admin.circuitBreakers.checking', 'Checking...') : t('admin.circuitBreakers.runChecks', 'Run Checks')}
          </button>
        </div>
      </div>

      {/* Overall Status */}
      <Card className={`p-6 border-2 ${overallConfig.color}`}>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center">
            <OverallIcon className="w-8 h-8" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold">{t('admin.circuitBreakers.overallStatus', 'Overall System Status')}: {overallConfig.label}</h2>
            <p className="text-sm opacity-80">
              {healthyCount} {t('admin.circuitBreakers.healthy', 'healthy')} · {degradedCount} {t('admin.circuitBreakers.degraded', 'degraded')} · {unhealthyCount} {t('admin.circuitBreakers.down', 'down')} · {services.length} {t('admin.circuitBreakers.total', 'total')}
            </p>
          </div>
          <div className="flex gap-1">
            {services.map(s => (
              <div
                key={s.id}
                className={`w-3 h-3 rounded-full ${STATUS_CONFIG[s.status].dot} ${s.circuitOpen ? 'opacity-30' : ''}`}
                title={`${s.name}: ${s.status}${s.circuitOpen ? ' (circuit open)' : ''}`}
              />
            ))}
          </div>
        </div>
      </Card>

      {/* Service Health Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {services.map(service => {
          const config = STATUS_CONFIG[service.status]
          return (
            <Card key={service.id} className={`p-6 border-2 ${config.color} ${service.circuitOpen ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{service.icon}</span>
                  <div>
                    <h3 className="font-semibold text-gray-900">{service.name}</h3>
                    <p className="text-xs text-gray-500">{service.description}</p>
                  </div>
                </div>
                <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${config.color}`}>
                  <span className={`w-2 h-2 rounded-full ${config.dot} ${service.status === 'healthy' ? 'animate-pulse' : ''}`} />
                  {config.label}
                </span>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-3 gap-3 mb-4 text-sm">
                <div>
                  <p className="text-gray-500">{t('admin.circuitBreakers.latency', 'Latency')}</p>
                  <p className="font-semibold">
                    {service.latency !== null ? `${service.latency}ms` : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">{t('admin.circuitBreakers.lastCheck', 'Last Check')}</p>
                  <p className="font-semibold">
                    {service.lastCheck ? new Date(service.lastCheck).toLocaleTimeString() : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">{t('admin.circuitBreakers.circuit', 'Circuit')}</p>
                  <p className={`font-semibold ${service.circuitOpen ? 'text-red-600' : 'text-green-600'}`}>
                    {service.circuitOpen ? t('admin.circuitBreakers.open', 'OPEN') : t('admin.circuitBreakers.closed', 'CLOSED')}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                {service.circuitOpen ? (
                  <button
                    onClick={() => toggleCircuitBreaker(service.id, false)}
                    className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <CheckCircleIcon className="w-4 h-4" />
                    {t('admin.circuitBreakers.closeCircuit', 'Close Circuit (Restore)')}
                  </button>
                ) : (
                  <button
                    onClick={() => toggleCircuitBreaker(service.id, true)}
                    className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
                  >
                    <XCircleIcon className="w-4 h-4" />
                    {t('admin.circuitBreakers.openCircuit', 'Open Circuit (Block)')}
                  </button>
                )}
                <button
                  onClick={() => setSelectedService(service)}
                  className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title={t('admin.circuitBreakers.viewDetails', 'View Details')}
                >
                  <EyeIcon className="w-5 h-5" />
                </button>
              </div>
            </Card>
          )
        })}
      </div>

      {/* Change History */}
      {showHistory && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <ClockIcon className="w-5 h-5 text-gray-600" />
            <h3 className="text-lg font-semibold text-gray-900">{t('admin.circuitBreakers.changeHistory', 'Circuit Breaker Change History')}</h3>
          </div>

          {history.length === 0 ? (
            <p className="text-gray-500 text-center py-8">{t('admin.circuitBreakers.noChanges', 'No circuit breaker changes recorded')}</p>
          ) : (
            <div className="space-y-2">
              {history.map(entry => (
                <div key={entry.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <BoltIcon className={`w-5 h-5 ${entry.action === 'CIRCUIT_OPENED' ? 'text-red-600' : 'text-green-600'}`} />
                    <div>
                      <p className="font-medium text-sm">{entry.serviceName}</p>
                      <p className="text-xs text-gray-500">
                        <span className={`font-medium ${entry.action === 'CIRCUIT_OPENED' ? 'text-red-600' : 'text-green-600'}`}>
                          {entry.action}
                        </span>
                        {' '}{t('admin.circuitBreakers.byAdmin', 'by admin')}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-gray-500">
                    {new Date(entry.timestamp).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Service Detail Modal */}
      {selectedService && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                {selectedService.icon} {selectedService.name}
              </h2>
              <button
                onClick={() => setSelectedService(null)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <XCircleIcon className="w-6 h-6 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-gray-600">{selectedService.description}</p>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500">{t('admin.circuitBreakers.status', 'Status')}</p>
                  <p className="font-semibold">{STATUS_CONFIG[selectedService.status].label}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500">{t('admin.circuitBreakers.latency', 'Latency')}</p>
                  <p className="font-semibold">{selectedService.latency !== null ? `${selectedService.latency}ms` : '—'}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500">{t('admin.circuitBreakers.circuit', 'Circuit')}</p>
                  <p className={`font-semibold ${selectedService.circuitOpen ? 'text-red-600' : 'text-green-600'}`}>
                    {selectedService.circuitOpen ? t('admin.circuitBreakers.openBlocking', 'OPEN (blocking)') : t('admin.circuitBreakers.closedNormal', 'CLOSED (normal)')}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500">{t('admin.circuitBreakers.lastCheck', 'Last Check')}</p>
                  <p className="font-semibold">
                    {selectedService.lastCheck ? new Date(selectedService.lastCheck).toLocaleString() : '—'}
                  </p>
                </div>
              </div>

              {/* Service-specific history */}
              {history.filter(h => h.serviceId === selectedService.id).length > 0 && (
                <div>
                  <h4 className="font-medium text-sm text-gray-700 mb-2">{t('admin.circuitBreakers.recentChanges', 'Recent Changes')}</h4>
                  <div className="space-y-1">
                    {history
                      .filter(h => h.serviceId === selectedService.id)
                      .slice(0, 5)
                      .map(h => (
                        <div key={h.id} className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded">
                          <span className={`font-medium ${h.action === 'CIRCUIT_OPENED' ? 'text-red-600' : 'text-green-600'}`}>
                            {h.action}
                          </span>
                          <span className="text-gray-500 text-xs">
                            {new Date(h.timestamp).toLocaleString()}
                          </span>
                        </div>
                      ))
                    }
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

export default CircuitBreakers
