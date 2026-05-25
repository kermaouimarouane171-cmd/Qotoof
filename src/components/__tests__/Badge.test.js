import { render, screen } from '@testing-library/react'
import Badge from '../ui/Badge'

describe('Badge/Status component', () => {
  const statusMap = {
    pending: { variant: 'warning', arabic: 'قيد الانتظار', expectedClass: 'badge-warning' },
    confirmed: { variant: 'primary', arabic: 'مؤكد', expectedClass: 'badge-primary' },
    delivered: { variant: 'success', arabic: 'تم التسليم', expectedClass: 'badge-green' },
    cancelled: { variant: 'danger', arabic: 'ملغي', expectedClass: 'badge-danger' },
  }

  it('renders correct color for each status (pending, confirmed, delivered, cancelled)', () => {
    const statuses = Object.keys(statusMap)

    statuses.forEach((status) => {
      const cfg = statusMap[status]
      const { unmount } = render(<Badge variant={cfg.variant}>{status}</Badge>)

      const badge = screen.getByText(status)
      expect(badge).toHaveClass(cfg.expectedClass)

      unmount()
    })
  })

  it('renders Arabic status text correctly', () => {
    const statuses = Object.keys(statusMap)

    statuses.forEach((status) => {
      const cfg = statusMap[status]
      const { unmount } = render(<Badge variant={cfg.variant}>{cfg.arabic}</Badge>)

      expect(screen.getByText(cfg.arabic)).toBeInTheDocument()

      unmount()
    })
  })
})
