import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Button from '../ui/Button'

describe('Button component', () => {
  it('renders with text content', () => {
    render(<Button>Place Order</Button>)
    expect(screen.getByRole('button', { name: /place order/i })).toBeInTheDocument()
  })

  it('handles onClick event', async () => {
    const user = userEvent.setup()
    const onClick = jest.fn()

    render(<Button onClick={onClick}>Click</Button>)
    await user.click(screen.getByRole('button', { name: /click/i }))

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('is disabled when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>)
    expect(screen.getByRole('button', { name: /disabled/i })).toBeDisabled()
  })

  it('shows loading spinner/state when isLoading is true', () => {
    const { container } = render(<Button isLoading>Saving</Button>)

    const button = screen.getByRole('button', { name: /saving/i })
    const spinner = container.querySelector('svg.animate-spin')

    expect(button).toBeDisabled()
    expect(button).toHaveClass('opacity-70')
    expect(spinner).toBeInTheDocument()
  })

  it('applies correct variant styles (primary, secondary, danger, ghost)', () => {
    const { rerender } = render(<Button variant="primary">Primary</Button>)
    expect(screen.getByRole('button')).toHaveClass('btn-primary')

    rerender(<Button variant="secondary">Secondary</Button>)
    expect(screen.getByRole('button')).toHaveClass('btn-secondary')

    rerender(<Button variant="danger">Danger</Button>)
    expect(screen.getByRole('button')).toHaveClass('btn-danger')

    rerender(<Button variant="ghost">Ghost</Button>)
    expect(screen.getByRole('button')).toHaveClass('btn-ghost')
  })

  it('applies correct size styles (sm, md, lg)', () => {
    const { rerender } = render(<Button size="sm">Small</Button>)
    expect(screen.getByRole('button')).toHaveClass('btn-sm')

    rerender(<Button size="md">Medium</Button>)
    expect(screen.getByRole('button')).not.toHaveClass('btn-sm')
    expect(screen.getByRole('button')).not.toHaveClass('btn-lg')

    rerender(<Button size="lg">Large</Button>)
    expect(screen.getByRole('button')).toHaveClass('btn-lg')
  })

  it('is accessible (has proper role and aria attributes)', () => {
    render(
      <Button aria-label="Submit checkout" aria-describedby="checkout-help">
        Submit
      </Button>
    )

    const button = screen.getByRole('button', { name: /submit checkout/i })
    expect(button).toBeInTheDocument()
    expect(button).toHaveAttribute('aria-describedby', 'checkout-help')

    button.focus()
    expect(button).toHaveFocus()
  })
})
