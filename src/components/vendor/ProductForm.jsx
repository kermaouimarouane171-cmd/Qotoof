/**
 * مكونات نموذج المنتج للبائع.
 * يحتوي على ImageUploader لرفع صور المنتجات (drag & drop + preview).
 */

import { useRef, useState } from 'react'
import { PhotoIcon, XMarkIcon, ArrowUpTrayIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

const MAX_IMAGES = 5
const MAX_SIZE_BYTES = 5 * 1024 * 1024
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

const readAsDataUrl = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export const ImageUploader = ({
  existingImages = [],
  newFiles = [],
  previews = [],
  onAddFiles,
  onRemoveNewImage,
  onRemoveExistingImage,
}) => {
  const inputRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)

  const totalCount = existingImages.length + newFiles.length
  const reachedLimit = totalCount >= MAX_IMAGES

  const validateFiles = (files) => {
    const selected = Array.from(files || [])

    if (selected.length === 0) return []

    if (selected.length + totalCount > MAX_IMAGES) {
      toast.error(`الحد الأقصى هو ${MAX_IMAGES} صور لكل منتج`)
      return []
    }

    const valid = []
    for (const file of selected) {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        toast.error(`صيغة غير مدعومة: ${file.name}. المسموح JPG/PNG/WebP فقط`)
        continue
      }
      if (file.size > MAX_SIZE_BYTES) {
        toast.error(`حجم الصورة كبير: ${file.name}. الحد الأقصى 5MB`)
        continue
      }
      valid.push(file)
    }

    return valid
  }

  const handleSelect = async (files) => {
    const validFiles = validateFiles(files)
    if (validFiles.length === 0) return

    const generatedPreviews = await Promise.all(validFiles.map((f) => readAsDataUrl(f)))
    onAddFiles(validFiles, generatedPreviews)
  }

  const onDrop = async (event) => {
    event.preventDefault()
    setIsDragging(false)
    await handleSelect(event.dataTransfer.files)
  }

  return (
    <div>
      <label className="input-label">صور المنتج ({totalCount}/{MAX_IMAGES})</label>

      {existingImages.length > 0 && (
        <div className="flex gap-3 mb-3 flex-wrap">
          {existingImages.map((img) => (
            <div key={img.id} className="relative group">
              <img src={img.url} alt="" className="w-20 h-20 rounded-lg object-cover border border-gray-200" />
              <button
                type="button"
                onClick={() => onRemoveExistingImage(img.id)}
                className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <XMarkIcon className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {previews.length > 0 && (
        <div className="flex gap-3 mb-3 flex-wrap">
          {previews.map((preview, index) => (
            <div key={`${index}-${preview?.slice?.(0, 12) || 'img'}`} className="relative group">
              <img src={preview} alt="" className="w-20 h-20 rounded-lg object-cover border border-gray-200" />
              <button
                type="button"
                onClick={() => onRemoveNewImage(index)}
                className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <XMarkIcon className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div
        role="button"
        tabIndex={0}
        onClick={() => !reachedLimit && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            if (!reachedLimit) inputRef.current?.click()
          }
        }}
        onDragOver={(e) => {
          e.preventDefault()
          if (!reachedLimit) setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className={`w-full h-28 border-2 border-dashed rounded-xl transition-colors flex items-center justify-center cursor-pointer ${
          reachedLimit
            ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
            : isDragging
              ? 'border-green-500 bg-green-50'
              : 'border-gray-300 hover:bg-gray-50'
        }`}
      >
        <div className="text-center px-4">
          {isDragging ? (
            <ArrowUpTrayIcon className="w-8 h-8 text-green-600 mx-auto mb-1" />
          ) : (
            <PhotoIcon className="w-8 h-8 text-gray-400 mx-auto mb-1" />
          )}
          <p className="text-sm text-gray-600">
            {reachedLimit ? 'تم الوصول للحد الأقصى للصور' : 'اسحب الصور هنا أو اضغط للاختيار'}
          </p>
          <p className="text-xs text-gray-400 mt-1">JPG, PNG, WebP - بحد أقصى 5MB لكل صورة</p>
        </div>

        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          disabled={reachedLimit}
          onChange={async (e) => {
            await handleSelect(e.target.files)
            e.target.value = ''
          }}
        />
      </div>
    </div>
  )
}

export default ImageUploader
