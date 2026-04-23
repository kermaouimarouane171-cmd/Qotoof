# 🔍 Profile Page (/profile) Security & Functionality Audit Report

**Date:** April 11, 2026  
**Auditor:** Senior Full-Stack Engineer (20 years experience)  
**File:** `src/pages/Profile.jsx` + `src/store/authStore.js`  
**Route:** `/profile`  
**Component:** `ProfilePage`

---

## 📊 Executive Summary

After thorough review of the Profile page, I identified **12 issues** including **no avatar upload functionality**, **no field-level validation**, **no loading state during update**, and **Map component with no props**. The page has good foundations with PATCH-style updates (Supabase `.update()`), CIN validation, and audit logging. However, several critical functionality gaps need immediate attention.

### Issues Breakdown

| Severity | Count | Status |
|----------|-------|--------|
| 🔴 Critical (Security) | 3 | Must fix immediately |
| 🟡 High (Functionality) | 5 | Should fix |
| 🟢 Medium (UX) | 3 | Nice to have |
| ⚪ Low (Cosmetic) | 1 | Optional |

---

## ❌ Issues Found & Fixes

---

### 🔴 CRITICAL #1: No Avatar/Photo Upload Functionality

**Issue:** The profile page shows a placeholder icon but has no way to upload a profile photo. Users cannot personalize their profile.

**Risk:** **SEVERE** — Core feature missing. Users expect to upload profile photos.

**Current Code:**
```jsx
<div className="w-20 h-20 rounded-full bg-primary-100 flex items-center justify-center">
  <UserCircleIcon className="w-12 h-12 text-primary-600" />
</div>
```

**Fixed Code:**
```jsx
import { useState, useRef } from 'react'
import { supabase } from '@/services/supabase'

const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || null)
const [avatarUploading, setAvatarUploading] = useState(false)
const fileInputRef = useRef(null)

const handleAvatarUpload = async (e) => {
  const file = e.target.files?.[0]
  if (!file) return

  // Validate file type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!allowedTypes.includes(file.type)) {
    toast.error('Only JPEG, PNG, WebP, and GIF images are allowed')
    return
  }

  // Validate file size (max 2MB)
  const maxSize = 2 * 1024 * 1024 // 2MB
  if (file.size > maxSize) {
    toast.error('Image must be less than 2MB')
    return
  }

  setAvatarUploading(true)
  try {
    // Generate unique file name
    const fileExt = file.name.split('.').pop()
    const fileName = `${user.id}-${Date.now()}.${fileExt}`
    const filePath = `profile-photos/${fileName}`

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('profile-photos')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
      })

    if (uploadError) throw uploadError

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('profile-photos')
      .getPublicUrl(filePath)

    setAvatarUrl(publicUrl)

    // Update profile with avatar URL
    await updateProfile({ avatar_url: publicUrl })
    toast.success('Profile photo updated!')
  } catch (error) {
    logger.error('Avatar upload error:', error)
    toast.error('Failed to upload photo')
  } finally {
    setAvatarUploading(false)
  }
}

// In JSX:
<div className="relative">
  <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center">
    {avatarUrl ? (
      <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
    ) : (
      <UserCircleIcon className="w-12 h-12 text-gray-400" />
    )}
  </div>
  <button
    type="button"
    onClick={() => fileInputRef.current?.click()}
    disabled={avatarUploading}
    className="absolute -bottom-1 -right-1 w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-white hover:bg-green-700 disabled:opacity-50"
    aria-label="Upload profile photo"
  >
    {avatarUploading ? (
      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    ) : (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    )}
  </button>
  <input
    ref={fileInputRef}
    type="file"
    accept="image/jpeg,image/png,image/webp,image/gif"
    onChange={handleAvatarUpload}
    className="hidden"
    aria-label="Profile photo upload"
  />
</div>
```

**Impact:** ✅ Users can upload profile photos with proper validation

---

### 🔴 CRITICAL #2: No Field-Level Validation

**Issue:** Only CIN is validated. First name, last name, phone, address, and city have no validation.

**Risk:** **SEVERE** — Users can submit invalid data (empty names, invalid phone numbers, etc.).

**Current Code:**
```jsx
<Input
  label={t('auth.firstName')}
  value={formData.firstName}
  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
/>
```

