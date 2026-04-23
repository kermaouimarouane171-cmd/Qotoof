# 🔍 Bank Account Page (/bank-account) Security Audit Report

**Date:** April 11, 2026  
**Auditor:** Senior Full-Stack Engineer (20 years experience)  
**File:** `src/pages/BankAccount.jsx`  
**Route:** `/bank-account`  
**Component:** `BankAccountPage`

---

## 📊 Executive Summary

After thorough security review of the Bank Account page, I identified **11 critical security issues** including **full bank account numbers displayed unmasked**, **no re-authentication before viewing/editing sensitive data**, **no audit logging for financial data changes**, and **no rate limiting**. This page handles highly sensitive financial data (RIB, IBAN) but lacks essential security controls.

### Issues Breakdown

| Severity | Count | Status |
|----------|-------|--------|
| 🔴 Critical (Security) | 4 | Must fix immediately |
| 🟡 High (Functionality) | 4 | Should fix |
| 🟢 Medium (UX) | 2 | Nice to have |
| ⚪ Low (Cosmetic) | 1 | Optional |

---

## ❌ Issues Found & Fixes

---

### 🔴 CRITICAL #1: Bank Account Numbers Displayed in Full (Not Masked)

**Issue:** RIB (24 digits) and IBAN are displayed in full without masking. Anyone looking over the user's shoulder can see their complete bank account details.

**Risk:** **SEVERE** — Financial data exposure. Shoulder surfing, screen recording, or screenshots can capture full bank details.

**Current Code:**
```jsx
<div className="flex justify-between text-sm">
  <span className="text-gray-500">RIB</span>
  <span className="font-mono font-medium">{bankAccount.rib}</span> {/* ❌ FULL RIB! */}
</div>
{bankAccount.iban && (
  <div className="flex justify-between text-sm">
    <span className="text-gray-500">IBAN</span>
    <span className="font-mono font-medium">{bankAccount.iban}</span> {/* ❌ FULL IBAN! */}
  </div>
)}
```

**Fixed Code:**
```jsx
// Helper to mask RIB (show only last 4 digits)
const maskRIB = (rib) => {
  if (!rib || rib.length < 4) return rib
  return '•••• •••• •••• •••• •••• ' + rib.slice(-4)
}

// Helper to mask IBAN (show only last 4 digits)
const maskIBAN = (iban) => {
  if (!iban || iban.length < 4) return iban
  return 'MA64 •••• •••• •••• •••• ' + iban.slice(-4)
}

// In JSX:
<div className="flex justify-between text-sm">
  <span className="text-gray-500">RIB</span>
  <div className="flex items-center gap-2">
    <span className="font-mono font-medium">
      {showFullRIB ? bankAccount.rib : maskRIB(bankAccount.rib)}
    </span>
    <button
      type="button"
      onClick={() => setShowFullRIB(!showFullRIB)}
      className="text-xs text-green-600 hover:underline"
    >
      {showFullRIB ? 'Hide' : 'Show'}
    </button>
  </div>
</div>
{bankAccount.iban && (
  <div className="flex justify-between text-sm">
    <span className="text-gray-500">IBAN</span>
    <div className="flex items-center gap-2">
      <span className="font-mono font-medium">
        {showFullIBAN ? bankAccount.iban : maskIBAN(bankAccount.iban)}
      </span>
      <button
        type="button"
        onClick={() => setShowFullIBAN(!showFullIBAN)}
        className="text-xs text-green-600 hover:underline"
      >
        {showFullIBAN ? 'Hide' : 'Show'}
      </button>
    </div>
  </div>
)}
```

**Impact:** ✅ Bank account numbers masked by default, user must explicitly reveal

---

### 🔴 CRITICAL #2: No Re-Authentication Before Viewing/Editing

**Issue:** Any logged-in user can view and edit their bank account without re-authentication. If a user leaves their session open on a shared device, anyone can change their bank account details and redirect payments.

**Risk:** **SEVERE** — Account takeover can lead to payment redirection to attacker's bank account.

**Current Code:**
```jsx
// No re-authentication check
const handleSubmit = async (e) => {
  e.preventDefault()
  // Directly saves without re-authentication
  const { data, error } = await supabase.rpc('upsert_bank_account', {...})
}
```

**Fixed Code:**
```jsx
import { useState } from 'react'
import { supabase } from '@/services/supabase'

const [requiresAuth, setRequiresAuth] = useState(false)
const [authPassword, setAuthPassword] = useState('')
const [authError, setAuthError] = useState('')
const [pendingAction, setPendingAction] = useState(null)

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
      setAuthError('Incorrect password')
      return
    }

    // Password verified - proceed with pending action
    setRequiresAuth(false)
    setAuthPassword('')

    if (pendingAction === 'edit') {
      setEditing(true)
    } else if (pendingAction === 'delete') {
      handleDeleteConfirmed()
    }

    setPendingAction(null)
  } catch (error) {
    logger.error('Re-authentication error:', error)
    setAuthError('Failed to verify password')
  }
}

// Re-authentication Modal
{requiresAuth && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-2xl p-6 max-w-md w-full">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
          <ShieldCheckIcon className="w-6 h-6 text-amber-600" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900">Re-authentication Required</h3>
          <p className="text-sm text-gray-500">Please enter your password to continue</p>
        </div>
      </div>

      <div className="space-y-4">
        <input
          type="password"
          value={authPassword}
          onChange={(e) => setAuthPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleReAuthenticate()}
          className="input"
          placeholder="Enter your password"
          autoFocus
        />
        {authError && (
          <p className="text-sm text-red-600">{authError}</p>
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
            Cancel
          </button>
          <button
            onClick={handleReAuthenticate}
            className="btn-primary flex-1"
          >
            Verify
          </button>
        </div>
      </div>
    </div>
  </div>
)}
```

