interface RetryableErrorType {
  code?: string;
  status?: number;
  message?: string;
}

interface RetryOptions {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffFactor: number;
  retryCondition?: (error: RetryableErrorType) => boolean;
}

const defaultRetryOptions: RetryOptions = {
  maxRetries: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffFactor: 2,
  retryCondition: (error) => {
    // Retry on network errors, timeout errors, and server errors (5xx)
    if (error.code === 'NETWORK_ERROR' || error.code === 'TIMEOUT') {
      return true;
    }

    // Check for HTTP status codes that indicate retryable errors
    if (error.status >= 500 && error.status < 600) {
      return true;
    }

    // Retry on rate limiting
    if (error.status === 429) {
      return true;
    }

    return false;
  },
};

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts = { ...defaultRetryOptions, ...options };
  let lastError: unknown;
  let delay = opts.initialDelay;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      // Don't retry if we've exhausted attempts or error is not retryable
      const errorInfo = error as RetryableErrorType;
      if (attempt === opts.maxRetries || !opts.retryCondition?.(errorInfo)) {
        throw error;
      }

      // Calculate delay with exponential backoff
      const currentDelay = Math.min(delay, opts.maxDelay);

      console.warn(
        `Operation failed (attempt ${attempt + 1}/${opts.maxRetries + 1}), retrying in ${currentDelay}ms:`,
        error
      );

      await new Promise(resolve => setTimeout(resolve, currentDelay));
      delay *= opts.backoffFactor;
    }
  }

  throw lastError;
}

export class RetryableError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string
  ) {
    super(message);
    this.name = 'RetryableError';
  }
}