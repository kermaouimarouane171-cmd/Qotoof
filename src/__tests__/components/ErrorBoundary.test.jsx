import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import ErrorBoundary, {
  ErrorFallback,
  withErrorBoundary,
} from '@/components/ErrorBoundary'
import { logger } from '@/utils/logger'

jest.mock('@/utils/logger', () => ({
  logger: {
    error: jest.fn(),
  },
}))

const CHUNK_RELOAD_STORAGE_KEY = 'qotoof_chunk_reload_attempted'

describe('ErrorBoundary Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    sessionStorage.clear()
  })

  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <div data-testid="child">Hello</div>
      </ErrorBoundary>
    )

    expect(screen.getByTestId('child')).toBeInTheDocument()
    expect(screen.queryByText('حدث خطأ ما')).not.toBeInTheDocument()
  })

  it('renders the fallback details for non-chunk errors', () => {
    render(
      <ErrorFallback
        error={new Error('Test error')}
        resetErrorBoundary={jest.fn()}
      />
    )

    expect(screen.getByText('حدث خطأ ما')).toBeInTheDocument()
    expect(screen.getByText('عذراً، حدث خطأ غير متوقع في التطبيق.')).toBeInTheDocument()
    expect(screen.getByText(/الخطأ:/)).toBeInTheDocument()
    expect(screen.getAllByText(/Test error/)).toHaveLength(2)
    expect(logger.error).toHaveBeenCalledWith('Error caught by ErrorBoundary:', expect.any(Error))
  })

  it('renders the chunk-specific message when the error looks like a chunk load failure', () => {
    sessionStorage.setItem(CHUNK_RELOAD_STORAGE_KEY, '1')

    render(
      <ErrorFallback
        error={new Error('ChunkLoadError: Loading chunk 12 failed')}
        resetErrorBoundary={jest.fn()}
      />
    )

    expect(screen.getByText('جاري محاولة تحديث التطبيق تلقائياً. إذا استمرت المشكلة، أعد تحميل الصفحة يدوياً.')).toBeInTheDocument()
  })

  it('clears the chunk reload marker after a repeated chunk load failure', async () => {
    sessionStorage.setItem(CHUNK_RELOAD_STORAGE_KEY, '1')

    render(
      <ErrorFallback
        error={new Error('ChunkLoadError: Loading chunk 12 failed')}
        resetErrorBoundary={jest.fn()}
      />
    )

    await waitFor(() => {
      expect(sessionStorage.getItem(CHUNK_RELOAD_STORAGE_KEY)).toBeNull()
    })
  })

  it('calls resetErrorBoundary when the retry button is clicked', () => {
    const resetErrorBoundary = jest.fn()

    render(
      <ErrorFallback
        error={new Error('Test error')}
        resetErrorBoundary={resetErrorBoundary}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'حاول مرة أخرى' }))

    expect(resetErrorBoundary).toHaveBeenCalledTimes(1)
  })

  it('wraps components with the exported HOC', () => {
    const PlainComponent = ({ label }) => <div>{label}</div>
    const WrappedComponent = withErrorBoundary(PlainComponent)

    render(<WrappedComponent label="Wrapped content" />)

    expect(screen.getByText('Wrapped content')).toBeInTheDocument()
  })
})
