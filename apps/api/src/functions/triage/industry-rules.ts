import { IndustryClassification } from '@scalemap/shared';
import { IndustryContext, TriageConfiguration } from '@scalemap/shared/src/types/triage';

export interface IndustryRule {
  sector: string;
  regulatoryClassification: 'lightly-regulated' | 'moderately-regulated' | 'heavily-regulated';
  requiredDomains: string[];
  preferredDomains: string[];
  excludedDomains: string[];
  weightingMultipliers: Record<string, number>;
  specialConsiderations: string[];
  benchmarks: Record<string, number>;
}

export class IndustryRulesEngine {
  private static readonly INDUSTRY_RULES: Record<string, IndustryRule> = {
    'financial-services': {
      sector: 'financial-services',
      regulatoryClassification: 'heavily-regulated',
      requiredDomains: ['risk-compliance', 'financial-management'],
      preferredDomains: ['operational-excellence', 'strategic-alignment', 'technology-data'],
      excludedDomains: [],
      weightingMultipliers: {
        'risk-compliance': 1.5,
        'financial-management': 1.3,
        'operational-excellence': 1.2,
        'technology-data': 1.1,
        'strategic-alignment': 1.1
      },
      specialConsiderations: [
        'Regulatory compliance is mandatory',
        'Financial risk management takes precedence',
        'Operational resilience is critical',
        'Customer data protection is paramount'
      ],
      benchmarks: {
        'risk-compliance': 4.2,
        'financial-management': 4.0,
        'operational-excellence': 3.8,
        'strategic-alignment': 3.5
      }
    },
    'healthcare': {
      sector: 'healthcare',
      regulatoryClassification: 'heavily-regulated',
      requiredDomains: ['risk-compliance'],
      preferredDomains: ['operational-excellence', 'people-organization', 'technology-data', 'customer-experience'],
      excludedDomains: [],
      weightingMultipliers: {
        'risk-compliance': 1.4,
        'operational-excellence': 1.3,
        'people-organization': 1.2,
        'technology-data': 1.2,
        'customer-experience': 1.1
      },
      specialConsiderations: [
        'Patient safety is paramount',
        'HIPAA compliance required',
        'Clinical workflow efficiency critical',
        'Staff training and retention essential'
      ],
      benchmarks: {
        'risk-compliance': 4.3,
        'operational-excellence': 4.0,
        'people-organization': 3.9,
        'customer-experience': 3.7
      }
    },
    'technology': {
      sector: 'technology',
      regulatoryClassification: 'lightly-regulated',
      requiredDomains: [],
      preferredDomains: ['technology-data', 'revenue-engine', 'people-organization', 'strategic-alignment'],
      excludedDomains: ['supply-chain'], // Less relevant for pure software companies
      weightingMultipliers: {
        'technology-data': 1.4,
        'revenue-engine': 1.3,
        'people-organization': 1.2,
        'strategic-alignment': 1.2,
        'customer-experience': 1.1
      },
      specialConsiderations: [
        'Technical scalability is critical',
        'Rapid innovation cycles',
        'Talent retention challenges',
        'Product-market fit validation'
      ],
      benchmarks: {
        'technology-data': 4.1,
        'revenue-engine': 3.9,
        'people-organization': 3.7,
        'strategic-alignment': 3.8
      }
    },
    'manufacturing': {
      sector: 'manufacturing',
      regulatoryClassification: 'moderately-regulated',
      requiredDomains: ['supply-chain', 'operational-excellence'],
      preferredDomains: ['people-organization', 'risk-compliance', 'strategic-alignment'],
      excludedDomains: [],
      weightingMultipliers: {
        'supply-chain': 1.5,
        'operational-excellence': 1.4,
        'people-organization': 1.2,
        'risk-compliance': 1.1,
        'strategic-alignment': 1.1
      },
      specialConsiderations: [
        'Supply chain resilience critical',
        'Quality control and safety',
        'Equipment maintenance and efficiency',
        'Workforce safety and training'
      ],
      benchmarks: {
        'supply-chain': 4.0,
        'operational-excellence': 4.2,
        'people-organization': 3.6,
        'risk-compliance': 3.8
      }
    },
    'retail': {
      sector: 'retail',
      regulatoryClassification: 'lightly-regulated',
      requiredDomains: ['customer-experience'],
      preferredDomains: ['revenue-engine', 'supply-chain', 'customer-success', 'operational-excellence'],
      excludedDomains: [],
      weightingMultipliers: {
        'customer-experience': 1.4,
        'revenue-engine': 1.3,
        'supply-chain': 1.2,
        'customer-success': 1.2,
        'operational-excellence': 1.1
      },
      specialConsiderations: [
        'Customer experience drives retention',
        'Inventory management critical',
        'Omnichannel consistency',
        'Seasonal demand fluctuations'
      ],
      benchmarks: {
        'customer-experience': 4.0,
        'revenue-engine': 3.8,
        'supply-chain': 3.9,
        'customer-success': 3.7
      }
    },
    'professional-services': {
      sector: 'professional-services',
      regulatoryClassification: 'moderately-regulated',
      requiredDomains: ['people-organization'],
      preferredDomains: ['customer-success', 'strategic-alignment', 'operational-excellence', 'revenue-engine'],
      excludedDomains: ['supply-chain', 'technology-data'],
      weightingMultipliers: {
        'people-organization': 1.5,
        'customer-success': 1.3,
        'strategic-alignment': 1.2,
        'operational-excellence': 1.2,
        'revenue-engine': 1.1
      },
      specialConsiderations: [
        'Talent is the primary asset',
        'Client relationship management',
        'Project delivery excellence',
        'Knowledge management and retention'
      ],
      benchmarks: {
        'people-organization': 4.1,
        'customer-success': 3.9,
        'strategic-alignment': 3.7,
        'operational-excellence': 3.6
      }
    }
  };

