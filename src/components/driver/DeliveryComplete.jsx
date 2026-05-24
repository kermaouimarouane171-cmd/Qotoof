// Enhanced DeliveryComplete component with mandatory photo, signature, and condition check
import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { Card, LoadingSpinner } from '@/components/ui'
import { supabase } from '@/services/supabase'
import { CameraIcon, CheckCircleIcon, ArrowLeftIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { logger } from '@/utils/logger'

const CONDITION_OPTIONS = [
  { value: 'excellent', label: 'Excellent', emoji: '✨', color: 'green' },
  { value: 'good', label: 'Good', emoji: '👍', color: 'blue' },
  { value: 'fair', label: 'Fair', emoji: '⚠️', color: 'yellow' },
  { value: 'damaged', label: 'Damaged', emoji: '❌', color: 'red' }
]

const DeliveryComplete = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  useAuthStore()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [delivery, setDelivery] = useState(null)
  
  // Form state
  const [_deliveryPhoto, setDeliveryPhoto] = useState(null)
  const [deliveryPhotoUrl, setDeliveryPhotoUrl] = useState(null)
  const [buyerSignature, setBuyerSignature] = useState(null)
  const [buyerSignatureUrl] = useState(null)
  const [deliveryCondition, setDeliveryCondition] = useState('')
  const [buyerName, setBuyerName] = useState('')
  const [deliveryNotes, setDeliveryNotes] = useState('')
  const [checklist, setChecklist] = useState({
    buyer_confirmed_receipt: false,
    buyer_reported_issues: false,
    delivery_issues: ''
  })

  const signatureCanvasRef = useRef(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    loadDeliveryDetails()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const loadDeliveryDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('deliveries')
        .select(`
          *,
          order:orders(*)
        `)
        .eq('id', id)
        .single()

      if (error) throw error
      setDelivery(data)
    } catch (error) {
      logger.error('Error loading delivery:', error)
      toast.error('Failed to load delivery details')
    } finally {
      setLoading(false)
    }
  }

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Photo size must be less than 10MB')
      return
    }

    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `delivery-proofs/${id}_${Date.now()}.${fileExt}`
      
      const { error } = await supabase.storage
        .from('delivery-proofs')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (error) throw error

      const { data: urlData } = supabase.storage
        .from('delivery-proofs')
        .getPublicUrl(fileName)

      setDeliveryPhoto(file)
      setDeliveryPhotoUrl(urlData.publicUrl)
      toast.success('✅ Delivery photo uploaded')
    } catch (error) {
      logger.error('Upload error:', error)
      toast.error('Failed to upload photo')
    }
  }

  const _captureSignature = () => {
    // Simple signature capture using canvas
    const canvas = signatureCanvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    let isDrawing = false
    let lastX = 0
    let lastY = 0

    const startDrawing = (e) => {
      isDrawing = true
      const rect = canvas.getBoundingClientRect()
      lastX = e.clientX - rect.left
      lastY = e.clientY - rect.top
    }

    const draw = (e) => {
      if (!isDrawing) return
      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      ctx.beginPath()
      ctx.moveTo(lastX, lastY)
      ctx.lineTo(x, y)
      ctx.strokeStyle = '#000'
      ctx.lineWidth = 2
      ctx.stroke()

      lastX = x
      lastY = y
    }

    const stopDrawing = () => {
      isDrawing = false
    }

    canvas.addEventListener('mousedown', startDrawing)
    canvas.addEventListener('mousemove', draw)
    canvas.addEventListener('mouseup', stopDrawing)
    canvas.addEventListener('mouseout', stopDrawing)

    // Touch events for mobile
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault()
      const touch = e.touches[0]
      const mouseEvent = new MouseEvent('mousedown', {
        clientX: touch.clientX,
        clientY: touch.clientY
      })
      canvas.dispatchEvent(mouseEvent)
    })

    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault()
      const touch = e.touches[0]
      const mouseEvent = new MouseEvent('mousemove', {
        clientX: touch.clientX,
        clientY: touch.clientY
      })
      canvas.dispatchEvent(mouseEvent)
    })

    canvas.addEventListener('touchend', (e) => {
      e.preventDefault()
      const mouseEvent = new MouseEvent('mouseup')
      canvas.dispatchEvent(mouseEvent)
    })
  }

  const saveSignature = () => {
    const canvas = signatureCanvasRef.current
    if (!canvas) return

    const dataUrl = canvas.toDataURL('image/png')
    setBuyerSignature(dataUrl)
    toast.success('✅ Signature captured')
  }

  const clearSignature = () => {
    const canvas = signatureCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setBuyerSignature(null)
  }

  const handleSubmit = async () => {
    // Validation
    if (!deliveryPhotoUrl) {
      toast.error('❌ Delivery photo is mandatory')
      return
    }

    if (!deliveryCondition) {
      toast.error('❌ Please select delivery condition')
      return
    }

    if (!buyerName.trim()) {
      toast.error('❌ Please enter recipient name')
      return
    }

    setSubmitting(true)

    try {
      // Upload signature if exists
      let signatureUrl = buyerSignatureUrl
      if (buyerSignature) {
        const signatureBlob = await fetch(buyerSignature).then(r => r.blob())
        const signatureFile = new File([signatureBlob], `signature_${Date.now()}.png`, { type: 'image/png' })
        
        const { data: sigData } = await supabase.storage
          .from('signatures')
          .upload(`signatures/${id}_${Date.now()}.png`, signatureFile)

        if (sigData) {
          const { data: urlData } = supabase.storage
            .from('signatures')
            .getPublicUrl(sigData.path)
          signatureUrl = urlData.publicUrl
        }
      }

      // Update delivery
      const { error: updateError } = await supabase
        .from('deliveries')
        .update({
          status: 'delivered',
          delivery_photo_url: deliveryPhotoUrl,
          buyer_signature_url: signatureUrl,
          buyer_name_received: buyerName,
          delivery_condition: deliveryCondition,
          driver_notes: deliveryNotes,
          delivered_at: new Date().toISOString()
        })
        .eq('id', id)

      if (updateError) throw updateError

      // Create checklist record
      if (checklist.buyer_confirmed_receipt || checklist.buyer_reported_issues) {
        await supabase
          .from('delivery_checklist')
          .insert({
            delivery_id: id,
            buyer_confirmed_receipt: checklist.buyer_confirmed_receipt,
            buyer_reported_issues: checklist.buyer_reported_issues,
            delivery_issues: checklist.delivery_issues
          })
      }

      toast.success('🎉 Delivery completed successfully!')
      navigate('/driver/dashboard')
    } catch (error) {
      logger.error('Submit error:', error)
      toast.error(error.message || 'Failed to complete delivery')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!delivery) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">Delivery not found</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeftIcon className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Complete Delivery</h1>
      </div>

      {/* Special Instructions Alert */}
      {delivery?.special_instructions && (
        <Card className="p-4 mb-6 bg-yellow-50 border-yellow-200">
          <h3 className="font-semibold text-yellow-900 mb-2">⚠️ Special Instructions:</h3>
          <p className="text-sm text-yellow-800">{delivery.special_instructions}</p>
        </Card>
      )}

      {/* Fragile Items Alert */}
      {delivery?.is_fragile && (
        <Card className="p-4 mb-6 bg-red-50 border-red-200">
          <h3 className="font-semibold text-red-900 mb-2">📦 Fragile Items!</h3>
          <p className="text-sm text-red-800">Handle with care. Take extra precautions during delivery.</p>
        </Card>
      )}

      {/* Step 1: Delivery Photo (MANDATORY) */}
      <Card className="p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <CameraIcon className="w-5 h-5" />
          Delivery Photo <span className="text-red-500">*</span>
        </h2>
        
        {deliveryPhotoUrl ? (
          <div className="space-y-3">
            <img src={deliveryPhotoUrl} alt="Delivery proof" className="w-full rounded-lg" />
            <button
              onClick={() => { setDeliveryPhoto(null); setDeliveryPhotoUrl(null) }}
              className="text-sm text-red-600 hover:underline"
            >
              Remove and retake
            </button>
          </div>
        ) : (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full p-8 border-2 border-dashed border-gray-300 rounded-lg hover:border-green-500 hover:bg-green-50 transition-colors"
            >
              <CameraIcon className="w-12 h-12 mx-auto text-gray-400 mb-3" />
              <p className="text-sm font-medium text-gray-700">Take Delivery Photo</p>
              <p className="text-xs text-gray-500 mt-1">Photo is mandatory to complete delivery</p>
            </button>
          </div>
        )}
      </Card>

      {/* Step 2: Product Condition */}
      <Card className="p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Product Condition at Delivery</h2>
        <div className="grid grid-cols-2 gap-3">
          {CONDITION_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setDeliveryCondition(option.value)}
              className={`p-4 rounded-lg border-2 transition-colors ${
                deliveryCondition === option.value
                  ? `border-${option.color}-500 bg-${option.color}-50`
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <span className="text-2xl">{option.emoji}</span>
              <p className="text-sm font-medium mt-2">{option.label}</p>
            </button>
          ))}
        </div>
      </Card>

      {/* Step 3: Recipient Name */}
      <Card className="p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recipient Information</h2>
        <input
          type="text"
          placeholder="Name of person who received the delivery"
          value={buyerName}
          onChange={(e) => setBuyerName(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
        />
      </Card>

      {/* Step 4: Buyer Signature (Optional but recommended) */}
      <Card className="p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Buyer Signature (Optional)</h2>
        <canvas
          ref={signatureCanvasRef}
          width={500}
          height={200}
          className="w-full border-2 border-gray-300 rounded-lg bg-white touch-none"
          style={{ cursor: 'crosshair' }}
        />
        <div className="flex gap-3 mt-3">
          <button
            onClick={saveSignature}
            className="flex-1 btn-primary"
          >
            Save Signature
          </button>
          <button
            onClick={clearSignature}
            className="flex-1 btn-outline"
          >
            Clear
          </button>
        </div>
      </Card>

      {/* Step 5: Delivery Checklist */}
      <Card className="p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Delivery Checklist</h2>
        <div className="space-y-3">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={checklist.buyer_confirmed_receipt}
              onChange={(e) => setChecklist({ ...checklist, buyer_confirmed_receipt: e.target.checked })}
              className="w-5 h-5 text-green-600 rounded"
            />
            <span className="text-sm">Buyer confirmed receipt of items</span>
          </label>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={checklist.buyer_reported_issues}
              onChange={(e) => setChecklist({ ...checklist, buyer_reported_issues: e.target.checked })}
              className="w-5 h-5 text-red-600 rounded"
            />
            <span className="text-sm">Buyer reported any issues</span>
          </label>
          {checklist.buyer_reported_issues && (
            <textarea
              placeholder="Describe the issues reported..."
              value={checklist.delivery_issues}
              onChange={(e) => setChecklist({ ...checklist, delivery_issues: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg mt-2"
              rows={3}
            />
          )}
        </div>
      </Card>

      {/* Step 6: Additional Notes */}
      <Card className="p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Additional Notes (Optional)</h2>
        <textarea
          placeholder="Any additional notes about the delivery..."
          value={deliveryNotes}
          onChange={(e) => setDeliveryNotes(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          rows={3}
        />
      </Card>

      {/* Submit Button */}
      <button
        onClick={handleSubmit}
        disabled={submitting || !deliveryPhotoUrl || !deliveryCondition || !buyerName}
        className="w-full btn-primary py-4 text-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting ? (
          <LoadingSpinner size="sm" />
        ) : (
          <>
            <CheckCircleIcon className="w-5 h-5 inline mr-2" />
            Complete Delivery
          </>
        )}
      </button>
    </div>
  )
}

export default DeliveryComplete
