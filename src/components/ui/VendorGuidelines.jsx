import { useState } from 'react'
import {
  ScaleIcon,
  ClockIcon,
  CubeIcon,
  DocumentCheckIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline'

const VendorGuidelines = ({ onAccept, alreadyAccepted = false }) => {
  const [agreed, setAgreed] = useState(false)
  const [showFull, setShowFull] = useState(false)

  const guidelines = [
    {
      icon: ScaleIcon,
      title: '1. Accurate Product Descriptions & Pricing',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      items: [
        'Provide truthful and accurate descriptions for all products listed',
        'Display prices in Moroccan Dirham (MAD) including all applicable taxes',
        'Update prices promptly when costs change',
        'Do not engage in misleading pricing practices (Law 31-08 on Consumer Protection)',
        'Clearly state unit type, minimum order quantity, and product origin',
        'Include clear, actual product photos (not stock images)',
      ],
    },
    {
      icon: CubeIcon,
      title: '2. Stock Management',
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      items: [
        'Maintain sufficient stock levels for all listed products',
        'Update inventory quantities in real-time',
        'Promptly mark products as "Out of Stock" when unavailable',
        'Do not list products you cannot fulfill',
        'Notify buyers immediately if stock becomes unavailable after order placement',
        'Regular inventory audits are recommended (minimum weekly)',
      ],
    },
    {
      icon: ClockIcon,
      title: '3. Order Fulfillment Timelines',
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      items: [
        'Confirm or reject orders within 24 hours of receipt',
        'Prepare orders within the agreed timeframe (default: 48 hours)',
        'Communicate delays proactively to buyers',
        'Accept delivery driver assignments or provide alternative arrangements',
        'Repeated order cancellations may result in account suspension',
        'Maintain a fulfillment rate of at least 95%',
      ],
    },
    {
      icon: DocumentCheckIcon,
      title: '4. Moroccan Legal Compliance',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      items: [
        'Comply with Law 31-08 on Consumer Protection',
        'Follow Law 13-03 on Combating Fraud and Commercial Deception',
        'Adhere to food safety regulations (ONSSA standards)',
        'Maintain valid business registration and tax identification',
        'Issue proper invoices/receipts for all transactions',
        'Comply with data protection Law 09-08 on Personal Data',
        'Respect intellectual property and trademark laws',
        'Follow environmental regulations for packaging and waste',
      ],
    },
  ]

  const penalties = [
    'Warning notice for first violation',
    'Temporary suspension (7 days) for repeated violations',
    'Permanent account termination for serious or ongoing violations',
    'Legal action may be taken for violations of Moroccan law',
    'Financial penalties may apply for fraudulent activities',
  ]

  if (alreadyAccepted) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-6 text-white">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircleIcon className="w-8 h-8" />
            <h2 className="text-xl font-bold">Vendor Agreement Accepted ✓</h2>
          </div>
          <p className="text-green-100 text-sm">
            You have agreed to the vendor guidelines and Moroccan legal compliance requirements.
          </p>
        </div>

        <div className="p-6">
          <button
            onClick={() => setShowFull(!showFull)}
            className="text-green-600 font-medium hover:underline text-sm"
          >
            {showFull ? 'Hide' : 'View'} Full Guidelines
          </button>

          {showFull && (
            <div className="mt-4 space-y-6">
              {guidelines.map((section, i) => (
                <div key={i}>
                  <h3 className={`font-semibold ${section.color} mb-2 flex items-center gap-2`}>
                    <section.icon className="w-5 h-5" />
                    {section.title}
                  </h3>
                  <ul className="space-y-1.5">
                    {section.items.map((item, j) => (
                      <li key={j} className="text-sm text-gray-600 flex items-start gap-2">
                        <span className="text-green-500 mt-1">•</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border-2 border-amber-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-6 text-white">
        <div className="flex items-center gap-3 mb-2">
          <ExclamationTriangleIcon className="w-8 h-8" />
          <h2 className="text-xl font-bold">Vendor Guidelines & Legal Agreement</h2>
        </div>
        <p className="text-amber-100 text-sm">
          Please read and accept these guidelines to continue selling on Qotoof.
          These guidelines are based on Moroccan commercial law and platform policies.
        </p>
      </div>

      {/* Guidelines */}
      <div className="p-6 space-y-6 max-h-96 overflow-y-auto">
        {guidelines.map((section, i) => (
          <div key={i}>
            <h3 className={`font-semibold ${section.color} mb-3 flex items-center gap-2`}>
              <div className={`w-8 h-8 ${section.bgColor} rounded-lg flex items-center justify-center`}>
                <section.icon className={`w-5 h-5 ${section.color}`} />
              </div>
              {section.title}
            </h3>
            <ul className="space-y-2">
              {section.items.map((item, j) => (
                <li key={j} className="text-sm text-gray-700 flex items-start gap-2">
                  <CheckCircleIcon className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}

        {/* Penalties */}
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
          <h3 className="font-semibold text-red-800 mb-2 flex items-center gap-2">
            <ExclamationTriangleIcon className="w-5 h-5" />
            Non-Compliance Penalties
          </h3>
          <ul className="space-y-1.5">
            {penalties.map((penalty, i) => (
              <li key={i} className="text-sm text-red-700 flex items-start gap-2">
                <span className="text-red-500 mt-1">•</span>
                {penalty}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Acceptance */}
      <div className="p-6 border-t border-gray-200 bg-gray-50">
        <label htmlFor="vendor-guidelines-agree" className="flex items-start gap-3 cursor-pointer">
          <input
            id="vendor-guidelines-agree"
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-1 w-5 h-5 text-green-600 rounded border-gray-300 focus:ring-green-500"
          />
          <div className="text-sm text-gray-700">
            <p className="font-medium text-gray-900 mb-1">
              I have read and agree to the Vendor Guidelines
            </p>
            <p className="text-gray-500">
              I commit to providing accurate product information, maintaining stock levels, 
              fulfilling orders on time, and complying with all Moroccan laws and regulations 
              including Law 31-08 (Consumer Protection), Law 13-03 (Anti-Fraud), and ONSSA standards.
            </p>
          </div>
        </label>

        <button
          onClick={() => agreed && onAccept?.()}
          disabled={!agreed}
          className={`w-full mt-4 py-3 rounded-xl font-semibold transition-all ${
            agreed
              ? 'bg-green-600 text-white hover:bg-green-700'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          {agreed ? 'Accept & Continue' : 'Please accept the guidelines to continue'}
        </button>
      </div>
    </div>
  )
}

export default VendorGuidelines
