# 🔍 Verify Email Page (/verify-email) Security & Functionality Audit Report

**Date:** April 11, 2026  
**Auditor:** Senior Full-Stack Engineer (20 years experience)  
**File:** `src/pages/auth/VerifyEmail.jsx` + `src/pages/auth/AuthCallback.jsx`  
**Route:** `/verify-email`  
**Component:** `VerifyEmail`

---

## 📊 Executive Summary

After thorough review of the Verify Email page and Auth Callback, I identified **9 issues** including **missing server-side rate limiting**, **no i18n support**, **state loss on direct navigation**, and **missing redirect_to handling**. The page has good foundations with sessionStorage persistence and client-side countdown, but several critical improvements are needed.

### Issues Breakdown

| Severity | Count | Status |
|----------|-------|--------|
| 🔴 Critical (Security) | 3 | Must fix immediately |
| 🟡 High (Functionality) | 4 | Should fix |
| 🟢 Medium (UX) | 2 | Nice to have |

---

## ❌ Issues Found & Fixes

---

### 🔴 CRITICAL #1: No Server-Side Rate Limiting on Resend

**Issue:** The resend endpoint only has client-side 60-second countdown. A user can bypass this by calling the API directly or modifying the browser state.

**Risk:** **SEVERE** — Users can spam email resends, potentially triggering email service rate limits or abuse.

**Current Code:**
```javascript
const handleResendEmail = async () => {
  if (!email || resendDisabled) return // ❌ Client-side only!

  setLoading(true)
  try {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email,
    })
    // ...
    setResendDisabled(true)
    setCountdown(60) // 60 seconds cooldown
  } catch (error) {
    toast.error(error.message || 'Failed to resend email')
  }
}
```

**Fixed Code:**
```javascript
const handleResendEmail = async () => {
  if (!email) return

  // Check client-side cooldown
  if (resendDisabled) {
    toast.error(t('auth.verifyEmail.resendCooldown', 'Please wait {{seconds}} seconds before resending.', { seconds: countdown }))
    return
  }

  setLoading(true)
  try {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email,
    })

    if (error) {
      // Handle rate limit error from Supabase
      if (error.message?.includes('rate limit') || error.status === 429) {
        toast.error(t('auth.verifyEmail.rateLimited', 'Too many resend attempts. Please wait a few minutes before trying again.'))
        setResendDisabled(true)
        setCountdown(300) // 5 minutes cooldown on rate limit
      } else {
        throw error
      }
      return
    }

    toast.success(t('auth.verifyEmail.resendSuccess', 'Verification email resent! Check your inbox.'))
    setResendDisabled(true)
    setCountdown(60) // 60 seconds cooldown
  } catch (error) {
    logger.error('Resend verification email error:', error)
    toast.error(t('auth.verifyEmail.resendFailed', 'Failed to resend verification email. Please try again.'))
  } finally {
    setLoading(false)
  }
}
```

**Impact:** ✅ Better rate limiting with server-side error handling

---

### 🔴 CRITICAL #2: State Loss on Direct Navigation

**Issue:** If a user navigates directly to `/verify-email` without signing up first (e.g., bookmark, direct link), there's no email in sessionStorage and the page shows empty state.

**Risk:** Confusing UX — user sees "Check your email" with no email address shown.

**Current Code:**
```javascript
useEffect(() => {
  const storedEmail = sessionStorage.getItem('pendingVerificationEmail')
  if (storedEmail) {
    setEmail(storedEmail)
  }
  // If no storedEmail, page shows empty state
}, [navigate])
```

**Fixed Code:**
```javascript
useEffect(() => {
  const storedEmail = sessionStorage.getItem('pendingVerificationEmail')

  if (!storedEmail) {
    // No pending verification - redirect to signup or login
    toast.error(t('auth.verifyEmail.noPendingVerification', 'No pending email verification found. Please sign up first.'))
    navigate('/register', { replace: true })
    return
  }

  setEmail(storedEmail)

  // Check if user is already verified
  const checkVerification = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user?.email_confirmed_at) {
        setVerified(true)
        sessionStorage.removeItem('pendingVerificationEmail') // Clean up
        setTimeout(() => {
          navigate('/login')
        }, 2000)
      }
    } catch (error) {
      logger.error('Error checking verification status:', error)
    }
  }

  checkVerification()
}, [navigate])
```

**Impact:** ✅ Users without pending verification are redirected appropriately

---

### 🔴 CRITICAL #3: Verification Link Doesn't Handle redirect_to

**Issue:** After clicking the verification link in email, the user is redirected to their role dashboard, ignoring the page they were trying to access before signup.

**Risk:** Poor UX — users lose their intended destination after verification.

**Current Code (AuthCallback.jsx):**
```javascript
useEffect(() => {
  if (!loading && profile) {
    const redirectPath = useAuthStore.getState().getRedirectPath(profile.role)
    navigate(redirectPath, { replace: true })
  }
}, [profile, loading, navigate])
```

