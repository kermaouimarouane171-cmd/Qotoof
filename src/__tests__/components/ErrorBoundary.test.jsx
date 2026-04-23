import React, { Component } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

// Simulated ErrorBoundary component (isolated, no real imports)
class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo })
    console.error('ErrorBoundary caught:', error)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div data-testid="error-fallback">
          <h1>Something went wrong</h1>
          <p>{this.state.error?.message || 'An error occurred'}</p>
          <button onClick={this.handleReset} data-testid="reset-btn">Try Again</button>
        </div>
      )
    }
    return this.props.children
  }
}

// Child component that throws
const ThrowError = ({ shouldThrow }) => {
  if (shouldThrow) {
    throw new Error('Test error')
  }
  return <div data-testid="child">Child Content</div>
}

describe('ErrorBoundary Component', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    console.error.mockRestore()
  })

  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <div data-testid="child">Hello</div>
      </ErrorBoundary>
    )
    expect(screen.getByTestId('child')).toBeInTheDocument()
    expect(screen.queryByTestId('error-fallback')).not.toBeInTheDocument()
  })

  it('shows fallback UI when child throws an error', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )
    expect(screen.getByTestId('error-fallback')).toBeInTheDocument()
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })

  it('displays the error message in the fallback', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )
    expect(screen.getByText('Test error')).toBeInTheDocument()
  })

  it('resets state and re-renders children when reset button is clicked', () => {
    // Use a toggleable error child
    let shouldThrow = true
    const ToggleError = () => {
      if (shouldThrow) throw new Error('Test error')
      return <div data-testid="child">Child Content</div>
    }

    render(
      <ErrorBoundary>
        <ToggleError />
      </ErrorBoundary>
    )
    expect(screen.getByTestId('error-fallback')).toBeInTheDocument()

    // Toggle error off before reset
    shouldThrow = false
    fireEvent.click(screen.getByTestId('reset-btn'))
    expect(screen.queryByTestId('error-fallback')).not.toBeInTheDocument()
    expect(screen.getByTestId('child')).toBeInTheDocument()
  })

  it('calls componentDidCatch with error and errorInfo when error occurs', () => {
    const componentDidCatchSpy = jest.spyOn(ErrorBoundary.prototype, 'componentDidCatch')

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )

    expect(componentDidCatchSpy).toHaveBeenCalled()
    const callArgs = componentDidCatchSpy.mock.calls[0]
    expect(callArgs[0]).toBeInstanceOf(Error)
    expect(callArgs[0].message).toBe('Test error')

    componentDidCatchSpy.mockRestore()
  })
})
