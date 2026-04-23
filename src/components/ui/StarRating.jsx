import { StarIcon as StarIconSolid, StarIcon as StarIconOutline } from '@heroicons/react/24/solid'
import { StarIcon as StarIconOutline2 } from '@heroicons/react/24/outline'

const StarRating = ({ rating, maxRating = 5, size = 'md', showValue = false, onRate }) => {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  }
  
  return (
    <div className="flex items-center gap-0.5">
      {[...Array(maxRating)].map((_, index) => {
        const filled = index < rating
        const Icon = filled ? StarIconSolid : StarIconOutline2
        
        return (
          <button
            key={index}
            type="button"
            disabled={!onRate}
            onClick={() => onRate?.(index + 1)}
            className={`${sizes[size]} ${
              filled ? 'text-yellow-400' : 'text-gray-300'
            } ${onRate ? 'cursor-pointer hover:scale-110 transition-transform' : ''}`}
          >
            <Icon className="w-full h-full" />
          </button>
        )
      })}
      {showValue && (
        <span className="ml-1 text-sm text-gray-600">
          {rating.toFixed(1)}
        </span>
      )}
    </div>
  )
}

export default StarRating
