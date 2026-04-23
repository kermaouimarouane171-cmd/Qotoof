import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, LoadingSpinner } from '@/components/ui'
import { useAuthStore } from '@/store/authStore'
import activityLogService from '@/services/activityLogService'
import { ClockIcon, ShieldCheckIcon } from '@heroicons/react/24/outline'
import { logger } from '@/utils/logger'
import toast from 'react-hot-toast'

const ActivityLogPage = () => {
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [logs, setLogs] = useState([])

  useEffect(() => {
    const load = async () => {
      if (!user?.id) {
        setLogs([])
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        const data = await activityLogService.getUserActivity(user.id, 100)
        setLogs(data)
      } catch (error) {
        logger.error('Error loading user activity log:', error)
        toast.error('تعذر تحميل سجل النشاط')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [user?.id])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <ShieldCheckIcon className="w-6 h-6 text-green-600" />
          سجل النشاط الأمني
        </h1>
        <Link to="/buyer/security" className="btn-outline">العودة للأمان</Link>
      </div>

      <Card className="overflow-hidden">
        {logs.length === 0 ? (
          <div className="p-12 text-center text-gray-500">لا توجد أنشطة مسجلة بعد.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {logs.map((log) => (
              <div key={log.id} className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-gray-900">{log.action}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {log.user_agent || 'Unknown device'}
                    </p>
                    {log.details && Object.keys(log.details).length > 0 && (
                      <pre className="mt-2 text-xs text-gray-600 bg-gray-50 rounded-lg p-2 overflow-x-auto">{JSON.stringify(log.details, null, 2)}</pre>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 text-right whitespace-nowrap">
                    <div className="flex items-center gap-1 justify-end">
                      <ClockIcon className="w-3 h-3" />
                      {new Date(log.created_at).toLocaleString('ar-MA')}
                    </div>
                    {log.ip_address && <p className="mt-1">IP: {log.ip_address}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

export default ActivityLogPage