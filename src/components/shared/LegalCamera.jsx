import { useCallback, useEffect, useRef, useState } from 'react'
import {
  CameraIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import {
  buildLegalWatermarkText,
  getCurrentGeoPosition,
  getProductConditionStageLabel,
  PRODUCT_CONDITION_ROLE_LABELS,
  renderWatermarkedCapture,
  reverseGeocodePosition,
} from '@/services/legalCameraService'

const LegalCamera = ({
  orderNumber,
  captureStage,
  actorRole,
  onCapture,
  submitting = false,
}) => {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const previewUrlRef = useRef('')
  const [startingCamera, setStartingCamera] = useState(true)
  const [cameraError, setCameraError] = useState('')
  const [capturing, setCapturing] = useState(false)
  const [previewUrl, setPreviewUrl] = useState('')
  const [capturePayload, setCapturePayload] = useState(null)

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }, [])

  const startCamera = useCallback(async () => {
    setStartingCamera(true)
    setCameraError('')

    try {
      if (!navigator?.mediaDevices?.getUserMedia) {
        throw new Error('المتصفح الحالي لا يدعم فتح الكاميرا مباشرة.')
      }

      stopCamera()
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      })

      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
    } catch (error) {
      setCameraError(error.message || 'تعذر تشغيل الكاميرا القانونية.')
    } finally {
      setStartingCamera(false)
    }
  }, [stopCamera])

  useEffect(() => {
    startCamera()
    return () => {
      stopCamera()
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
      }
    }
  }, [startCamera, stopCamera])

  const resetPreview = () => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = ''
    }

    setPreviewUrl('')
    setCapturePayload(null)
  }

  const handleCapture = async () => {
    if (!videoRef.current) return

    setCapturing(true)
    try {
      const capturedAt = new Date().toISOString()
      const position = await getCurrentGeoPosition()
      const address = await reverseGeocodePosition(position)
      const watermarkLines = buildLegalWatermarkText({
        orderNumber,
        captureStage,
        actorRole,
        capturedAt,
        latitude: position.latitude,
        longitude: position.longitude,
        address,
      })

      const blob = await renderWatermarkedCapture({
        videoElement: videoRef.current,
        watermarkLines,
      })

      const nextPreviewUrl = URL.createObjectURL(blob)
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
      }

      previewUrlRef.current = nextPreviewUrl
      setPreviewUrl(nextPreviewUrl)
      setCapturePayload({
        blob,
        capturedAt,
        latitude: position.latitude,
        longitude: position.longitude,
        accuracy: position.accuracy,
        address,
        watermarkLines,
        metadata: {
          accuracy: position.accuracy,
          heading: position.heading,
          speed: position.speed,
        },
      })
    } catch (error) {
      toast.error(error.message || 'تعذر التقاط الصورة القانونية.')
    } finally {
      setCapturing(false)
    }
  }

  const handleConfirm = async () => {
    if (!capturePayload) return
    await onCapture(capturePayload)
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-start gap-3">
          <CameraIcon className="mt-0.5 h-5 w-5 text-slate-600" />
          <div>
            <p className="font-semibold text-slate-900">الكاميرا القانونية المباشرة</p>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              سيتم تضمين الوقت، الدور، المرحلة، وإحداثيات GPS داخل الصورة نفسها. لا يمكن رفع صورة من المعرض هنا.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              {getProductConditionStageLabel(captureStage)} | {PRODUCT_CONDITION_ROLE_LABELS[actorRole] || actorRole}
            </p>
          </div>
        </div>
      </div>

      {cameraError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
          <div className="flex items-start gap-3">
            <ExclamationTriangleIcon className="mt-0.5 h-5 w-5" />
            <div>
              <p className="font-semibold">تعذر تشغيل الكاميرا</p>
              <p className="mt-1 text-sm">{cameraError}</p>
              <button type="button" onClick={startCamera} className="mt-3 btn-outline">
                إعادة محاولة فتح الكاميرا
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-black">
        {previewUrl ? (
          <img src={previewUrl} alt="معاينة الالتقاط القانوني" className="aspect-video w-full object-cover" />
        ) : (
          <video ref={videoRef} playsInline muted className="aspect-video w-full object-cover" />
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        {!previewUrl ? (
          <button
            type="button"
            onClick={handleCapture}
            disabled={startingCamera || capturing || Boolean(cameraError)}
            className="btn-primary inline-flex items-center gap-2"
          >
            {capturing ? <ArrowPathIcon className="h-5 w-5 animate-spin" /> : <CameraIcon className="h-5 w-5" />}
            {capturing ? 'جاري الالتقاط...' : 'التقاط الصورة القانونية'}
          </button>
        ) : (
          <>
            <button type="button" onClick={resetPreview} disabled={submitting} className="btn-outline inline-flex items-center gap-2">
              <ArrowPathIcon className="h-5 w-5" />
              إعادة الالتقاط
            </button>
            <button type="button" onClick={handleConfirm} disabled={submitting} className="btn-primary inline-flex items-center gap-2">
              {submitting ? <ArrowPathIcon className="h-5 w-5 animate-spin" /> : <CheckCircleIcon className="h-5 w-5" />}
              {submitting ? 'جاري الحفظ...' : 'اعتماد الصورة القانونية'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default LegalCamera
