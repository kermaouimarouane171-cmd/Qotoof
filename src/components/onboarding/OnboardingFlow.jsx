import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { LoadingSpinner } from '@/components/ui'
import { useAuthStore } from '@/store/authStore'
import {
  completeOnboarding,
  getOnboardingPathForRole,
  updateOnboardingStep,
} from '@/services/onboardingService'

const THEMES = {
  buyer: {
    background: 'from-emerald-100 via-white to-lime-50',
    glow: 'bg-emerald-500/10',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    icon: 'bg-emerald-50',
    primaryButton: 'bg-emerald-600 hover:bg-emerald-700',
    dotActive: 'bg-emerald-600',
    dotInactive: 'bg-emerald-100',
  },
  vendor: {
    background: 'from-amber-100 via-white to-orange-50',
    glow: 'bg-amber-500/10',
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
    icon: 'bg-amber-50',
    primaryButton: 'bg-amber-600 hover:bg-amber-700',
    dotActive: 'bg-amber-600',
    dotInactive: 'bg-amber-100',
  },
  driver: {
    background: 'from-sky-100 via-white to-blue-50',
    glow: 'bg-sky-500/10',
    badge: 'bg-sky-50 text-sky-700 border-sky-200',
    icon: 'bg-sky-50',
    primaryButton: 'bg-sky-600 hover:bg-sky-700',
    dotActive: 'bg-sky-600',
    dotInactive: 'bg-sky-100',
  },
}

const clampStep = (step, length) => {
  if (!Number.isInteger(step)) {
    return 0
  }

  return Math.min(Math.max(step, 0), Math.max(length - 1, 0))
}

const OnboardingFlow = ({ role, roleLabel, slides, completeLabel, completePath }) => {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { user, profile, loading } = useAuthStore()
  const [currentStep, setCurrentStep] = useState(0)
  const [saving, setSaving] = useState(false)

  const theme = useMemo(() => THEMES[role] || THEMES.buyer, [role])
  const currentSlide = slides[currentStep]

  useEffect(() => {
    if (!user || !profile) {
      return
    }

    if (profile.role !== role) {
      navigate(getOnboardingPathForRole(profile.role), { replace: true })
      return
    }

    if (profile.onboarding_completed) {
      navigate(completePath, { replace: true })
      return
    }

    setCurrentStep(clampStep(profile.onboarding_step || 0, slides.length))
  }, [completePath, navigate, profile, role, slides.length, user])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  const moveToStep = async (nextStep) => {
    if (!user?.id) {
      return
    }

    setSaving(true)
    try {
      await updateOnboardingStep(user.id, nextStep)
      setCurrentStep(nextStep)
    } catch (error) {
      toast.error(error.message || t('onboarding.errors.saveFailed', 'تعذر حفظ تقدم التهيئة الآن'))
    } finally {
      setSaving(false)
    }
  }

  const handleComplete = async () => {
    if (!user?.id) {
      return
    }

    setSaving(true)
    try {
      await completeOnboarding(user.id)
      useAuthStore.setState((state) => ({
        ...state,
        profile: state.profile
          ? {
              ...state.profile,
              onboarding_completed: true,
              onboarding_step: 100,
            }
          : state.profile,
      }))

      navigate(completePath, { replace: true })
    } catch (error) {
      toast.error(error.message || t('onboarding.errors.completeFailed', 'تعذر إكمال التهيئة حالياً'))
    } finally {
      setSaving(false)
    }
  }

  const handleNext = async () => {
    if (currentStep === slides.length - 1) {
      await handleComplete()
      return
    }

    await moveToStep(currentStep + 1)
  }

  const handlePrevious = async () => {
    if (currentStep === 0) {
      return
    }

    await moveToStep(currentStep - 1)
  }

  return (
    <div data-testid={`onboarding-${role}`} className={`min-h-screen bg-gradient-to-br ${theme.background} px-4 py-8 sm:px-6 lg:px-8`}>
      <div className={`mx-auto max-w-4xl rounded-[2rem] ${theme.glow} blur-3xl h-28`} />

      <div className="relative mx-auto -mt-20 max-w-2xl">
        <div className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/95 shadow-[0_32px_80px_rgba(15,23,42,0.12)] backdrop-blur">
          <div className="px-6 py-8 sm:px-10 sm:py-12">
            <div className="flex justify-center">
              <span className={`inline-flex items-center rounded-full border px-4 py-1.5 text-sm font-semibold ${theme.badge}`}>
                {roleLabel}
              </span>
            </div>

            <div className={`mx-auto mt-6 flex h-24 w-24 items-center justify-center rounded-[2rem] text-5xl ${theme.icon}`}>
              <span aria-hidden="true">{currentSlide.icon}</span>
            </div>

            <div className="mt-8 text-center">
              <h1 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
                {currentSlide.title}
              </h1>

              {currentSlide.variant === 'list' ? (
                <div className="mx-auto mt-6 max-w-xl space-y-3 text-right text-lg leading-8 text-slate-600">
                  {currentSlide.lines.map((line) => (
                    <p key={line} className="rounded-2xl bg-slate-50 px-4 py-3">
                      {line}
                    </p>
                  ))}
                </div>
              ) : (
                <div className="mx-auto mt-6 max-w-xl space-y-3 text-lg leading-8 text-slate-600">
                  {currentSlide.lines.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
              )}

              {currentSlide.callout ? (
                <div className="mx-auto mt-6 max-w-xl rounded-3xl border border-slate-200 bg-slate-50 px-5 py-4 text-right">
                  {currentSlide.callout.map((line) => (
                    <p key={line} className="text-base leading-7 text-slate-700">
                      {line}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="mt-10 flex justify-center gap-2">
              {slides.map((slide, index) => (
                <span
                  key={`${slide.title}-${index}`}
                  className={`h-2.5 rounded-full transition-all ${
                    index === currentStep
                      ? `${theme.dotActive} w-8`
                      : `${theme.dotInactive} w-2.5`
                  }`}
                />
              ))}
            </div>

            <div className="mt-10 flex flex-col-reverse gap-3 sm:flex-row sm:justify-center">
              {currentStep > 0 ? (
                <button
                  type="button"
                  data-testid="onboarding-secondary-action"
                  onClick={handlePrevious}
                  disabled={saving}
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-200 px-5 py-3 text-base font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {t('onboarding.previousArrow', '← السابق')}
                </button>
              ) : null}

              <button
                type="button"
                data-testid="onboarding-primary-action"
                onClick={handleNext}
                disabled={saving}
                className={`inline-flex items-center justify-center rounded-2xl px-6 py-3 text-base font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${theme.primaryButton}`}
              >
                {saving
                  ? t('onboarding.saving', 'جارٍ الحفظ...')
                  : currentStep === slides.length - 1
                    ? completeLabel
                    : t('onboarding.nextArrow', 'التالي →')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default OnboardingFlow