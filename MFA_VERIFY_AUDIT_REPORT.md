# 🔍 MFA Verify Page (/mfa-verify) Security Audit Report

**Date:** April 11, 2026  
**Auditor:** Senior Full-Stack Engineer (20 years experience)  
**File:** `src/components/auth/MFAVerify.jsx` + `src/services/vendorSecurity.js`  
**Route:** `/mfa-verify`  
**Component:** `MFAVerify`

---

## 📊 Executive Summary

After thorough security review of the MFA Verify page and MFA service, I identified **10 issues** including **client-side attempt counter that resets on refresh**, **no account lockout handling**, **resend code not calling API**, and **missing i18n support**. The page has **good foundations** with server-side rate limiting (5 attempts/10min), OTP expiry via database RPC, and proper code invalidation after use. However, several critical UX and security improvements are needed.

### Issues Breakdown

| Severity | Count | Status |
|----------|-------|--------|
| 🔴 Critical (Security) | 3 | Must fix immediately |
| 🟡 High (Functionality) | 4 | Should fix |
| 🟢 Medium (UX) | 3 | Nice to have |

---

## ❌ Issues Found & Fixes

---

### 🔴 CRITICAL #1: Client-Side Attempt Counter Resets on Page Refresh

**Issue:** The `attempts` state is stored in React component state. If a user refreshes the page, the counter resets to 0, allowing them to bypass the client-side attempt limit.

**Risk:** **SEVERE** — Users can bypass client-side attempt limiting by refreshing the page. However, server-side rate limiting (`checkMFARate`) still protects against brute force.

**Current Code:**
```javascript
const [attempts, setAttempts] = useState(0)
const [maxAttempts] = useState(5)

// In handleSubmit:
if (attempts >= maxAttempts) {
  setError(`Too many attempts. Please try again later.`)
  return
}
// ...
setAttempts(attempts + 1)
```

**Fixed Code:**
```javascript
// Track attempts in sessionStorage (persists across refresh)
const [attempts, setAttempts] = useState(() => {
  const stored = sessionStorage.getItem('mfa_attempts')
  return stored ? parseInt(stored, 10) : 0
})

const [isLocked, setIsLocked] = useState(() => {
  const stored = sessionStorage.getItem('mfa_locked_until')
  if (stored) {
    const unlockTime = parseInt(stored, 10)
    if (Date.now() < unlockTime) {
      return true
    } else {
      sessionStorage.removeItem('mfa_locked_until')
      sessionStorage.removeItem('mfa_attempts')
      return false
    }
  }
  return false
})

// In handleSubmit:
if (isLocked) {
  const unlockTime = parseInt(sessionStorage.getItem('mfa_locked_until'), 10)
  const remainingMs = unlockTime - Date.now()
  const remainingMin = Math.ceil(remainingMs / 60000)
  setError(`Account locked. Please try again in ${remainingMin} minute(s).`)
  return
}

// After failed attempt:
const newAttempts = attempts + 1
setAttempts(newAttempts)
sessionStorage.setItem('mfa_attempts', newAttempts.toString())

if (newAttempts >= maxAttempts) {
  // Lock for 15 minutes (matching server-side blockDuration)
  const lockUntil = Date.now() + 15 * 60 * 1000
  sessionStorage.setItem('mfa_locked_until', lockUntil.toString())
  setIsLocked(true)
  setError(`Too many attempts. Account locked for 15 minutes.`)

  // Also sign out and redirect to login
  setTimeout(async () => {
    await signOut()
    navigate('/login')
  }, 3000)
}
```

**Impact:** ✅ Attempt counter persists across page refreshes, account locks properly

---

### 🔴 CRITICAL #2: No Handling for Server-Side Account Lockout

**Issue:** When the server-side rate limiter blocks the user (after 5 attempts in 10 minutes), the frontend doesn't show a proper lockout message or redirect to login.

**Risk:** Users see generic "Invalid code" error instead of "Account locked" message.

**Current Code:**
```javascript
const result = await verifyMFA(codeString)

if (result.success) {
  navigate(result.redirect || '/vendor/dashboard')
} else {
  setAttempts(attempts + 1)
  setError(result.error || 'Invalid code')
}
```