**Impact:** ✅ Re-authentication required before editing or deleting bank account

---

### 🔴 CRITICAL #3: No Audit Logging for Financial Data Changes

**Issue:** Adding, editing, or deleting bank account details is not logged. No audit trail for financial data changes.

**Risk:** **SEVERE** — Cannot detect or investigate unauthorized changes to bank account details.

**Current Code:**
```javascript
const handleSubmit = async (e) => {
  // ... save logic
  // No audit logging
  toast.success('Bank account saved successfully!')
}
```

**Fixed Code:**
```javascript
import { auditLogger } from '@/services/auditLogger'

const handleSubmit = async (e) => {
  e.preventDefault()
  if (!validateForm()) return

  try {
    setSaving(true)

    const { data, error } = await supabase.rpc('upsert_bank_account', {
      p_user_id: user.id,
      p_bank_name: formData.bank_name,
      p_account_holder: formData.account_holder,
      p_rib: formData.rib,
      p_iban: formData.iban || null,
    })

    if (error) throw error

    if (data.success) {
      // AUDIT LOG: Bank account added/updated
      await auditLogger.logFinancialAction('BANK_ACCOUNT_UPDATED', user.id, {
        bankName: formData.bank_name,
        accountHolder: formData.account_holder,
        // NEVER log full RIB/IBAN - only last 4 digits
        ribLast4: formData.rib?.slice(-4),
        ibanLast4: formData.iban?.slice(-4),
        action: bankAccount ? 'updated' : 'created',
      })

      toast.success('Bank account saved successfully!')
      await loadBankAccount()
      setEditing(false)
    }
  } catch (error) {
    logger.error('Save bank account error:', error)
    toast.error(error.message || 'Failed to save bank account')
  } finally {
    setSaving(false)
  }
}

const handleDeleteConfirmed = async () => {
  try {
    const { error } = await supabase
      .from('bank_accounts')
      .delete()
      .eq('user_id', user.id)

    if (error) throw error

    // AUDIT LOG: Bank account deleted
    await auditLogger.logFinancialAction('BANK_ACCOUNT_DELETED', user.id, {
      bankName: bankAccount?.bank_name,
      ribLast4: bankAccount?.rib?.slice(-4),
    })

    toast.success('Bank account deleted')
    setBankAccount(null)
    setFormData({ bank_name: '', account_holder: '', rib: '', iban: '' })
  } catch (error) {
    toast.error('Failed to delete bank account')
  }
}
```

**Impact:** ✅ All financial data changes logged with audit trail

---

### 🔴 CRITICAL #4: No Rate Limiting on Bank Account Changes

**Issue:** Users can change their bank account details unlimited times. An attacker with temporary access could rapidly change bank account details multiple times.

**Risk:** **SEVERE** — No protection against rapid unauthorized changes.

**Fixed Code:**
```javascript
import { checkBankAccountRate, RateLimitError } from '@/utils/rateLimiter'

const handleSubmit = async (e) => {
  e.preventDefault()
  if (!validateForm()) return

  try {
    // Check rate limit (max 2 changes per hour)
    try {
      checkBankAccountRate(user.id)
    } catch (err) {
      if (err instanceof RateLimitError) {
        toast.error('Too many bank account changes. Please wait before trying again.')
        return
      }
    }

    setSaving(true)
    // ... rest of save logic
  } catch (error) {
    // ... error handling
  }
}
```

**Also add to rateLimiter.js:**
```javascript
export const RATE_LIMITS = {
  // ... existing limits
  BANK_ACCOUNT: {
    maxAttempts: 2,
    windowMs: 60 * 60 * 1000, // 1 hour
    blockDuration: 60 * 60 * 1000 // 1 hour
  },
}

export const checkBankAccountRate = (identifier) => {
  return rateLimiter.check(
    identifier,
    'bank_account',
    RATE_LIMITS.BANK_ACCOUNT.maxAttempts,
    RATE_LIMITS.BANK_ACCOUNT.windowMs
  )
}
```

**Impact:** ✅ Rate limiting prevents rapid unauthorized changes

---

### 🟡 HIGH #5: No i18n Support

**Issue:** All text is hardcoded in English.

**Fixed Code:**
```javascript
const { t } = useTranslation()

// In JSX:
<h1>{t('bankAccount.title', 'Bank Account')}</h1>
<p>{t('bankAccount.subtitle', 'Add your bank account to receive payments')}</p>
```