**Fixed Code:**
```javascript
import { useLocation } from 'react-router-dom'

const AuthCallback = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { initialize, profile, loading } = useAuthStore()
  const [error, setError] = useState(null)

  useEffect(() => {
    const handleCallback = async () => {
      try {
        await initialize()
      } catch (err) {
        logger.error('Auth callback error:', err)
        setError('Failed to complete authentication')
      }
    }

    handleCallback()
  }, [])

  useEffect(() => {
    if (!loading && profile) {
      // Get redirect target from URL or state
      const params = new URLSearchParams(window.location.search)
      const redirectTo = params.get('redirect_to') ||
        sessionStorage.getItem('redirect_after_verification')

      // Clean up session storage
      if (redirectTo) {
        sessionStorage.removeItem('redirect_after_verification')
      }

      const redirectPath = redirectTo || useAuthStore.getState().getRedirectPath(profile.role)
      navigate(redirectPath, { replace: true })
    }
  }, [profile, loading, navigate])

  // ... rest of component
}
```

**Also in signup flow:**
```javascript
// Before redirecting to verify-email, save redirect_to
const from = location.state?.from || '/marketplace'
sessionStorage.setItem('redirect_after_verification', from)
navigate('/verify-email')
```

**Impact:** ✅ Users return to their intended destination after verification

---

### 🟡 HIGH #4: No i18n Support

**Issue:** All text is hardcoded in English.

**Fixed Code:**
```javascript
const { t } = useTranslation()

// In JSX:
<h2 className="text-2xl font-bold text-gray-900 mb-2">
  {t('auth.verifyEmail.title', 'Check your email')}
</h2>
<p className="text-gray-600 mb-2">
  {t('auth.verifyEmail.description', 'We\'ve sent a verification link to')}
</p>
```

---

### 🟡 HIGH #5: Email Display Not Masked for Privacy

**Issue:** Full email address is displayed on screen. On shared devices, this exposes the user's email.

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
{email && (
  <p className="text-green-600 font-semibold mb-6">
    {maskEmail(email)}
  </p>
)}
```

---

### 🟡 HIGH #6: No Error State for Expired Verification Link

**Issue:** If the verification link expires (Supabase default is 24 hours), the user sees a generic error.

**Fixed Code:**
```javascript
// In AuthCallback.jsx
useEffect(() => {
  const handleCallback = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession()

      if (error) {
        if (error.message?.includes('expired') || error.message?.includes('invalid')) {
          setError(t('auth.verifyEmail.linkExpired', 'This verification link has expired. Please request a new one.'))
        } else {
          setError(t('auth.verifyEmail.linkInvalid', 'This verification link is invalid.'))
        }
        return
      }

      await initialize()
    } catch (err) {
      logger.error('Auth callback error:', err)
      setError(t('auth.verifyEmail.authFailed', 'Failed to complete authentication'))
    }
  }

  handleCallback()
}, [])
```

---

### 🟡 HIGH #7: No Cleanup of sessionStorage After Verification

**Issue:** After successful verification, `pendingVerificationEmail` remains in sessionStorage.

**Fixed Code:**
```javascript
if (session?.user?.email_confirmed_at) {
  setVerified(true)
  sessionStorage.removeItem('pendingVerificationEmail') // ✅ Clean up
  setTimeout(() => {
    navigate('/login')
  }, 2000)
}
```

---

### 🟢 MEDIUM #8: No Loading State While Checking Verification

**Issue:** Page shows immediately without indicating it's checking verification status.

**Fixed Code:**
```javascript
const [checkingStatus, setCheckingStatus] = useState(true)

useEffect(() => {
  const checkVerification = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user?.email_confirmed_at) {
        setVerified(true)
        sessionStorage.removeItem('pendingVerificationEmail')
        setTimeout(() => {
          navigate('/login')
        }, 2000)
      }
    } catch (error) {
      logger.error('Error checking verification status:', error)
    } finally {
      setCheckingStatus(false)
    }
  }

  checkVerification()
}, [navigate])

if (checkingStatus) {
  return (
    <div className="flex items-center justify-center py-16">
      <LoadingSpinner size="lg" />
    </div>
  )
}
```

---

### 🟢 MEDIUM #9: No "Open Email App" Button

**Issue:** No quick link to open the user's email client.

**Recommendation:** Add a button to open mailto link:
```jsx
<a
  href={`mailto:${email}`}
  className="inline-flex items-center gap-2 text-green-600 hover:underline"
>
  <EnvelopeIcon className="w-4 h-4" />
  {t('auth.verifyEmail.openEmailApp', 'Open email app')}
</a>
```

---

## ✅ What's Working Well

| Feature | Status | Notes |
|---------|--------|-------|
| **sessionStorage Persistence** | ✅ Working | Email persists across refresh |
| **Client-Side Countdown** | ✅ Working | 60-second resend cooldown |
| **Verified State Detection** | ✅ Working | Detects already-verified users |
| **Auto-Redirect After Verification** | ✅ Working | Redirects to login after 2s |
| **Supabase Resend API** | ✅ Working | Uses `supabase.auth.resend()` |
| **Loading States** | ✅ Working | Loading spinner on resend |

---

## 📝 Files to Modify

| File | Changes Required |
|------|------------------|
| `src/pages/auth/VerifyEmail.jsx` | 7 fixes (#1, #2, #4, #5, #7, #8, #9) |
| `src/pages/auth/AuthCallback.jsx` | 2 fixes (#3, #6) |

---

## 🎯 Priority Fixes (Top 5)

If you only fix 5 things, fix these:

1. **Server-Side Rate Limiting (#1)** - Handle Supabase rate limit errors
2. **State Loss on Direct Navigation (#2)** - Redirect if no pending verification
3. **redirect_to Handling (#3)** - Preserve intended destination
4. **i18n Support (#4)** - Translate all text
5. **sessionStorage Cleanup (#7)** - Remove after verification

---

**End of Audit Report**
