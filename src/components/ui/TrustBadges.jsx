import { ShieldCheckIcon, LockClosedIcon, EyeSlashIcon } from '@heroicons/react/24/outline'

const TrustBadges = ({ variant = 'default' }) => {
  const badges = [
    {
      icon: ShieldCheckIcon,
      title: 'Protected by 256-bit SSL',
      desc: 'Your data is encrypted in transit',
    },
    {
      icon: LockClosedIcon,
      title: 'Secure Storage',
      desc: 'Stored encrypted at rest',
    },
    {
      icon: EyeSlashIcon,
      title: 'Privacy Guaranteed',
      desc: 'Never shared with third parties',
    },
  ]

  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-4 text-xs text-gray-500">
        {badges.map((badge, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <badge.icon className="w-3.5 h-3.5 text-green-500" />
            <span>{badge.title}</span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {badges.map((badge, i) => (
        <div key={i} className="flex items-start gap-3 p-3 bg-green-50 rounded-xl border border-green-100">
          <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <badge.icon className="w-4 h-4 text-green-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-green-800">{badge.title}</p>
            <p className="text-xs text-green-600">{badge.desc}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

export default TrustBadges
