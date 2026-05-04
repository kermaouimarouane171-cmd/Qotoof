import { useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/services/supabase'
import { XMarkIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { logger } from '../utils/logger.js'

const ReportAbuseModal = ({ isOpen, onClose, reportedUserId = null, reportType = null, category = 'user', categoryId = null }) => {
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState(1)
  const [selectedType, setSelectedType] = useState(reportType || '')
  const [description, setDescription] = useState('')
  const [evidence, setEvidence] = useState('')

  const reportTypes = [
    {
      id: 'illegal_activity',
      label: 'Illegal Activity',
      icon: '🚫',
      description: 'Selling illegal or prohibited items',
      color: 'red'
    },
    {
      id: 'false_info',
      label: 'False Information',
      icon: '⚠️',
      description: 'Misleading product info or fake reviews',
      color: 'orange'
    },
    {
      id: 'fee_circumvention',
      label: 'Fee Circumvention',
      icon: '💰',
      description: 'Attempting to avoid platform fees',
      color: 'yellow'
    },
    {
      id: 'harassment',
      label: 'Harassment',
      icon: '👥',
      description: 'Abusive, threatening, or discriminatory behavior',
      color: 'purple'
    },
    {
      id: 'security_violation',
      label: 'Security Violation',
      icon: '🔒',
      description: 'Hacking, scraping, or security bypass attempts',
      color: 'blue'
    },
    {
      id: 'spam',
      label: 'Spam',
      icon: '📧',
      description: 'Unsolicited messages or advertisements',
      color: 'gray'
    },
  ]

  const handleSubmit = async () => {
    if (!selectedType) {
      toast.error('Please select a report type')
      return
    }

    if (!description.trim()) {
      toast.error('Please provide a description')
      return
    }

    try {
      setLoading(true)

      const { error } = await supabase.rpc('create_user_report', {
        p_reporter_id: user.id,
        p_reported_user_id: reportedUserId,
        p_report_type: selectedType,
        p_category: category,
        p_category_id: categoryId,
        p_description: description,
        p_evidence_urls: evidence ? evidence.split('\n').filter(u => u.trim()) : null,
      })

      if (error) throw error

      toast.success('Report submitted successfully. Our team will review it within 24 hours.')
      handleClose()
    } catch (error) {
      logger.error('Submit report error:', error)
      toast.error('Failed to submit report')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setStep(1)
    setSelectedType('')
    setDescription('')
    setEvidence('')
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-xl font-bold text-gray-900">Report Abuse</h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          {/* Step 1: Select Type */}
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-gray-600 mb-4">
                What type of violation are you reporting?
              </p>
              <div className="grid grid-cols-1 gap-3">
                {reportTypes.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => {
                      setSelectedType(type.id)
                      setStep(2)
                    }}
                    className={`flex items-start gap-3 p-4 border-2 rounded-xl text-left transition-all hover:shadow-md ${
                      selectedType === type.id
                        ? `border-${type.color}-500 bg-${type.color}-50`
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <span className="text-2xl">{type.icon}</span>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">{type.label}</p>
                      <p className="text-sm text-gray-500">{type.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Details */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <button
                  onClick={() => setStep(1)}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  ← Back
                </button>
              </div>

              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">Reporting:</p>
                <p className="font-medium">
                  {reportTypes.find(t => t.id === selectedType)?.label}
                </p>
              </div>

              <div>
                <label htmlFor="report-description" className="input-label">Description *</label>
                <textarea
                  id="report-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="input h-32 resize-none"
                  placeholder="Please describe what happened in detail..."
                  maxLength={2000}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {description.length}/2000 characters
                </p>
              </div>

              <div>
                <label htmlFor="report-evidence" className="input-label">Evidence (Optional)</label>
                <textarea
                  id="report-evidence"
                  value={evidence}
                  onChange={(e) => setEvidence(e.target.value)}
                  className="input h-20 resize-none"
                  placeholder="Paste URLs of screenshots or evidence (one per line)..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  Include links to screenshots, messages, or other evidence
                </p>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-800">
                  ⚠️ <strong>Note:</strong> False reports may result in account suspension. 
                  Please only submit genuine concerns.
                </p>
              </div>

              <button
                onClick={handleSubmit}
                disabled={loading || !description.trim()}
                className="btn-primary w-full disabled:opacity-50"
              >
                {loading ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ReportAbuseModal
