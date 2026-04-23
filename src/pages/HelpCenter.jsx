import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { Card } from '@/components/ui'
import { supabase } from '@/services/supabase'
import FAQS from '@/data/faqData'
import {
  ArrowLeftIcon,
  QuestionMarkCircleIcon,
  ChatBubbleLeftRightIcon,
  PhoneIcon,
  EnvelopeIcon,
  PlusIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { logger } from '@/utils/logger'
import { APP_CONFIG } from '@/config/appConfig'

const HelpCenter = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { hash } = useLocation()
  const { user } = useAuthStore()

  // Scroll to FAQ section when navigated via /faq redirect or direct anchor link
  useEffect(() => {
    if (hash === '#faq') {
      const el = document.getElementById('faq')
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [hash])
  const [expandedFaq, setExpandedFaq] = useState(null)
  const [showTicketForm, setShowTicketForm] = useState(false)
  const [ticketSubject, setTicketSubject] = useState('')
  const [ticketDescription, setTicketDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmitTicket = async (e) => {
    e.preventDefault()
    if (!ticketSubject.trim() || !ticketDescription.trim()) {
      toast.error(t('helpCenter.errors.fillFields', 'Please fill in all fields'))
      return
    }

    setSubmitting(true)
    try {
      const { error } = await supabase
        .from('support_tickets')
        .insert({
          user_id: user.id,
          subject: ticketSubject.trim(),
          description: ticketDescription.trim(),
          status: 'open',
        })

      if (error) throw error
      toast.success(t('helpCenter.ticketSuccess', "Support ticket submitted! We'll respond within 24 hours."))
      setTicketSubject('')
      setTicketDescription('')
      setShowTicketForm(false)
    } catch (error) {
      logger.error('Error submitting ticket:', error)
      toast.error(t('helpCenter.ticketError', 'Failed to submit ticket'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate('/buyer/dashboard')} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <QuestionMarkCircleIcon className="w-7 h-7 text-blue-600" />
            {t('helpCenter.title', 'Help Center')}
          </h1>
          <p className="text-sm text-gray-500 mt-1">{t('helpCenter.subtitle', 'Find answers or contact support')}</p>
        </div>
      </div>

      {/* Contact Options */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <Card className="p-5 text-center cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setShowTicketForm(true)}>
          <ChatBubbleLeftRightIcon className="w-8 h-8 text-green-600 mx-auto mb-2" />
          <h3 className="font-semibold text-gray-900">{t('helpCenter.contact.ticket', 'Support Ticket')}</h3>
          <p className="text-xs text-gray-500 mt-1">{t('helpCenter.contact.ticketDesc', 'Submit a ticket')}</p>
        </Card>
        <a href={`tel:${APP_CONFIG.supportPhone}`} className="block">
          <Card className="p-5 text-center hover:shadow-md transition-shadow">
            <PhoneIcon className="w-8 h-8 text-blue-600 mx-auto mb-2" />
            <h3 className="font-semibold text-gray-900">{t('helpCenter.contact.call', 'Call Us')}</h3>
            <p className="text-xs text-gray-500 mt-1">{APP_CONFIG.supportPhoneDisplay}</p>
          </Card>
        </a>
        <a href={`mailto:${APP_CONFIG.supportEmail}`} className="block">
          <Card className="p-5 text-center hover:shadow-md transition-shadow">
            <EnvelopeIcon className="w-8 h-8 text-purple-600 mx-auto mb-2" />
            <h3 className="font-semibold text-gray-900">{t('helpCenter.contact.email', 'Email')}</h3>
            <p className="text-xs text-gray-500 mt-1">{APP_CONFIG.supportEmail}</p>
          </Card>
        </a>
      </div>

      {/* Submit Ticket Form */}
      {showTicketForm && (
        <Card className="p-6 mb-8 border-2 border-green-200 bg-green-50/30">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">{t('helpCenter.ticketForm.title', 'Submit a Support Ticket')}</h2>
            <button onClick={() => setShowTicketForm(false)} className="p-1 hover:bg-gray-100 rounded-lg">
              <XMarkIcon className="w-5 h-5 text-gray-400" />
            </button>
          </div>
          <form onSubmit={handleSubmitTicket} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('helpCenter.ticketForm.subject', 'Subject')}</label>
              <input
                type="text"
                value={ticketSubject}
                onChange={(e) => setTicketSubject(e.target.value)}
                placeholder={t('helpCenter.ticketForm.subjectPlaceholder', 'Brief description of your issue')}
                className="input"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('helpCenter.ticketForm.description', 'Description')}</label>
              <textarea
                value={ticketDescription}
                onChange={(e) => setTicketDescription(e.target.value)}
                rows={4}
                placeholder={t('helpCenter.ticketForm.descriptionPlaceholder', 'Describe your issue in detail...')}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                required
              />
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowTicketForm(false)} className="btn-outline flex-1">
                {t('common.cancel', 'Cancel')}
              </button>
              <button type="submit" disabled={submitting} className="btn-primary flex-1 disabled:opacity-60">
                {submitting ? t('helpCenter.ticketForm.submitting', 'Submitting...') : t('helpCenter.ticketForm.submit', 'Submit Ticket')}
              </button>
            </div>
          </form>
        </Card>
      )}

      {/* FAQs */}
      <div id="faq" className="scroll-mt-20">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('helpCenter.faq.title', 'Frequently Asked Questions')}</h2>
        <div className="space-y-6">
          {FAQS.map(category => (
            <div key={category.category}>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">{category.category}</h3>
              <div className="space-y-2">
                {category.questions.map((faq, idx) => {
                  const key = `${category.category}-${idx}`
                  const isExpanded = expandedFaq === key
                  return (
                    <Card key={key} className="overflow-hidden">
                      <button
                        onClick={() => setExpandedFaq(isExpanded ? null : key)}
                        className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
                      >
                        <span className="font-medium text-sm text-gray-900 pr-4">{faq.q}</span>
                        <PlusIcon className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-45' : ''}`} />
                      </button>
                      {isExpanded && (
                        <div className="px-4 pb-4">
                          <p className="text-sm text-gray-600 leading-relaxed">{faq.a}</p>
                        </div>
                      )}
                    </Card>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default HelpCenter
