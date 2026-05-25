import { useState } from 'react'
import { validateCIN, autoFormatCIN, formatCIN } from '@/utils/cinValidation'
import { ShieldCheckIcon, InformationCircleIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline'

const CINInput = ({ value, onChange, error, label = 'رقم البطاقة الوطنية (CIN)', required = true, showHelp = true, inputTestId }) => {
  const [touched, setTouched] = useState(false)
  const [validationResult, setValidationResult] = useState(null)

  const handleChange = (e) => {
    const formatted = autoFormatCIN(e.target.value)
    onChange(formatted)

    // Validate when we have at least 7 characters (minimum for old format)
    if (formatted.length >= 7) {
      const result = validateCIN(formatted)
      setValidationResult(result)
    } else {
      setValidationResult(null)
    }
  }

  const handleBlur = () => {
    setTouched(true)
    if (value && value.length >= 7) {
      const result = validateCIN(value)
      setValidationResult(result)
    }
  }

  const displayError = error || (touched && validationResult && !validationResult.valid ? validationResult.error : null)
  const isValid = touched && validationResult?.valid

  // Calculate remaining characters needed
  const remainingChars = value ? (value.length < 7 ? 7 - value.length : value.length < 8 ? 8 - value.length : 0) : 7

  return (
    <div>
      <label className="input-label flex items-center gap-2">
        {label}
        {required && <span className="text-red-500">*</span>}
        <span className="group relative">
          <InformationCircleIcon className="w-4 h-4 text-gray-400 cursor-help" />
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10" dir="ltr">
            Your Moroccan National ID number (Carte d'Identité Nationale). Format: 2 letters + 5 or 6 digits (e.g., AB12345 or AB123456). Required for identity verification.
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
          </div>
        </span>
      </label>

      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2">
          <ShieldCheckIcon className={`w-5 h-5 ${isValid ? 'text-green-500' : displayError ? 'text-red-400' : 'text-gray-400'}`} />
        </div>
        <input
          type="text"
          value={value || ''}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder="AB12345 أو AB123456"
          maxLength={8}
          data-testid={inputTestId}
          className={`input pl-10 pr-10 font-mono tracking-wider uppercase ${
            isValid ? 'border-green-500 bg-green-50' :
            displayError ? 'border-red-500 bg-red-50' : ''
          }`}
          required={required}
          autoComplete="off"
          dir="ltr"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {isValid && <CheckCircleIcon className="w-5 h-5 text-green-500" />}
          {displayError && <XCircleIcon className="w-5 h-5 text-red-400" />}
        </div>
      </div>

      {/* Character counter */}
      {value && value.length < 7 && (
        <p className="text-xs text-gray-400 mt-1" dir="ltr">
          {remainingChars} more character{remainingChars !== 1 ? 's' : ''} needed (minimum 7)
        </p>
      )}

      {/* Optional 8th character hint */}
      {value && value.length === 7 && validationResult?.valid && (
        <p className="text-xs text-blue-500 mt-1" dir="ltr">
          ✓ Valid! You can add one more digit if your CIN has 8 characters
        </p>
      )}

      {/* Error message */}
      {displayError && (
        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
          <XCircleIcon className="w-3.5 h-3.5" />
          {displayError}
        </p>
      )}

      {/* Valid message */}
      {isValid && (
        <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
          <CheckCircleIcon className="w-3.5 h-3.5" />
          تنسيق صالح • العرض: {formatCIN(value)}
        </p>
      )}

      {/* Help box */}
      {showHelp && (
        <div className="mt-3 p-3 bg-blue-50 border border-blue-100 rounded-lg">
          <div className="flex items-start gap-2">
            <InformationCircleIcon className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-blue-700">
              <p className="font-medium mb-1">أين تجد رقم البطاقة الوطنية؟</p>
              <p className="mb-1">مطبوع على بطاقة التعريف الوطنية - حرفان متبوعان بـ 5 أو 6 أرقام</p>
              <p className="text-blue-600" dir="ltr">
                مثال: AB12345 (قديم) أو AB123456 (جديد)
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CINInput
