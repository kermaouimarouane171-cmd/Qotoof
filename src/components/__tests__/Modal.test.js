import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Modal from '../ui/Modal'

describe('Modal component', () => {
  it('shows when isOpen is true', () => {
    render(
      <Modal isOpen={true} onClose={jest.fn()} title="Checkout">
        <p>Confirm order</p>
      </Modal>
    )

    expect(screen.getByText('Checkout')).toBeInTheDocument()
    expect(screen.getByText('Confirm order')).toBeInTheDocument()
  })

  it('hides when isOpen is false', () => {
    render(
      <Modal isOpen={false} onClose={jest.fn()} title="Checkout">
        <p>Confirm order</p>
      </Modal>
    )

    expect(screen.queryByText('Checkout')).not.toBeInTheDocument()
    expect(screen.queryByText('Confirm order')).not.toBeInTheDocument()
  })

  it('calls onClose when backdrop is clicked', async () => {
    const user = userEvent.setup()
    const onClose = jest.fn()
    render(
      <Modal isOpen={true} onClose={onClose} title="Checkout">
        <p>Confirm order</p>
      </Modal>
    )

    // Suggestion: add data-testid="modal-backdrop" to make this selector stable.
    const backdrop = document.querySelector('div[class*="bg-black/50"]')
    expect(backdrop).toBeInTheDocument()

    await user.click(backdrop)

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled()
    })
  })

  it('calls onClose when Escape key is pressed', async () => {
    const onClose = jest.fn()
    render(
      <Modal isOpen={true} onClose={onClose} title="Checkout">
        <p>Confirm order</p>
      </Modal>
    )

    fireEvent.keyDown(document, { key: 'Escape' })

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled()
    })
  })

  it('renders children correctly', () => {
    render(
      <Modal isOpen={true} onClose={jest.fn()} title="Details">
        <div>
          <p>Child line 1</p>
          <p>Child line 2</p>
        </div>
      </Modal>
    )

    expect(screen.getByText('Child line 1')).toBeInTheDocument()
    expect(screen.getByText('Child line 2')).toBeInTheDocument()
  })

  it('traps focus inside modal', async () => {
    const user = userEvent.setup()

    render(
      <div>
        <button data-testid="outside-button" type="button">Outside</button>
        <Modal isOpen={true} onClose={jest.fn()} title="Focus Trap">
          <input placeholder="inside-input" />
          <button type="button">Inside Action</button>
        </Modal>
      </div>
    )

    const outside = screen.getByTestId('outside-button')
    const dialog = screen.getByRole('dialog')

    outside.focus()
    expect(outside).toHaveFocus()

    await user.tab()

    await waitFor(() => {
      expect(dialog.contains(document.activeElement)).toBe(true)
    })

    expect(outside).not.toHaveFocus()
  })
})
