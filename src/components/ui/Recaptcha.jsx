import { forwardRef } from 'react'
import ReCAPTCHA from 'react-google-recaptcha'
import { recaptchaSiteKeyLooksIssued } from '@/utils/envValidators'

const isLoopbackHost = (hostname = typeof window !== 'undefined' ? window.location.hostname : '') => {
  return /^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/i.test(hostname)
}

export const isRecaptchaSiteKeyConfigured = (siteKey, hostname) => {
  return recaptchaSiteKeyLooksIssued(siteKey) && !isLoopbackHost(hostname)
}

const Recaptcha = forwardRef(({ onChange, siteKey }, ref) => {
  if (!isRecaptchaSiteKeyConfigured(siteKey)) {
    // Skip reCAPTCHA in development
    return null
  }
  
  return (
    <ReCAPTCHA
      ref={ref}
      sitekey={siteKey}
      onChange={onChange}
      theme="light"
    />
  )
})

Recaptcha.displayName = 'Recaptcha'
export default Recaptcha