  /**
   * Get industry-specific rules and context
   */
  static getIndustryContext(classification?: IndustryClassification): IndustryContext {
    if (!classification) {
      return this.getDefaultContext();
    }

    const industryRule = this.INDUSTRY_RULES[classification.sector];
    if (!industryRule) {
      return this.getDefaultContext();
    }

    return {
      sector: classification.sector,
      regulatoryClassification: industryRule.regulatoryClassification,
      specificRules: industryRule.requiredDomains,
      benchmarks: industryRule.benchmarks,
      weightingMultipliers: industryRule.weightingMultipliers
    };
  }

  /**
   * Get industry-specific triage configuration
   */
  static getIndustryConfiguration(sector: string): Partial<TriageConfiguration> {
    const industryRule = this.INDUSTRY_RULES[sector];
    if (!industryRule) {
      return {};
    }

    return {
      industryRules: {
        [sector]: {
          weightingMultipliers: industryRule.weightingMultipliers,
          requiredDomains: industryRule.requiredDomains,
          excludedDomains: industryRule.excludedDomains
        }
      },
      thresholds: this.getIndustryThresholds(industryRule.regulatoryClassification)
    };
  }

  /**
   * Apply industry-specific domain weighting
   */
  static applyIndustryWeighting(
    domainScores: Record<string, number>,
    sector: string
  ): Record<string, number> {
    const industryRule = this.INDUSTRY_RULES[sector];
    if (!industryRule) {
      return domainScores;
    }

    const weightedScores: Record<string, number> = {};

    Object.entries(domainScores).forEach(([domain, score]) => {
      const multiplier = industryRule.weightingMultipliers[domain] || 1.0;
      weightedScores[domain] = Math.min(5.0, score * multiplier);
    });

    return weightedScores;
  }

  /**
   * Validate domain selection against industry rules
   */
  static validateIndustryCompliance(
    selectedDomains: string[],
    sector: string
  ): { isCompliant: boolean; violations: string[]; recommendations: string[] } {
    const industryRule = this.INDUSTRY_RULES[sector];
    if (!industryRule) {
      return { isCompliant: true, violations: [], recommendations: [] };
    }

    const violations: string[] = [];
    const recommendations: string[] = [];

    // Check required domains
    industryRule.requiredDomains.forEach(required => {
      if (!selectedDomains.includes(required)) {
        violations.push(`Missing required domain for ${sector}: ${required}`);
      }
    });

    // Check excluded domains
    industryRule.excludedDomains.forEach(excluded => {
      if (selectedDomains.includes(excluded)) {
        violations.push(`Should not include ${excluded} domain for ${sector} industry`);
      }
    });

    // Generate recommendations for preferred domains
    industryRule.preferredDomains.forEach(preferred => {
      if (!selectedDomains.includes(preferred) && selectedDomains.length < 5) {
        recommendations.push(`Consider including ${preferred} domain for ${sector} optimization`);
      }
    });

    return {
      isCompliant: violations.length === 0,
      violations,
      recommendations
    };
  }

  /**
   * Get industry benchmarks for comparison
   */
  static getIndustryBenchmarks(sector: string): Record<string, number> {
    const industryRule = this.INDUSTRY_RULES[sector];
    return industryRule?.benchmarks || {};
  }

  /**
   * Get industry-specific special considerations
   */
  static getSpecialConsiderations(sector: string): string[] {
    const industryRule = this.INDUSTRY_RULES[sector];
    return industryRule?.specialConsiderations || [];
  }