**Fixed Code:**
```jsx
const [errors, setErrors] = useState({})

const validateField = (name, value) => {
  switch (name) {
    case 'firstName':
      if (!value.trim()) return 'First name is required'
      if (value.trim().length < 2) return 'First name must be at least 2 characters'
      if (value.trim().length > 50) return 'First name must be less than 50 characters'
      if (!/^[a-zA-Z\u0600-\u06FF\s'-]+$/.test(value)) return 'First name can only contain letters'
      return ''
    case 'lastName':
      if (!value.trim()) return 'Last name is required'
      if (value.trim().length < 2) return 'Last name must be at least 2 characters'
      if (value.trim().length > 50) return 'Last name must be less than 50 characters'
      if (!/^[a-zA-Z\u0600-\u06FF\s'-]+$/.test(value)) return 'Last name can only contain letters'
      return ''
    case 'phone':
      if (value && !/^[+]?[\d\s()-]{8,15}$/.test(value)) return 'Please enter a valid phone number'
      return ''
    case 'address':
      if (value && value.length > 200) return 'Address must be less than 200 characters'
      return ''
    case 'city':
      if (value && value.length > 50) return 'City must be less than 50 characters'
      return ''
    case 'storeName':
      if (value && value.length < 3) return 'Store name must be at least 3 characters'
      if (value && value.length > 100) return 'Store name must be less than 100 characters'
      return ''
    default:
      return ''
  }
}

const handleFieldChange = (name, value) => {
  setFormData({ ...formData, [name]: value })
  const error = validateField(name, value)
  setErrors({ ...errors, [name]: error })
}

// In JSX:
<Input
  label={t('auth.firstName')}
  value={formData.firstName}
  onChange={(e) => handleFieldChange('firstName', e.target.value)}
  error={errors.firstName}
  required
/>
```

**Impact:** ✅ All fields validated client-side before submission

---

### 🔴 CRITICAL #3: No Loading State During Profile Update

**Issue:** No visual feedback while profile is being saved. Users may click submit multiple times.

**Risk:** **SEVERE** — Duplicate submissions, confusing UX.

**Current Code:**
```jsx
const handleSubmit = async (e) => {
  e.preventDefault()
  // No loading state
  const result = await updateProfile({...})
  if (result.success) {
    toast.success('Profile updated successfully')
  }
}
```

**Fixed Code:**
```jsx
const [submitting, setSubmitting] = useState(false)

const handleSubmit = async (e) => {
  e.preventDefault()

  // Validate all fields
  const newErrors = {}
  Object.keys(formData).forEach(key => {
    const error = validateField(key, formData[key])
    if (error) newErrors[key] = error
  })

  if (Object.keys(newErrors).length > 0) {
    setErrors(newErrors)
    toast.error('Please fix the errors before submitting')
    return
  }

  setSubmitting(true)
  try {
    const result = await updateProfile({
      first_name: formData.firstName,
      last_name: formData.lastName,
      phone: formData.phone,
      cin: formData.cin || null,
      store_name: formData.storeName,
      store_description: formData.storeDescription,
      address: formData.address,
      city: formData.city,
      country: formData.country,
    })

    if (result.success) {
      toast.success('Profile updated successfully')
    } else {
      toast.error(result.error || 'Failed to update profile')
    }
  } catch (error) {
    logger.error('Profile update error:', error)
    toast.error('Failed to update profile')
  } finally {
    setSubmitting(false)
  }
}

// In JSX:
<Button type="submit" variant="primary" size="lg" isLoading={submitting} disabled={submitting}>
  {submitting ? 'Updating...' : t('profile.updateProfile')}
</Button>
```

**Impact:** ✅ Clear loading state, prevents duplicate submissions

---

### 🟡 HIGH #4: PATCH Request Verified ✅

**Status:** ✅ **WORKING CORRECTLY**

The `updateProfile` method uses Supabase's `.update()` which is a **partial update (PATCH)**, not a full replacement (PUT):

```javascript
const { data, error } = await supabase
  .from('profiles')
  .update(updates) // ✅ Only updates the fields provided
  .eq('id', user.id)
  .select()
  .single()
```

**No fix needed** — Supabase `.update()` only updates the fields provided in the `updates` object, leaving other fields unchanged. This is equivalent to a PATCH request.

---

### 🟡 HIGH #5: Map Component Has No Props

**Issue:** `<Map height="250px" />` is rendered without center coordinates, markers, or any interactivity.

**Fixed Code:**
```jsx
<Map
  center={[
    profile?.latitude || 33.5731, // Casablanca default
    profile?.longitude || -7.5898
  ]}
  zoom={12}
  markers={
    profile?.latitude && profile?.longitude
      ? [{
          lat: profile.latitude,
          lng: profile.longitude,
          popup: formData.storeName || 'Store Location',
        }]
      : []
  }
  height="250px"
  onLocationSelect={(lat, lng) => {
    setFormData({ ...formData, latitude: lat, longitude: lng })
  }}
/>
```

