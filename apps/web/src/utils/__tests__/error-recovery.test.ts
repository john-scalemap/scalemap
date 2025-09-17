import { jest } from '@jest/globals'

import { withRetry, withFallback, isRetriableError, resilientFetch, RetryError } from '../error-recovery'

// Mock fetch and Response
global.fetch = jest.fn()
global.Response = jest.fn().mockImplementation((body, init) => ({
  ok: (init?.status || 200) < 400,
  status: init?.status || 200,
  statusText: init?.statusText || 'OK',
  body
}))

describe('error-recovery utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('withRetry', () => {
    it('succeeds on first attempt', async () => {
      const operation = jest.fn().mockResolvedValue('success')

      const result = await withRetry(operation)

      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(1)
    })

    it('retries on failure and eventually succeeds', async () => {
      // Use retriable error
      const retriableError = new TypeError('fetch failed')
      const operation = jest.fn()
        .mockRejectedValueOnce(retriableError)
        .mockRejectedValueOnce(retriableError)
        .mockResolvedValue('success')

      const result = await withRetry(operation, {
        maxAttempts: 3,
        baseDelay: 0,
        retryCondition: () => true // Force retry for test
      })

      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(3)
    })

    it('throws RetryError after max attempts', async () => {
      const retriableError = new TypeError('fetch failed')
      const operation = jest.fn().mockRejectedValue(retriableError)

      await expect(
        withRetry(operation, {
          maxAttempts: 2,
          baseDelay: 0,
          retryCondition: () => true // Force retry for test
        })
      ).rejects.toThrow(RetryError)

      expect(operation).toHaveBeenCalledTimes(2)
    })

    it('respects retry condition', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('non-retriable'))

      await expect(
        withRetry(operation, {
          maxAttempts: 3,
          baseDelay: 0,
          retryCondition: () => false
        })
      ).rejects.toThrow('non-retriable')

      expect(operation).toHaveBeenCalledTimes(1)
    })
  })

  describe('withFallback', () => {
    it('returns operation result on success', async () => {
      const operation = jest.fn().mockResolvedValue('success')

      const result = await withFallback(operation, { fallbackValue: 'fallback' })

      expect(result).toBe('success')
    })

    it('returns fallback value on error', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('failed'))

      const result = await withFallback(operation, { fallbackValue: 'fallback' })

      expect(result).toBe('fallback')
    })

    it('calls fallback function on error', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('failed'))
      const fallbackFn = jest.fn().mockReturnValue('fallback result')

      const result = await withFallback(operation, { fallbackFn })

      expect(result).toBe('fallback result')
      expect(fallbackFn).toHaveBeenCalled()
    })

    it('respects shouldUseFallback condition', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('failed'))

      await expect(
        withFallback(operation, {
          fallbackValue: 'fallback',
          shouldUseFallback: () => false
        })
      ).rejects.toThrow('failed')
    })
  })

  describe('isRetriableError', () => {
    it('identifies fetch errors as retriable', () => {
      const fetchError = new TypeError('fetch failed')
      expect(isRetriableError(fetchError)).toBe(true)
    })

    it('identifies 5xx HTTP errors as retriable', () => {
      const httpError = { status: 500 }
      expect(isRetriableError(httpError)).toBe(true)
    })

    it('identifies 4xx HTTP errors as non-retriable', () => {
      const httpError = { status: 404 }
      expect(isRetriableError(httpError)).toBe(false)
    })

    it('identifies timeout errors as retriable', () => {
      const timeoutError = { code: 'TIMEOUT' }
      expect(isRetriableError(timeoutError)).toBe(true)
    })

    it('identifies unknown errors as non-retriable', () => {
      const unknownError = new Error('unknown')
      expect(isRetriableError(unknownError)).toBe(false)
    })
  })

  describe('resilientFetch', () => {
    it('makes successful request', async () => {
      const mockResponse = { ok: true, status: 200, statusText: 'OK' }
      ;(fetch as jest.Mock).mockResolvedValue(mockResponse)

      const result = await resilientFetch('/api/test')

      expect(result).toBe(mockResponse)
      expect(fetch).toHaveBeenCalledWith('/api/test', {})
    })

    it('throws error for failed request', async () => {
      const mockResponse = { ok: false, status: 500, statusText: 'Internal Server Error' }
      ;(fetch as jest.Mock).mockResolvedValue(mockResponse)

      await expect(resilientFetch('/api/test')).rejects.toThrow('HTTP 500')
    })

    it('retries on failure when retry options provided', async () => {
      const mockSuccessResponse = { ok: true, status: 200, statusText: 'OK' }
      const mockErrorResponse = { ok: false, status: 500, statusText: 'Internal Server Error' }
      ;(fetch as jest.Mock)
        .mockResolvedValueOnce(mockErrorResponse)
        .mockResolvedValue(mockSuccessResponse)

      const result = await resilientFetch('/api/test', {
        retry: { maxAttempts: 2, baseDelay: 0, retryCondition: () => true }
      })

      expect(result).toBe(mockSuccessResponse)
      expect(fetch).toHaveBeenCalledTimes(2)
    })

    it('uses fallback on failure', async () => {
      const mockErrorResponse = { ok: false, status: 500, statusText: 'Internal Server Error' }
      ;(fetch as jest.Mock).mockResolvedValue(mockErrorResponse)

      const fallbackResponse = { ok: true, status: 200, statusText: 'OK' }
      const result = await resilientFetch('/api/test', {
        fallback: { fallbackValue: fallbackResponse }
      })

      expect(result).toBe(fallbackResponse)
    })
  })
})