import { useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { mfaService } from '@/services/authServices'
import { ShieldCheckIcon, XMarkIcon, CheckIcon, QrCodeIcon, EnvelopeIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

const MFASetup = ({ isOpen, onClose }) => {
  const { refreshProfile } = useAuthStore()
  const [step, setStep] = useState(1) // 1: method selection, 2: setup, 3: complete
  const [method, setMethod] = useState(null) // 'email' or 'totp'
  const [loading, setLoading] = useState(false)
  const [totpData, setTotpData] = useState(null)
  const [backupCodes, setBackupCodes] = useState(null)
  const [verificationCode, setVerificationCode] = useState('')

  const handleEnableEmail = async () => {
    try {
      setLoading(true)
      const result = await mfaService.enableWithEmail()

      if (result.success) {
        setMethod('email')
        setStep(3)
        await refreshProfile()
        toast.success('Email MFA enabled successfully!')
      } else {
        toast.error(result.error || 'Failed to enable MFA')
      }
    } catch (_error) {
      toast.error('Failed to enable MFA')
    } finally {
      setLoading(false)
    }
  }

  const handleEnableTOTP = async () => {
    try {
      setLoading(true)
      // Generate TOTP secret but DON'T enable MFA yet
      const result = await mfaService.generateTOTPSecret()

      if (result.success) {
        setMethod('totp')
        setTotpData(result)
        setStep(2) // Show QR code and verification
        // MFA is NOT enabled yet - will be enabled after verification
      } else {
        toast.error(result.error || 'Failed to generate TOTP secret')
      }
    } catch (_error) {
      toast.error('Failed to generate TOTP secret')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyTOTP = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      toast.error('Please enter a 6-digit code')
      return
    }

    try {
      setLoading(true)
      // Verify the code against the generated secret
      const { success, error } = await mfaService.verifyCode(verificationCode)

      if (success) {
        // NOW enable MFA in the database
        const enableResult = await mfaService.enableWithTOTP(totpData.secret)

        if (enableResult.success) {
          setStep(3)
          setBackupCodes(enableResult.backupCodes)
          await refreshProfile()
          toast.success('TOTP verified and MFA enabled!')
        } else {
          toast.error(enableResult.error || 'Failed to enable MFA')
        }
      } else {
        toast.error(error || 'Invalid code')
      }
    } catch (_error) {
      toast.error('Failed to verify code')
    } finally {
      setLoading(false)
    }
  }

  const handleComplete = () => {
    setStep(1)
    setMethod(null)
    setTotpData(null)
    setBackupCodes(null)
    setVerificationCode('')
    onClose()
  }

  const downloadBackupCodes = () => {
    const content = `
Qotoof - Backup Codes
==========================
Save these codes in a safe place. Each code can only be used once.

${backupCodes.map((code, i) => `${i + 1}. ${code}`).join('\n')}

Generated: ${new Date().toLocaleString()}
    `.trim()

    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'qotoof-backup-codes.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 relative">
        {/* Close button */}
        <button
          onClick={handleComplete}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <XMarkIcon className="w-6 h-6" />
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldCheckIcon className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Enable Two-Factor Authentication</h2>
          <p className="text-gray-600 mt-2">Add an extra layer of security to your account</p>
        </div>

        {/* Step 1: Method Selection */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              {/* Email Method */}
              <button
                onClick={handleEnableEmail}
                disabled={loading}
                className="flex items-center gap-4 p-4 border-2 border-gray-200 rounded-xl hover:border-green-500 hover:bg-green-50 transition-all disabled:opacity-50"
              >
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <EnvelopeIcon className="w-6 h-6 text-blue-600" />
                </div>
                <div className="text-left flex-1">
                  <h3 className="font-semibold text-gray-900">Email Verification</h3>
                  <p className="text-sm text-gray-600">Receive a 6-digit code via email</p>
                </div>
              </button>

              {/* TOTP Method */}
              <button
                onClick={handleEnableTOTP}
                disabled={loading}
                className="flex items-center gap-4 p-4 border-2 border-gray-200 rounded-xl hover:border-green-500 hover:bg-green-50 transition-all disabled:opacity-50"
              >
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
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

        {/* Step 2: TOTP Setup */}
        {step === 2 && totpData && (
          <div className="space-y-6">
            {/* QR Code */}
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-4">
                Scan this QR code with your authenticator app
              </p>
              <div className="bg-white p-4 rounded-xl border-2 border-gray-200 inline-block">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(totpData.qrCodeUrl)}`}
                  alt="QR Code"
                  className="w-48 h-48"
                />
              </div>
            </div>

            {/* Manual Entry */}
            <div className="bg-gray-50 p-4 rounded-xl">
              <p className="text-xs text-gray-600 mb-2">Manual entry key:</p>
              <code className="text-sm font-mono bg-white px-3 py-2 rounded block break-all">
                {totpData.secret}
              </code>
            </div>

            {/* Verification */}
            <div>
              <label htmlFor="mfa-verification-code" className="block text-sm font-medium text-gray-700 mb-2">
                Enter the 6-digit code from your app
              </label>
              <input
                id="mfa-verification-code"
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                className="input text-center text-2xl tracking-widest font-mono"
              />
              <button
                onClick={handleVerifyTOTP}
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
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
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
            {backupCodes && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                <h4 className="font-semibold text-gray-900 mb-2">⚠️ Save Your Backup Codes</h4>
                <p className="text-sm text-gray-600 mb-3">
                  These codes can be used to access your account if you lose your authenticator app.
                  Store them in a safe place.
                </p>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {backupCodes.map((code, index) => (
                    <code key={index} className="text-sm font-mono bg-white px-2 py-1 rounded text-center">
                      {code}
                    </code>
                  ))}
                </div>
                <button
                  onClick={downloadBackupCodes}
                  className="btn-secondary w-full text-sm"
                >
                  📥 Download Backup Codes
                </button>
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

        {/* Loading */}
        {loading && (
          <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center rounded-2xl">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-3"></div>
              <p className="text-gray-600">Please wait...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default MFASetup
