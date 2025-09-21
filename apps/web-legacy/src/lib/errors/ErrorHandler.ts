import { ApiError } from '@scalemap/shared/types/api';

export interface ErrorContext {
  component?: string;
  action?: string;
  userId?: string;
  assessmentId?: string;
  metadata?: Record<string, any>;
}

export interface ErrorReport {
  error: Error | ApiError;
  context: ErrorContext;
  timestamp: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export class ErrorHandler {
  private static instance: ErrorHandler;
  private errorQueue: ErrorReport[] = [];
  private maxQueueSize = 50;

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  public handleError(
    error: Error | ApiError,
    context: ErrorContext = {},
    severity: ErrorReport['severity'] = 'medium'
  ): void {
    const report: ErrorReport = {
      error,
      context,
      timestamp: new Date().toISOString(),
      severity,
    };

    // Add to queue
    this.errorQueue.push(report);
    if (this.errorQueue.length > this.maxQueueSize) {
      this.errorQueue.shift(); // Remove oldest error
    }

    // Log error
    this.logError(report);

    // Send to monitoring service if critical
    if (severity === 'critical') {
      this.sendToMonitoring(report);
    }

    // Show user-friendly message
    this.showUserMessage(report);
  }

  public handleApiError(
    apiError: ApiError,
    context: ErrorContext = {}
  ): void {
    let severity: ErrorReport['severity'] = 'medium';

    // Determine severity based on error code
    if (apiError.code === 'NETWORK_ERROR' || apiError.code === 'TIMEOUT') {
      severity = 'high';
    } else if (apiError.code === 'UNAUTHORIZED' || apiError.code === 'FORBIDDEN') {
      severity = 'critical';
    } else if (apiError.code === 'VALIDATION_ERROR') {
      severity = 'low';
    }

    this.handleError(apiError as any, context, severity);
  }

  public getErrorHistory(): ErrorReport[] {
    return [...this.errorQueue];
  }

  public clearErrorHistory(): void {
    this.errorQueue = [];
  }

  private logError(report: ErrorReport): void {
    const { error, context, severity } = report;
    const message = `[${severity.toUpperCase()}] ${error.message}`;

    console.group(`🚨 Error Handler: ${context.component || 'Unknown'}`);
    console.error(message);
    console.error('Context:', context);
    console.error('Stack:', (error as Error).stack);
    console.groupEnd();
  }

  private async sendToMonitoring(report: ErrorReport): Promise<void> {
    try {
      // In production, this would send to a monitoring service like Sentry
      // For now, we'll just log it
      console.warn('Critical error reported to monitoring:', report);

      // Example implementation:
      // await fetch('/api/monitoring/errors', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(report),
      // });
    } catch (err) {
      console.error('Failed to send error to monitoring:', err);
    }
  }

  private showUserMessage(report: ErrorReport): void {
    const { error, severity } = report;

    // Don't show messages for low severity errors
    if (severity === 'low') return;

    const message = this.getUserFriendlyMessage(error, severity);

    // In a real app, this would show a toast notification or modal
    console.warn('User message:', message);

    // Example implementation:
    // toast.error(message, {
    //   duration: severity === 'critical' ? 10000 : 5000,
    // });
  }

  private getUserFriendlyMessage(
    error: Error | ApiError,
    severity: ErrorReport['severity']
  ): string {
    const apiError = error as ApiError;

    if (apiError.code) {
      switch (apiError.code) {
        case 'NETWORK_ERROR':
          return 'Connection problem. Please check your internet connection and try again.';
        case 'TIMEOUT':
          return 'Request timed out. Please try again.';
        case 'UNAUTHORIZED':
          return 'Your session has expired. Please log in again.';
        case 'FORBIDDEN':
          return 'You don\'t have permission to perform this action.';
        case 'VALIDATION_ERROR':
          return apiError.message || 'Please check your input and try again.';
        case 'NOT_FOUND':
          return 'The requested resource was not found.';
        case 'SERVER_ERROR':
          return 'Server error occurred. Please try again later.';
        default:
          return apiError.message || 'An unexpected error occurred.';
      }
    }

    // Fallback for regular errors
    if (severity === 'critical') {
      return 'A critical error occurred. Please refresh the page or contact support if the problem persists.';
    }

    return error.message || 'An unexpected error occurred. Please try again.';
  }

  // Recovery helpers
  public async retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxRetries = 3,
    baseDelay = 1000
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        if (attempt === maxRetries) {
          this.handleError(lastError, { action: 'retry_exhausted' }, 'high');
          throw lastError;
        }

        // Exponential backoff
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));

        this.handleError(lastError, { action: 'retry_attempt', attempt }, 'low');
      }
    }

    throw lastError!;
  }

  public createErrorBoundary<T>(
    operation: () => Promise<T>,
    context: ErrorContext,
    fallback?: T
  ): Promise<T | undefined> {
    return operation().catch((error) => {
      this.handleError(error, context);
      return fallback;
    });
  }
}

// Global error handler instance
export const errorHandler = ErrorHandler.getInstance();

// Global error event listeners
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    errorHandler.handleError(event.error, { component: 'global' }, 'medium');
  });

  window.addEventListener('unhandledrejection', (event) => {
    errorHandler.handleError(
      new Error(event.reason?.message || 'Unhandled promise rejection'),
      { component: 'global' },
      'high'
    );
  });
}