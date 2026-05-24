import ReviewModalBase from '@/components/orders/ReviewModal'

export default function ReviewModal({ order, onClose, onSubmit }) {
  return (
    <ReviewModalBase
      order={order}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  )
}