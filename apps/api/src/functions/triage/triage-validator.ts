import {
  Assessment
} from '@scalemap/shared';
import {
  TriageAnalysis,
  DomainScore,
  TriageValidationResult
} from '@scalemap/shared/src/types/triage';

export class TriageValidator {
  private readonly CONFIDENCE_THRESHOLD = 0.7;
  private readonly DATA_COMPLETENESS_THRESHOLD = 0.6;
  private readonly QUALITY_SCORE_THRESHOLD = 0.65;
  private readonly DEFAULT_DOMAINS = ['strategic-alignment', 'operational-excellence', 'people-organization'];

  /**
   * Validate triage results and apply fallback logic if needed
   */
  async validateTriageResults(
    assessment: Assessment,
    triageAnalysis: TriageAnalysis
  ): Promise<{ isValid: boolean; result: TriageAnalysis; fallbackApplied: boolean }> {
    const validation = this.performComprehensiveValidation(assessment, triageAnalysis);

    // Check for validation errors that require fallback
    const criticalErrors = validation.validationErrors.filter(error =>
      error.includes('Insufficient domains') ||
      error.includes('Too many domains') ||
      error.includes('required for') ||
      error.includes('required domain') ||
      error.includes('Invalid confidence') ||
      error.includes('Invalid score') ||
      error.includes('Severity mismatch') ||
      error.includes('Priority level mismatch') ||
      error.includes('unreasonably high') ||
      error.includes('Data completeness')
    );

    if (criticalErrors.length === 0 && triageAnalysis.confidence >= this.CONFIDENCE_THRESHOLD) {
      return {
        isValid: true,
        result: triageAnalysis,
        fallbackApplied: false
      };
    }

    console.warn('Triage validation failed, applying fallback logic:', {
      confidence: triageAnalysis.confidence,
      validationErrors: validation.validationErrors,
      dataCompleteness: validation.dataCompleteness
    });

    // Apply appropriate fallback strategy
    const fallbackResult = await this.applyFallbackStrategy(assessment, triageAnalysis, validation);

    return {
      isValid: true,
      result: fallbackResult,
      fallbackApplied: true
    };
  }

  /**
   * Perform comprehensive validation of triage results
   */
  private performComprehensiveValidation(
    assessment: Assessment,
    triageAnalysis: TriageAnalysis
  ): TriageValidationResult {
    const errors: string[] = [];

    // 1. Validate domain coverage
    const validationResult = this.validateDomainCoverage(triageAnalysis);
    errors.push(...validationResult.errors);

    // 2. Validate score consistency
    const consistencyResult = this.validateScoreConsistency(triageAnalysis.domainScores);
    errors.push(...consistencyResult.errors);

    // 3. Validate industry alignment
    const industryResult = this.validateIndustryAlignment(assessment, triageAnalysis);
    errors.push(...industryResult.errors);

    // 4. Calculate data completeness
    const dataCompleteness = this.calculateDataCompleteness(assessment);

    // 5. Calculate quality score
    const qualityScore = this.calculateQualityScore(assessment, triageAnalysis);

    // 6. Validate confidence score
    const confidenceResult = this.validateConfidenceScore(triageAnalysis);
    errors.push(...confidenceResult.errors);

    // 7. Validate data completeness
    if (dataCompleteness < 0.5) {
      errors.push(`Data completeness (${Math.round(dataCompleteness * 100)}%) below required threshold (50%)`);
    }

    return {
      isValid: errors.length === 0,
      confidence: triageAnalysis.confidence,
      validationErrors: errors,
      fallbackActivated: false,
      dataCompleteness,
      qualityScore
    };
  }

  /**
   * Validate that selected domains provide adequate coverage
   */
  private validateDomainCoverage(triageAnalysis: TriageAnalysis): { errors: string[] } {
    const errors: string[] = [];
    const criticalDomains = triageAnalysis.criticalDomains;

    // Must have at least 3 domains
    if (criticalDomains.length < 3) {
      errors.push(`Insufficient domains selected: ${criticalDomains.length} (minimum: 3)`);
    }

    // Should not exceed 5 domains for cost optimization
    if (criticalDomains.length > 5) {
      errors.push(`Too many domains selected: ${criticalDomains.length} (maximum: 5)`);
    }

    // Check for essential domain combinations
    const hasStrategy = criticalDomains.some(d =>
      ['strategic-alignment', 'change-management'].includes(d)
    );
    const hasOperations = criticalDomains.some(d =>
      ['operational-excellence', 'technology-data', 'supply-chain'].includes(d)
    );
    const hasPeople = criticalDomains.some(d =>
      ['people-organization', 'customer-experience', 'customer-success'].includes(d)
    );

    if (!hasStrategy && !hasOperations && !hasPeople) {
      errors.push('Domain selection lacks balance across strategy, operations, and people dimensions');
    }

    return { errors };
  }

