# 🔍 Vendor Profile (/vendor/profile) Audit Report

**Date:** April 11, 2026  
**Auditor:** Senior Full-Stack Engineer (20 years experience)  
**File:** `src/pages/vendor/Profile.jsx` + `src/pages/StoreDetail.jsx`  
**Route:** `/vendor/profile` → Public: `/stores/:id`  
**Component:** `VendorProfile`

---

## 📊 Executive Summary

After thorough review of the Vendor Profile page and its connection to the public Store Detail page, I identified **14 critical issues** including **no image upload functionality at all**, **no real-time sync between profile updates and public store page**, **no validation**, **no i18n support**, and **no Error Boundary**. The page is extremely basic and missing core functionality expected from a vendor profile management page.

### Issues Breakdown

| Severity | Count | Status |
|----------|-------|--------|
| 🔴 Critical (Functionality) | 5 | Must fix immediately |
| 🟡 High (UX/Security) | 5 | Should fix |
| 🟢 Medium (Polish) | 3 | Nice to have |
| ⚪ Low (Cosmetic) | 1 | Optional |

---

## ❌ Issues Found & Fixes

---

### 🔴 CRITICAL #1: No Image Upload Functionality

**Issue:** The profile page shows a placeholder icon but has NO way to upload a store logo or banner. Vendors cannot personalize their store appearance.

**Risk:** **SEVERE** — Core feature missing. Vendors expect to upload store logos and banners.

**Current Code:**
```jsx
<div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
  <UserIcon className="w-8 h-8 text-green-600" />
</div>
```

**Fixed Code:**
```jsx
import { useState, useRef } from 'react'
import { CameraIcon, XMarkIcon } from '@heroicons/react/24/outline'

const [storeLogo, setStoreLogo] = useState(profile?.store_logo || null)
const [storeBanner, setStoreBanner] = useState(profile?.store_banner || null)
const [logoUploading, setLogoUploading] = useState(false)
const [bannerUploading, setBannerUploading] = useState(false)
const logoInputRef = useRef(null)
const bannerInputRef = useRef(null)

const handleImageUpload = async (file, type) => {
  if (!file || !user) return

  // Validate file type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    toast.error('Only JPEG, PNG, and WebP images are allowed')
    return
  }

  // Validate file size (max 2MB for logo, 5MB for banner)
  const maxSize = type === 'logo' ? 2 * 1024 * 1024 : 5 * 1024 * 1024
  if (file.size > maxSize) {
    toast.error(`Image must be less than ${type === 'logo' ? '2MB' : '5MB'}`)
    return
  }

  const setUploading = type === 'logo' ? setLogoUploading : setBannerUploading
  const setUrl = type === 'logo' ? setStoreLogo : setStoreBanner

  setUploading(true)
  try {
    const fileExt = file.name.split('.').pop()
    const fileName = `${user.id}-${type}-${Date.now()}.${fileExt}`
    const filePath = `store-logos/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from('store-logos')
      .upload(filePath, file, { cacheControl: '3600', upsert: true })

    if (uploadError) throw uploadError

    const { data: { publicUrl } } = supabase.storage
      .from('store-logos')
      .getPublicUrl(filePath)

    setUrl(publicUrl)

    // Update profile with image URL
    const updateField = type === 'logo' ? 'store_logo' : 'store_banner'
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ [updateField]: publicUrl })
      .eq('id', user.id)

    if (updateError) throw updateError

    toast.success(`${type === 'logo' ? 'Store logo' : 'Store banner'} updated!`)
  } catch (error) {
    logger.error(`${type} upload error:`, error)
    toast.error(`Failed to upload ${type}`)
  } finally {
    setUploading(false)
  }
}

// In JSX:
{/* Store Banner */}
<div className="relative w-full h-48 bg-gray-100 rounded-xl overflow-hidden mb-6">
  {storeBanner ? (
    <img src={storeBanner} alt="Store banner" className="w-full h-full object-cover" />
  ) : (
    <div className="w-full h-full flex items-center justify-center bg-gradient-to-r from-green-500 to-emerald-600">
      <BuildingStorefrontIcon className="w-16 h-16 text-white/50" />
    </div>
  )}
  <button
    type="button"
    onClick={() => bannerInputRef.current?.click()}
    disabled={bannerUploading}
    className="absolute bottom-3 right-3 w-10 h-10 bg-white/90 rounded-full flex items-center justify-center shadow-lg hover:bg-white disabled:opacity-50"
  >
    {bannerUploading ? (
      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    ) : (
      <CameraIcon className="w-5 h-5 text-gray-600" />
    )}
  </button>
  <input
    ref={bannerInputRef}
    type="file"
    accept="image/jpeg,image/png,image/webp"
    onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'banner')}
    className="hidden"
  />
