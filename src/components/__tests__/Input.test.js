import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Input from '../ui/Input'

describe('Input component', () => {
  it('renders label and input', () => {
    render(<Input label="Email" placeholder="name@example.com" />)

    expect(screen.getByText('Email')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('name@example.com')).toBeInTheDocument()
  })

  it('shows error message when error prop is provided', () => {
    render(<Input label="Phone" error="Phone is required" />)

    expect(screen.getByText('Phone is required')).toBeInTheDocument()
  })

  it('calls onChange handler correctly', async () => {
    const user = userEvent.setup()
    const onChange = jest.fn()

    render(<Input label="Name" onChange={onChange} />)
    const input = screen.getByRole('textbox')

    await user.type(input, 'Ali')

    expect(onChange).toHaveBeenCalled()
    expect(input).toHaveValue('Ali')
  })

  it('is disabled when disabled prop is true', () => {
    render(<Input disabled placeholder="Disabled input" />)
    expect(screen.getByPlaceholderText('Disabled input')).toBeDisabled()
  })

  it('shows required indicator behavior when required is true', () => {
    render(<Input label="Company" required placeholder="Company name" />)

    const input = screen.getByPlaceholderText('Company name')
    expect(input).toBeRequired()

    // Suggestion: add data-testid="required-indicator" in the component
    // if you want to assert a visible asterisk independently from HTML required attribute.
  })

  it('handles RTL (Arabic) text direction', async () => {
    const user = userEvent.setup()

    render(<Input dir="rtl" placeholder="الاسم" />)
    const input = screen.getByPlaceholderText('الاسم')

    await user.type(input, 'محمد')

    expect(input).toHaveAttribute('dir', 'rtl')
    expect(input).toHaveValue('محمد')
  })
})
