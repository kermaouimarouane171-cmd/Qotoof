import { forwardRef } from 'react'
import ReCAPTCHA from 'react-google-recaptcha'
import { recaptchaSiteKeyLooksIssued } from '@/utils/envValidators'

export const isRecaptchaSiteKeyConfigured = (siteKey) => {
  return recaptchaSiteKeyLooksIssued(siteKey)
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
