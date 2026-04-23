/**
 * ⚡ Performance Monitoring & Optimization
 * Track and improve application performance metrics
 */

import { logger } from './logger.js'

// ============================================
// 1. PERFORMANCE METRICS TRACKING
// ============================================

class PerformanceMonitor {
  constructor() {
    this.metrics = new Map()
    this.observers = []
    this.initialized = false
  }

  /**
   * Initialize performance monitoring
   */
  initialize() {
    if (this.initialized) return

    // Track Core Web Vitals
    this.trackLCP() // Largest Contentful Paint
    this.trackFID() // First Input Delay
    this.trackCLS() // Cumulative Layout Shift
    this.trackFCP() // First Contentful Paint
    this.trackTTFB() // Time to First Byte

    this.initialized = true

    if (import.meta.env.DEV) {
      logger.log('⚡ Performance monitoring initialized')
    }
  }

  /**
   * Track Largest Contentful Paint
   */
  trackLCP() {
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries()
          const lastEntry = entries[entries.length - 1]
          this.setMetric('LCP', lastEntry.startTime)

          if (import.meta.env.DEV) {
            logger.log(`📊 LCP: ${lastEntry.startTime.toFixed(2)}ms`)
          }
        })

        observer.observe({ entryTypes: ['largest-contentful-paint'] })
        this.observers.push(observer)
      } catch (error) {
        logger.warn('LCP observer failed:', error)
      }
    }
  }

  /**
   * Track First Input Delay
   */
  trackFID() {
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            if (entry.interactionId) {
              this.setMetric('FID', entry.processingStart - entry.startTime)
            }
          })
        })

        observer.observe({ entryTypes: ['first-input', 'event'] })
        this.observers.push(observer)
      } catch (error) {
        logger.warn('FID observer failed:', error)
      }
    }
  }

  /**
   * Track Cumulative Layout Shift
   */
  trackCLS() {
    if ('PerformanceObserver' in window) {
      try {
        let clsValue = 0

        const observer = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            if (!entry.hadRecentInput) {
              clsValue += entry.value
              this.setMetric('CLS', clsValue)
            }
          })
        })

        observer.observe({ entryTypes: ['layout-shift'] })
        this.observers.push(observer)
      } catch (error) {
        logger.warn('CLS observer failed:', error)
      }
    }
  }

  /**
   * Track First Contentful Paint
   */
  trackFCP() {
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            if (entry.name === 'first-contentful-paint') {
              this.setMetric('FCP', entry.startTime)

              if (import.meta.env.DEV) {
                logger.log(`📊 FCP: ${entry.startTime.toFixed(2)}ms`)
              }
            }
          })
        })

        observer.observe({ entryTypes: ['paint'] })
        this.observers.push(observer)
      } catch (error) {
        logger.warn('FCP observer failed:', error)
      }
    }
  }

  /**
   * Track Time to First Byte
   */
  trackTTFB() {
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            if (entry.name === 'navigation') {
              const ttfb = entry.responseStart - entry.requestStart
              this.setMetric('TTFB', ttfb)

              if (import.meta.env.DEV) {
                logger.log(`📊 TTFB: ${ttfb.toFixed(2)}ms`)
              }
            }
          })
        })

        observer.observe({ entryTypes: ['navigation'] })
        this.observers.push(observer)
      } catch (error) {
        logger.warn('TTFB observer failed:', error)
      }
    }
  }

  /**
   * Set metric value
   */
  setMetric(name, value) {
    this.metrics.set(name, {
      value,
      timestamp: Date.now(),
      rating: this.getMetricRating(name, value),
    })
  }

  /**
   * Get metric rating
   */
  getMetricRating(name, value) {
    const thresholds = {
      LCP: { good: 2500, needsImprovement: 4000 },
      FID: { good: 100, needsImprovement: 300 },
      CLS: { good: 0.1, needsImprovement: 0.25 },
      FCP: { good: 1800, needsImprovement: 3000 },
      TTFB: { good: 800, needsImprovement: 1800 },
    }

    const threshold = thresholds[name]
    if (!threshold) return 'unknown'

    if (value <= threshold.good) return 'good'
    if (value <= threshold.needsImprovement) return 'needs-improvement'
    return 'poor'
  }

  /**
   * Get all metrics
   */
  getMetrics() {
    return Object.fromEntries(this.metrics)
  }

  /**
   * Get specific metric
   */
  getMetric(name) {
    return this.metrics.get(name)
  }

  /**
   * Get performance score (0-100)
   */
  getPerformanceScore() {
    const weights = {
      LCP: 0.25,
      FID: 0.25,
      CLS: 0.25,
      FCP: 0.15,
      TTFB: 0.10,
    }

    let score = 100
    let totalWeight = 0

    for (const [metric, weight] of Object.entries(weights)) {
      const metricData = this.metrics.get(metric)
      if (metricData) {
        const metricScore = this.getMetricScore(metric, metricData.value)
        score -= (100 - metricScore) * weight
        totalWeight += weight
      }
    }

    return totalWeight > 0 ? Math.round(score / totalWeight) : 0
  }

  /**
   * Get metric score (0-100)
   */
  getMetricScore(name, value) {
    const thresholds = {
      LCP: { good: 2500, poor: 4000 },
      FID: { good: 100, poor: 300 },
      CLS: { good: 0.1, poor: 0.25 },
      FCP: { good: 1800, poor: 3000 },
      TTFB: { good: 800, poor: 1800 },
    }

    const threshold = thresholds[name]
    if (!threshold) return 50

    if (value <= threshold.good) return 100
    if (value >= threshold.poor) return 0

    return Math.round(100 - ((value - threshold.good) / (threshold.poor - threshold.good)) * 100)
  }

  /**
   * Cleanup observers
   */
  cleanup() {
    this.observers.forEach((observer) => {
      try {
        observer.disconnect()
      } catch {
        // Ignore
      }
    })
    this.observers = []
  }
}

