import { forwardRef } from 'react'
import ReCAPTCHA from 'react-google-recaptcha'

const Recaptcha = forwardRef(({ onChange, siteKey }, ref) => {
  if (!siteKey || siteKey === 'recaptcha-site-key-placeholder') {
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
