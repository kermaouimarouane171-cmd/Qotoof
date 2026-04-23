/**
 * 🖼️ Optimized Image Component with Lazy Loading
 * Provides performance optimizations for image loading
 */

import { useState, useEffect, useRef, useCallback } from 'react'

// ============================================
// 1. LAZY LOADING IMAGE COMPONENT
// ============================================

/**
 * OptimizedImage - Image component with lazy loading, placeholder, and error handling
 */
export const OptimizedImage = ({
  src,
  alt,
  className = '',
  placeholderClassName = '',
  errorClassName = '',
  placeholder = 'blur', // 'blur' | 'skeleton' | 'color' | 'none'
  placeholderColor = '#e5e7eb',
  fallbackSrc = null,
  onLoad = null,
  onError = null,
  priority = false, // Load immediately (above fold images)
  threshold = 0.1, // Intersection observer threshold
  rootMargin = '50px', // Start loading before visible
  objectFit = 'cover',
  ...props
}) => {
  const [isLoaded, setIsLoaded] = useState(false)
  const [isInView, setIsInView] = useState(priority) // If priority, load immediately
  const [hasError, setHasError] = useState(false)
  const [currentSrc, setCurrentSrc] = useState(src)
  const imgRef = useRef(null)

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (priority || isInView) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true)
          observer.disconnect()
        }
      },
      { threshold, rootMargin }
    )

    if (imgRef.current) {
      observer.observe(imgRef.current)
    }

    return () => observer.disconnect()
  }, [priority, threshold, rootMargin])

  // Handle image load
  const handleLoad = useCallback(() => {
    setIsLoaded(true)
    onLoad?.()
  }, [onLoad])

  // Handle image error
  const handleError = useCallback(() => {
    setHasError(true)
    setIsLoaded(false)

    // Try fallback if available
    if (fallbackSrc && currentSrc !== fallbackSrc) {
      setCurrentSrc(fallbackSrc)
      setHasError(false)
    } else {
      onError?.()
    }
  }, [fallbackSrc, currentSrc, onError])

  // Reset state when src changes
  useEffect(() => {
    setIsLoaded(false)
    setHasError(false)
    setCurrentSrc(src)
  }, [src])

  // Render placeholder
  const renderPlaceholder = () => {
    if (placeholder === 'none') return null

    if (placeholder === 'skeleton') {
      return (
        <div
          className={`animate-pulse bg-gray-200 ${placeholderClassName}`}
          style={{ backgroundColor: placeholderColor }}
        />
      )
    }

    if (placeholder === 'color') {
      return (
        <div
          className={placeholderClassName}
          style={{ backgroundColor: placeholderColor }}
        />
      )
    }

    // Default: blur placeholder
    return (
      <div
        className={`blur-sm bg-gray-200 ${placeholderClassName}`}
        style={{ backgroundColor: placeholderColor }}
      />
    )
  }

  // Render error state
  const renderError = () => {
    return (
      <div className={`flex items-center justify-center bg-gray-100 ${errorClassName}`}>
        <svg
          className="w-12 h-12 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </div>
    )
  }

  return (
    <div ref={imgRef} className={`relative overflow-hidden ${className}`}>
      {/* Placeholder or Error */}
      {!isLoaded && !hasError && renderPlaceholder()}
      {hasError && renderError()}

      {/* Actual Image */}
      {isInView && (
        <img
          src={currentSrc}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          onLoad={handleLoad}
          onError={handleError}
          className={`w-full h-full object-${objectFit} transition-opacity duration-300 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          {...props}
        />
      )}
    </div>
  )
}

// ============================================
// 2. IMAGE GALLERY WITH LAZY LOADING
// ============================================

/**
 * ImageGallery - Grid of images with lazy loading
 */
export const ImageGallery = ({
  images,
  className = '',
  itemClassName = '',
  columns = { default: 1, sm: 2, md: 3, lg: 4 },
  gap = 'gap-4',
  ...props
}) => {
  const columnClasses = Object.entries(columns)
    .map(([breakpoint, count]) => {
      const prefix = breakpoint === 'default' ? '' : `${breakpoint}:`
      return `${prefix}grid-cols-${count}`
    })
    .join(' ')

  return (
    <div className={`grid ${columnClasses} ${gap} ${className}`}>
      {images.map((image, index) => (
        <OptimizedImage
          key={image.id || index}
          src={image.src || image.url}
          alt={image.alt || image.name || `Image ${index + 1}`}
          className={itemClassName}
          priority={index < 4} // First 4 images load immediately
          {...props}
        />
      ))}
    </div>
  )
}

// ============================================
// 3. RESPONSIVE IMAGE COMPONENT
// ============================================

/**
 * ResponsiveImage - Serves different sizes based on viewport
 */
export const ResponsiveImage = ({
  src,
  alt,
  sizes,
  className = '',
  aspectRatio = null, // '16/9', '4/3', '1/1', etc.
  ...props
}) => {
  const style = aspectRatio ? { aspectRatio } : {}

  return (
    <picture>
      <source
        media="(max-width: 640px)"
        srcSet={`${src}?w=480&q=75`}
        type="image/webp"
      />
      <source
        media="(max-width: 1024px)"
        srcSet={`${src}?w=768&q=80`}
        type="image/webp"
      />
      <source
        media="(min-width: 1025px)"
        srcSet={`${src}?w=1200&q=85`}
        type="image/webp"
      />
      <img
        src={src}
        alt={alt}
        className={className}
        style={style}
        loading="lazy"
        {...props}
      />
    </picture>
  )
}

// ============================================
// 4. IMAGE PRELOAD UTILITY
// ============================================

/**
 * Preload critical images
 */
export const preloadImage = (src) => {
  if (!src) return

  const link = document.createElement('link')
  link.rel = 'preload'
  link.as = 'image'
  link.href = src
  document.head.appendChild(link)
}

/**
 * Preload multiple images
 */
export const preloadImages = (sources) => {
  sources.forEach(src => preloadImage(src))
}

// ============================================
// 5. LAZY LOADING HOOK
// ============================================

/**
 * useLazyImage - Hook for lazy loading images
 */
export const useLazyImage = (src, options = {}) => {
  const { threshold = 0.1, rootMargin = '50px', priority = false } = options

  const [isLoaded, setIsLoaded] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [isInView, setIsInView] = useState(priority)
  const ref = useRef(null)

  useEffect(() => {
    if (priority || isInView) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true)
          observer.disconnect()
        }
      },
      { threshold, rootMargin }
    )

    if (ref.current) {
      observer.observe(ref.current)
    }

    return () => observer.disconnect()
  }, [priority, isInView, threshold, rootMargin])

  const handleLoad = useCallback(() => setIsLoaded(true), [])
  const handleError = useCallback(() => setHasError(true), [])

  return {
    ref,
    src: isInView ? src : undefined,
    isLoaded,
    hasError,
    handleLoad,
    handleError,
  }
}

// ============================================
// 6. IMAGE CACHE MANAGER
// ============================================

class ImageCache {
  constructor(maxSize = 100) {
    this.cache = new Map()
    this.maxSize = maxSize
  }

  /**
   * Check if image is cached
   */
  has(src) {
    return this.cache.has(src)
  }

  /**
   * Add image to cache
   */
  set(src, img) {
    // Remove oldest if cache is full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value
      this.cache.delete(firstKey)
    }

    this.cache.set(src, img)
  }

  /**
   * Get image from cache
   */
  get(src) {
    const img = this.cache.get(src)

    // Move to end (most recently used)
    if (img) {
      this.cache.delete(src)
      this.cache.set(src, img)
    }

    return img
  }

  /**
   * Clear cache
   */
  clear() {
    this.cache.clear()
  }

  /**
   * Get cache size
   */
  size() {
    return this.cache.size
  }
}

export const imageCache = new ImageCache()

// ============================================
// Default export
// ============================================
export default {
  OptimizedImage,
  ImageGallery,
  ResponsiveImage,
  preloadImage,
  preloadImages,
  useLazyImage,
  imageCache,
}