export const performanceMonitor = new PerformanceMonitor()

// ============================================
// 2. COMPONENT RENDER TRACKING
// ============================================

/**
 * Track component render count and duration
 */
export const useRenderTracker = (componentName) => {
  const renderCount = useRef(0)
  const renderTime = useRef(null)

  useEffect(() => {
    renderCount.current++
    renderTime.current = performance.now()
    const currentRenderCount = renderCount.current

    return () => {
      const duration = performance.now() - renderTime.current
      if (import.meta.env.DEV && currentRenderCount > 10) {
        logger.warn(
          `🔄 ${componentName} rendered ${currentRenderCount} times, last render: ${duration.toFixed(2)}ms`
        )
      }
    }
  })

  return {
    renderCount: renderCount.current,
    componentName,
  }
}

// ============================================
// 3. MEMORY USAGE TRACKING
// ============================================

/**
 * Track memory usage
 */
export const getMemoryUsage = () => {
  if (performance.memory) {
    return {
      used: Math.round(performance.memory.usedJSHeapSize / 1048576), // MB
      total: Math.round(performance.memory.totalJSHeapSize / 1048576), // MB
      limit: Math.round(performance.memory.jsHeapSizeLimit / 1048576), // MB
    }
  }
  return null
}

/**
 * Log memory warning if usage is high
 */
export const checkMemoryUsage = () => {
  const memory = getMemoryUsage()
  if (memory && memory.used > memory.limit * 0.8) {
    logger.warn(
      `⚠️ High memory usage: ${memory.used}MB / ${memory.limit}MB (${Math.round((memory.used / memory.limit) * 100)}%)`
    )
    return true
  }
  return false
}

// ============================================
// 4. BUNDLE SIZE ANALYSIS
// ============================================

/**
 * Get bundle size information
 */
export const getBundleSizeInfo = () => {
  if ('PerformanceObserver' in window) {
    try {
      const entries = performance.getEntriesByType('resource')
      const jsFiles = entries.filter((e) => e.name.endsWith('.js'))

      return {
        totalJS: jsFiles.reduce((sum, e) => sum + e.transferSize, 0),
        jsFileCount: jsFiles.length,
        avgLoadTime: jsFiles.reduce((sum, e) => sum + e.duration, 0) / jsFiles.length,
      }
    } catch (error) {
      logger.warn('Bundle size analysis failed:', error)
    }
  }
  return null
}

// ============================================
// 5. LAZY LOADING OPTIMIZATION
// ============================================

/**
 * Intersection Observer hook for lazy loading
 */
import { useState, useEffect, useRef, useCallback } from 'react'

export const useIntersectionObserver = (options = {}) => {
  const [isIntersecting, setIsIntersecting] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const observer = new IntersectionObserver(([entry]) => {
      setIsIntersecting(entry.isIntersecting)
    }, options)

    observer.observe(element)

    return () => {
      observer.disconnect()
    }
  }, [options])

  return [ref, isIntersecting]
}

// ============================================
// 6. DEBOUNCE & THROTTLE
// ============================================

/**
 * Debounce function
 */
export const debounce = (fn, delay = 300) => {
  let timeoutId

  return (...args) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(...args), delay)
  }
}

/**
 * Throttle function
 */
