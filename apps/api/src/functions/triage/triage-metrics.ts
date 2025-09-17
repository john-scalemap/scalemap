import {
  TriageMetrics,
  ProcessingMetrics
} from '@scalemap/shared/src/types/triage';

export interface PerformanceThresholds {
  maxProcessingTime: number; // ms
  maxTokensPerRequest: number;
  maxCostPerTriage: number; // £
  targetConfidence: number;
  circuitBreakerThreshold: number;
}

export class TriageMetricsCollector {
  private metrics: TriageMetrics;
  private performanceThresholds: PerformanceThresholds;
  private circuitBreakerState: {
    failures: number;
    lastFailure: number;
    isOpen: boolean;
  };
  private readonly CIRCUIT_BREAKER_RESET_TIME = 300000; // 5 minutes

  constructor(thresholds?: Partial<PerformanceThresholds>) {
    this.performanceThresholds = {
      maxProcessingTime: 120000, // 2 minutes
      maxTokensPerRequest: 8000,
      maxCostPerTriage: 0.5, // £0.5 target
      targetConfidence: 0.7,
      circuitBreakerThreshold: 5,
      ...thresholds
    };

    this.metrics = {
      averageProcessingTime: 0,
      averageTokenUsage: 0,
      averageCost: 0,
      accuracyScore: 0,
      overrideRate: 0,
      confidenceDistribution: {},
      industryPerformance: {}
    };

    this.circuitBreakerState = {
      failures: 0,
      lastFailure: 0,
      isOpen: false
    };
  }

  /**
   * Record triage completion metrics
   */
  recordTriageCompletion(
    assessmentId: string,
    processingMetrics: ProcessingMetrics,
    confidence: number,
    industryContext: { sector: string },
    wasSuccessful: boolean = true
  ): void {
    if (!wasSuccessful) {
      this.recordFailure();
      return;
    }

    // Update overall averages
    this.updateAverageMetrics(processingMetrics);

    // Update confidence distribution
    this.updateConfidenceDistribution(confidence);

    // Update industry-specific metrics
    this.updateIndustryMetrics(industryContext.sector, processingMetrics, confidence);

    // Check performance thresholds
    this.checkPerformanceThresholds(processingMetrics, confidence);

    // Reset circuit breaker on successful completion
    this.resetCircuitBreaker();
  }

  /**
   * Record triage override (for measuring accuracy)
   */
  recordTriageOverride(
    assessmentId: string,
    originalDomains: string[],
    overriddenDomains: string[],
    overrideReason: string
  ): void {
    // Update override rate
    const currentOverrideRate = this.metrics.overrideRate;
    this.metrics.overrideRate = (currentOverrideRate * 0.95) + 0.05; // Exponential moving average

    console.log(`Triage override recorded for ${assessmentId}:`, {
      originalDomains,
      overriddenDomains,
      reason: overrideReason,
      newOverrideRate: this.metrics.overrideRate
    });
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): TriageMetrics {
    return { ...this.metrics };
  }

