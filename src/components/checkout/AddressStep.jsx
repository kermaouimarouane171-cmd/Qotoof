import { HomeIcon, BuildingOfficeIcon, MapPinIcon, CheckIcon } from '@heroicons/react/24/outline'

const ADDRESS_TYPE_ICONS = {
  home: HomeIcon,
  work: BuildingOfficeIcon,
  other: MapPinIcon,
}

export default function AddressStep({ selectedAddress, savedAddresses = [], onAddressSelect, onNewAddress, userId, t }) {
  void userId

  return (
    <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50 p-4" data-testid="checkout-address-step">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">{t('checkout.addressStep.title', 'Address Selection')}</h3>

      {savedAddresses.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-gray-600 mb-2">{t('checkout.addressStep.saved', 'Saved addresses')}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {savedAddresses.map((address) => {
              const isSelected = selectedAddress === address.value
              const TypeIcon = ADDRESS_TYPE_ICONS[address.type] || MapPinIcon
              return (
                <button
                  key={address.id}
                  type="button"
                  onClick={() => onAddressSelect(address)}
                  className={`flex items-start gap-3 px-3 py-3 rounded-lg border text-left transition-colors ${isSelected ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'}`}
                  aria-pressed={isSelected}
                >
                  <TypeIcon className="w-5 h-5 flex-shrink-0 mt-0.5 text-gray-400" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{address.label}</span>
                      {address.is_default && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-primary-600 bg-primary-100 px-1.5 py-0.5 rounded-full">
                          <CheckIcon className="w-3 h-3" />
                          {t('checkout.addressStep.default', 'Default')}
                        </span>
                      )}
                    </div>
                    {address.city && (
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{address.city}</p>
                    )}
                  </div>
                  {isSelected && <CheckIcon className="w-4 h-4 flex-shrink-0 text-primary-600 mt-0.5" />}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div>
        <label htmlFor="checkout-new-address" className="text-xs font-medium text-gray-600">
          {t('checkout.addressStep.newAddress', 'New address')}
        </label>
        <textarea
          id="checkout-new-address"
          value={selectedAddress || ''}
          onChange={(event) => onNewAddress(event.target.value)}
          className="mt-2 input h-20 resize-none"
          placeholder={t('checkout.addressStep.placeholder', 'Street, building, apartment...')}
        />
      </div>
    </div>
  )
}