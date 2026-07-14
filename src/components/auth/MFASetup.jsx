import { useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { mfaService } from '@/services/authServices'
import { ShieldCheckIcon, XMarkIcon, CheckIcon, QrCodeIcon, EnvelopeIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { logger } from '@/utils/logger'

const MFASetup = ({ isOpen, onClose }) => {
  const { refreshProfile } = useAuthStore()
  const [step, setStep] = useState(1) // 1: method selection, 2: verify, 3: complete
  const [method, setMethod] = useState(null) // 'totp' | 'email'
  const [loading, setLoading] = useState(false)
  const [enrollment, setEnrollment] = useState(null)
  const [verificationCode, setVerificationCode] = useState('')
  const [verifyError, setVerifyError] = useState('')
  const [backupCodes, setBackupCodes] = useState([])

  // ── TOTP: generate secret and show QR ──────────────────────────────────────
  const handleEnrollTOTP = async () => {
    try {
      setLoading(true)
      setVerifyError('')
      setMethod('totp')

      const result = await mfaService.generateTOTPSecret()

      if (!result.success) {
        toast.error(result.error || 'Failed to start TOTP enrollment')
        return
      }

      setEnrollment({
        secret: result.secret,
        qrCodeUrl: result.qrCodeUrl,
      })
      setStep(2)
    } catch (err) {
      logger.error('MFA enroll error:', err)
      toast.error('Failed to start TOTP enrollment')
    } finally {
      setLoading(false)
    }
  }

  // ── Email: initiate email MFA (send OTP) ───────────────────────────────────
  const handleEnrollEmail = async () => {
    try {
      setLoading(true)
      setVerifyError('')
      setMethod('email')

      const result = await mfaService.initiateEmailMFA()

      if (!result.success) {
        toast.error(result.error || 'Failed to send verification email')
        return
      }

      setStep(2)
    } catch (err) {
      logger.error('MFA email initiate error:', err)
      toast.error('Failed to send verification email')
    } finally {
      setLoading(false)
    }
  }

  // ── Verify code (TOTP or Email) ────────────────────────────────────────────
  const handleVerify = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      setVerifyError('Please enter a 6-digit code')
      return
    }

    try {
      setLoading(true)
      setVerifyError('')

      let result
      if (method === 'totp') {
        if (!enrollment?.secret) {
          setVerifyError('Enrollment data missing. Please restart setup.')
          return
        }
        result = await mfaService.enableWithTOTP(enrollment.secret, verificationCode)
      } else if (method === 'email') {
        result = await mfaService.verifyEmailMFA(verificationCode)
      } else {
        setVerifyError('Unknown MFA method')
        return
      }

      if (!result.success) {
        setVerifyError(result.error || 'Invalid code')
        toast.error(result.error || 'Invalid code')
        setVerificationCode('')
        return
      }

      if (result.backupCodes?.length) {
        setBackupCodes(result.backupCodes)
      }

      await refreshProfile()
      setStep(3)
      toast.success(method === 'email' ? 'Email MFA enabled successfully!' : 'TOTP verified and MFA enabled!')
    } catch (err) {
      logger.error('MFA verify error:', err)
      setVerifyError('Failed to verify code')
    } finally {
      setLoading(false)
    }
  }

  const handleCancelEnrollment = () => {
    handleComplete()
  }

  const handleComplete = () => {
    setStep(1)
    setMethod(null)
    setEnrollment(null)
    setVerificationCode('')
    setVerifyError('')
    setBackupCodes([])
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white/90 backdrop-blur-xl rounded-3xl max-w-md w-full p-8 relative shadow-[0_8px_40px_rgba(0,0,0,0.12)] border border-white/60 auth-scale-in">
        {/* Close button */}
        <button
          onClick={handleCancelEnrollment}
          className="absolute top-5 right-5 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <XMarkIcon className="w-6 h-6" />
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center mx-auto mb-5 shadow-sm">
            <ShieldCheckIcon className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Enable Two-Factor Authentication</h2>
          <p className="text-gray-500 mt-2 text-sm">Add an extra layer of security to your account</p>
        </div>

        {/* Step 1: Method Selection */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              {/* Email Method */}
              <button
                onClick={handleEnrollEmail}
                disabled={loading}
                className="flex items-center gap-4 p-4 border-2 border-gray-200 rounded-2xl hover:border-green-500 hover:bg-green-50 transition-all duration-200 disabled:opacity-50"
              >
                <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <EnvelopeIcon className="w-6 h-6 text-blue-600" />
                </div>
                <div className="text-left flex-1">
                  <h3 className="font-semibold text-gray-900">Email Verification</h3>
                  <p className="text-sm text-gray-600">Receive a code via email</p>
                </div>
              </button>

              {/* TOTP Method */}
              <button
                onClick={handleEnrollTOTP}
                disabled={loading}
                className="flex items-center gap-4 p-4 border-2 border-gray-200 rounded-2xl hover:border-green-500 hover:bg-green-50 transition-all duration-200 disabled:opacity-50"
              >
                <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <QrCodeIcon className="w-6 h-6 text-purple-600" />
                </div>
                <div className="text-left flex-1">
                  <h3 className="font-semibold text-gray-900">Authenticator App</h3>
                  <p className="text-sm text-gray-600">Use Google Authenticator, Authy, etc.</p>
                </div>
              </button>
            </div>

            <p className="text-xs text-gray-500 text-center mt-4">
              You can disable 2FA at any time from your security settings
            </p>
          </div>
        )}

        {/* Step 2: Verification */}
        {step === 2 && (
          <div className="space-y-6">
            {/* TOTP QR Code */}
            {method === 'totp' && enrollment && (
              <>
                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-4">
                    Scan this QR code with your authenticator app
                  </p>
                  <div className="bg-white p-4 rounded-2xl border-2 border-gray-100 inline-block shadow-sm">
                    <img
                      src={enrollment.qrCodeUrl}
                      alt="QR Code"
                      className="w-48 h-48"
                    />
                  </div>
                </div>

                <div className="bg-gray-50/80 p-4 rounded-2xl">
                  <p className="text-xs text-gray-600 mb-2">Manual entry key:</p>
                  <code className="text-sm font-mono bg-white px-3 py-2 rounded block break-all">
                    {enrollment.secret}
                  </code>
                </div>
              </>
            )}

            {/* Email instructions */}
            {method === 'email' && (
              <div className="text-center">
                <p className="text-sm text-gray-600">
                  Enter the 6-digit code sent to your email
                </p>
              </div>
            )}

            {/* Verification input */}
            <div>
              <label htmlFor="mfa-verification-code" className="block text-sm font-medium text-gray-700 mb-2">
                Enter the 6-digit code from your app
              </label>
              <input
                id="mfa-verification-code"
                type="text"
                value={verificationCode}
                onChange={(e) => {
                  setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                  setVerifyError('')
                }}
                placeholder="000000"
                maxLength={6}
                className="input text-center text-2xl tracking-widest font-mono"
                autoFocus
              />
              {verifyError && (
                <p className="text-sm text-red-600 mt-2">{verifyError}</p>
              )}
              <button
                onClick={handleVerify}
                disabled={loading || verificationCode.length !== 6}
                className="btn-primary w-full mt-3 disabled:opacity-50"
              >
                {loading ? 'Verifying...' : 'Verify Code'}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Complete */}
        {step === 3 && (
          <div className="space-y-6">
            {/* Success */}
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center mx-auto mb-4 shadow-sm">
                <CheckIcon className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Two-Factor Authentication Enabled!
              </h3>
              <p className="text-gray-600">
                Your account is now protected with {method === 'email' ? 'email' : 'authenticator app'} verification
              </p>
            </div>

            {/* Backup Codes */}
            {backupCodes.length > 0 && (
              <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4">
                <h4 className="font-semibold text-gray-900 mb-2">Save Your Backup Codes</h4>
                <p className="text-sm text-gray-600 mb-3">
                  Save these codes in a safe place. Each code can be used once if you lose access to your authenticator app.
                </p>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {backupCodes.map((code, index) => (
                    <code
                      key={index}
                      className="text-sm font-mono bg-white px-2 py-1 rounded text-center"
                    >
                      {code}
                    </code>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(backupCodes.join('\n'))
                      toast.success('Backup codes copied to clipboard')
                    }}
                    className="text-sm text-amber-700 font-medium hover:underline"
                  >
                    Copy to clipboard
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const blob = new Blob([backupCodes.join('\n')], { type: 'text/plain' })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = 'qotoof-backup-codes.txt'
                      a.click()
                      URL.revokeObjectURL(url)
                    }}
                    className="text-sm text-amber-700 font-medium hover:underline"
                  >
                    Download Backup Codes
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={handleComplete}
              className="btn-primary w-full"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default MFASetup
