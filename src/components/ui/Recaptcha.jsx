import { forwardRef } from 'react'
import ReCAPTCHA from 'react-google-recaptcha'

export const isRecaptchaSiteKeyConfigured = (siteKey) => {
  const normalizedKey = siteKey?.trim() || ''

  return !(
    !normalizedKey ||
    normalizedKey === 'recaptcha-site-key-placeholder' ||
    normalizedKey === 'your-recaptcha-v2-site-key' ||
    normalizedKey.includes('...')
  )
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
