import { useTranslation } from 'react-i18next'
import { Card } from '@/components/ui'
import { TruckIcon, ClockIcon, ArrowPathIcon } from '@heroicons/react/24/outline'

const Shipping = () => {
  const { t } = useTranslation()
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">{t('shipping.title', 'Shipping & Delivery')}</h1>

      <div className="space-y-8">
        {/* How it works */}
        <Card className="p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">{t('shipping.howItWorks.title', 'How Delivery Works')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <TruckIcon className="w-7 h-7 text-green-600" />
              </div>
              <h3 className="font-semibold mb-2">{t('shipping.howItWorks.step1.title', '1. Order Placed')}</h3>
              <p className="text-sm text-gray-500">{t('shipping.howItWorks.step1.desc', 'Vendor confirms and prepares your order')}</p>
            </div>
            <div className="text-center">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <ClockIcon className="w-7 h-7 text-green-600" />
              </div>
              <h3 className="font-semibold mb-2">{t('shipping.howItWorks.step2.title', '2. Driver Assigned')}</h3>
              <p className="text-sm text-gray-500">{t('shipping.howItWorks.step2.desc', 'A nearby driver picks up your delivery')}</p>
            </div>
            <div className="text-center">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <ArrowPathIcon className="w-7 h-7 text-green-600" />
              </div>
              <h3 className="font-semibold mb-2">{t('shipping.howItWorks.step3.title', '3. Delivered')}</h3>
              <p className="text-sm text-gray-500">{t('shipping.howItWorks.step3.desc', 'Order delivered to your doorstep')}</p>
            </div>
          </div>
        </Card>

        {/* Delivery Times */}
        <Card className="p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">{t('shipping.deliveryTimes.title', 'Delivery Times')}</h2>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('shipping.deliveryTimes.location', 'Location')}</th>
                  <th>{t('shipping.deliveryTimes.estimatedTime', 'Estimated Time')}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{t('shipping.deliveryTimes.sameCity', 'Same City')}</td>
                  <td>{t('shipping.deliveryTimes.sameCityTime', '2-4 hours')}</td>
                </tr>
                <tr>
                  <td>{t('shipping.deliveryTimes.nearbyCities', 'Nearby Cities')}</td>
                  <td>{t('shipping.deliveryTimes.nearbyCitiesTime', 'Same day')}</td>
                </tr>
                <tr>
                  <td>{t('shipping.deliveryTimes.otherRegions', 'Other Regions')}</td>
                  <td>{t('shipping.deliveryTimes.otherRegionsTime', '1-2 business days')}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>

        {/* Delivery Fees */}
        <Card className="p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">{t('shipping.deliveryFees.title', 'Delivery Fees')}</h2>
          <div className="space-y-3">
            <div className="flex justify-between py-3 border-b">
              <span>{t('shipping.fees.under500', 'Orders under 500 MAD')}</span>
              <span className="font-semibold">{t('shipping.fees.under500Amount', '30 MAD')}</span>
            </div>
            <div className="flex justify-between py-3 border-b">
              <span>{t('shipping.fees.500to1000', 'Orders 500-1000 MAD')}</span>
              <span className="font-semibold">{t('shipping.fees.500to1000Amount', '20 MAD')}</span>
            </div>
            <div className="flex justify-between py-3">
              <span>{t('shipping.fees.over1000', 'Orders over 1000 MAD')}</span>
              <span className="font-semibold text-green-600">{t('shipping.fees.over1000Amount', 'FREE')}</span>
            </div>
          </div>
        </Card>

        {/* Tracking */}
        <Card className="p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">{t('shipping.tracking.title', 'Track Your Order')}</h2>
          <p className="text-gray-600 mb-4">
            {t('shipping.tracking.description', 'Once your order is confirmed, you\'ll receive a tracking link via email. You can also track your order from the "My Orders" page.')}
          </p>
          <a href="/tracking" className="btn-primary inline-block">
            {t('shipping.tracking.button', 'Track Order')}
          </a>
        </Card>
      </div>
    </div>
  )
}

export default Shipping
