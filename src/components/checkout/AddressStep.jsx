export default function AddressStep({ selectedAddress, savedAddresses = [], onAddressSelect, onNewAddress, userId, t }) {
  void userId

  return (
    <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50 p-4" data-testid="checkout-address-step">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">{t('checkout.addressStep.title', 'Address Selection')}</h3>

      {savedAddresses.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-medium text-gray-600 mb-2">{t('checkout.addressStep.saved', 'Saved addresses')}</p>
          <div className="flex flex-wrap gap-2">
            {savedAddresses.map((address) => (
              <button
                key={address.id}
                type="button"
                onClick={() => onAddressSelect(address)}
                className={`px-3 py-2 rounded-lg border text-sm transition-colors ${selectedAddress === address.value ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'}`}
              >
                {address.label}
              </button>
            ))}
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