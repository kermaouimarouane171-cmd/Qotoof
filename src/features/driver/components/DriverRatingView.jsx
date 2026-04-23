import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import Card from '../../../components/ui/Card';
import Button from '../../../components/ui/Button';
import TextArea from '../../../components/ui/TextArea';

export default function DriverRatingView({ deliveryId, driverId, onClose }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [hoverRating, setHoverRating] = useState(0);

  const submitRatingMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/driver/${driverId}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deliveryId,
          rating,
          comment,
        }),
      });
      if (!response.ok) throw new Error('Failed to submit rating');
      return response.json();
    },
    onSuccess: () => {
      onClose?.();
    },
  });

  const handleSubmit = () => {
    if (rating === 0) {
      alert('Please select a rating');
      return;
    }
    submitRatingMutation.mutate();
  };

  const stars = [1, 2, 3, 4, 5];

  return (
    <Card title="Rate Your Delivery" className="max-w-md">
      <div className="space-y-4">
        {/* Star Rating */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            How was your delivery experience?
          </label>
          <div className="flex gap-2 justify-center py-4">
            {stars.map((star) => (
              <button
                key={star}
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                className="focus:outline-none transition"
                type="button"
              >
                <span className={`text-4xl ${(hoverRating || rating) >= star ? '⭐' : '☆'}`}>{star}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Comment */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Additional Comments (Optional)
          </label>
          <TextArea
            placeholder="Share your experience with this driver..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={4}
            maxLength={500}
          />
          <p className="text-xs text-gray-500 mt-1">{comment.length}/500</p>
        </div>

        {/* Quick Feedback Options */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Quick feedback:</p>
          <div className="flex gap-2 flex-wrap">
            {[
              { label: '✅ Professional', value: 'professional' },
              { label: '⏰ On Time', value: 'on_time' },
              { label: '📦 Careful Handling', value: 'careful' },
              { label: '😊 Friendly', value: 'friendly' },
            ].map((item) => (
              <button
                key={item.value}
                onClick={() => setComment((prev) => `${prev} ${item.label}`.trim())}
                className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded-full text-sm hover:bg-gray-300 dark:hover:bg-gray-600 transition"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-4">
          <Button
            variant="primary"
            className="flex-1"
            onClick={handleSubmit}
            disabled={submitRatingMutation.isPending}
          >
            {submitRatingMutation.isPending ? 'Submitting...' : 'Submit Rating'} ✅
          </Button>
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Skip ⏭️
          </Button>
        </div>

        {submitRatingMutation.isError && (
          <div className="p-3 bg-red-100 text-red-800 rounded text-sm">
            {submitRatingMutation.error?.message || 'Failed to submit rating'}
          </div>
        )}
      </div>
    </Card>
  );
}
