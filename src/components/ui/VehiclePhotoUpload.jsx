import { useState, useRef } from 'react'
import { PhotoIcon, XMarkIcon, CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { logger } from '@/utils/logger'

const VehiclePhotoUpload = ({ value, onChange, error, label = 'Vehicle Photo', required = true }) => {
  const [preview, setPreview] = useState(value || null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(error || '')
  const fileInputRef = useRef(null)

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setUploadError('Please select an image file (JPG, PNG, WebP)')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Image must be less than 5MB')
      return
    }

    setUploading(true)
    setUploadError('')

    try {
      // Create preview
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreview(reader.result)
      }
      reader.readAsDataURL(file)

      // Upload to Supabase Storage
      const { supabase } = await import('@/services/supabase')
      const fileExt = file.name.split('.').pop()
      const fileName = `vehicle_${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('vehicle-photos')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        })

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('vehicle-photos')
        .getPublicUrl(fileName)

      onChange(publicUrl)
    } catch (err) {
      logger.error('Upload error:', err)
      setUploadError('Failed to upload photo. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const handleRemove = () => {
    setPreview(null)
    onChange(null)
    setUploadError('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div>
      <label className="input-label flex items-center gap-2">
        {label}
        {required && <span className="text-red-500">*</span>}
      </label>

      {preview ? (
        <div className="relative group">
          <div className="w-full h-48 rounded-xl overflow-hidden border-2 border-green-200 bg-gray-100">
            <img
              src={preview}
              alt="Vehicle"
              className="w-full h-full object-cover"
            />
          </div>

          {/* Success Badge */}
          <div className="absolute top-3 left-3 flex items-center gap-1.5 px-3 py-1.5 bg-green-500 text-white text-xs font-medium rounded-full shadow-lg">
            <CheckCircleIcon className="w-4 h-4" />
            Photo uploaded
          </div>

          {/* Remove Button */}
          <button
            type="button"
            onClick={handleRemove}
            className="absolute top-3 right-3 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 shadow-lg"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className={`w-full h-48 rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-colors bg-transparent ${
            uploadError
              ? 'border-red-300 bg-red-50 hover:border-red-400'
              : 'border-gray-300 bg-gray-50 hover:border-green-400 hover:bg-green-50'
          }`}
        >
          {uploading ? (
            <>
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600 mb-3"></div>
              <p className="text-sm text-gray-600">Uploading...</p>
            </>
          ) : (
            <>
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center mb-3 ${
                uploadError ? 'bg-red-100' : 'bg-green-100'
              }`}>
                <PhotoIcon className={`w-7 h-7 ${uploadError ? 'text-red-500' : 'text-green-600'}`} />
              </div>
              <p className="text-sm font-medium text-gray-700 mb-1">
                Click to upload vehicle photo
              </p>
              <p className="text-xs text-gray-500">
                JPG, PNG or WebP • Max 5MB
              </p>
            </>
          )}
        </button>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        disabled={uploading}
      />

      {uploadError && (
        <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
          <ExclamationTriangleIcon className="w-4 h-4" />
          {uploadError}
        </p>
      )}

      {/* Help Text */}
      <div className="mt-3 p-3 bg-blue-50 border border-blue-100 rounded-lg">
        <div className="flex items-start gap-2">
          <ExclamationTriangleIcon className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-blue-700">
            <p className="font-medium mb-1">Photo Requirements:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>Clear photo of your vehicle (front or side view)</li>
              <li>License plate must be visible</li>
              <li>Good lighting, no blur</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

export default VehiclePhotoUpload
