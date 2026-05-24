import BuyerOrderCard from '@/components/orders/BuyerOrderCard'

export default function OrderCard({
  order,
  onReorder,
  onReview,
  onReturn,
  onViewDetails,
  onDownloadInvoice,
  isSelected,
  onSelect,
  cardDataCy,
  statusDataCy,
  t,
}) {
  return (
    <BuyerOrderCard
      order={order}
      onReorder={onReorder}
      onReview={onReview}
      onReturn={onReturn}
      onViewDetails={onViewDetails}
      onDownloadInvoice={onDownloadInvoice}
      isSelected={isSelected}
      onSelect={onSelect}
      cardDataCy={cardDataCy}
      statusDataCy={statusDataCy}
      t={t}
    />
  )
}