import { useState, useEffect, useCallback } from 'react'
import { Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon, ArrowRightIcon, ArrowLeftIcon } from '@heroicons/react/24/outline'
import { useTranslation } from 'react-i18next'

const STORAGE_KEY = 'negotiation-onboarding-seen'

const slides = [
  {
    illustration: 'negotiate',
    titleKey: 'onboarding.negotiation.slide1Title',
    descKey: 'onboarding.negotiation.slide1Desc',
    titleFallback: 'Negotiate Prices',
    descFallback: 'Found a product you like but want a better price? Click "Negotiate Price" on any product in your favorites to start a negotiation with the vendor.',
  },
  {
    illustration: 'offer',
    titleKey: 'onboarding.negotiation.slide2Title',
    descKey: 'onboarding.negotiation.slide2Desc',
    titleFallback: 'Send Your Offer',
    descFallback: 'Propose your price and quantity. The vendor can accept, reject, or send a counter-offer. You can negotiate up to 3 rounds.',
  },
  {
    illustration: 'locked',
    titleKey: 'onboarding.negotiation.slide3Title',
    descKey: 'onboarding.negotiation.slide3Desc',
    titleFallback: 'Locked-In Price',
    descFallback: 'When your offer is accepted, the item is added to your cart with the agreed price locked in. The price won\'t change even if the vendor updates their listing.',
  },
  {
    illustration: 'checkout',
    titleKey: 'onboarding.negotiation.slide4Title',
    descKey: 'onboarding.negotiation.slide4Desc',
    titleFallback: 'Unified Checkout',
    descFallback: 'Checkout with all your items in one place — negotiated and regular items together. Pay once for everything in your cart.',
  },
]

