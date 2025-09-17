import { logger } from './logger';

export interface MetricData {
  metricName: string;
  value: number;
  unit?: 'Count' | 'Seconds' | 'Milliseconds' | 'Bytes' | 'Percent';
  dimensions?: Record<string, string>;
  timestamp?: Date;
}

export class Monitoring {
  static putMetric(metric: MetricData) {
    const { metricName, value, unit = 'Count', dimensions = {}, timestamp = new Date() } = metric;

    // In development, just log metrics
    if (process.env.NODE_ENV === 'development') {
      logger.info('Custom Metric', {
        metric: metricName,
        value,
        unit,
        dimensions,
        timestamp: timestamp.toISOString(),
      });
      return;
    }

    // In production, this would integrate with CloudWatch
    // For now, structured logging that CloudWatch can parse
    console.log(JSON.stringify({
      type: 'METRIC',
      metric: metricName,
      value,
      unit,
      dimensions,
      timestamp: timestamp.toISOString(),
    }));
  }

  static incrementCounter(name: string, dimensions?: Record<string, string>) {
    this.putMetric({
      metricName: name,
      value: 1,
      unit: 'Count',
      dimensions,
    });
  }

  static recordLatency(name: string, milliseconds: number, dimensions?: Record<string, string>) {
    this.putMetric({
      metricName: name,
      value: milliseconds,
      unit: 'Milliseconds',
      dimensions,
    });
  }

  static recordError(functionName: string, errorType: string, error?: Error) {
    this.incrementCounter('Errors', {
      function: functionName,
      errorType,
    });

    logger.error('Function Error', {
      function: functionName,
      errorType,
      errorMessage: error?.message,
      errorStack: error?.stack,
    });
  }
}

// Performance timing helper
export function withTiming<T>(
  operation: () => Promise<T>,
  metricName: string,
  dimensions?: Record<string, string>
): Promise<T> {
  const start = Date.now();

  return operation()
    .then((result) => {
      const duration = Date.now() - start;
      Monitoring.recordLatency(metricName, duration, dimensions);
      return result;
    })
    .catch((error) => {
      const duration = Date.now() - start;
      Monitoring.recordLatency(metricName, duration, { ...dimensions, status: 'error' });
      throw error;
    });
}