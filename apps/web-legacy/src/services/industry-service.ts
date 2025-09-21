import {
  IndustryClassification,
  DomainName,
  Question,
  DomainTemplate
} from '@/types';

export interface IndustryRules {
  regulatoryRequirements: string[];
  additionalDomains: DomainName[];
  skipDomains: DomainName[];
  questionFilters: Record<DomainName, {
    includeQuestions: string[];
    excludeQuestions: string[];
    requiredQuestions: string[];
  }>;
  validationRules: Record<string, any>;
  scoringAdjustments: Record<DomainName, number>;
}

export interface CompanyProfileIndicators {
  hasInternationalOperations: boolean;
  hasPhysicalProducts: boolean;
  hasChannelSales: boolean;
  isRapidGrowth: boolean;
  hasComplexSupplyChain: boolean;
  requiresRegulatorycompliance: boolean;
  usesSubscriptionModel: boolean;
  hasHighTouchCustomers: boolean;
}

export class IndustryService {
  private static instance: IndustryService;
  private industryRules: Map<string, IndustryRules> = new Map();

  static getInstance(): IndustryService {
    if (!IndustryService.instance) {
      IndustryService.instance = new IndustryService();
    }
    return IndustryService.instance;
  }

  constructor() {
    this.loadIndustryRules();
  }

