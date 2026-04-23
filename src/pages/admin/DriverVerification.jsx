import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, LoadingSpinner } from '@/components/ui'
import { useAuthStore } from '@/store/authStore'
import {
  DocumentCheckIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  EyeIcon,
  UserIcon
} from '@heroicons/react/24/outline'
import { supabase } from '@/services/supabase'
import toast from 'react-hot-toast'
import { logger } from '@/utils/logger'

const AdminDriverVerification = () => {
  const { t } = useTranslation()
  const DOCUMENT_TYPES_MAP = {
    driver_license: t('admin.driverVerification.documentTypes.driver_license', "Driver's License"),
    vehicle_insurance: t('admin.driverVerification.documentTypes.vehicle_insurance', 'Vehicle Insurance'),
    vehicle_registration: t('admin.driverVerification.documentTypes.vehicle_registration', 'Vehicle Registration')
  }
  const { user } = useAuthStore()
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(null)
  const [selectedDoc, setSelectedDoc] = useState(null)
  const [adminNotes, setAdminNotes] = useState('')
  const [filter, setFilter] = useState('pending')

  useEffect(() => {
    loadDocuments()
  }, [filter])

  const loadDocuments = async () => {
    try {
      let query = supabase
        .from('driver_verification_documents')
        .select(`
          *,
          driver:profiles!driver_verification_documents_driver_id_fkey(
            id,
            first_name,
            last_name,
            email,
            phone,
            vehicle_type,
            vehicle_plate,
            license_verified,
            insurance_verified
          )
        `)
        .order('created_at', { ascending: false })

      if (filter !== 'all') {
        query = query.eq('status', filter)
      }

      const { data, error } = await query

      if (error) throw error
      setDocuments(data || [])
    } catch (error) {
      logger.error('Error loading documents:', error)
      toast.error(t('admin.driverVerification.notifications.loadFailed', 'Failed to load documents'))
    } finally {
      setLoading(false)
    }
  }

  const handleReview = async (docId, status) => {
    setProcessing(docId)
    try {
      const { error: updateError } = await supabase
        .from('driver_verification_documents')
        .update({
          status,
          admin_notes: adminNotes || null,
          reviewed_by: user?.id || null,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', docId)

      if (updateError) throw updateError

      // Get the document to notify the driver
      const doc = documents.find(d => d.id === docId)
      if (doc) {
        // Notify the driver about the review result
        const { error: notifError } = await supabase
          .from('notifications')
          .insert({
            user_id: doc.driver_id,
            title: status === 'approved' ? '✅ Document Approved' : '❌ Document Rejected',
            message: status === 'approved'
              ? `Your ${DOCUMENT_TYPES_MAP[doc.document_type]} has been approved. You can now accept deliveries.`
              : `Your ${DOCUMENT_TYPES_MAP[doc.document_type]} was rejected. ${adminNotes ? 'Note: ' + adminNotes : 'Please re-upload with correct information.'}`,
            type: 'driver_verification',
            data: JSON.stringify({
              document_id: docId,
              document_type: doc.document_type,
              status,
              admin_notes: adminNotes
            })
          })

        if (notifError) {
          logger.error('Failed to notify driver:', notifError)
        }

        // If approved, update driver profile verification status
        if (status === 'approved') {
          const updateField = doc.document_type === 'driver_license'
            ? { license_verified: true, license_expiry_date: doc.expiry_date }
            : doc.document_type === 'vehicle_insurance'
            ? { insurance_verified: true, insurance_expiry_date: doc.expiry_date }
            : {}

          if (Object.keys(updateField).length > 0) {
            const { error: profileError } = await supabase
              .from('profiles')
              .update(updateField)
              .eq('id', doc.driver_id)

            if (profileError) {
              logger.error('Failed to update profile:', profileError)
            }
          }
        }
      }

      toast.success(t('admin.driverVerification.notifications.reviewSuccess', 'Document {{status}} successfully', { replace: { status } }))
      setSelectedDoc(null)
      setAdminNotes('')
      loadDocuments()
    } catch (error) {
      logger.error('Review error:', error)
      toast.error(t('admin.driverVerification.notifications.reviewFailed', 'Failed to review document'))
    } finally {
      setProcessing(null)
    }
  }

  const getStatusBadge = (status) => {
    const config = {
      pending: { color: 'bg-yellow-100 text-yellow-800', icon: ClockIcon, label: t('admin.driverVerification.status.pending', 'Pending') },
      approved: { color: 'bg-green-100 text-green-800', icon: CheckCircleIcon, label: t('admin.driverVerification.status.approved', 'Approved') },
      rejected: { color: 'bg-red-100 text-red-800', icon: XCircleIcon, label: t('admin.driverVerification.status.rejected', 'Rejected') }
    }
    const { color, icon: Icon, label } = config[status] || config.pending
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${color}`}>
        <Icon className="w-3 h-3" />
        {label}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('admin.driverVerification.title', 'Driver Verification Documents')}</h1>
        <p className="text-gray-500">{t('admin.driverVerification.subtitle', 'Review and approve driver documents')}</p>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {[
          { key: 'pending', label: t('admin.driverVerification.filters.pending', 'Pending') },
          { key: 'approved', label: t('admin.driverVerification.filters.approved', 'Approved') },
          { key: 'rejected', label: t('admin.driverVerification.filters.rejected', 'Rejected') },
          { key: 'all', label: t('admin.driverVerification.filters.all', 'All') },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              filter === f.key
                ? 'border-green-600 text-green-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Documents List */}
      {documents.length === 0 ? (
        <Card className="p-12 text-center">
          <DocumentCheckIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('admin.driverVerification.noDocuments', 'No Documents Found')}</h3>
          <p className="text-gray-500">
            {filter === 'pending'
              ? t('admin.driverVerification.noPendingDocs', 'No pending documents to review')
              : t('admin.driverVerification.noStatusDocs', 'No {{status}} documents', { replace: { status: filter } })}
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {documents.map((doc) => (
            <Card key={doc.id} className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <DocumentCheckIcon className="w-5 h-5 text-blue-600" />
                    <h3 className="font-semibold text-gray-900">
                      {DOCUMENT_TYPES_MAP[doc.document_type]}
                    </h3>
                    {getStatusBadge(doc.status)}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    {/* Driver Info */}
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-gray-700">{t('admin.driverVerification.driverInfo', 'Driver Information')}</h4>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <UserIcon className="w-4 h-4" />
                        <span>
                          {doc.driver?.first_name} {doc.driver?.last_name}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">{doc.driver?.email}</p>
                      {doc.driver?.phone && (
                        <p className="text-xs text-gray-500">{doc.driver?.phone}</p>
                      )}
                      {doc.driver?.vehicle_type && (
                        <p className="text-xs text-gray-500 capitalize">
                          {t('marketplace.vendor', 'Vehicle')}: {doc.driver?.vehicle_type}
                        </p>
                      )}
                      {doc.driver?.vehicle_plate && (
                        <p className="text-xs text-gray-500">
                          {t('admin.driverVerification.documentDetails.plate', 'Plate')}: {doc.driver?.vehicle_plate}
                        </p>
                      )}
                    </div>

                    {/* Document Details */}
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-gray-700">{t('admin.driverVerification.documentDetails', 'Document Details')}</h4>
                      {doc.document_number && (
                        <p className="text-xs text-gray-600">
                          <span className="font-medium">{t('admin.driverVerification.documentNumber', 'Document #')}:</span> {doc.document_number}
                        </p>
                      )}
                      {doc.issue_date && (
                        <p className="text-xs text-gray-600">
                          <span className="font-medium">{t('admin.driverVerification.issueDate', 'Issue Date')}:</span>{' '}
                          {new Date(doc.issue_date).toLocaleDateString()}
                        </p>
                      )}
                      {doc.expiry_date && (
                        <p className="text-xs text-gray-600">
                          <span className="font-medium">{t('admin.driverVerification.expiryDate', 'Expiry Date')}:</span>{' '}
                          {new Date(doc.expiry_date).toLocaleDateString()}
                        </p>
                      )}
                      <p className="text-xs text-gray-500">
                        <span className="font-medium">{t('admin.driverVerification.uploaded', 'Uploaded')}:</span>{' '}
                        {new Date(doc.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {doc.admin_notes && (
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-600">
                        <span className="font-medium">{t('admin.driverVerification.adminNotes', 'Admin Notes')}:</span> {doc.admin_notes}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 ml-4">
                  <a
                    href={doc.document_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title={t('admin.driverVerification.viewDocument', 'View Document')}
                  >
                    <EyeIcon className="w-5 h-5" />
                  </a>
                  {doc.status === 'pending' && (
                    <button
                      onClick={() => setSelectedDoc(doc)}
                      className="px-3 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                    >
                      {t('admin.driverVerification.review', 'Review')}
                    </button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Review Modal */}
      {selectedDoc && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="max-w-lg w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">{t('admin.driverVerification.reviewModal.title', 'Review Document')}</h2>

            <div className="mb-4">
              <h3 className="font-medium text-gray-900 mb-2">
                {DOCUMENT_TYPES_MAP[selectedDoc.document_type]}
              </h3>
              <p className="text-sm text-gray-600">
                {t('admin.driverVerification.reviewModal.driverLabel', 'Driver')}: {selectedDoc.driver?.first_name} {selectedDoc.driver?.last_name}
              </p>
              <a
                href={selectedDoc.document_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-green-600 hover:underline mt-2 inline-block"
              >
                {t('admin.driverVerification.reviewModal.viewDocumentLink', 'View Document')} →
              </a>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('admin.driverVerification.reviewModal.adminNotesLabel', 'Admin Notes (optional)')}
                </label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder={t('admin.driverVerification.reviewModal.adminNotesPlaceholder', 'Add notes about this review...')}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => handleReview(selectedDoc.id, 'rejected')}
                  disabled={processing === selectedDoc.id}
                  className="flex-1 py-2 px-4 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <XCircleIcon className="w-5 h-5" />
                  {processing === selectedDoc.id ? t('admin.driverVerification.reviewModal.processing', 'Processing...') : t('admin.driverVerification.reviewModal.reject', 'Reject')}
                </button>
                <button
                  onClick={() => handleReview(selectedDoc.id, 'approved')}
                  disabled={processing === selectedDoc.id}
                  className="flex-1 py-2 px-4 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <CheckCircleIcon className="w-5 h-5" />
                  {processing === selectedDoc.id ? t('admin.driverVerification.reviewModal.processing', 'Processing...') : t('admin.driverVerification.reviewModal.approve', 'Approve')}
                </button>
              </div>

              <button
                onClick={() => {
                  setSelectedDoc(null)
                  setAdminNotes('')
                }}
                className="w-full py-2 px-4 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                {t('admin.driverVerification.reviewModal.cancel', 'Cancel')}
              </button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

export default AdminDriverVerification