  /**
   * Determine regulatory impact on triage
   */
  static getRegulatoryImpact(
    regulatoryClassification: 'lightly-regulated' | 'moderately-regulated' | 'heavily-regulated'
  ): {
    complianceWeight: number;
    riskTolerance: number;
    auditRequirements: string[];
  } {
    switch (regulatoryClassification) {
      case 'heavily-regulated':
        return {
          complianceWeight: 1.5,
          riskTolerance: 0.2,
          auditRequirements: [
            'Complete audit trail required',
            'Regular compliance reviews',
            'External validation necessary',
            'Documentation standards strict'
          ]
        };
      case 'moderately-regulated':
        return {
          complianceWeight: 1.2,
          riskTolerance: 0.4,
          auditRequirements: [
            'Standard audit trail',
            'Periodic compliance checks',
            'Internal validation sufficient'
          ]
        };
      default:
        return {
          complianceWeight: 1.0,
          riskTolerance: 0.6,
          auditRequirements: [
            'Basic audit trail',
            'Self-assessment acceptable'
          ]
        };
    }
  }

  /**
   * Get company stage adjustments
   */
  static getStageAdjustments(
    stage: 'startup' | 'growth' | 'mature'
  ): {
    focusDomains: string[];
    weightingAdjustments: Record<string, number>;
    priorityShifts: Record<string, number>;
  } {
    switch (stage) {
      case 'startup':
        return {
          focusDomains: ['strategic-alignment', 'revenue-engine', 'people-organization'],
          weightingAdjustments: {
            'strategic-alignment': 1.3,
            'revenue-engine': 1.4,
            'people-organization': 1.2,
            'operational-excellence': 0.9,
            'risk-compliance': 0.8
          },
          priorityShifts: {
            'product-market-fit': 1.5,
            'cash-flow': 1.4,
            'team-building': 1.3
          }
        };
      case 'growth':
        return {
          focusDomains: ['operational-excellence', 'people-organization', 'strategic-alignment'],
          weightingAdjustments: {
            'operational-excellence': 1.4,
            'people-organization': 1.3,
            'strategic-alignment': 1.2,
            'revenue-engine': 1.1,
            'risk-compliance': 1.0
          },
          priorityShifts: {
            'scaling': 1.4,
            'process-optimization': 1.3,
            'team-expansion': 1.2
          }
        };
      default: // mature
        return {
          focusDomains: ['strategic-alignment', 'operational-excellence', 'risk-compliance'],
          weightingAdjustments: {
            'strategic-alignment': 1.3,
            'operational-excellence': 1.2,
            'risk-compliance': 1.2,
            'change-management': 1.1,
            'revenue-engine': 1.0
          },
          priorityShifts: {
            'optimization': 1.3,
            'innovation': 1.2,
            'risk-management': 1.2
          }
        };
    }
  }

  /**
   * Generate industry-specific reasoning
   */
  static generateIndustryReasoning(
    sector: string,
    selectedDomains: string[],
    regulatoryClassification: string
  ): string {
    const industryRule = this.INDUSTRY_RULES[sector];
    if (!industryRule) {
      return `Standard domain selection for general business analysis: ${selectedDomains.join(', ')}.`;
    }

    const specialConsiderations = industryRule.specialConsiderations.slice(0, 2).join(' and ');
    const requiredNote = industryRule.requiredDomains.length > 0
      ? ` Required domains (${industryRule.requiredDomains.join(', ')}) included per industry standards.`
      : '';

    return `Industry-specific analysis for ${sector} sector (${regulatoryClassification}). Key considerations: ${specialConsiderations}. Selected domains: ${selectedDomains.join(', ')}.${requiredNote}`;
  }

  // Private helper methods

  private static getDefaultContext(): IndustryContext {
    return {
      sector: 'unknown',
      regulatoryClassification: 'lightly-regulated',
      specificRules: [],
      benchmarks: {},
      weightingMultipliers: {}
    };
  }

  private static getIndustryThresholds(
    regulatoryClassification: 'lightly-regulated' | 'moderately-regulated' | 'heavily-regulated'
  ): { domainSelection: number; confidenceMinimum: number; dataCompletenessRequired: number } {
    switch (regulatoryClassification) {
      case 'heavily-regulated':
        return {
          domainSelection: 3.8, // Lower threshold due to higher stakes
          confidenceMinimum: 0.8, // Higher confidence required
          dataCompletenessRequired: 0.75 // More data required
        };
      case 'moderately-regulated':
        return {
          domainSelection: 4.0,
          confidenceMinimum: 0.7,
          dataCompletenessRequired: 0.65
        };
      default:
        return {
          domainSelection: 4.2,
          confidenceMinimum: 0.6,
          dataCompletenessRequired: 0.6
        };
    }
  }
}