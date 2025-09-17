export interface RetryOptions {
  maxAttempts: number
  baseDelay: number
  maxDelay: number
  backoffFactor: number
  retryCondition?: (error: unknown) => boolean
}

export class RetryError extends Error {
  constructor(
    message: string,
    public attempts: number,
    public lastError: unknown
  ) {
    super(message)
    this.name = 'RetryError'
  }
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    backoffFactor = 2,
    retryCondition = (error) => {
      // Default: retry on network errors and 5xx status codes
      if (error instanceof TypeError && error.message.includes('fetch')) {
        return true
      }
      if (error && typeof error === 'object' && 'status' in error) {
        const status = (error as { status: number }).status
        return status >= 500 && status < 600
      }
      return false
    }
  } = options

  let lastError: unknown
  let delay = baseDelay

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error

      // If this is not the last attempt and the error is retriable, continue
      if (attempt < maxAttempts && retryCondition(error)) {
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, Math.min(delay, maxDelay)))
        delay *= backoffFactor
        continue
      }

      // If we can't retry, throw the original error
      if (!retryCondition(error)) {
        throw error
      }

      // If we've exhausted all attempts, throw RetryError
      break
    }
  }

  throw new RetryError(
    `Operation failed after ${maxAttempts} attempts`,
    maxAttempts,
    lastError
  )
}

export function isRetriableError(error: unknown): boolean {
  // Network errors
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true
  }

  // HTTP errors 5xx
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status: number }).status
    return status >= 500 && status < 600
  }

  // Timeout errors
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code: string }).code
    return ['TIMEOUT', 'ECONNRESET', 'ECONNREFUSED'].includes(code)
  }

  return false
}

export async function withCircuitBreaker<T>(
  operation: () => Promise<T>,
  options: {
    failureThreshold: number
    resetTimeout: number
    monitoringPeriod: number
  } = {
    failureThreshold: 5,
    resetTimeout: 60000, // 1 minute
    monitoringPeriod: 60000 // 1 minute
  }
): Promise<T> {
  const key = operation.toString()

  if (!circuitBreakerState.has(key)) {
    circuitBreakerState.set(key, {
      state: 'CLOSED',
      failures: 0,
      lastFailTime: 0,
      successes: 0
    })
  }

  const state = circuitBreakerState.get(key)!
  const now = Date.now()

  // Reset if enough time has passed
  if (now - state.lastFailTime > options.resetTimeout && state.state === 'OPEN') {
    state.state = 'HALF_OPEN'
    state.failures = 0
  }

  // Check if circuit is open
  if (state.state === 'OPEN') {
    throw new Error('Circuit breaker is OPEN - too many failures')
  }

  try {
    const result = await operation()

    // Success - reset failure count
    state.failures = 0
    state.successes++

    if (state.state === 'HALF_OPEN' && state.successes >= 3) {
      state.state = 'CLOSED'
      state.successes = 0
    }

    return result
  } catch (error) {
    state.failures++
    state.lastFailTime = now

    if (state.failures >= options.failureThreshold) {
      state.state = 'OPEN'
    }

    throw error
  }
}

// Simple in-memory circuit breaker state
const circuitBreakerState = new Map<string, {
  state: 'OPEN' | 'CLOSED' | 'HALF_OPEN'
  failures: number
  lastFailTime: number
  successes: number
}>()

export interface FallbackOptions<T> {
  fallbackValue?: T
  fallbackFn?: () => T | Promise<T>
  shouldUseFallback?: (error: unknown) => boolean
}

export async function withFallback<T>(
  operation: () => Promise<T>,
  options: FallbackOptions<T>
): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    const shouldFallback = options.shouldUseFallback?.(error) ?? true

    if (!shouldFallback) {
      throw error
    }

    if (options.fallbackFn) {
      return await options.fallbackFn()
    }

    if (options.fallbackValue !== undefined) {
      return options.fallbackValue
    }

    throw error
  }
}

// Utility for making resilient HTTP requests
export async function resilientFetch(
  url: string,
  options: RequestInit & {
    retry?: Partial<RetryOptions>
    fallback?: FallbackOptions<Response>
    circuitBreaker?: boolean
  } = {}
): Promise<Response> {
  const { retry, fallback, circuitBreaker, ...fetchOptions } = options

  const operation = async () => {
    const response = await fetch(url, fetchOptions)

    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}: ${response.statusText}`)
      ;(error as any).status = response.status
      throw error
    }

    return response
  }

  let wrappedOperation = operation

  if (retry) {
    wrappedOperation = () => withRetry(operation, retry)
  }

  if (circuitBreaker) {
    wrappedOperation = () => withCircuitBreaker(wrappedOperation)
  }

  if (fallback) {
    return withFallback(wrappedOperation, fallback)
  }

  return wrappedOperation()
}