  /**
   * Get performance health status
   */
  getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'critical';
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];
    let status: 'healthy' | 'degraded' | 'critical' = 'healthy';

    // Check processing time
    if (this.metrics.averageProcessingTime > this.performanceThresholds.maxProcessingTime) {
      issues.push(`Average processing time (${Math.round(this.metrics.averageProcessingTime / 1000)}s) exceeds threshold`);
      recommendations.push('Consider optimizing prompts or using faster models');
      status = 'degraded';
    }

    // Check cost
    if (this.metrics.averageCost > this.performanceThresholds.maxCostPerTriage) {
      issues.push(`Average cost (£${this.metrics.averageCost.toFixed(2)}) exceeds budget`);
      recommendations.push('Implement prompt optimization and model fallbacks');
      status = 'degraded';
    }

    // Check override rate
    if (this.metrics.overrideRate > 0.2) {
      issues.push(`High override rate (${Math.round(this.metrics.overrideRate * 100)}%) indicates accuracy issues`);
      recommendations.push('Review triage algorithm and industry rules');
      status = 'critical';
    }

    // Check token usage
    if (this.metrics.averageTokenUsage > this.performanceThresholds.maxTokensPerRequest) {
      issues.push(`Average token usage (${Math.round(this.metrics.averageTokenUsage)}) is high`);
      recommendations.push('Optimize prompt structure and reduce unnecessary context');
    }

    // Check circuit breaker
    if (this.circuitBreakerState.isOpen) {
      issues.push('Circuit breaker is open due to repeated failures');
      recommendations.push('Investigate and resolve underlying service issues');
      status = 'critical';
    }

    return { status, issues, recommendations };
  }

  /**
   * Generate performance report
   */
  generatePerformanceReport(_timeframe: 'hour' | 'day' | 'week' = 'day'): {
    summary: TriageMetrics;
    health: ReturnType<TriageMetricsCollector['getHealthStatus']>;
    industryBreakdown: Record<string, any>;
    trends: {
      processingTime: 'improving' | 'stable' | 'degrading';
      cost: 'improving' | 'stable' | 'degrading';
      accuracy: 'improving' | 'stable' | 'degrading';
    };
  } {
    const health = this.getHealthStatus();

    return {
      summary: this.getMetrics(),
      health,
      industryBreakdown: this.metrics.industryPerformance,
      trends: this.calculateTrends()
    };
  }

  /**
   * Check if circuit breaker should activate
   */
  isCircuitBreakerOpen(): boolean {
    // Check if enough time has passed to reset
    if (this.circuitBreakerState.isOpen &&
        Date.now() - this.circuitBreakerState.lastFailure > this.CIRCUIT_BREAKER_RESET_TIME) {
      this.resetCircuitBreaker();
      return false;
    }

    return this.circuitBreakerState.isOpen;
  }

  /**
   * Get optimization recommendations
   */
  getOptimizationRecommendations(): {
    modelSelection: string;
    promptOptimization: string[];
    cachingStrategy: string[];
    batchProcessing: boolean;
  } {
    const recommendations = {
      modelSelection: 'gpt-4o-mini',
      promptOptimization: [] as string[],
      cachingStrategy: [] as string[],
      batchProcessing: false
    };

    // Model selection based on cost and performance
    if (this.metrics.averageCost > this.performanceThresholds.maxCostPerTriage * 0.8) {
      recommendations.modelSelection = 'gpt-4o-mini';
      recommendations.promptOptimization.push('Use more concise prompts for cost optimization');
    }

    if (this.metrics.averageProcessingTime > this.performanceThresholds.maxProcessingTime * 0.8) {
      recommendations.promptOptimization.push('Reduce prompt complexity to improve speed');
      recommendations.cachingStrategy.push('Cache industry rules and common patterns');
    }

    // Token optimization
    if (this.metrics.averageTokenUsage > this.performanceThresholds.maxTokensPerRequest * 0.8) {
      recommendations.promptOptimization.push('Remove unnecessary context from prompts');
      recommendations.promptOptimization.push('Use structured outputs to reduce completion tokens');
    }

    // Batch processing recommendation
    if (Object.keys(this.metrics.industryPerformance).length > 3) {
      recommendations.batchProcessing = true;
      recommendations.cachingStrategy.push('Implement industry-specific caching');
    }

    return recommendations;
  }

  /**
   * Estimate processing time for new triage
   */
  estimateProcessingTime(
    industryContext: { sector: string },
    domainCount: number,
    dataCompleteness: number
  ): {
    estimatedTime: number;
    confidence: number;
    factors: string[];
  } {
    let baseTime = this.metrics.averageProcessingTime || 45000; // 45s default
    const factors: string[] = [];

    // Industry-specific adjustment
    const industryMetrics = this.metrics.industryPerformance[industryContext.sector];
    if (industryMetrics) {
      baseTime = industryMetrics.averageTime;
      factors.push(`Industry-specific baseline: ${industryContext.sector}`);
    }

    // Domain count adjustment
    const domainMultiplier = 1 + ((domainCount - 3) * 0.1); // 10% per additional domain beyond 3
    baseTime *= domainMultiplier;
    if (domainCount !== 3) {
      factors.push(`Domain count adjustment: ${domainCount} domains`);
    }

    // Data completeness adjustment
    if (dataCompleteness < 0.8) {
      baseTime *= 1.2; // 20% longer for incomplete data
      factors.push('Incomplete data penalty');
    }

    // Circuit breaker adjustment
    if (this.circuitBreakerState.failures > 0) {
      baseTime *= 1.3; // Slower processing when system is stressed
      factors.push('System stress factor');
    }

    const confidence = industryMetrics ? 0.8 : 0.6;

    return {
      estimatedTime: Math.round(baseTime),
      confidence,
      factors
    };
  }

  // Private helper methods

  private updateAverageMetrics(processingMetrics: ProcessingMetrics): void {
    const alpha = 0.1; // Smoothing factor for exponential moving average

    this.metrics.averageProcessingTime =
      (this.metrics.averageProcessingTime * (1 - alpha)) +
      (processingMetrics.processingTime * alpha);

    this.metrics.averageTokenUsage =
      (this.metrics.averageTokenUsage * (1 - alpha)) +
      (processingMetrics.tokenUsage.total * alpha);

    this.metrics.averageCost =
      (this.metrics.averageCost * (1 - alpha)) +
      (processingMetrics.costEstimate * alpha);
  }

  private updateConfidenceDistribution(confidence: number): void {
    const bucket = Math.floor(confidence * 10) / 10; // Round to nearest 0.1
    const bucketKey = bucket.toString();

    this.metrics.confidenceDistribution[bucketKey] =
      (this.metrics.confidenceDistribution[bucketKey] || 0) + 1;
  }

  private updateIndustryMetrics(
    sector: string,
    processingMetrics: ProcessingMetrics,
    confidence: number
  ): void {
    if (!this.metrics.industryPerformance[sector]) {
      this.metrics.industryPerformance[sector] = {
        averageTime: processingMetrics.processingTime,
        averageAccuracy: confidence,
        domainDistribution: {}
      };
    } else {
      const alpha = 0.2; // Industry metrics update more slowly
      const industry = this.metrics.industryPerformance[sector];

      industry.averageTime =
        (industry.averageTime * (1 - alpha)) +
        (processingMetrics.processingTime * alpha);

      industry.averageAccuracy =
        (industry.averageAccuracy * (1 - alpha)) +
        (confidence * alpha);
    }
  }

  private checkPerformanceThresholds(
    processingMetrics: ProcessingMetrics,
    confidence: number
  ): void {
    const violations: string[] = [];

    if (processingMetrics.processingTime > this.performanceThresholds.maxProcessingTime) {
      violations.push(`Processing time exceeded: ${Math.round(processingMetrics.processingTime / 1000)}s`);
    }

    if (processingMetrics.tokenUsage.total > this.performanceThresholds.maxTokensPerRequest) {
      violations.push(`Token usage exceeded: ${processingMetrics.tokenUsage.total}`);
    }

    if (processingMetrics.costEstimate > this.performanceThresholds.maxCostPerTriage) {
      violations.push(`Cost exceeded: £${processingMetrics.costEstimate.toFixed(2)}`);
    }

    if (confidence < this.performanceThresholds.targetConfidence) {
      violations.push(`Confidence below target: ${confidence.toFixed(2)}`);
    }

    if (violations.length > 0) {
      console.warn('Performance threshold violations:', violations);
    }
  }

  private recordFailure(): void {
    this.circuitBreakerState.failures++;
    this.circuitBreakerState.lastFailure = Date.now();

    if (this.circuitBreakerState.failures >= this.performanceThresholds.circuitBreakerThreshold) {
      this.circuitBreakerState.isOpen = true;
      console.error('Circuit breaker activated due to repeated failures');
    }
  }

  private resetCircuitBreaker(): void {
    if (this.circuitBreakerState.failures > 0) {
      this.circuitBreakerState.failures = Math.max(0, this.circuitBreakerState.failures - 1);

      if (this.circuitBreakerState.failures === 0) {
        this.circuitBreakerState.isOpen = false;
        console.log('Circuit breaker reset - system recovered');
      }
    }
  }

  private calculateTrends(): {
    processingTime: 'improving' | 'stable' | 'degrading';
    cost: 'improving' | 'stable' | 'degrading';
    accuracy: 'improving' | 'stable' | 'degrading';
  } {
    // This would typically look at historical data to determine trends
    // For now, return stable trends
    return {
      processingTime: 'stable',
      cost: 'stable',
      accuracy: 'stable'
    };
  }
}