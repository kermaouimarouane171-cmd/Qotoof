// DriverVerification component - Handles driver license and insurance upload
import { useState, useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import { Card, LoadingSpinner } from '@/components/ui'
import { DocumentIcon, CheckCircleIcon, XCircleIcon, ClockIcon, ArrowUpTrayIcon } from '@heroicons/react/24/outline'
import { supabase } from '@/services/supabase'
import toast from 'react-hot-toast'
import { logger } from '@/utils/logger'

const DOCUMENT_TYPES = [
  {
    type: 'driver_license',
    label: "Driver's License",
    icon: '🪪',
    required: true,
    description: 'Valid driver license (front and back)',
    fields: ['document_number', 'issue_date', 'expiry_date']
  },
  {
    type: 'vehicle_insurance',
    label: 'Vehicle Insurance',
    icon: '🛡️',
    required: true,
    description: 'Current vehicle insurance certificate',
    fields: ['document_number', 'expiry_date']
  },
  {
    type: 'vehicle_registration',
    label: 'Vehicle Registration',
    icon: '🚗',
    required: false,
    description: 'Vehicle registration document',
    fields: ['document_number']
  }
]

const DriverVerification = () => {
  const { user, profile } = useAuthStore()
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [selectedDoc, setSelectedDoc] = useState(null)
  const [formData, setFormData] = useState({
    document_number: '',
    issue_date: '',
    expiry_date: ''
  })

  useEffect(() => {
    if (user) loadDocuments()
  }, [user])

  const loadDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from('driver_verification_documents')
        .select('*')
        .eq('driver_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setDocuments(data || [])
    } catch (error) {
      logger.error('Error loading documents:', error)
      toast.error('Failed to load documents')
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async (e, docType) => {
    const file = e.target.files[0]
    if (!file) return

    // Validate file
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB')
      return
    }

    if (!file.type.startsWith('image/')) {
      toast.error('Only image files are allowed')
      return
    }

    setUploading(true)
    setSelectedDoc(docType)

    try {
      // Upload to storage
      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}/${docType}_${Date.now()}.${fileExt}`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('driver-documents')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) throw uploadError

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('driver-documents')
        .getPublicUrl(fileName)

      // Create document record
      const { error: dbError } = await supabase
        .from('driver_verification_documents')
        .insert({
          driver_id: user.id,
          document_type: docType,
          document_url: urlData.publicUrl,
          document_number: formData.document_number || null,
          issue_date: formData.issue_date || null,
          expiry_date: formData.expiry_date || null,
          status: 'pending'
        })

      if (dbError) throw dbError

      // Notify all admins about the new document submission
      const { data: admins } = await supabase
        .from('profiles')
        .select('id, first_name')
        .eq('role', 'admin')

      if (admins && admins.length > 0) {
        const adminNotifications = admins.map(admin => ({
          user_id: admin.id,
          title: '📄 Driver Document Submitted for Review',
          message: `${profile?.first_name || 'A driver'} has uploaded ${docType.replace('_', ' ')} for verification. Please review.`,
          type: 'driver_verification',
          data: JSON.stringify({
            driver_id: user.id,
            document_type: docType,
            driver_name: `${profile?.first_name || ''} ${profile?.last_name || ''}`
          })
        }))

        const { error: notifError } = await supabase
          .from('notifications')
          .insert(adminNotifications)

        if (notifError) {
          logger.error('Failed to notify admins:', notifError)
        }
      }

      toast.success('Document uploaded successfully. Waiting for admin review.')
      loadDocuments()
      setFormData({ document_number: '', issue_date: '', expiry_date: '' })
    } catch (error) {
      logger.error('Upload error:', error)
      toast.error('Failed to upload document')
    } finally {
      setUploading(false)
      setSelectedDoc(null)
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'approved':
        return <CheckCircleIcon className="w-5 h-5 text-green-600" />
      case 'rejected':
        return <XCircleIcon className="w-5 h-5 text-red-600" />
      default:
        return <ClockIcon className="w-5 h-5 text-yellow-600" />
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved':
        return 'bg-green-50 border-green-200'
      case 'rejected':
        return 'bg-red-50 border-red-200'
      default:
        return 'bg-yellow-50 border-yellow-200'
    }
  }

  const getDocumentStatus = (docType) => {
    const doc = documents.find(d => d.document_type === docType)
    return doc?.status || 'not_uploaded'
  }

  const isVerified = profile?.license_verified && profile?.insurance_verified

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Verification Status Banner */}
      <Card className={`p-6 border-2 ${isVerified ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isVerified ? 'bg-green-100' : 'bg-yellow-100'}`}>
            {isVerified ? (
              <CheckCircleIcon className="w-7 h-7 text-green-600" />
            ) : (
              <ClockIcon className="w-7 h-7 text-yellow-600" />
            )}
          </div>
          <div className="flex-1">
            <h3 className={`text-lg font-semibold ${isVerified ? 'text-green-900' : 'text-yellow-900'}`}>
              {isVerified ? '✅ Verified Driver' : '⏳ Verification Pending'}
            </h3>
            <p className={`text-sm mt-1 ${isVerified ? 'text-green-700' : 'text-yellow-700'}`}>
              {isVerified
                ? 'All your documents are verified. You can accept deliveries.'
                : 'Please upload all required documents to start accepting deliveries.'}
            </p>
            {!isVerified && (
              <div className="mt-3 flex gap-2 text-xs">
                {!profile?.license_verified && (
                  <span className="px-2 py-1 bg-red-100 text-red-700 rounded">❌ License Required</span>
                )}
                {!profile?.insurance_verified && (
                  <span className="px-2 py-1 bg-red-100 text-red-700 rounded">❌ Insurance Required</span>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Document Upload Cards */}
      {DOCUMENT_TYPES.map((docType) => {
        const status = getDocumentStatus(docType.type)
        const existingDoc = documents.find(d => d.document_type === docType.type)

        return (
          <Card key={docType.type} className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-start gap-3">
                <span className="text-3xl">{docType.icon}</span>
                <div>
                  <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                    {docType.label}
                    {docType.required && <span className="text-red-500 text-xs">*</span>}
                  </h4>
                  <p className="text-sm text-gray-500 mt-1">{docType.description}</p>
                </div>
              </div>
              {status !== 'not_uploaded' && getStatusIcon(status)}
            </div>

            {existingDoc && (
              <div className={`p-3 rounded-lg border mb-4 ${getStatusColor(status)}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium capitalize">{status}</p>
                    {existingDoc.admin_notes && (
                      <p className="text-xs text-gray-600 mt-1">Note: {existingDoc.admin_notes}</p>
                    )}
                    {existingDoc.expiry_date && (
                      <p className="text-xs text-gray-500 mt-1">
                        Expires: {new Date(existingDoc.expiry_date).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <a
                    href={existingDoc.document_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-green-600 hover:underline"
                  >
                    View Document
                  </a>
                </div>
              </div>
            )}

            {/* Upload Form */}
            {status === 'not_uploaded' || status === 'rejected' ? (
              <div className="space-y-3">
                {docType.fields.includes('document_number') && (
                  <input
                    type="text"
                    placeholder="Document Number"
                    value={formData.document_number}
                    onChange={(e) => setFormData({ ...formData, document_number: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                )}
                
                {docType.fields.includes('issue_date') && (
                  <input
                    type="date"
                    placeholder="Issue Date"
                    value={formData.issue_date}
                    onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                )}

                {docType.fields.includes('expiry_date') && (
                  <input
                    type="date"
                    placeholder="Expiry Date"
                    value={formData.expiry_date}
                    onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                )}

                <label className="flex items-center justify-center w-full p-4 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-green-500 hover:bg-green-50 transition-colors">
                  <div className="text-center">
                    <ArrowUpTrayIcon className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                    <p className="text-sm text-gray-600">
                      {uploading && selectedDoc === docType.type ? 'Uploading...' : 'Click to upload image'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">PNG, JPG up to 5MB</p>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e, docType.type)}
                    disabled={uploading}
                    className="hidden"
                  />
                </label>
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">
                {status === 'pending' ? '⏳ Waiting for admin review...' : '✅ Document verified'}
              </p>
            )}
          </Card>
        )
      })}

      {/* Important Notice */}
      <Card className="p-4 bg-blue-50 border-blue-200">
        <h4 className="font-semibold text-blue-900 mb-2">📋 Important Notes:</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Driver's License and Vehicle Insurance are <strong>mandatory</strong></li>
          <li>• You cannot accept deliveries until your documents are verified</li>
          <li>• Documents are reviewed by admin within 24-48 hours</li>
          <li>• You will receive a notification when your documents expire</li>
          <li>• Make sure document photos are clear and all details are visible</li>
        </ul>
      </Card>
    </div>
  )
}

export default DriverVerification