---

### 🟡 HIGH #6: No Error Boundary

**Fixed Code:**
```jsx
import ErrorBoundary from '@/components/ErrorBoundary'

const BankAccountWithErrorBoundary = () => (
  <ErrorBoundary componentName="BankAccountPage">
    <BankAccountPage />
  </ErrorBoundary>
)

export default BankAccountWithErrorBoundary
```

---

### 🟡 HIGH #7: No Confirmation for Edit (Only Delete)

**Issue:** Delete has confirmation, but edit doesn't warn about changing sensitive financial data.

**Fixed Code:**
```jsx
const handleEditClick = () => {
  // Require re-authentication before editing
  setRequiresAuth(true)
  setPendingAction('edit')
}
```

---

### 🟡 HIGH #8: RIB Input Not Properly Formatted

**Issue:** RIB input allows any 24 digits without formatting or validation of Moroccan RIB structure.

**Current Code:**
```javascript
onChange={(e) => {
  const value = e.target.value.replace(/\D/g, '').slice(0, 24)
  setFormData({ ...formData, rib: value })
}}
```

**Fixed Code:**
```javascript
// Moroccan RIB structure validation
// Format: BBB GGG GGGG GGGG GGGG GGGG (Bank code + Branch code + Account number + Key)
const validateRIBStructure = (rib) => {
  if (!rib || rib.length !== 24) return false

  const bankCode = rib.substring(0, 3)
  const branchCode = rib.substring(3, 6)
  const accountNumber = rib.substring(6, 16)
  const key = rib.substring(16, 24)

  // Basic validation: all parts must be numeric
  return /^\d{3}$/.test(bankCode) &&
         /^\d{3}$/.test(branchCode) &&
         /^\d{10}$/.test(accountNumber) &&
         /^\d{8}$/.test(key)
}

// In form validation:
if (!formData.rib.trim()) {
  newErrors.rib = 'RIB is required'
} else if (!validateRIBStructure(formData.rib)) {
  newErrors.rib = 'Invalid RIB format (BBB GGG GGGG GGGG GGGG GGGG)'
}
```

**Impact:** ✅ Better RIB validation with structure checking

---

### 🟢 MEDIUM #9: No Loading State on Delete

**Issue:** Delete happens without loading indicator.

**Fixed Code:**
```javascript
const [deleting, setDeleting] = useState(false)

const handleDeleteConfirmed = async () => {
  setDeleting(true)
  try {
    // ... delete logic
  } finally {
    setDeleting(false)
  }
}

// In JSX:
<button
  onClick={handleDeleteClick}
  disabled={deleting}
  className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg disabled:opacity-50"
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
```

---

### 🟢 MEDIUM #10: No Success Indicator After Save

**Issue:** Only toast message, no visual confirmation in the UI.

**Recommendation:** Add a success banner after save:
```jsx
{saveSuccess && (
  <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl">
    <div className="flex items-center gap-3">
      <CheckCircleIcon className="w-5 h-5 text-green-600" />
      <p className="text-sm text-green-700">Bank account updated successfully</p>
    </div>
  </div>
)}
```

---

### ⚪ LOW #11: No HTTPS Enforcement Check

**Issue:** Page doesn't verify it's being served over HTTPS.

**Recommendation:** Add HTTPS check at component mount:
```javascript
useEffect(() => {
  if (window.location.protocol !== 'https:' && import.meta.env.PROD) {
    toast.error('This page requires a secure connection (HTTPS)')
    window.location.href = window.location.href.replace('http://', 'https://')
  }
}, [])
```

**Note:** In production, Firebase Hosting enforces HTTPS automatically, so this is a defense-in-depth measure.

---

## ✅ What's Working Well

| Feature | Status | Notes |
|---------|--------|-------|
| **RIB Validation** | ✅ Working | 24-digit validation |
| **IBAN Validation** | ✅ Working | MA64 format validation |
| **Bank Selection** | ✅ Working | Moroccan banks list |
| **Supabase RPC** | ✅ Working | Uses stored procedure |
| **Delete Confirmation** | ✅ Working | Confirm dialog |
| **Error Handling** | ✅ Working | Toast messages |

---

## 📝 Files to Modify

| File | Changes Required |
|------|------------------|
| `src/pages/BankAccount.jsx` | 9 fixes (#1, #2, #3, #5, #6, #7, #8, #9, #10) |
| `src/utils/rateLimiter.js` | 1 fix (#4 - add bank account rate limit) |
| `src/services/auditLogger.js` | 1 fix (#3 - add financial action logging) |

---

## 🎯 Priority Fixes (Top 5)

If you only fix 5 things, fix these:

1. **Mask Bank Account Numbers (#1)** - Show only last 4 digits
2. **Re-authentication (#2)** - Require password before edit/delete
3. **Audit Logging (#3)** - Log all financial data changes
4. **Rate Limiting (#4)** - Max 2 changes per hour
5. **i18n Support (#5)** - Translate all text

---

**End of Audit Report**