</div>

{/* Store Logo */}
<div className="relative -mt-16 ml-6 w-24 h-24 bg-white rounded-xl overflow-hidden shadow-lg border-4 border-white">
  {storeLogo ? (
    <img src={storeLogo} alt="Store logo" className="w-full h-full object-cover" />
  ) : (
    <div className="w-full h-full flex items-center justify-center bg-gray-100">
      <BuildingStorefrontIcon className="w-10 h-10 text-gray-400" />
    </div>
  )}
  <button
    type="button"
    onClick={() => logoInputRef.current?.click()}
    disabled={logoUploading}
    className="absolute bottom-1 right-1 w-8 h-8 bg-white/90 rounded-full flex items-center justify-center shadow hover:bg-white disabled:opacity-50"
  >
    {logoUploading ? (
      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    ) : (
      <CameraIcon className="w-4 h-4 text-gray-600" />
    )}
  </button>
  <input
    ref={logoInputRef}
    type="file"
    accept="image/jpeg,image/png,image/webp"
    onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'logo')}
    className="hidden"
  />
</div>
```

**Impact:** ✅ Vendors can upload store logo and banner

---

### 🔴 CRITICAL #2: No Real-Time Sync to Public Store Page

**Issue:** When a vendor updates their profile, the changes don't appear immediately on the public store page (`/stores/:id`). The public page would need to be manually refreshed.

**Risk:** **SEVERE** — Vendors expect their changes to appear immediately. Buyers may see outdated information.

**Current Code:**
```javascript
// In VendorProfile.jsx - no notification to public store page
const handleSave = async () => {
  await supabase.from('profiles').update(formData).eq('id', user.id)
  toast.success('Profile updated')
  // ❌ No real-time update to public store page!
}
```

**Fixed Code:**
```javascript
// In VendorProfile.jsx - after successful update
const handleSave = async () => {
  setLoading(true)
  try {
    const { error } = await supabase
      .from('profiles')
      .update(formData)
      .eq('id', user.id)
      .select()
      .single()

    if (error) throw error

    // ✅ Update local auth store
    useAuthStore.setState({ profile: { ...profile, ...formData } })

    toast.success('Profile updated successfully!')
  } catch (error) {
    toast.error('Failed to update profile')
  } finally {
    setLoading(false)
  }
}