  private loadIndustryRules(): void {
    // Financial Services (Heavily Regulated)
    this.industryRules.set('financial-services', {
      regulatoryRequirements: ['SOX', 'Basel III', 'MiFID II', 'PCI DSS', 'GDPR'],
      additionalDomains: [],
      skipDomains: ['supply-chain'],
      questionFilters: {
        'risk-compliance': {
          includeQuestions: ['9.7', '9.8', 'reg-capital', 'audit-controls'],
          excludeQuestions: [],
          requiredQuestions: ['9.1', '9.2', '9.3', '9.4', '9.5', '9.6', '9.7', '9.8']
        },
        'financial-management': {
          includeQuestions: ['2.9', 'regulatory-capital'],
          excludeQuestions: [],
          requiredQuestions: ['2.1', '2.2', '2.3', '2.4', '2.5', '2.6', '2.7', '2.8', '2.9']
        },
        'strategic-alignment': {
          includeQuestions: ['1.7', '1.8'],
          excludeQuestions: [],
          requiredQuestions: ['1.1', '1.2', '1.3', '1.4', '1.5', '1.6', '1.7']
        }
      },
      validationRules: {
        requiresAuditTrail: true,
        dataRetentionMinimum: '7 years',
        complianceReporting: 'monthly'
      },
      scoringAdjustments: {
        'risk-compliance': 1.3,
        'financial-management': 1.2,
        'technology-data': 1.1
      }
    });

    // Healthcare (Heavily Regulated)
    this.industryRules.set('healthcare', {
      regulatoryRequirements: ['HIPAA', 'FDA', 'GDPR', 'SOX'],
      additionalDomains: [],
      skipDomains: ['supply-chain'],
      questionFilters: {
        'risk-compliance': {
          includeQuestions: ['9.7', '9.8', 'hipaa-compliance', 'patient-data'],
          excludeQuestions: [],
          requiredQuestions: ['9.1', '9.2', '9.3', '9.4', '9.5', '9.6', '9.7', '9.8']
        },
        'technology-data': {
          includeQuestions: ['6.8', 'data-security', 'patient-privacy'],
          excludeQuestions: [],
          requiredQuestions: ['6.1', '6.2', '6.3', '6.4', '6.5', '6.6', '6.7', '6.8']
        },
        'customer-experience': {
          includeQuestions: ['patient-outcomes', 'care-quality'],
          excludeQuestions: [],
          requiredQuestions: ['7.1', '7.2', '7.3', '7.4', '7.5', '7.6', '7.7']
        }
      },
      validationRules: {
        requiresHIPAACompliance: true,
        dataEncryption: 'required',
        patientConsent: 'explicit'
      },
      scoringAdjustments: {
        'risk-compliance': 1.4,
        'technology-data': 1.2,
        'customer-experience': 1.1
      }
    });

    // Technology/SaaS
    this.industryRules.set('technology', {
      regulatoryRequirements: ['GDPR', 'SOC 2', 'ISO 27001'],
      additionalDomains: [],
      skipDomains: ['supply-chain'],
      questionFilters: {
        'technology-data': {
          includeQuestions: ['6.8', 'product-architecture', 'scalability'],
          excludeQuestions: [],
          requiredQuestions: ['6.1', '6.2', '6.3', '6.4', '6.5', '6.6', '6.7', '6.8']
        },
        'customer-success': {
          includeQuestions: ['11.7', '11.8', 'churn-prediction', 'onboarding'],
          excludeQuestions: [],
          requiredQuestions: ['11.1', '11.2', '11.3', '11.4', '11.5', '11.6', '11.7', '11.8']
        },
        'partnerships': {
          includeQuestions: ['10.7', 'integration-partnerships'],
          excludeQuestions: [],
          requiredQuestions: ['10.1', '10.2', '10.3', '10.4', '10.5', '10.6', '10.7']
        }
      },
      validationRules: {
        requiresSOC2: true,
        dataProcessing: 'GDPR-compliant',
        uptimeRequirement: '99.9%'
      },
      scoringAdjustments: {
        'technology-data': 1.3,
        'customer-success': 1.2,
        'revenue-engine': 1.1
      }
    });

    // Manufacturing
    this.industryRules.set('manufacturing', {
      regulatoryRequirements: ['ISO 9001', 'Environmental regulations', 'Safety standards'],
      additionalDomains: [],
      skipDomains: [],
      questionFilters: {
        'supply-chain': {
          includeQuestions: ['8.6', 'production-planning', 'quality-control'],
          excludeQuestions: [],
          requiredQuestions: ['8.1', '8.2', '8.3', '8.4', '8.5', '8.6']
        },
        'operational-excellence': {
          includeQuestions: ['4.8', 'lean-manufacturing', 'waste-reduction'],
          excludeQuestions: [],
          requiredQuestions: ['4.1', '4.2', '4.3', '4.4', '4.5', '4.6', '4.7', '4.8']
        },
        'risk-compliance': {
          includeQuestions: ['safety-compliance', 'environmental-impact'],
          excludeQuestions: [],
          requiredQuestions: ['9.1', '9.2', '9.3', '9.4', '9.5', '9.6']
        }
      },
      validationRules: {
        requiresISO9001: true,
        safetyCompliance: 'mandatory',
        environmentalReporting: 'required'
      },
      scoringAdjustments: {
        'supply-chain': 1.4,
        'operational-excellence': 1.3,
        'risk-compliance': 1.1
      }
    });

    // Retail
    this.industryRules.set('retail', {
      regulatoryRequirements: ['PCI DSS', 'Consumer protection', 'GDPR'],
      additionalDomains: [],
      skipDomains: [],
      questionFilters: {
        'customer-experience': {
          includeQuestions: ['7.8', 'brand-experience', 'omnichannel'],
          excludeQuestions: [],
          requiredQuestions: ['7.1', '7.2', '7.3', '7.4', '7.5', '7.6', '7.7', '7.8']
        },
        'supply-chain': {
          includeQuestions: ['inventory-management', 'supplier-relationships'],
          excludeQuestions: [],
          requiredQuestions: ['8.1', '8.2', '8.3', '8.4', '8.5']
        },
        'technology-data': {
          includeQuestions: ['pos-systems', 'inventory-systems'],
          excludeQuestions: [],
          requiredQuestions: ['6.1', '6.2', '6.3', '6.4', '6.5', '6.6', '6.7']
        }
      },
      validationRules: {
        requiresPCIDSS: true,
        inventoryTracking: 'real-time',
        customerDataProtection: 'GDPR-compliant'
      },
      scoringAdjustments: {
        'customer-experience': 1.3,
        'supply-chain': 1.2,
        'revenue-engine': 1.2
      }
    });
  }

  getIndustryRules(sector: string): IndustryRules | null {
    return this.industryRules.get(sector) || null;
  }

