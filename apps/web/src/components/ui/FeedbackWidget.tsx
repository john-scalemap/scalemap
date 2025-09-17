'use client'

import { useState } from 'react'

import { useError } from '@/contexts/ErrorContext'

interface FeedbackData {
  type: 'bug' | 'feature' | 'improvement' | 'other'
  title: string
  description: string
  email?: string
  rating?: number
  page: string
  userAgent: string
}

export default function FeedbackWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [step, setStep] = useState<'initial' | 'form' | 'success'>('initial')
  const [feedbackType, setFeedbackType] = useState<FeedbackData['type']>('improvement')
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    email: '',
    rating: 0
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { showError, showSuccess } = useError()

  const feedbackTypes = [
    { id: 'bug', label: 'Report a Bug', icon: '🐛', description: 'Something isn\'t working correctly' },
    { id: 'feature', label: 'Request Feature', icon: '💡', description: 'Suggest a new feature or enhancement' },
    { id: 'improvement', label: 'General Feedback', icon: '💬', description: 'Share your thoughts or suggestions' },
    { id: 'other', label: 'Other', icon: '📝', description: 'Something else on your mind' }
  ]

  const handleTypeSelect = (type: FeedbackData['type']) => {
    setFeedbackType(type)
    setStep('form')
  }

  const handleSubmit = async () => {
    if (!formData.title.trim() || !formData.description.trim()) {
      showError('Please fill in all required fields.')
      return
    }

    setIsSubmitting(true)

    try {
      const feedbackData: FeedbackData = {
        type: feedbackType,
        title: formData.title,
        description: formData.description,
        email: formData.email || undefined,
        rating: formData.rating || undefined,
        page: window.location.pathname,
        userAgent: navigator.userAgent
      }

      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(feedbackData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to submit feedback')
      }

      const result = await response.json()
      console.log('Feedback submitted successfully:', result.id)

      setStep('success')
      showSuccess('Thank you for your feedback! We appreciate your input.')

      // Reset form after a delay
      setTimeout(() => {
        setIsOpen(false)
        setStep('initial')
        setFormData({ title: '', description: '', email: '', rating: 0 })
      }, 3000)

    } catch (error) {
      console.error('Error submitting feedback:', error)
      showError('Failed to submit feedback. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const StarRating = ({ rating, onRatingChange }: { rating: number, onRatingChange: (rating: number) => void }) => {
    return (
      <div className="flex space-x-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onRatingChange(star)}
            className={`text-2xl transition-colors ${
              star <= rating ? 'text-yellow-400' : 'text-gray-300 hover:text-yellow-300'
            }`}
          >
            ⭐
          </button>
        ))}
      </div>
    )
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 left-6 bg-green-600 hover:bg-green-700 text-white p-3 rounded-full shadow-lg transition-all duration-200 hover:scale-105 z-40"
        aria-label="Send feedback"
      >
        <span className="text-lg">📝</span>
      </button>
    )
  }

  return (
    <div className="fixed bottom-6 left-6 bg-white border border-gray-200 rounded-lg shadow-xl z-40 w-80">
      {/* Header */}
      <div className="bg-green-600 text-white p-4 rounded-t-lg flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <span className="text-lg">📝</span>
          <h3 className="font-semibold">Send Feedback</h3>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="text-white hover:text-gray-200"
          aria-label="Close feedback"
        >
          ✕
        </button>
      </div>

      {/* Content */}
      <div className="p-4">
        {step === 'initial' && (
          <div>
            <p className="text-gray-600 mb-4 text-sm">
              Help us improve ScaleMap by sharing your feedback!
            </p>
            <div className="space-y-2">
              {feedbackTypes.map((type) => (
                <button
                  key={type.id}
                  onClick={() => handleTypeSelect(type.id as FeedbackData['type'])}
                  className="w-full text-left p-3 border border-gray-200 rounded-lg hover:border-green-500 hover:bg-green-50 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-lg">{type.icon}</span>
                    <div>
                      <h4 className="font-medium text-sm">{type.label}</h4>
                      <p className="text-xs text-gray-500">{type.description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 'form' && (
          <div className="space-y-4">
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <span>{feedbackTypes.find(t => t.id === feedbackType)?.icon}</span>
              <span>{feedbackTypes.find(t => t.id === feedbackType)?.label}</span>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Brief summary of your feedback"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description *
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Please provide details about your feedback..."
                rows={4}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
              />
            </div>

            {feedbackType === 'improvement' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rate your experience (optional)
                </label>
                <StarRating
                  rating={formData.rating}
                  onRatingChange={(rating) => setFormData(prev => ({ ...prev, rating }))}
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email (optional)
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="your@email.com"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                We'll only use this to follow up on your feedback if needed.
              </p>
            </div>

            <div className="flex space-x-2 pt-2">
              <button
                onClick={() => setStep('initial')}
                className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50"
              >
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !formData.title.trim() || !formData.description.trim()}
                className="flex-1 px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Sending...' : 'Send Feedback'}
              </button>
            </div>
          </div>
        )}

        {step === 'success' && (
          <div className="text-center py-6">
            <div className="text-4xl mb-4">✅</div>
            <h3 className="font-semibold text-gray-900 mb-2">Thank you!</h3>
            <p className="text-sm text-gray-600">
              Your feedback has been sent. We appreciate you taking the time to help us improve ScaleMap.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}