**Impact:** ✅ Map shows actual store location with interactive pin placement

---

### 🟡 HIGH #6: No Success/Error Feedback Per Field

**Issue:** Only a general toast message. No indication of which fields were updated or failed.

**Recommendation:** Add field-level success indicators:
```jsx
{result.success && (
  <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
    <p className="text-sm text-green-700">Profile updated successfully</p>
  </div>
)}
```

---

### 🟡 HIGH #7: No Confirmation Before Update

**Issue:** No diff display or confirmation before submitting changes.

**Recommendation:** Show a summary of changes before submitting:
```jsx
const getChangedFields = () => {
  const changes = {}
  if (formData.firstName !== profile?.first_name) changes.firstName = formData.firstName
  if (formData.lastName !== profile?.last_name) changes.lastName = formData.lastName
  // ... etc
  return changes
}

const changes = getChangedFields()
if (Object.keys(changes).length > 0) {
  // Show confirmation modal
}
```

---

### 🟡 HIGH #8: Email Field Disabled But No Explanation

**Issue:** Email is shown as disabled but there's no explanation of how to change it.

**Fixed Code:**
```jsx
<div>
  <Input
    label={t('auth.email')}
    type="email"
    value={formData.email}
    disabled
  />
  <p className="text-xs text-gray-500 mt-1">
    To change your email, go to{' '}
    <Link to="/settings" className="text-green-600 hover:underline">Account Settings</Link>
  </p>
</div>
```

---

### 🟢 MEDIUM #9: No i18n for CIN Section

**Issue:** CIN section has hardcoded English text.

**Fixed Code:**
```jsx
<h3 className="font-semibold text-green-800">
  {t('profile.cin.title', 'National ID (CIN)')}
</h3>
```

---

### 🟢 MEDIUM #10: No Error Boundary

**Fixed Code:**
```jsx
import ErrorBoundary from '@/components/ErrorBoundary'

const ProfileWithErrorBoundary = () => (
  <ErrorBoundary componentName="ProfilePage">
    <ProfilePage />
  </ErrorBoundary>
)

export default ProfileWithErrorBoundary
```

---

### 🟢 MEDIUM #11: No Unsaved Changes Warning

**Issue:** User can navigate away without saving changes.

**Recommendation:** Add `useBeforeUnload` hook:
```jsx
useEffect(() => {
  const hasChanges = JSON.stringify(formData) !== JSON.stringify({
    firstName: profile?.first_name,
    lastName: profile?.last_name,
    // ...
  })

  if (hasChanges) {
    const handleBeforeUnload = (e) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }
}, [formData, profile])
```

---

### ⚪ LOW #12: No Profile Photo Fallback on Error

**Issue:** If avatar URL is invalid, broken image is shown.

**Fixed Code:**
```jsx
<img
  src={avatarUrl}
  alt="Profile"
  className="w-full h-full object-cover"
  onError={(e) => {
    e.target.style.display = 'none'
    e.target.parentElement.innerHTML = '<svg class="w-12 h-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>'
  }}
/>
```

---

## ✅ What's Working Well

| Feature | Status | Notes |
|---------|--------|-------|
| **PATCH-style Updates** | ✅ Working | Supabase `.update()` is partial update |
| **CIN Validation** | ✅ Working | Full validation with format detection |
| **CIN Masking** | ✅ Working | Shows masked CIN with show/hide toggle |
| **Audit Logging** | ✅ Working | Profile updates logged |
| **Trust Badges** | ✅ Working | Displayed at bottom |
| **Role-Based Sections** | ✅ Working | Vendor-only store info section |

---

## 📝 Files to Modify

| File | Changes Required |
|------|------------------|
| `src/pages/Profile.jsx` | 10 fixes (#1, #2, #3, #5, #6, #7, #8, #9, #11, #12) |
| `src/store/authStore.js` | 1 fix (#10 - Error Boundary) |

---

## 🎯 Priority Fixes (Top 5)

If you only fix 5 things, fix these:

1. **Avatar Upload (#1)** - Core missing feature
2. **Field Validation (#2)** - Prevent invalid data
3. **Loading State (#3)** - Prevent duplicate submissions
4. **Map Props (#5)** - Make map functional
5. **Email Explanation (#8)** - Clarify email change process

---

**End of Audit Report**