  getApplicableDomains(industryClassification: IndustryClassification): DomainName[] {
    const rules = this.getIndustryRules(industryClassification.sector);

    const baseDomains: DomainName[] = [
      'strategic-alignment',
      'financial-management',
      'revenue-engine',
      'operational-excellence',
      'people-organization',
      'technology-data',
      'customer-experience',
      'risk-compliance',
      'partnerships',
      'customer-success',
      'change-management'
    ];

    // Add supply-chain for relevant industries
    if (this.requiresSupplyChain(industryClassification)) {
      baseDomains.push('supply-chain');
    }

    if (!rules) {
      return baseDomains;
    }

    // Remove skip domains and add additional domains
    const applicableDomains = baseDomains
      .filter(domain => !rules.skipDomains.includes(domain))
      .concat(rules.additionalDomains);

    return [...new Set(applicableDomains)]; // Remove duplicates
  }

  private requiresSupplyChain(industryClassification: IndustryClassification): boolean {
    const physicalProductSectors = ['manufacturing', 'retail'];
    const physicalProductModels = ['manufacturing'];

    return physicalProductSectors.includes(industryClassification.sector) ||
           physicalProductModels.includes(industryClassification.businessModel);
  }

  getIndustrySpecificQuestions(
    domain: DomainName,
    industryClassification: IndustryClassification
  ): string[] {
    const rules = this.getIndustryRules(industryClassification.sector);
    if (!rules || !rules.questionFilters[domain]) {
      return [];
    }

    return rules.questionFilters[domain].includeQuestions || [];
  }

  getRequiredQuestions(
    domain: DomainName,
    industryClassification: IndustryClassification
  ): string[] {
    const rules = this.getIndustryRules(industryClassification.sector);
    if (!rules || !rules.questionFilters[domain]) {
      // Return default required questions
      return this.getDefaultRequiredQuestions(domain);
    }

    return rules.questionFilters[domain].requiredQuestions ||
           this.getDefaultRequiredQuestions(domain);
  }

  private getDefaultRequiredQuestions(domain: DomainName): string[] {
    const defaultRequired: Record<DomainName, string[]> = {
      'strategic-alignment': ['1.1', '1.2', '1.3', '1.4', '1.5', '1.6'],
      'financial-management': ['2.1', '2.2', '2.3', '2.4', '2.5', '2.6', '2.7'],
      'revenue-engine': ['3.1', '3.2', '3.3', '3.4', '3.5', '3.6', '3.7'],
      'operational-excellence': ['4.1', '4.2', '4.3', '4.4', '4.5', '4.6', '4.7'],
      'people-organization': ['5.1', '5.2', '5.3', '5.4', '5.5', '5.6', '5.7'],
      'technology-data': ['6.1', '6.2', '6.3', '6.4', '6.5', '6.6', '6.7'],
      'customer-experience': ['7.1', '7.2', '7.3', '7.4', '7.5', '7.6', '7.7'],
      'supply-chain': ['8.1', '8.2', '8.3', '8.4', '8.5'],
      'risk-compliance': ['9.1', '9.2', '9.3', '9.4', '9.5', '9.6'],
      'partnerships': ['10.1', '10.2', '10.3', '10.4', '10.5', '10.6'],
      'customer-success': ['11.1', '11.2', '11.3', '11.4', '11.5', '11.6'],
      'change-management': ['12.1', '12.2', '12.3', '12.4', '12.5', '12.6', '12.7']
    };

    return defaultRequired[domain] || [];
  }

