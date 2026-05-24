import { LoadingSpinner, DriverSelection } from '@/components/ui'

export default function DriverSelectionStep({ availableDrivers, selectedDriver, onDriverSelect, loading, t }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8" data-testid="checkout-driver-selection-loading">
        <LoadingSpinner size="md" />
        <p className="text-sm text-gray-600 ml-3">{t('checkout.driverSelection.loading', 'Finding available drivers...')}</p>
      </div>
    )
  }

  if (!availableDrivers || availableDrivers.length === 0) {
    return (
      <div className="p-4 rounded-xl border border-amber-200 bg-amber-50" data-testid="checkout-driver-selection-empty">
        <p className="text-sm font-medium text-amber-900">{t('checkout.driverSelection.emptyTitle', 'No available drivers now')}</p>
        <p className="text-xs text-amber-700 mt-1 leading-6">
          {t('checkout.driverSelection.emptyDescription', 'You can continue and drivers will be matched when available.')}
        </p>
      </div>
    )
  }

  return (
    <DriverSelection
      drivers={availableDrivers}
      selectedDriver={selectedDriver}
      onChange={onDriverSelect}
    />
  )
}