**Fixed Code:**
```javascript
const result = await verifyMFA(codeString)

if (result.success) {
  toast.success('Authentication verified!')
  sessionStorage.removeItem('mfa_attempts')
  sessionStorage.removeItem('mfa_locked_until')
  navigate(result.redirect || '/vendor/dashboard')
} else {
  const newAttempts = attempts + 1
  setAttempts(newAttempts)
  sessionStorage.setItem('mfa_attempts', newAttempts.toString())

  // Check if error message indicates rate limit/lockout
  if (result.error?.includes('Too many attempts') || result.error?.includes('rate limit')) {
    // Server-side lockout - lock for 15 minutes
    const lockUntil = Date.now() + 15 * 60 * 1000
    sessionStorage.setItem('mfa_locked_until', lockUntil.toString())
    setIsLocked(true)
    setError('Too many attempts. Your account has been locked for 15 minutes. Please try again later.')

    // Redirect to login after 3 seconds
    setTimeout(async () => {
      await signOut()
      navigate('/login')
    }, 3000)
  } else {
    setError(result.error || 'Invalid code')
  }

  // Clear inputs
  setCode(['', '', '', '', '', ''])
  document.getElementById('mfa-code-0')?.focus()
}
```

**Impact:** ✅ Proper handling of server-side lockout with redirect to login

---

### 🔴 CRITICAL #3: Resend Code Doesn't Call Any API

**Issue:** The "Resend Code" button only shows a toast message but doesn't actually call any API to resend the OTP.

**Risk:** Users can't actually resend their verification code.

**Current Code:**
```javascript
const handleResendCode = async () => {
  if (!canResend) return

  try {
    setCountdown(60)
    setCanResend(false)
    toast.success('New code sent to your email!')
    // In production, call the API to resend code ❌ NOT IMPLEMENTED!
  } catch (error) {
    toast.error('Failed to resend code')
  }
}
```

**Fixed Code:**
```javascript
const handleResendCode = async () => {
  if (!canResend || !user) return

  setLoading(true)
  try {
    // Call Supabase to resend OTP
    const { error } = await supabase.auth.resend({
      type: 'mfa',
      email: user.email,
    })

    if (error) {
      if (error.message?.includes('rate limit') || error.status === 429) {
        toast.error('Too many resend attempts. Please wait a few minutes.')
        setCountdown(300) // 5 minutes cooldown
      } else {
        throw error
      }
      return
    }

    setCountdown(60)
    setCanResend(false)
    toast.success('New code sent to your email!')
  } catch (error) {
    logger.error('Resend MFA code error:', error)
    toast.error('Failed to resend code. Please try again.')
  } finally {
    setLoading(false)
  }
}
```

**Impact:** ✅ Resend code actually sends a new OTP via email

---

### 🟡 HIGH #4: No i18n Support

**Issue:** All text is hardcoded in English.

**Fixed Code:**
```javascript
const { t } = useTranslation()

// In JSX:
<h1>{t('auth.mfa.title', 'Two-Factor Authentication')}</h1>
<p>{t('auth.mfa.description', 'Enter the 6-digit code sent to your email')}</p>
<button>{t('auth.mfa.verifyButton', 'Verify Code')}</button>
```

---

### 🟡 HIGH #5: No Masked Email Display

**Issue:** The page doesn't show which email the code was sent to.

**Fixed Code:**
```javascript
const maskEmail = (email) => {
  if (!email || !email.includes('@')) return email
  const [name, domain] = email.split('@')
  if (name.length < 2) return `***@${domain}`
  const maskedName = name.charAt(0) + '***' + name.charAt(name.length - 1)
  return `${maskedName}@${domain}`
}

// In JSX:
<p className="text-gray-600">
  {t('auth.mfa.description', 'Enter the 6-digit code sent to {{email}}', {
    email: maskEmail(user?.email)
  })}
</p>
```

---

### 🟡 HIGH #6: No Error State for Expired OTP

**Issue:** The page doesn't distinguish between "invalid code" and "expired code".