  detectCompanyProfile(
    industryClassification: IndustryClassification,
    responses: Record<string, any>
  ): CompanyProfileIndicators {
    const indicators: CompanyProfileIndicators = {
      hasInternationalOperations: false,
      hasPhysicalProducts: false,
      hasChannelSales: false,
      isRapidGrowth: false,
      hasComplexSupplyChain: false,
      requiresRegulatorycompliance: false,
      usesSubscriptionModel: false,
      hasHighTouchCustomers: false
    };

    // Detect based on industry classification
    const physicalProductSectors = ['manufacturing', 'retail'];
    const physicalProductModels = ['manufacturing'];
    indicators.hasPhysicalProducts =
      physicalProductSectors.includes(industryClassification.sector) ||
      physicalProductModels.includes(industryClassification.businessModel);

    const regulatedSectors = ['financial-services', 'healthcare'];
    indicators.requiresRegulatorycompliance =
      regulatedSectors.includes(industryClassification.sector) ||
      industryClassification.regulatoryClassification !== 'non-regulated';

    const subscriptionModels = ['b2b-saas'];
    indicators.usesSubscriptionModel =
      subscriptionModels.includes(industryClassification.businessModel);

    const highTouchModels = ['b2b-saas', 'services'];
    indicators.hasHighTouchCustomers =
      highTouchModels.includes(industryClassification.businessModel);

    // Detect from company size
    if (industryClassification.employeeCount > 500) {
      indicators.hasComplexSupplyChain = indicators.hasPhysicalProducts;
      indicators.hasChannelSales = true; // Likely for large companies
    }

    // Detect from company stage
    if (industryClassification.companyStage === 'growth') {
      indicators.isRapidGrowth = true;
    }

    // Detect from responses (if available)
    if (responses) {
      // Look for international operations indicators
      const revenueEngineResponses = responses['revenue-engine']?.questions || {};
      if (revenueEngineResponses['3.4']?.value === 'International markets') {
        indicators.hasInternationalOperations = true;
      }

      // Look for supply chain complexity
      const supplychainResponses = responses['supply-chain']?.questions || {};
      if (supplychainResponses['8.6']) { // International supply chain question
        indicators.hasInternationalOperations = true;
        indicators.hasComplexSupplyChain = true;
      }

      // Look for channel sales indicators
      const partnershipResponses = responses['partnerships']?.questions || {};
      if (partnershipResponses['10.7']) { // Channel partner enablement question
        indicators.hasChannelSales = true;
      }
    }

    return indicators;
  }

  getScoringAdjustments(
    domain: DomainName,
    industryClassification: IndustryClassification
  ): number {
    const rules = this.getIndustryRules(industryClassification.sector);
    if (!rules || !rules.scoringAdjustments[domain]) {
      return 1.0; // No adjustment
    }

    return rules.scoringAdjustments[domain];
  }

  validateIndustrySpecificRequirements(
    industryClassification: IndustryClassification,
    domainResponses: Record<string, any>
  ): { isValid: boolean; violations: string[] } {
    const rules = this.getIndustryRules(industryClassification.sector);
    const violations: string[] = [];

    if (!rules) {
      return { isValid: true, violations };
    }

    // Check validation rules
    Object.entries(rules.validationRules).forEach(([rule, requirement]) => {
      switch (rule) {
        case 'requiresSOC2':
          if (requirement && !this.hasSOC2Compliance(domainResponses)) {
            violations.push('SOC 2 compliance evidence required for technology sector');
          }
          break;

        case 'requiresHIPAACompliance':
          if (requirement && !this.hasHIPAACompliance(domainResponses)) {
            violations.push('HIPAA compliance evidence required for healthcare sector');
          }
          break;

        case 'requiresPCIDSS':
          if (requirement && !this.hasPCIDSSCompliance(domainResponses)) {
            violations.push('PCI DSS compliance required for retail payment processing');
          }
          break;

        case 'requiresISO9001':
          if (requirement && !this.hasISO9001Compliance(domainResponses)) {
            violations.push('ISO 9001 quality management certification required for manufacturing');
          }
          break;
      }
    });

    return {
      isValid: violations.length === 0,
      violations
    };
  }

  private hasSOC2Compliance(domainResponses: Record<string, any>): boolean {
    const techResponses = domainResponses['technology-data']?.questions || {};
    const riskResponses = domainResponses['risk-compliance']?.questions || {};

    // Check if security practices are in place
    return (techResponses['6.4']?.value >= 3) || // Good security posture
           (riskResponses['9.5']?.value >= 3);   // Good cybersecurity
  }

  private hasHIPAACompliance(domainResponses: Record<string, any>): boolean {
    const techResponses = domainResponses['technology-data']?.questions || {};
    const riskResponses = domainResponses['risk-compliance']?.questions || {};

    // Check for healthcare-specific security measures
    return (techResponses['6.4']?.value >= 4) && // Strong security
           (riskResponses['9.2']?.value >= 4);    // Strong compliance management
  }