function SlideIllustration({ type }) {

  if (type === 'negotiate') {
    return (
      <svg viewBox="0 0 200 140" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="20" y="30" width="160" height="90" rx="12" fill="#f0fdf4" stroke="#bbf7d0" strokeWidth="2" />
        <rect x="40" y="50" width="50" height="50" rx="8" fill="#dcfce7" />
        <text x="65" y="80" textAnchor="middle" fontSize="20" fill="#16a34a">🛒</text>
        <rect x="110" y="50" width="50" height="50" rx="8" fill="#dcfce7" />
        <text x="135" y="80" textAnchor="middle" fontSize="20" fill="#16a34a">💬</text>
        <path d="M90 75 L110 75" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" markerEnd="url(#arrowhead)" />
        <defs>
          <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
            <polygon points="0 0, 6 3, 0 6" fill="#22c55e" />
          </marker>
        </defs>
      </svg>
    )
  }

  if (type === 'offer') {
    return (
      <svg viewBox="0 0 200 140" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="30" y="25" width="140" height="95" rx="12" fill="#f0fdf4" stroke="#bbf7d0" strokeWidth="2" />
        <circle cx="100" cy="55" r="18" fill="#dcfce7" />
        <text x="100" y="62" textAnchor="middle" fontSize="16" fill="#16a34a" fontWeight="bold">%</text>
        <rect x="50" y="85" width="100" height="8" rx="4" fill="#bbf7d0" />
        <rect x="50" y="100" width="70" height="8" rx="4" fill="#bbf7d0" />
        <rect x="60" y="115" width="80" height="14" rx="7" fill="#22c55e" />
        <text x="100" y="126" textAnchor="middle" fontSize="9" fill="white" fontWeight="bold">SEND</text>
      </svg>
    )
  }

  if (type === 'locked') {
    return (
      <svg viewBox="0 0 200 140" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="25" y="35" width="150" height="80" rx="12" fill="#f0fdf4" stroke="#bbf7d0" strokeWidth="2" />
        <rect x="45" y="55" width="60" height="40" rx="6" fill="#dcfce7" />
        <text x="75" y="80" textAnchor="middle" fontSize="18" fill="#16a34a">📦</text>
        <g transform="translate(125, 60)">
          <rect x="0" y="10" width="28" height="22" rx="4" fill="#22c55e" />
          <path d="M5 10 V6 a9 9 0 0 1 18 0 V10" stroke="#22c55e" strokeWidth="3" fill="none" />
          <circle cx="14" cy="21" r="3" fill="white" />
        </g>
        <text x="100" y="110" textAnchor="middle" fontSize="10" fill="#15803d" fontWeight="bold">✓ Agreed Price</text>
      </svg>
    )
  }

  // checkout
  return (
    <svg viewBox="0 0 200 140" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="20" y="20" width="160" height="100" rx="12" fill="#f0fdf4" stroke="#bbf7d0" strokeWidth="2" />
      <rect x="35" y="35" width="130" height="10" rx="5" fill="#bbf7d0" />
      <rect x="35" y="52" width="90" height="8" rx="4" fill="#dcfce7" />
      <rect x="35" y="65" width="90" height="8" rx="4" fill="#dcfce7" />
      <rect x="35" y="85" width="130" height="20" rx="10" fill="#22c55e" />
      <text x="100" y="99" textAnchor="middle" fontSize="10" fill="white" fontWeight="bold">Checkout</text>
    </svg>
  )
}

export function hasSeenOnboarding() {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

export function resetOnboarding() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

export default function NegotiationOnboarding({ isOpen, onClose, onSkip }) {
  const { t } = useTranslation()
  const [currentSlide, setCurrentSlide] = useState(0)

  const handleClose = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, 'true')
    } catch {
      // ignore
    }
    onClose?.()
  }, [onClose])

  const handleSkip = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, 'true')
    } catch {
      // ignore
    }
    onSkip?.()
  }, [onSkip])

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1)
    } else {
      handleClose()
    }
  }

  const handlePrev = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1)
    }
  }

  useEffect(() => {
    if (isOpen) {
      setCurrentSlide(0)
    }
  }, [isOpen])

  const slide = slides[currentSlide]

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleSkip}>
        {/* Backdrop */}
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity" />
        </Transition.Child>

        {/* Modal */}
        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="relative transform overflow-hidden rounded-2xl bg-white shadow-2xl transition-all w-full max-w-md">
                {/* Close button */}
                <button
                  type="button"
                  onClick={handleSkip}
                  className="absolute top-4 right-4 z-10 text-gray-400 hover:text-gray-500 transition-colors p-1 rounded-lg hover:bg-gray-100"
                  aria-label={t('common.close', 'Close')}
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>

                {/* Illustration */}
                <div className="px-8 pt-8 pb-2">
                  <div className="aspect-[200/140] w-full max-w-[280px] mx-auto">
                    <SlideIllustration type={slide.illustration} />
                  </div>
                </div>

                {/* Content */}
                <div className="px-8 pb-6 text-center">
                  <h2 className="text-xl font-bold text-gray-900 mb-2">
                    {t(slide.titleKey, slide.titleFallback)}
                  </h2>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {t(slide.descKey, slide.descFallback)}
                  </p>
                </div>

                {/* Progress dots */}
                <div className="flex items-center justify-center gap-2 pb-4">
                  {slides.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentSlide(idx)}
                      className={`h-2 rounded-full transition-all ${
                        idx === currentSlide
                          ? 'w-6 bg-primary-600'
                          : 'w-2 bg-gray-300 hover:bg-gray-400'
                      }`}
                      aria-label={`Slide ${idx + 1}`}
                    />
                  ))}
                </div>

                {/* Buttons */}
                <div className="flex items-center justify-between px-8 pb-8 pt-2">
                  {/* Previous */}
                  {currentSlide > 0 ? (
                    <button
                      onClick={handlePrev}
                      className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      <ArrowLeftIcon className="w-4 h-4" />
                      {t('common.previous', 'Previous')}
                    </button>
                  ) : (
                    <button
                      onClick={handleSkip}
                      className="text-sm font-medium text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {t('onboarding.skip', 'Skip')}
                    </button>
                  )}

                  {/* Next / Finish */}
                  <button
                    onClick={handleNext}
                    className="inline-flex items-center gap-1 px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold transition-colors"
                  >
                    {currentSlide === slides.length - 1
                      ? t('onboarding.gotIt', 'Got it!')
                      : t('onboarding.next', 'Next')}
                    {currentSlide < slides.length - 1 && <ArrowRightIcon className="w-4 h-4" />}
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  )
}