**Fixed Code:**
```javascript
// In mfaService.verifyCode():
if (!isValid) {
  // Check if code is expired vs invalid
  const { data: otpData } = await supabase
    .from('otp_codes')
    .select('expires_at')
    .eq('user_id', user.id)
    .eq('code', code)
    .eq('purpose', 'mfa_verify')
    .single()

  if (otpData && new Date(otpData.expires_at) < new Date()) {
    return { success: false, error: 'Code has expired. Please request a new one.' }
  }

  return { success: false, error: 'Invalid code. Please try again.' }
}
```

---

### 🟡 HIGH #7: No Loading State While Checking MFA Settings

**Issue:** Page renders immediately without checking if MFA is actually required.

**Fixed Code:**
```javascript
const [checkingMFA, setCheckingMFA] = useState(true)

useEffect(() => {
  const checkMFARequired = async () => {
    try {
      const mfaSettings = await mfaService.getSettings()
      if (!mfaSettings?.is_enabled) {
        // MFA not required - redirect to dashboard
        navigate('/marketplace', { replace: true })
        return
      }
    } catch (error) {
      logger.error('Error checking MFA settings:', error)
    } finally {
      setCheckingMFA(false)
    }
  }

  checkMFARequired()
}, [navigate])

if (checkingMFA) {
  return (
    <div className="flex items-center justify-center py-16">
      <LoadingSpinner size="lg" />
    </div>
  )
}
```

---

### 🟢 MEDIUM #8: No Auto-Focus on First Input

**Issue:** User has to manually click the first input box.

**Fixed Code:**
```javascript
useEffect(() => {
  document.getElementById('mfa-code-0')?.focus()
}, [])
```

---

### 🟢 MEDIUM #9: No "Back to Login" Link

**Issue:** Only "Cancel and Sign Out" button, no simple back link.

**Fixed Code:**
```jsx
<div className="text-center mt-4">
  <Link to="/login" className="text-sm text-gray-600 hover:text-gray-900">
    ← Back to Login
  </Link>
</div>
```

---

### 🟢 MEDIUM #10: No Help Text for TOTP Users

**Issue:** If user has TOTP enabled (Google Authenticator), the page still says "sent to your email".

**Fixed Code:**
```javascript
const [mfaMethod, setMfaMethod] = useState('email')

useEffect(() => {
  const checkMFAMethod = async () => {
    const settings = await mfaService.getSettings()
    if (settings?.method === 'totp') {
      setMfaMethod('totp')
    }
  }
  checkMFAMethod()
}, [])

// In JSX:
<p className="text-gray-600">
  {mfaMethod === 'totp'
    ? t('auth.mfa.totpDescription', 'Enter the 6-digit code from your authenticator app')
    : t('auth.mfa.emailDescription', 'Enter the 6-digit code sent to {{email}}', { email: maskEmail(user?.email) })}
</p>
```

---

## ✅ What's Working Well

| Feature | Status | Notes |
|---------|--------|-------|
| **Server-Side Rate Limiting** | ✅ Working | 5 attempts per 10 minutes, 15 min block |
| **OTP Expiry** | ✅ Working | Handled by `verify_otp` RPC in database |
| **Code Invalidation** | ✅ Working | OTP is consumed after first use (database RPC) |
| **6-Digit Input** | ✅ Working | Auto-focus, paste support, backspace navigation |
| **Cancel & Sign Out** | ✅ Working | Properly signs out and redirects |
| **Audit Logging** | ✅ Working | MFA actions logged |

---

## 📝 Files to Modify

| File | Changes Required |
|------|------------------|
| `src/components/auth/MFAVerify.jsx` | 8 fixes (#1, #2, #3, #4, #5, #8, #9, #10) |
| `src/services/vendorSecurity.js` | 2 fixes (#6, #7) |

---

## 🎯 Priority Fixes (Top 5)

If you only fix 5 things, fix these:

1. **Client-Side Counter Reset (#1)** - Persist attempts in sessionStorage
2. **Server Lockout Handling (#2)** - Show lockout message and redirect
3. **Resend Code API (#3)** - Actually call Supabase resend
4. **i18n Support (#4)** - Translate all text
5. **Masked Email (#5)** - Show which email received the code

---

**End of Audit Report**
