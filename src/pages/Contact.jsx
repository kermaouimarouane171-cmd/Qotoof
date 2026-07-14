import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/services/supabase'
import { Card, Input } from '@/components/ui'
import AuthGate from '@/components/auth/AuthGate'
import { EnvelopeIcon, PhoneIcon, MapPinIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline'
import { logger } from '@/utils/logger'
import toast from 'react-hot-toast'
import { APP_CONFIG, getWhatsappUrl } from '@/config/appConfig'

const Contact = () => {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  })
  const [loading, setLoading] = useState(false)
  const [emailError, setEmailError] = useState('')

  const validateEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return re.test(email)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setEmailError('')

    if (!validateEmail(formData.email)) {
      setEmailError(t('contact.errors.invalidEmail'))
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase
        .from('contact_messages')
        .insert({
          user_id: user?.id || null,
          name: formData.name,
          email: formData.email,
          subject: formData.subject,
          message: formData.message,
          status: 'new',
        })

      if (error) throw error

      toast.success(t('contact.success'))
      setFormData({ name: '', email: '', subject: '', message: '' })
    } catch (error) {
      logger.error('Error sending contact message:', error)
      toast.error(t('contact.error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">{t('contact.title')}</h1>
        <p className="text-gray-600">{t('contact.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Contact Info */}
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <EnvelopeIcon className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">{t('contact.email')}</h3>
                <p className="text-sm text-gray-600">{APP_CONFIG.supportEmail}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <PhoneIcon className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">{t('contact.phone')}</h3>
                <p className="text-sm text-gray-600">{APP_CONFIG.supportPhoneDisplay}</p>
                <p className="text-xs text-gray-500">{t('contact.phoneHours')}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <PhoneIcon className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">{t('contact.whatsapp')}</h3>
                <a href={getWhatsappUrl(t('contact.whatsappMessage'))} target="_blank" rel="noreferrer" className="text-sm text-green-700 hover:underline">
                  {APP_CONFIG.supportWhatsappDisplay}
                </a>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <MapPinIcon className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">{t('contact.address')}</h3>
                <p className="text-sm text-gray-600">{t('contact.addressValue', APP_CONFIG.headquarters)}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Contact Form — authenticated users only to match RLS */}
        <Card className="lg:col-span-2 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">{t('contact.formTitle')}</h2>
          {user ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label={t('contact.form.name')}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
                <div>
                  <Input
                    label={t('contact.form.email')}
                    type="email"
                    value={formData.email}
                    onChange={(e) => { setFormData({ ...formData, email: e.target.value }); setEmailError('') }}
                    required
                  />
                  {emailError && (
                    <p className="mt-1 text-sm text-red-600">{emailError}</p>
                  )}
                </div>
              </div>
              <Input
                label={t('contact.form.subject')}
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                required
              />
              <div>
                <label className="input-label">{t('contact.form.message')}</label>
                <textarea
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="input h-32 resize-none"
                  required
                />
              </div>
              <button type="submit" className="btn-primary w-full sm:w-auto" disabled={loading}>
                <span className="flex items-center justify-center gap-2">
                  <PaperAirplaneIcon className="w-4 h-4" />
                  {loading ? t('contact.form.sending') : t('contact.form.send')}
                </span>
              </button>
            </form>
          ) : (
            <AuthGate
              title={t('contact.authRequired', 'Please sign in to send us a message.')}
              from="/contact"
            />
          )}
        </Card>
      </div>
    </div>
  )
}

export default Contact