  /**
   * Validate score consistency and logic
   */
  private validateScoreConsistency(domainScores: Record<string, DomainScore>): { errors: string[] } {
    const errors: string[] = [];

    Object.entries(domainScores).forEach(([domain, score]) => {
      // Score should be between 1 and 5
      if (score.score < 1 || score.score > 5) {
        errors.push(`Invalid score for ${domain}: ${score.score} (must be 1-5)`);
      }

      // Confidence should be between 0 and 1
      if (score.confidence < 0 || score.confidence > 1) {
        errors.push(`Invalid confidence for ${domain}: ${score.confidence} (must be 0-1)`);
      }

      // Severity should match score
      const expectedSeverity = this.getExpectedSeverity(score.score);
      if (score.severity !== expectedSeverity) {
        errors.push(`Severity mismatch for ${domain}: expected ${expectedSeverity}, got ${score.severity}`);
      }

      // Priority level should match score
      const expectedPriority = this.getExpectedPriority(score.score);
      if (score.priorityLevel !== expectedPriority) {
        errors.push(`Priority level mismatch for ${domain}: expected ${expectedPriority}, got ${score.priorityLevel}`);
      }
    });

    return { errors };
  }

  /**
   * Validate industry-specific requirements
   */
  private validateIndustryAlignment(
    assessment: Assessment,
    triageAnalysis: TriageAnalysis
  ): { errors: string[] } {
    const errors: string[] = [];
    const industryContext = triageAnalysis.industryContext;

    // Check if required domains for industry are included
    const requiredDomains = this.getRequiredDomainsForIndustry(industryContext.sector);
    const selectedDomains = triageAnalysis.criticalDomains;

    requiredDomains.forEach(required => {
      if (!selectedDomains.includes(required)) {
        errors.push(`Required domain for ${industryContext.sector} industry missing: ${required}`);
      }
    });

    // Validate regulatory compliance requirements
    if (industryContext.regulatoryClassification === 'heavily-regulated') {
      if (!selectedDomains.includes('risk-compliance')) {
        errors.push('Risk-compliance domain required for heavily regulated industries');
      }
    }

    return { errors };
  }

  /**
   * Calculate data completeness score
   */
  private calculateDataCompleteness(assessment: Assessment): number {
    const domains = Object.values(assessment.domainResponses || {});
    if (domains.length === 0) return 0;

    // Use pre-calculated completeness from domain responses if available
    const completenessScores = domains.map(domain => (domain.completeness || 0) / 100);
    return completenessScores.reduce((sum, score) => sum + score, 0) / completenessScores.length;
  }

  /**
   * Calculate quality score based on response patterns
   */
  private calculateQualityScore(assessment: Assessment, triageAnalysis: TriageAnalysis): number {
    const qualityFactors: number[] = [];

    // 1. Response variance (consistent responses indicate better quality)
    const domainScores = Object.values(triageAnalysis.domainScores).map(d => d.score);
    const variance = this.calculateVariance(domainScores);
    const varianceScore = Math.max(0, 1 - (variance / 4)); // Normalize to 0-1
    qualityFactors.push(varianceScore);

    // 2. Confidence distribution (consistent confidence is good)
    const confidenceScores = Object.values(triageAnalysis.domainScores).map(d => d.confidence);
    const avgConfidence = confidenceScores.reduce((sum, c) => sum + c, 0) / confidenceScores.length;
    qualityFactors.push(avgConfidence);

    // 3. Response completeness by domain
    const completenessScores = Object.values(assessment.domainResponses || {}).map(d => d.completeness || 0);
    const avgCompleteness = completenessScores.reduce((sum, c) => sum + c, 0) / Math.max(completenessScores.length, 1);
    const completenessScore = avgCompleteness / 100; // Convert percentage to 0-1
    qualityFactors.push(completenessScore);

    // Weight and combine factors
    const qualityScore = (
      varianceScore * 0.3 +
      Math.min(1.0, avgConfidence) * 0.4 + // Clamp confidence to max 1.0
      completenessScore * 0.3
    );

    // Ensure quality score is always between 0 and 1
    return Math.max(0, Math.min(1.0, qualityScore));
  }

  /**
   * Validate confidence score reasonableness
   */
  private validateConfidenceScore(triageAnalysis: TriageAnalysis): { errors: string[] } {
    const errors: string[] = [];

    if (triageAnalysis.confidence < 0 || triageAnalysis.confidence > 1) {
      errors.push(`Invalid overall confidence: ${triageAnalysis.confidence} (must be 0-1)`);
    }

    // Check if confidence is reasonable given domain confidences
    const domainConfidences = Object.values(triageAnalysis.domainScores).map(d => d.confidence);
    const avgDomainConfidence = domainConfidences.reduce((sum, c) => sum + c, 0) / domainConfidences.length;

    // Overall confidence shouldn't be significantly higher than average domain confidence
    if (triageAnalysis.confidence > avgDomainConfidence + 0.2) {
      errors.push('Overall confidence unreasonably high compared to domain confidences');
    }

    return { errors };
  }

