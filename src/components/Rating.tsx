import { Star } from 'lucide-react'
export function Rating({ rating }: { rating: number }) {
  return (
    <span className="rating" aria-label={rating ? `${rating} out of 5 stars` : 'Not rated'}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          size={15}
          key={n}
          fill={n <= rating ? 'currentColor' : 'none'}
          className={n <= rating ? '' : 'unfilled'}
        />
      ))}
    </span>
  )
}