  private hasPCIDSSCompliance(domainResponses: Record<string, any>): boolean {
    const techResponses = domainResponses['technology-data']?.questions || {};
    const riskResponses = domainResponses['risk-compliance']?.questions || {};

    // Check for payment security measures
    return (techResponses['6.4']?.value >= 3) && // Adequate security
           (riskResponses['9.5']?.value >= 3);    // Adequate cybersecurity
  }

  private hasISO9001Compliance(domainResponses: Record<string, any>): boolean {
    const opExcellenceResponses = domainResponses['operational-excellence']?.questions || {};

    // Check for quality management systems
    return (opExcellenceResponses['4.1']?.value >= 3) && // Process documentation
           (opExcellenceResponses['4.3']?.value >= 3);    // Quality control
  }

  generateIndustryReport(
    industryClassification: IndustryClassification,
    companyProfile: CompanyProfileIndicators
  ): {
    applicableDomains: DomainName[];
    keyFocusAreas: string[];
    regulatoryRequirements: string[];
    recommendedPriorities: DomainName[];
  } {
    const rules = this.getIndustryRules(industryClassification.sector);
    const applicableDomains = this.getApplicableDomains(industryClassification);

    const keyFocusAreas = this.getKeyFocusAreas(industryClassification, companyProfile);
    const regulatoryRequirements = rules?.regulatoryRequirements || [];
    const recommendedPriorities = this.getRecommendedPriorities(industryClassification, companyProfile);

    return {
      applicableDomains,
      keyFocusAreas,
      regulatoryRequirements,
      recommendedPriorities
    };
  }

  private getKeyFocusAreas(
    industryClassification: IndustryClassification,
    companyProfile: CompanyProfileIndicators
  ): string[] {
    const focusAreas: string[] = [];

    // Industry-specific focus areas
    switch (industryClassification.sector) {
      case 'technology':
        focusAreas.push('Product scalability', 'Customer success', 'Technology infrastructure');
        break;
      case 'financial-services':
        focusAreas.push('Regulatory compliance', 'Risk management', 'Customer trust');
        break;
      case 'healthcare':
        focusAreas.push('Patient outcomes', 'Data security', 'Regulatory compliance');
        break;
      case 'manufacturing':
        focusAreas.push('Supply chain efficiency', 'Quality control', 'Operational excellence');
        break;
      case 'retail':
        focusAreas.push('Customer experience', 'Inventory management', 'Omnichannel presence');
        break;
    }

    // Company-specific focus areas
    if (companyProfile.isRapidGrowth) {
      focusAreas.push('Scaling operations', 'Team development');
    }

    if (companyProfile.hasInternationalOperations) {
      focusAreas.push('Global coordination', 'Cultural adaptation');
    }

    if (companyProfile.requiresRegulatorycompliance) {
      focusAreas.push('Compliance automation', 'Audit readiness');
    }

    return [...new Set(focusAreas)];
  }

  private getRecommendedPriorities(
    industryClassification: IndustryClassification,
    companyProfile: CompanyProfileIndicators
  ): DomainName[] {
    const priorities: DomainName[] = ['strategic-alignment']; // Always start here

    // Industry-specific priorities
    const rules = this.getIndustryRules(industryClassification.sector);
    if (rules) {
      const sortedDomains = Object.entries(rules.scoringAdjustments)
        .sort(([, a], [, b]) => b - a) // Sort by adjustment factor (higher = more important)
        .map(([domain]) => domain as DomainName);

      priorities.push(...sortedDomains.slice(0, 3)); // Top 3 priorities
    }

    // Company-specific priorities
    if (companyProfile.isRapidGrowth) {
      priorities.push('people-organization', 'operational-excellence');
    }

    if (companyProfile.requiresRegulatorycompliance) {
      priorities.push('risk-compliance');
    }

    if (companyProfile.usesSubscriptionModel) {
      priorities.push('customer-success');
    }

    // Remove duplicates and limit to top 5
    return [...new Set(priorities)].slice(0, 5);
  }
}