export const throttle = (fn, limit = 300) => {
  let inThrottle

  return (...args) => {
    if (!inThrottle) {
      fn(...args)
      inThrottle = true
      setTimeout(() => {
        inThrottle = false
      }, limit)
    }
  }
}

/**
 * Debounce hook
 */
export const useDebounce = (value, delay = 300) => {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(timer)
    }
  }, [value, delay])

  return debouncedValue
}

/**
 * Throttle hook
 */
export const useThrottle = (value, limit = 300) => {
  const [throttledValue, setThrottledValue] = useState(value)
  const lastRan = useRef(Date.now())

  useEffect(() => {
    const handler = setTimeout(() => {
      if (Date.now() - lastRan.current >= limit) {
        setThrottledValue(value)
        lastRan.current = Date.now()
      }
    }, limit - (Date.now() - lastRan.current))

    return () => {
      clearTimeout(handler)
    }
  }, [value, limit])

  return throttledValue
}

// ============================================
// 7. VIRTUAL SCROLLING
// ============================================

/**
 * useVirtualList - Virtual scrolling hook
 */
export const useVirtualList = (items, options = {}) => {
  const {
    containerHeight,
    itemHeight = 50,
    overscan = 5,
  } = options

  const [scrollTop, setScrollTop] = useState(0)
  const containerRef = useRef(null)

  const totalHeight = items.length * itemHeight
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
  const endIndex = Math.min(
    items.length,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
  )

  const visibleItems = items.slice(startIndex, endIndex)
  const offsetY = startIndex * itemHeight

  const handleScroll = useCallback((e) => {
    setScrollTop(e.target.scrollTop)
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  return {
    containerRef,
    visibleItems,
    totalHeight,
    offsetY,
  }
}

// ============================================
// 8. PERFORMANCE COMPONENTS
// ============================================

/**
 * VirtualList - Virtual scrolling component
 */
export const VirtualList = ({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  overscan = 5,
  className = '',
}) => {
  const { containerRef, visibleItems, totalHeight, offsetY } = useVirtualList(items, {
    containerHeight,
    itemHeight,
    overscan,
  })

  return (
    <div
      ref={containerRef}
      className={`overflow-auto ${className}`}
      style={{ height: containerHeight }}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map((item, index) => (
            <div
              key={item.id || index}
              style={{ height: itemHeight }}
            >
              {renderItem(item, index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ============================================
// 9. PERFORMANCE REPORT
// ============================================

/**
 * Generate performance report
 */
export const generatePerformanceReport = () => {
  const metrics = performanceMonitor.getMetrics()
  const score = performanceMonitor.getPerformanceScore()
  const memory = getMemoryUsage()
  const bundle = getBundleSizeInfo()

  return {
    score,
    metrics,
    memory,
    bundle,
    timestamp: new Date().toISOString(),
    recommendations: generateRecommendations(metrics, score),
  }
}

/**
 * Generate performance recommendations
 */
export const generateRecommendations = (metrics, score) => {
  const recommendations = []

  if (metrics.LCP && metrics.LCP.value > 2500) {
    recommendations.push({
      type: 'LCP',
      priority: 'high',
      message: 'Optimize Largest Contentful Paint by reducing image sizes and using preload',
    })
  }

  if (metrics.FID && metrics.FID.value > 100) {
    recommendations.push({
      type: 'FID',
      priority: 'high',
      message: 'Reduce First Input Delay by minimizing JavaScript execution time',
    })
  }

  if (metrics.CLS && metrics.CLS.value > 0.1) {
    recommendations.push({
      type: 'CLS',
      priority: 'medium',
      message: 'Reduce Cumulative Layout Shift by setting explicit dimensions for images and ads',
    })
  }

  if (score < 50) {
    recommendations.push({
      type: 'overall',
      priority: 'critical',
      message: 'Overall performance score is poor. Consider code splitting and lazy loading',
    })
  }

  return recommendations
}

// ============================================
// 10. PERFORMANCE INITIALIZER
// ============================================

/**
 * Initialize performance monitoring
 */
export const initializePerformance = () => {
  performanceMonitor.initialize()

  // Log performance report in dev
  if (import.meta.env.DEV) {
    setTimeout(() => {
      const report = generatePerformanceReport()
      logger.log('⚡ Performance Report:', report)
    }, 5000)
  }
}

// ============================================
// Default export
// ============================================
export default {
  performanceMonitor,
  useRenderTracker,
  getMemoryUsage,
  checkMemoryUsage,
  getBundleSizeInfo,
  useIntersectionObserver,
  debounce,
  throttle,
  useDebounce,
  useThrottle,
  useVirtualList,
  VirtualList,
  generatePerformanceReport,
  generateRecommendations,
  initializePerformance,
}