  /**
   * Apply fallback strategy when validation fails
   */
  private async applyFallbackStrategy(
    assessment: Assessment,
    triageAnalysis: TriageAnalysis,
    validation: TriageValidationResult
  ): Promise<TriageAnalysis> {
    console.log('Applying fallback strategy for triage:', {
      originalConfidence: triageAnalysis.confidence,
      dataCompleteness: validation.dataCompleteness,
      qualityScore: validation.qualityScore,
      validationErrors: validation.validationErrors
    });

    // Strategy 1: Fix domain count and industry requirements if validation failed
    const criticalErrors = validation.validationErrors.filter(error =>
      error.includes('Insufficient domains') ||
      error.includes('Too many domains') ||
      error.includes('required for') ||
      error.includes('required domain') ||
      error.includes('Invalid confidence') ||
      error.includes('Invalid score')
    );

    if (criticalErrors.length > 0) {
      return this.applyValidationFallback(assessment, triageAnalysis, criticalErrors);
    }

    // Strategy 2: Use default domain selection if confidence too low
    if (triageAnalysis.confidence < this.CONFIDENCE_THRESHOLD) {
      return this.applyDefaultDomainFallback(assessment, triageAnalysis);
    }

    // Strategy 3: Use industry-specific fallback if data completeness too low
    if (validation.dataCompleteness < this.DATA_COMPLETENESS_THRESHOLD) {
      return this.applyIndustryFallback(assessment, triageAnalysis);
    }

    // Strategy 4: Use rule-based fallback if quality too low
    if (validation.qualityScore < this.QUALITY_SCORE_THRESHOLD) {
      return this.applyRuleBasedFallback(assessment, triageAnalysis);
    }

    // Default: return original with adjusted confidence
    return {
      ...triageAnalysis,
      confidence: Math.max(0.5, triageAnalysis.confidence),
      reasoning: `${triageAnalysis.reasoning} [Fallback applied: confidence adjusted]`
    };
  }

  /**
   * Apply fallback strategy based on specific validation errors
   */
  private applyValidationFallback(
    assessment: Assessment,
    triageAnalysis: TriageAnalysis,
    errors: string[]
  ): TriageAnalysis {
    let finalDomains = [...triageAnalysis.criticalDomains];
    let fallbackReason = '';

    // Fix domain count issues
    const domainCountError = errors.find(e => e.includes('Insufficient domains'));
    if (domainCountError) {
      // Add default domains to reach minimum of 3
      const needed = 3 - finalDomains.length;
      const defaultsToAdd = this.DEFAULT_DOMAINS.filter(d => !finalDomains.includes(d)).slice(0, needed);
      finalDomains = [...finalDomains, ...defaultsToAdd];
      fallbackReason += `Added ${defaultsToAdd.join(', ')} to meet minimum domain count. `;
    }

    const tooManyError = errors.find(e => e.includes('Too many domains'));
    if (tooManyError) {
      // Trim to maximum of 5, keeping highest scoring domains
      const sortedDomains = Object.entries(triageAnalysis.domainScores)
        .filter(([domain]) => finalDomains.includes(domain))
        .sort((a, b) => b[1].score - a[1].score)
        .map(([domain]) => domain);
      finalDomains = sortedDomains.slice(0, 5);
      fallbackReason += `Reduced to top 5 domains by score. `;
    }

    // Fix industry requirement issues
    const industryError = errors.find(e => e.includes('required for') || e.includes('risk-compliance'));
    if (industryError && assessment.industryClassification?.regulatoryClassification === 'heavily-regulated') {
      if (!finalDomains.includes('risk-compliance')) {
        // Remove lowest scoring domain if we're at max capacity, then add risk-compliance
        if (finalDomains.length >= 5) {
          const sortedByScore = Object.entries(triageAnalysis.domainScores)
            .filter(([domain]) => finalDomains.includes(domain))
            .sort((a, b) => a[1].score - b[1].score); // Ascending to get lowest
          if (sortedByScore.length > 0) {
            const lowestDomain = sortedByScore[0]?.[0];
            if (lowestDomain) {
              finalDomains = finalDomains.filter(d => d !== lowestDomain);
            }
          }
        }
        finalDomains.push('risk-compliance');
        fallbackReason += `Added risk-compliance for heavily regulated industry. `;
      }
    }

    // Ensure we still meet minimum after adjustments
    if (finalDomains.length < 3) {
      const needed = 3 - finalDomains.length;
      const additionalDefaults = this.DEFAULT_DOMAINS.filter(d => !finalDomains.includes(d)).slice(0, needed);
      finalDomains = [...finalDomains, ...additionalDefaults];
      fallbackReason += `Added ${additionalDefaults.join(', ')} to ensure minimum count. `;
    }

    return {
      ...triageAnalysis,
      criticalDomains: finalDomains,
      confidence: 0.65, // Conservative confidence for validation fallback
      reasoning: `${triageAnalysis.reasoning} [Validation fallback applied: ${fallbackReason.trim()}]`
    };
  }

