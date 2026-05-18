import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import ErrorBoundary, {
  ErrorFallback,
  withErrorBoundary,
} from '@/components/ErrorBoundary'
import i18n from '@/i18n'
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
    expect(screen.queryByText(i18n.t('errorBoundary.title', 'Something went wrong'))).not.toBeInTheDocument()
  })

  it('renders the fallback details for non-chunk errors', () => {
    render(
      <ErrorFallback
        error={new Error('Test error')}
        resetErrorBoundary={jest.fn()}
      />
    )

    expect(screen.getByText(i18n.t('errorBoundary.title', 'Something went wrong'))).toBeInTheDocument()
    expect(screen.getByText(i18n.t('errorBoundary.description', 'An unexpected application error occurred.'))).toBeInTheDocument()
    expect(screen.getAllByText(new RegExp(i18n.t('errorBoundary.errorLabel', 'Error:'), 'i')).length).toBeGreaterThan(0)
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

    expect(screen.getByText(i18n.t('errorBoundary.chunkReloading', 'The app is trying to refresh automatically. If the problem persists, reload the page manually.'))).toBeInTheDocument()
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

    fireEvent.click(screen.getByRole('button', { name: i18n.t('errorBoundary.tryAgain', 'Try Again') }))

    expect(resetErrorBoundary).toHaveBeenCalledTimes(1)
  })

  it('wraps components with the exported HOC', () => {
    const PlainComponent = ({ label }) => <div>{label}</div>
    const WrappedComponent = withErrorBoundary(PlainComponent)

    render(<WrappedComponent label="Wrapped content" />)

    expect(screen.getByText('Wrapped content')).toBeInTheDocument()
  })
})
