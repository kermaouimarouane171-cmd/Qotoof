// Simplified tests for UI components
import { render, screen, fireEvent } from '@testing-library/react'
import Badge from '../components/ui/Badge'
import Card from '../components/ui/Card'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import StarRating from '../components/ui/StarRating'
import Input from '../components/ui/Input'
import Modal from '../components/ui/Modal'

describe('Badge', () => {
  it('renders with text', () => {
    render(<Badge>New</Badge>)
    expect(screen.getByText('New')).toBeInTheDocument()
  })

  it('renders with different variants', () => {
    const { rerender } = render(<Badge variant="primary">Primary</Badge>)
    expect(screen.getByText('Primary')).toBeInTheDocument()
    
    rerender(<Badge variant="success">Success</Badge>)
    expect(screen.getByText('Success')).toBeInTheDocument()
    
    rerender(<Badge variant="warning">Warning</Badge>)
    expect(screen.getByText('Warning')).toBeInTheDocument()
  })
})

describe('Card', () => {
  it('renders children', () => {
    render(<Card>Content</Card>)
    expect(screen.getByText('Content')).toBeInTheDocument()
  })

  it('handles clicks', () => {
    const onClick = jest.fn()
    render(<Card onClick={onClick}>Clickable</Card>)
    fireEvent.click(screen.getByText('Clickable'))
    expect(onClick).toHaveBeenCalled()
  })
})

describe('LoadingSpinner', () => {
  it('renders without crashing', () => {
    const { container } = render(<LoadingSpinner />)
    expect(container.firstChild).toBeDefined()
  })
})

describe('StarRating', () => {
  it('renders without crashing', () => {
    const { container } = render(<StarRating rating={3} />)
    expect(container).toBeDefined()
  })
})

describe('Input', () => {
  it('renders correctly', () => {
    render(<Input placeholder="Enter text" />)
    expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument()
  })

  it('handles changes', () => {
    const onChange = jest.fn()
    render(<Input onChange={onChange} />)
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'test' } })
    expect(onChange).toHaveBeenCalled()
  })

  it('displays label', () => {
    render(<Input label="Username" />)
    expect(screen.getByText('Username')).toBeInTheDocument()
  })

  it('displays error', () => {
    render(<Input error="Required" />)
    expect(screen.getByText('Required')).toBeInTheDocument()
  })
})

describe('Modal', () => {
  it('renders when open', () => {
    render(
      <Modal isOpen={true} onClose={jest.fn()} title="Test">
        Content
      </Modal>
    )
    expect(screen.getByText('Test')).toBeInTheDocument()
    expect(screen.getByText('Content')).toBeInTheDocument()
  })

  it('does not render when closed', () => {
    render(
      <Modal isOpen={false} onClose={jest.fn()} title="Test">
        Content
      </Modal>
    )
    expect(screen.queryByText('Test')).not.toBeInTheDocument()
  })
})