// In StoreDetail.jsx - add real-time subscription
useEffect(() => {
  if (!id) return

  // Subscribe to store profile updates
  const channel = supabase
    .channel(`store-updates:${id}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: `id=eq.${id}`,
      },
      (payload) => {
        logger.info('Store profile updated:', payload)
        // Update store data in real-time
        setStore(prev => prev ? { ...prev, ...payload.new } : payload.new)
        toast.success('Store information updated')
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}, [id])
```

**Impact:** ✅ Public store page updates in real-time when vendor changes profile

---

### 🔴 CRITICAL #3: No Form Validation

**Issue:** No validation on any field. Vendors can submit empty store names, invalid phone numbers, etc.

**Fixed Code:**
```javascript
const validateForm = () => {
  const errors = {}

  if (!formData.store_name.trim()) {
    errors.store_name = 'Store name is required'
  } else if (formData.store_name.length < 3) {
    errors.store_name = 'Store name must be at least 3 characters'
  } else if (formData.store_name.length > 100) {
    errors.store_name = 'Store name must be less than 100 characters'
  }

  if (formData.phone && !/^[+]?[\d\s()-]{8,15}$/.test(formData.phone)) {
    errors.phone = 'Please enter a valid phone number'
  }

  if (formData.city && formData.city.length > 50) {
    errors.city = 'City must be less than 50 characters'
  }

  if (formData.description && formData.description.length > 500) {
    errors.description = 'Description must be less than 500 characters'
  }

  return errors
}

const handleSave = async () => {
  const errors = validateForm()
  if (Object.keys(errors).length > 0) {
    setErrors(errors)
    toast.error('Please fix the errors before saving')
    return
  }
  // ... save logic
}
```

**Impact:** ✅ Prevents invalid data submission

---

### 🔴 CRITICAL #4: No i18n Support

**Issue:** All text is hardcoded in English.

**Fixed Code:**
```javascript
const { t } = useTranslation()

// In JSX:
<h1>{t('vendor.profile.title', 'Vendor Profile')}</h1>
<label>{t('vendor.profile.storeName', 'Store Name')}</label>
```

---

### 🔴 CRITICAL #5: No Error Boundary

**Fixed Code:**
```jsx
import ErrorBoundary from '@/components/ErrorBoundary'

const VendorProfileWithErrorBoundary = () => (
  <ErrorBoundary componentName="VendorProfile">
    <VendorProfile />
  </ErrorBoundary>
)

export default VendorProfileWithErrorBoundary
```

**Impact:** ✅ Prevents complete page crash on errors

---

### 🟡 HIGH #6: No Loading State for Individual Fields

**Issue:** No visual feedback while saving.

**Recommendation:** Add field-level loading states or a save indicator.

---

### 🟡 HIGH #7: No Success/Error Feedback Per Field

**Issue:** Only a general toast message. No indication of which field failed.

**Recommendation:** Add field-level error messages.

---

### 🟡 HIGH #8: No Unsaved Changes Warning

**Issue:** User can navigate away without saving changes.

**Recommendation:** Add `useBeforeUnload` hook.

---

### 🟡 HIGH #9: No Profile Image Fallback on Error

**Issue:** If image URL is invalid, broken image is shown.

**Fixed Code:**
```jsx
<img
  src={storeLogo}
  alt="Store logo"
  className="w-full h-full object-cover"
  onError={(e) => {
    e.target.style.display = 'none'
    e.target.parentElement.innerHTML = '<svg class="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>'
  }}
/>
```

**Impact:** ✅ Graceful fallback on image error

---

### 🟡 HIGH #10: No Audit Logging for Profile Changes

**Issue:** Profile changes are not logged for security auditing.

**Fixed Code:**
```javascript
import { auditLogger } from '@/services/auditLogger'

const handleSave = async () => {
  // ... validation

  const { data: oldProfile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const { error } = await supabase
    .from('profiles')
    .update(formData)
    .eq('id', user.id)

  if (error) throw error

  // Log profile update
  await auditLogger.logProfileAction('UPDATE', { ...oldProfile, ...formData }, oldProfile)

  toast.success('Profile updated successfully!')
}
```

**Impact:** ✅ All profile changes logged for security auditing

---

### 🟢 MEDIUM #11: No Business Hours Section

**Recommendation:** Add business hours input:
```jsx
<div>
  <label className="input-label">Business Hours</label>
  <div className="space-y-2">
    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => (
      <div key={day} className="flex items-center gap-3">
        <span className="text-sm w-24">{day}</span>
        <input type="time" className="input" />
        <span>to</span>
        <input type="time" className="input" />
      </div>
    ))}
  </div>
</div>
```

---

### 🟢 MEDIUM #12: No Social Media Links Section

**Recommendation:** Add social media links input.

---

### 🟢 MEDIUM #13: No Preview Button

**Recommendation:** Add button to preview public store page.

---

### ⚪ LOW #14: No Keyboard Shortcuts

**Recommendation:** Add Ctrl+S to save.

---

## ✅ What's Working Well

| Feature | Status | Notes |
|---------|--------|-------|
| **Basic Form** | ✅ Working | Store name, city, phone, address, description |
| **Save to Database** | ✅ Working | Updates profiles table |
| **Loading State** | ✅ Working | Spinner during save |

---

## 📝 Files to Modify

| File | Changes Required |
|------|------------------|
| `src/pages/vendor/Profile.jsx` | 12 fixes (#1, #2, #3, #4, #5, #6, #7, #8, #9, #10, #13, #14) |
| `src/pages/StoreDetail.jsx` | 1 fix (#2 - add real-time subscription) |

---

## 🎯 Priority Fixes (Top 5)

If you only fix 5 things, fix these:

1. **Image Upload (#1)** - Core missing feature
2. **Real-Time Sync (#2)** - Changes appear on public store
3. **Form Validation (#3)** - Prevent invalid data
4. **i18n Support (#4)** - Translate all text
5. **Error Boundary (#5)** - Prevent page crashes

---

**End of Audit Report**
