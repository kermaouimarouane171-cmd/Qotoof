import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/services/supabase'
import { Card, LoadingSpinner } from '@/components/ui'
import { PhoneVerificationDialog } from '@/components/auth/PhoneVerification'
import ErrorBoundary from '@/components/ErrorBoundary'
import {
  BuildingLibraryIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  PencilIcon,
  TrashIcon,
  InformationCircleIcon,
  ShieldCheckIcon,
  EyeIcon,
  EyeSlashIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { logger } from '@/utils/logger'
import { auditLogger } from '@/services/auditLogger'
import { checkBankAccountRate, RateLimitError } from '@/utils/rateLimiter'

// Moroccan Banks List
const moroccanBanks = [
  { name: 'Attijariwafa Bank', code: 'attijariwafa', color: '#F37021' },
  { name: 'BMCE Bank of Africa', code: 'bmce', color: '#0066B3' },
  { name: 'Banque Populaire', code: 'bp', color: '#E30613' },
  { name: 'CIH Bank', code: 'cih', color: '#6B2D8B' },
  { name: 'Crédit du Maroc', code: 'cdm', color: '#009639' },
  { name: 'Société Générale Maroc', code: 'sg', color: '#E2001A' },
  { name: 'Al Barid Bank', code: 'barid', color: '#FFD100' },
  { name: 'CDG Capital', code: 'cdg', color: '#005EB8' },
  { name: 'CFG Bank', code: 'cfg', color: '#003366' },
  { name: 'Umnia Bank', code: 'umnia', color: '#8B0000' },
  { name: 'Bank Assafa', code: 'assafa', color: '#00A651' },
  { name: 'Dar Al Amane', code: 'daralamane', color: '#0057B8' },
]

// ============================================================
// MASKING HELPERS
// ============================================================
const maskRIB = (rib) => {
  if (!rib || rib.length < 4) return rib
  return '•••• •••• •••• •••• •••• ' + rib.slice(-4)
}

const maskIBAN = (iban) => {
  if (!iban || iban.length < 4) return iban
  return 'MA64 •••• •••• •••• •••• ' + iban.slice(-4)
}

// Moroccan RIB structure validation
// Format: BBB GGG GGGG GGGG GGGG GGGG (Bank code + Branch code + Account number + Key)
const validateRIBStructure = (rib) => {
  if (!rib || rib.length !== 24) return false

  const bankCode = rib.substring(0, 3)
  const branchCode = rib.substring(3, 6)
  const accountNumber = rib.substring(6, 16)
  const key = rib.substring(16, 24)

  return /^\d{3}$/.test(bankCode) &&
         /^\d{3}$/.test(branchCode) &&
         /^\d{10}$/.test(accountNumber) &&
         /^\d{8}$/.test(key)
}

const BankAccountPage = () => {
  const { t } = useTranslation()
  const { user, profile } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [editing, setEditing] = useState(false)
  const [bankAccount, setBankAccount] = useState(null)
  const [formData, setFormData] = useState({
    bank_name: '',
    account_holder: '',
    rib: '',
    iban: '',
  })
  const [errors, setErrors] = useState({})

  // SECURITY: Masking state
  const [showFullRIB, setShowFullRIB] = useState(false)
  const [showFullIBAN, setShowFullIBAN] = useState(false)

  // SECURITY: Re-authentication state
  const [requiresAuth, setRequiresAuth] = useState(false)
  const [authPassword, setAuthPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [pendingAction, setPendingAction] = useState(null)
  const [showPhoneVerification, setShowPhoneVerification] = useState(false)
  const [pendingBankSave, setPendingBankSave] = useState(null)

  // HTTPS check in production
  useEffect(() => {
    if (window.location.protocol !== 'https:' && import.meta.env.PROD) {
      toast.error(t('bankAccount.errors.httpsRequired', 'This page requires a secure connection (HTTPS)'))
      window.location.href = window.location.href.replace('http://', 'https://')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    loadBankAccount()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadBankAccount = async () => {
    try {
      const { data, error } = await supabase
        .from('bank_accounts')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (error && error.code !== 'PGRST116') throw error

      if (data) {
        setBankAccount(data)
        setFormData({
          bank_name: data.bank_name,
          account_holder: data.account_holder,
          rib: data.rib,
          iban: data.iban || '',
        })
      }
    } catch (error) {
      logger.error('Load bank account error:', error)
    } finally {
      setLoading(false)
    }
  }

  const validateForm = () => {
    const newErrors = {}

    if (!formData.bank_name) {
      newErrors.bank_name = t('bankAccount.errors.selectBank', 'Please select a bank')
    }

    if (!formData.account_holder.trim()) {
      newErrors.account_holder = t('bankAccount.errors.accountHolderRequired', 'Account holder name is required')
    }

    if (!formData.rib.trim()) {
      newErrors.rib = t('bankAccount.errors.ribRequired', 'RIB is required')
    } else if (!validateRIBStructure(formData.rib)) {
      newErrors.rib = t('bankAccount.errors.invalidRIB', 'Invalid RIB format (BBB GGG GGGG GGGG GGGG GGGG)')
    }

    if (formData.iban && !/^MA64[0-9]{21}$/.test(formData.iban.replace(/\s/g, ''))) {
      newErrors.iban = t('bankAccount.errors.invalidIBAN', 'Invalid IBAN format (MA64 + 21 digits)')
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // ============================================================
  // RE-AUTHENTICATION HANDLERS
  // ============================================================
  const handleEditClick = () => {
    // Require re-authentication before editing
    setRequiresAuth(true)
    setPendingAction('edit')
  }

  const handleDeleteClick = () => {
    // Require re-authentication before deleting
    setRequiresAuth(true)
    setPendingAction('delete')
  }

  const handleReAuthenticate = async () => {
    setAuthError('')

    try {
      // Verify user's password
      const { error } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: authPassword,
      })

      if (error) {
        setAuthError(t('bankAccount.auth.incorrectPassword', 'Incorrect password'))
        return
      }

      // Password verified - proceed with pending action
      setRequiresAuth(false)
      setAuthPassword('')

      if (pendingAction === 'edit') {
        setEditing(true)
      } else if (pendingAction === 'delete') {
        await handleDeleteConfirmed()
      }

      setPendingAction(null)
    } catch (error) {
      logger.error('Re-authentication error:', error)
      setAuthError(t('bankAccount.auth.failed', 'Failed to verify password'))
    }
  }

  const persistBankAccount = async (payload) => {
    try {
      setSaving(true)

      const { data, error } = await supabase.rpc('upsert_bank_account', {
        p_user_id: user.id,
        p_bank_name: payload.bank_name,
        p_account_holder: payload.account_holder,
        p_rib: payload.rib,
        p_iban: payload.iban || null,
      })

      if (error) throw error

      if (data.success) {
        // SECURITY: AUDIT LOG - Bank account added/updated
        await auditLogger.logFinancialAction('BANK_ACCOUNT_UPDATED', user.id, {
          bankName: payload.bank_name,
          accountHolder: payload.account_holder,
          // NEVER log full RIB/IBAN - only last 4 digits
          ribLast4: payload.rib?.slice(-4),
          ibanLast4: payload.iban?.slice(-4),
          action: bankAccount ? 'updated' : 'created',
        })

        toast.success(t('bankAccount.saved', 'Bank account saved successfully!'))
        await loadBankAccount()
        setEditing(false)
        setShowFullRIB(false)
        setShowFullIBAN(false)
      } else {
        toast.error(data.error || t('bankAccount.errors.saveFailed', 'Failed to save bank account'))
      }
    } catch (error) {
      logger.error('Save bank account error:', error)
      toast.error(error.message || t('bankAccount.errors.saveFailed', 'Failed to save bank account'))
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!validateForm()) return

    try {
      try {
        checkBankAccountRate(user.id)
      } catch (err) {
        if (err instanceof RateLimitError) {
          toast.error(t('bankAccount.errors.rateLimited', 'Too many bank account changes. Please wait before trying again.'))
          return
        }
      }

      if (!profile?.phone) {
        toast.error('أضف رقم هاتف إلى الحساب قبل حفظ الحساب البنكي')
        return
      }

      setPendingBankSave({ ...formData })
      setShowPhoneVerification(true)
    } catch (error) {
      logger.error('Bank account verification preparation error:', error)
      toast.error('تعذر تجهيز التحقق من الهاتف الآن')
    }
  }

  const handleDeleteConfirmed = async () => {
    setDeleting(true)
    try {
      const { error } = await supabase
        .from('bank_accounts')
        .delete()
        .eq('user_id', user.id)

      if (error) throw error

      // SECURITY: AUDIT LOG - Bank account deleted
      await auditLogger.logFinancialAction('BANK_ACCOUNT_DELETED', user.id, {
        bankName: bankAccount?.bank_name,
        ribLast4: bankAccount?.rib?.slice(-4),
      })

      toast.success(t('bankAccount.deleted', 'Bank account deleted'))
      setBankAccount(null)
      setFormData({ bank_name: '', account_holder: '', rib: '', iban: '' })
      setEditing(false)
    } catch (_error) {
      toast.error(t('bankAccount.errors.deleteFailed', 'Failed to delete bank account'))
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {t('bankAccount.title', 'Bank Account')}
        </h1>
        <p className="text-gray-600">
          {t('bankAccount.subtitle', 'Add your bank account to receive payments')}
        </p>
      </div>

      {/* Info Banner */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
        <div className="flex items-start gap-3">
          <InformationCircleIcon className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">{t('bankAccount.info.title', 'Why do we need your bank account?')}</p>
            <p>
              {t('bankAccount.info.description', 'Your bank account is used to receive payments. All information is encrypted and secure.')}
            </p>
          </div>
        </div>
      </div>

      <Card className="p-6">
        {/* Existing Account Display */}
        {bankAccount && !editing ? (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                  <BuildingLibraryIcon className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900">{bankAccount.bank_name}</h2>
                  <p className="text-sm text-gray-500">{bankAccount.account_holder}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleEditClick}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                  aria-label={t('bankAccount.edit', 'Edit bank account')}
                >
                  <PencilIcon className="w-5 h-5" />
                </button>
                <button
                  onClick={handleDeleteClick}
                  disabled={deleting}
                  className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg disabled:opacity-50"
                  aria-label={t('bankAccount.delete', 'Delete bank account')}
                >
                  {deleting ? (
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <TrashIcon className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* SECURITY: Masked bank account details */}
            <div className="space-y-3 p-4 bg-gray-50 rounded-xl">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">{t('bankAccount.fields.bank', 'Bank')}</span>
                <span className="font-medium">{bankAccount.bank_name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">{t('bankAccount.fields.rib', 'RIB')}</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-medium">
                    {showFullRIB ? bankAccount.rib : maskRIB(bankAccount.rib)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowFullRIB(!showFullRIB)}
                    className="text-xs text-green-600 hover:underline"
                    aria-label={showFullRIB ? t('bankAccount.hide', 'Hide') : t('bankAccount.show', 'Show')}
                  >
                    {showFullRIB ? (
                      <EyeSlashIcon className="w-4 h-4" />
                    ) : (
                      <EyeIcon className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
              {bankAccount.iban && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{t('bankAccount.fields.iban', 'IBAN')}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-medium">
                      {showFullIBAN ? bankAccount.iban : maskIBAN(bankAccount.iban)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowFullIBAN(!showFullIBAN)}
                      className="text-xs text-green-600 hover:underline"
                      aria-label={showFullIBAN ? t('bankAccount.hide', 'Hide') : t('bankAccount.show', 'Show')}
                    >
                      {showFullIBAN ? (
                        <EyeSlashIcon className="w-4 h-4" />
                      ) : (
                        <EyeIcon className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">{t('bankAccount.fields.status', 'Status')}</span>
                {bankAccount.is_verified ? (
                  <span className="flex items-center gap-1 text-green-600">
                    <CheckCircleIcon className="w-4 h-4" />
                    {t('bankAccount.status.verified', 'Verified')}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-yellow-600">
                    <ExclamationTriangleIcon className="w-4 h-4" />
                    {t('bankAccount.status.pending', 'Pending')}
                  </span>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Form */
          <form onSubmit={handleSubmit} className="space-y-6">
            <h2 className="font-semibold text-gray-900">
              {bankAccount ? t('bankAccount.form.edit', 'Edit Bank Account') : t('bankAccount.form.add', 'Add Bank Account')}
            </h2>

            {/* Bank Selection */}
            <div>
              <label className="input-label">{t('bankAccount.form.selectBank', 'Select Your Bank')} *</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {moroccanBanks.map((bank) => (
                  <button
                    key={bank.code}
                    type="button"
                    onClick={() => {
                      setFormData({ ...formData, bank_name: bank.name })
                      setErrors({ ...errors, bank_name: null })
                    }}
                    className={`p-3 border-2 rounded-xl text-sm font-medium transition-all ${
                      formData.bank_name === bank.name
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div
                      className="w-3 h-3 rounded-full mx-auto mb-2"
                      style={{ backgroundColor: bank.color }}
                    />
                    <span className="text-xs">{bank.name}</span>
                  </button>
                ))}
              </div>
              {errors.bank_name && (
                <p className="text-red-500 text-xs mt-1">{errors.bank_name}</p>
              )}
            </div>

            {/* Account Holder */}
            <div>
              <label className="input-label">{t('bankAccount.form.accountHolder', 'Account Holder Name')} *</label>
              <input
                type="text"
                value={formData.account_holder}
                onChange={(e) => {
                  setFormData({ ...formData, account_holder: e.target.value })
                  setErrors({ ...errors, account_holder: null })
                }}
                className={`input ${errors.account_holder ? 'border-red-500' : ''}`}
                placeholder={t('bankAccount.form.accountHolderPlaceholder', 'Full name as it appears on your bank account')}
              />
              {errors.account_holder && (
                <p className="text-red-500 text-xs mt-1">{errors.account_holder}</p>
              )}
            </div>

            {/* RIB */}
            <div>
              <label className="input-label">{t('bankAccount.form.rib', 'RIB (Relevé d\'Identité Bancaire)')} *</label>
              <input
                type="text"
                value={formData.rib}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 24)
                  setFormData({ ...formData, rib: value })
                  setErrors({ ...errors, rib: null })
                }}
                className={`input font-mono ${errors.rib ? 'border-red-500' : ''}`}
                placeholder={t('bankAccount.form.ribPlaceholder', '24 digits')}
                maxLength={24}
              />
              <p className="text-xs text-gray-500 mt-1">
                {t('bankAccount.form.ribHint', 'Your RIB is 24 digits - found on your bank statements')}
              </p>
              {errors.rib && (
                <p className="text-red-500 text-xs mt-1">{errors.rib}</p>
              )}
            </div>

            {/* IBAN (Optional) */}
            <div>
              <label className="input-label">{t('bankAccount.form.iban', 'IBAN (Optional)')}</label>
              <input
                type="text"
                value={formData.iban}
                onChange={(e) => {
                  setFormData({ ...formData, iban: e.target.value })
                  setErrors({ ...errors, iban: null })
                }}
                className={`input font-mono ${errors.iban ? 'border-red-500' : ''}`}
                placeholder={t('bankAccount.form.ibanPlaceholder', 'MA64 0000 0000 0000 0000 0000 000')}
              />
              {errors.iban && (
                <p className="text-red-500 text-xs mt-1">{errors.iban}</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              {editing && (
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false)
                    setFormData({
                      bank_name: bankAccount.bank_name,
                      account_holder: bankAccount.account_holder,
                      rib: bankAccount.rib,
                      iban: bankAccount.iban || '',
                    })
                  }}
                  className="btn-outline flex-1"
                >
                  {t('common.cancel', 'Cancel')}
                </button>
              )}
              <button
                type="submit"
                disabled={saving}
                className="btn-primary flex-1 disabled:opacity-50"
              >
                {saving ? t('bankAccount.form.saving', 'Saving...') : bankAccount ? t('bankAccount.form.update', 'Update') : t('bankAccount.form.save', 'Save Bank Account')}
              </button>
            </div>
          </form>
        )}
      </Card>

      {/* ============================================================
          SECURITY: Re-authentication Modal
          ============================================================ */}
      {requiresAuth && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                <ShieldCheckIcon className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">
                  {t('bankAccount.auth.title', 'Re-authentication Required')}
                </h3>
                <p className="text-sm text-gray-500">
                  {t('bankAccount.auth.description', 'Please enter your password to continue')}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <input
                type="password"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleReAuthenticate()}
                className="input"
                placeholder={t('bankAccount.auth.passwordPlaceholder', 'Enter your password')}
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
              />
              {authError && (
                <p className="text-sm text-red-600" role="alert">{authError}</p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setRequiresAuth(false)
                    setAuthPassword('')
                    setPendingAction(null)
                  }}
                  className="btn-outline flex-1"
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  onClick={handleReAuthenticate}
                  className="btn-primary flex-1"
                >
                  {t('bankAccount.auth.verify', 'Verify')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <PhoneVerificationDialog
        open={showPhoneVerification}
        onClose={() => {
          setShowPhoneVerification(false)
          setPendingBankSave(null)
        }}
        userId={user?.id}
        phone={profile?.phone}
        purpose="sensitive_action"
        title="📱 تأكيد العملية البنكية"
        description="قبل إضافة أو تحديث الحساب البنكي، أدخل رمز التحقق المرسل إلى هاتفك المسجل."
        onVerified={async () => {
          const payload = pendingBankSave
          setShowPhoneVerification(false)
          setPendingBankSave(null)

          if (payload) {
            await persistBankAccount(payload)
          }
        }}
      />
    </div>
  )
}

// Wrap with Error Boundary
const BankAccountWithErrorBoundary = () => (
  <ErrorBoundary componentName="BankAccountPage">
    <BankAccountPage />
  </ErrorBoundary>
)

export default BankAccountWithErrorBoundary