  /**
   * Apply default domain selection fallback
   */
  private applyDefaultDomainFallback(
    assessment: Assessment,
    triageAnalysis: TriageAnalysis
  ): TriageAnalysis {
    // Use pure default domains without industry-specific additions
    const finalDomains = [...this.DEFAULT_DOMAINS];

    return {
      ...triageAnalysis,
      criticalDomains: finalDomains,
      confidence: 0.6, // Conservative confidence for fallback
      reasoning: `Default domain selection applied due to low confidence (${triageAnalysis.confidence.toFixed(2)}). Selected core operational domains: ${finalDomains.join(', ')}.`
    };
  }

  /**
   * Apply industry-specific fallback
   */
  private applyIndustryFallback(
    assessment: Assessment,
    triageAnalysis: TriageAnalysis
  ): TriageAnalysis {
    const industryDomains = this.getIndustrySpecificDomains(
      assessment.industryClassification?.sector || 'unknown'
    );

    return {
      ...triageAnalysis,
      criticalDomains: industryDomains.slice(0, 5),
      confidence: Math.max(0.65, triageAnalysis.confidence),
      reasoning: `Industry-specific domain selection applied for ${assessment.industryClassification?.sector || 'general'} sector due to insufficient data completeness.`
    };
  }

  /**
   * Apply rule-based fallback using simple scoring
   */
  private applyRuleBasedFallback(
    assessment: Assessment,
    triageAnalysis: TriageAnalysis
  ): TriageAnalysis {
    // Use simple rule-based selection: top scoring domains
    const sortedDomains = Object.entries(triageAnalysis.domainScores)
      .sort((a, b) => b[1].score - a[1].score)
      .slice(0, 5)
      .map(([domain]) => domain);

    return {
      ...triageAnalysis,
      criticalDomains: sortedDomains,
      confidence: Math.max(0.55, triageAnalysis.confidence * 0.9),
      reasoning: `Rule-based domain selection applied using highest scoring domains due to low data quality. Selected domains based on assessment scores.`
    };
  }

  // Helper methods

  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return variance;
  }

  private getExpectedSeverity(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= 4.5) return 'critical';
    if (score >= 4.0) return 'high';
    if (score >= 3.5) return 'medium'; // Adjusted threshold
    return 'low';
  }

  private getExpectedPriority(score: number): 'HEALTHY' | 'MODERATE' | 'HIGH' | 'CRITICAL' {
    if (score >= 4.5) return 'CRITICAL';
    if (score >= 4.0) return 'HIGH';
    if (score >= 3.5) return 'MODERATE';
    return 'HEALTHY';
  }

  private getRequiredDomainsForIndustry(sector: string): string[] {
    const industryRequirements: Record<string, string[]> = {
      'financial-services': ['risk-compliance', 'financial-management'],
      'healthcare': ['risk-compliance', 'operational-excellence'],
      'technology': ['technology-data'],
      'manufacturing': ['supply-chain', 'operational-excellence'],
      'retail': ['customer-experience', 'supply-chain']
    };

    return industryRequirements[sector] || [];
  }

  private getTopIndustryDomain(sector: string): string | null {
    const industryDomains: Record<string, string> = {
      'financial-services': 'financial-management',
      'healthcare': 'risk-compliance',
      'technology': 'technology-data',
      'manufacturing': 'operational-excellence',
      'retail': 'customer-experience'
    };

    return industryDomains[sector] || null;
  }

  private getIndustrySpecificDomains(sector: string): string[] {
    const industryDomains: Record<string, string[]> = {
      'financial-services': ['risk-compliance', 'financial-management', 'operational-excellence', 'strategic-alignment'],
      'healthcare': ['risk-compliance', 'operational-excellence', 'people-organization', 'technology-data'],
      'technology': ['technology-data', 'revenue-engine', 'people-organization', 'strategic-alignment'],
      'manufacturing': ['operational-excellence', 'supply-chain', 'people-organization', 'strategic-alignment'],
      'retail': ['customer-experience', 'revenue-engine', 'supply-chain', 'customer-success'],
      'unknown': [...this.DEFAULT_DOMAINS, 'revenue-engine']
    };

    return industryDomains[sector] || industryDomains['unknown'] || this.DEFAULT_DOMAINS;
  }
}