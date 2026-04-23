import { StarIcon as StarSolid } from '@heroicons/react/24/solid'
import { StarIcon as StarOutline, StarIcon as StarHalf } from '@heroicons/react/24/outline'

const SimpleRating = ({ rating, maxRating = 5, size = 'md', showValue = false }) => {
  const sizes = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  }

  const stars = []
  for (let i = 1; i <= maxRating; i++) {
    const diff = rating - (i - 1)
    if (diff >= 1) {
      stars.push(
        <StarSolid key={i} className={`${sizes[size]} text-yellow-400`} />
      )
    } else if (diff >= 0.5) {
      stars.push(
        <StarHalf key={i} className={`${sizes[size]} text-yellow-400`} />
      )
    } else {
      stars.push(
        <StarOutline key={i} className={`${sizes[size]} text-gray-300`} />
      )
    }
  }

  return (
    <div className="flex items-center gap-0.5" role="img" aria-label={`Rating: ${rating.toFixed(1)} out of ${maxRating}`}>
      {stars}
      {showValue && (
        <span className="ml-1 text-sm text-gray-600">
          {rating.toFixed(1)}
        </span>
      )}
    </div>
  )
}

export default SimpleRating
