import {
  IndustryClassification,
  DomainName,
  QuestionResponse,
  ValidationError,
  ValidationWarning
} from '@/types';

export interface BusinessModelRules {
  requiredDomains: DomainName[];
  optionalDomains: DomainName[];
  domainWeighting: Record<DomainName, number>;
  keyMetrics: string[];
  validationRules: {
    crossDomain: CrossDomainValidation[];
    businessLogic: BusinessLogicValidation[];
  };
}

export interface CrossDomainValidation {
  name: string;
  domains: DomainName[];
  rule: string;
  message: string;
}

export interface BusinessLogicValidation {
  name: string;
  domain: DomainName;
  questionIds: string[];
  rule: string;
  message: string;
}

export class BusinessModelValidator {
  private static instance: BusinessModelValidator;
  private businessModelRules: Map<string, BusinessModelRules> = new Map();

  static getInstance(): BusinessModelValidator {
    if (!BusinessModelValidator.instance) {
      BusinessModelValidator.instance = new BusinessModelValidator();
    }
    return BusinessModelValidator.instance;
  }

  constructor() {
    this.loadBusinessModelRules();
  }

  private loadBusinessModelRules(): void {
    // B2B SaaS Model
    this.businessModelRules.set('b2b-saas', {
      requiredDomains: [
        'strategic-alignment',
        'financial-management',
        'revenue-engine',
        'technology-data',
        'customer-success',
        'people-organization'
      ],
      optionalDomains: [
        'operational-excellence',
        'partnerships',
        'risk-compliance',
        'change-management'
      ],
      domainWeighting: {
        'strategic-alignment': 1.0,
        'financial-management': 1.1,
        'revenue-engine': 1.2,
        'operational-excellence': 0.9,
        'people-organization': 1.0,
        'technology-data': 1.3,
        'customer-experience': 1.1,
        'supply-chain': 0.5,
        'risk-compliance': 0.8,
        'partnerships': 1.0,
        'customer-success': 1.4,
        'change-management': 0.9
      },
      keyMetrics: ['MRR', 'ARR', 'Churn Rate', 'LTV', 'CAC', 'NPS'],
      validationRules: {
        crossDomain: [
          {
            name: 'cac-ltv-consistency',
            domains: ['revenue-engine', 'customer-success'],
            rule: 'LTV:CAC ratio should be > 3:1',
            message: 'Customer acquisition cost relative to lifetime value indicates sustainability issues'
          },
          {
            name: 'churn-product-fit',
            domains: ['customer-success', 'customer-experience'],
            rule: 'High churn correlates with poor product-market fit',
            message: 'High customer churn may indicate product-market fit issues'
          },
          {
            name: 'scaling-technology',
            domains: ['revenue-engine', 'technology-data'],
            rule: 'Revenue growth must be supported by scalable technology',
            message: 'Technology infrastructure may not support revenue growth targets'
          }
        ],
        businessLogic: [
          {
            name: 'subscription-metrics',
            domain: 'customer-success',
            questionIds: ['11.7', '11.8'],
            rule: 'SaaS businesses must track churn and onboarding metrics',
            message: 'Subscription metrics are critical for SaaS business health'
          },
          {
            name: 'product-architecture',
            domain: 'technology-data',
            questionIds: ['6.8'],
            rule: 'SaaS products require scalable architecture',
            message: 'Product architecture must support multi-tenant scalability'
          }
        ]
      }
    });

    // B2C Marketplace Model
    this.businessModelRules.set('b2c-marketplace', {
      requiredDomains: [
        'strategic-alignment',
        'financial-management',
        'revenue-engine',
        'technology-data',
        'customer-experience',
        'partnerships'
      ],
      optionalDomains: [
        'operational-excellence',
        'people-organization',
        'customer-success',
        'risk-compliance',
        'change-management'
      ],
      domainWeighting: {
        'strategic-alignment': 1.0,
        'financial-management': 1.1,
        'revenue-engine': 1.3,
        'operational-excellence': 1.0,
        'people-organization': 0.9,
        'technology-data': 1.2,
        'customer-experience': 1.4,
        'supply-chain': 0.7,
        'risk-compliance': 0.9,
        'partnerships': 1.3,
        'customer-success': 1.0,
        'change-management': 0.8
      },
      keyMetrics: ['GMV', 'Take Rate', 'User Acquisition', 'Engagement', 'Transaction Volume'],
      validationRules: {
        crossDomain: [
          {
            name: 'network-effects',
            domains: ['revenue-engine', 'customer-experience', 'partnerships'],
            rule: 'Marketplace success depends on network effects',
            message: 'Marketplace platforms require strong network effects for sustainable growth'
          },
          {
            name: 'platform-scalability',
            domains: ['technology-data', 'partnerships'],
            rule: 'Platform must scale with ecosystem partners',
            message: 'Technology platform must support ecosystem growth'
          }
        ],
        businessLogic: [
          {
            name: 'marketplace-metrics',
            domain: 'revenue-engine',
            questionIds: ['3.4', '3.5'],
            rule: 'Marketplaces must track supply/demand balance',
            message: 'Marketplace platforms require balanced supply and demand metrics'
          }
        ]
      }
    });

    // Manufacturing Model
    this.businessModelRules.set('manufacturing', {
      requiredDomains: [
        'strategic-alignment',
        'financial-management',
        'operational-excellence',
        'supply-chain',
        'people-organization',
        'risk-compliance'
      ],
      optionalDomains: [
        'revenue-engine',
        'technology-data',
        'customer-experience',
        'partnerships',
        'customer-success',
        'change-management'
      ],
      domainWeighting: {
        'strategic-alignment': 1.0,
        'financial-management': 1.2,
        'revenue-engine': 1.0,
        'operational-excellence': 1.4,
        'people-organization': 1.1,
        'technology-data': 0.9,
        'customer-experience': 1.0,
        'supply-chain': 1.5,
        'risk-compliance': 1.2,
        'partnerships': 1.1,
        'customer-success': 0.8,
        'change-management': 1.0
      },
      keyMetrics: ['OEE', 'Inventory Turnover', 'Quality Metrics', 'Lead Times', 'Cost per Unit'],
      validationRules: {
        crossDomain: [
          {
            name: 'supply-operations-alignment',
            domains: ['supply-chain', 'operational-excellence'],
            rule: 'Supply chain efficiency must align with operational processes',
            message: 'Supply chain and operations must be synchronized for optimal efficiency'
          },
          {
            name: 'quality-supply-chain',
            domains: ['supply-chain', 'operational-excellence'],
            rule: 'Supplier quality directly impacts operational quality',
            message: 'Supplier quality management affects overall product quality'
          }
        ],
        businessLogic: [
          {
            name: 'manufacturing-processes',
            domain: 'operational-excellence',
            questionIds: ['4.8'],
            rule: 'Manufacturing requires systematic process management',
            message: 'Manufacturing operations must have standardized processes'
          }
        ]
      }
    });

    // Services Model
    this.businessModelRules.set('services', {
      requiredDomains: [
        'strategic-alignment',
        'financial-management',
        'revenue-engine',
        'people-organization',
        'customer-experience',
        'operational-excellence'
      ],
      optionalDomains: [
        'technology-data',
        'partnerships',
        'customer-success',
        'risk-compliance',
        'change-management'
      ],
      domainWeighting: {
        'strategic-alignment': 1.0,
        'financial-management': 1.1,
        'revenue-engine': 1.2,
        'operational-excellence': 1.2,
        'people-organization': 1.4,
        'technology-data': 0.8,
        'customer-experience': 1.3,
        'supply-chain': 0.5,
        'risk-compliance': 0.9,
        'partnerships': 1.1,
        'customer-success': 1.1,
        'change-management': 1.0
      },
      keyMetrics: ['Utilization Rate', 'Project Margins', 'Client Satisfaction', 'Employee Productivity'],
      validationRules: {
        crossDomain: [
          {
            name: 'people-service-delivery',
            domains: ['people-organization', 'customer-experience'],
            rule: 'Service quality depends on people capabilities',
            message: 'Service delivery quality is directly tied to team capabilities and satisfaction'
          },
          {
            name: 'utilization-profitability',
            domains: ['people-organization', 'financial-management'],
            rule: 'People utilization affects profitability',
            message: 'Team utilization rates directly impact service business profitability'
          }
        ],
        businessLogic: [
          {
            name: 'service-standardization',
            domain: 'operational-excellence',
            questionIds: ['4.8'],
            rule: 'Service businesses need delivery standardization',
            message: 'Service delivery processes should be standardized for consistency'
          }
        ]
      }
    });

    // Hybrid Model
    this.businessModelRules.set('hybrid', {
      requiredDomains: [
        'strategic-alignment',
        'financial-management',
        'revenue-engine',
        'operational-excellence',
        'people-organization',
        'technology-data',
        'customer-experience'
      ],
      optionalDomains: [
        'supply-chain',
        'risk-compliance',
        'partnerships',
        'customer-success',
        'change-management'
      ],
      domainWeighting: {
        'strategic-alignment': 1.2, // Higher importance for hybrid models
        'financial-management': 1.2,
        'revenue-engine': 1.2,
        'operational-excellence': 1.1,
        'people-organization': 1.1,
        'technology-data': 1.0,
        'customer-experience': 1.1,
        'supply-chain': 0.8,
        'risk-compliance': 1.0,
        'partnerships': 1.0,
        'customer-success': 1.0,
        'change-management': 1.1
      },
      keyMetrics: ['Revenue Mix', 'Cross-sell Ratio', 'Customer Lifetime Value', 'Operational Efficiency'],
      validationRules: {
        crossDomain: [
          {
            name: 'revenue-stream-balance',
            domains: ['strategic-alignment', 'revenue-engine'],
            rule: 'Hybrid models require balanced revenue stream strategy',
            message: 'Multiple revenue streams must be strategically aligned and balanced'
          },
          {
            name: 'operational-complexity',
            domains: ['operational-excellence', 'change-management'],
            rule: 'Hybrid models increase operational complexity',
            message: 'Multiple business models require sophisticated operational management'
          }
        ],
        businessLogic: []
      }
    });
  }

  validateBusinessModel(
    industryClassification: IndustryClassification,
    domainResponses: Record<string, any>
  ): { errors: ValidationError[]; warnings: ValidationWarning[] } {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    const rules = this.businessModelRules.get(industryClassification.businessModel);
    if (!rules) {
      warnings.push({
        field: 'business-model',
        message: `Business model '${industryClassification.businessModel}' not recognized. Using generic validation.`,
        type: 'quality'
      });
      return { errors, warnings };
    }

    // Validate required domains
    rules.requiredDomains.forEach(domain => {
      const domainResponse = domainResponses[domain];
      if (!domainResponse || !domainResponse.questions || Object.keys(domainResponse.questions).length === 0) {
        errors.push({
          field: domain,
          message: `Domain '${domain}' is required for ${industryClassification.businessModel} business model`,
          type: 'required'
        });
      }
    });

    // Validate cross-domain rules
    rules.validationRules.crossDomain.forEach(crossValidation => {
      const domainData = crossValidation.domains.map(domain => ({
        domain,
        responses: domainResponses[domain]?.questions || {}
      }));

      const violation = this.checkCrossDomainRule(crossValidation, domainData, industryClassification);
      if (violation) {
        errors.push({
          field: 'cross-domain',
          message: violation,
          type: 'consistency'
        });
      }
    });

    // Validate business logic rules
    rules.validationRules.businessLogic.forEach(businessRule => {
      const domainResponse = domainResponses[businessRule.domain];
      if (domainResponse) {
        const violation = this.checkBusinessLogicRule(businessRule, domainResponse.questions);
        if (violation) {
          warnings.push({
            field: businessRule.domain,
            message: violation,
            type: 'quality'
          });
        }
      }
    });

    // Check domain completeness based on weighting
    Object.entries(rules.domainWeighting).forEach(([domain, weight]) => {
      const domainResponse = domainResponses[domain];
      if (domainResponse && weight > 1.1) { // High importance domains
        const completeness = domainResponse.completeness || 0;
        if (completeness < 80) {
          warnings.push({
            field: domain,
            message: `Domain '${domain}' is critical for ${industryClassification.businessModel} business model but only ${completeness}% complete`,
            type: 'completeness'
          });
        }
      }
    });

    return { errors, warnings };
  }

  private checkCrossDomainRule(
    rule: CrossDomainValidation,
    domainData: Array<{ domain: DomainName; responses: Record<string, QuestionResponse> }>,
    industryClassification: IndustryClassification
  ): string | null {
    switch (rule.name) {
      case 'cac-ltv-consistency':
        return this.checkCACLTVConsistency(domainData);

      case 'churn-product-fit':
        return this.checkChurnProductFit(domainData);

      case 'scaling-technology':
        return this.checkScalingTechnology(domainData);

      case 'network-effects':
        return this.checkNetworkEffects(domainData);

      case 'supply-operations-alignment':
        return this.checkSupplyOperationsAlignment(domainData);

      case 'people-service-delivery':
        return this.checkPeopleServiceDelivery(domainData);

      case 'revenue-stream-balance':
        return this.checkRevenueStreamBalance(domainData);

      default:
        return null;
    }
  }

  private checkCACLTVConsistency(domainData: Array<{ domain: DomainName; responses: Record<string, QuestionResponse> }>): string | null {
    const revenueData = domainData.find(d => d.domain === 'revenue-engine');
    const customerSuccessData = domainData.find(d => d.domain === 'customer-success');

    if (!revenueData || !customerSuccessData) return null;

    const cacEfficiency = revenueData.responses['3.3']?.value; // CAC management
    const customerRetention = customerSuccessData.responses['11.2']?.value; // Customer health/retention

    if (typeof cacEfficiency === 'number' && typeof customerRetention === 'number') {
      // If CAC management is poor (4+) but retention is also poor (4+), flag issue
      if (cacEfficiency >= 4 && customerRetention >= 4) {
        return 'Poor customer acquisition cost management combined with poor retention indicates unsustainable unit economics';
      }
    }

    return null;
  }

  private checkChurnProductFit(domainData: Array<{ domain: DomainName; responses: Record<string, QuestionResponse> }>): string | null {
    const customerSuccessData = domainData.find(d => d.domain === 'customer-success');
    const customerExperienceData = domainData.find(d => d.domain === 'customer-experience');

    if (!customerSuccessData || !customerExperienceData) return null;

    const churnManagement = customerSuccessData.responses['11.2']?.value; // Customer health
    const productFit = customerExperienceData.responses['7.2']?.value; // Product-market fit

    if (typeof churnManagement === 'number' && typeof productFit === 'number') {
      // High churn (4+) with weak product-market fit (4+) is a red flag
      if (churnManagement >= 4 && productFit >= 4) {
        return 'High customer churn combined with weak product-market fit indicates fundamental business model issues';
      }
    }

    return null;
  }

  private checkScalingTechnology(domainData: Array<{ domain: DomainName; responses: Record<string, QuestionResponse> }>): string | null {
    const revenueData = domainData.find(d => d.domain === 'revenue-engine');
    const technologyData = domainData.find(d => d.domain === 'technology-data');

    if (!revenueData || !technologyData) return null;

    const revenueGrowth = revenueData.responses['3.1']?.value; // Revenue predictability (proxy for growth)
    const techScalability = technologyData.responses['6.1']?.value; // Technology scalability

    if (typeof revenueGrowth === 'number' && typeof techScalability === 'number') {
      // Strong revenue growth (1-2) with poor tech scalability (4+) is problematic
      if (revenueGrowth <= 2 && techScalability >= 4) {
        return 'High revenue growth expectations with poor technology scalability may limit growth potential';
      }
    }

    return null;
  }

  private checkNetworkEffects(domainData: Array<{ domain: DomainName; responses: Record<string, QuestionResponse> }>): string | null {
    const revenueData = domainData.find(d => d.domain === 'revenue-engine');
    const partnershipData = domainData.find(d => d.domain === 'partnerships');

    if (!revenueData || !partnershipData) return null;

    const revenueGrowth = revenueData.responses['3.1']?.value;
    const partnershipEffectiveness = partnershipData.responses['10.1']?.value;

    if (typeof revenueGrowth === 'number' && typeof partnershipEffectiveness === 'number') {
      // Marketplace needs strong partnerships for network effects
      if (revenueGrowth <= 2 && partnershipEffectiveness >= 4) {
        return 'Marketplace growth requires effective partnership ecosystem for network effects';
      }
    }

    return null;
  }

  private checkSupplyOperationsAlignment(domainData: Array<{ domain: DomainName; responses: Record<string, QuestionResponse> }>): string | null {
    const supplyChainData = domainData.find(d => d.domain === 'supply-chain');
    const operationsData = domainData.find(d => d.domain === 'operational-excellence');

    if (!supplyChainData || !operationsData) return null;

    const supplyChainReliability = supplyChainData.responses['8.1']?.value;
    const processEfficiency = operationsData.responses['4.2']?.value;

    if (typeof supplyChainReliability === 'number' && typeof processEfficiency === 'number') {
      // Supply chain issues (4+) with process efficiency issues (4+) compound problems
      if (supplyChainReliability >= 4 && processEfficiency >= 4) {
        return 'Supply chain reliability issues combined with process inefficiencies create significant operational risks';
      }
    }

    return null;
  }

  private checkPeopleServiceDelivery(domainData: Array<{ domain: DomainName; responses: Record<string, QuestionResponse> }>): string | null {
    const peopleData = domainData.find(d => d.domain === 'people-organization');
    const customerExperienceData = domainData.find(d => d.domain === 'customer-experience');

    if (!peopleData || !customerExperienceData) return null;

    const talentManagement = peopleData.responses['5.1']?.value;
    const customerSatisfaction = customerExperienceData.responses['7.1']?.value;

    if (typeof talentManagement === 'number' && typeof customerSatisfaction === 'number') {
      // Poor talent management (4+) typically leads to poor customer satisfaction (4+) in services
      if (talentManagement >= 4 && customerSatisfaction >= 4) {
        return 'Service quality issues often stem from talent management and organizational development challenges';
      }
    }

    return null;
  }

  private checkRevenueStreamBalance(domainData: Array<{ domain: DomainName; responses: Record<string, QuestionResponse> }>): string | null {
    const strategicData = domainData.find(d => d.domain === 'strategic-alignment');
    const revenueData = domainData.find(d => d.domain === 'revenue-engine');

    if (!strategicData || !revenueData) return null;

    const strategicClarity = strategicData.responses['1.1']?.value;
    const revenueDiversification = revenueData.responses['3.4']?.value;

    if (typeof strategicClarity === 'number' && typeof revenueDiversification === 'number') {
      // Poor strategic clarity (4+) with poor diversification (4+) is risky for hybrid models
      if (strategicClarity >= 4 && revenueDiversification >= 4) {
        return 'Hybrid business models require clear strategic direction and balanced revenue diversification';
      }
    }

    return null;
  }

  private checkBusinessLogicRule(
    rule: BusinessLogicValidation,
    responses: Record<string, QuestionResponse>
  ): string | null {
    switch (rule.name) {
      case 'subscription-metrics':
        return this.checkSubscriptionMetrics(responses, rule.questionIds);

      case 'product-architecture':
        return this.checkProductArchitecture(responses, rule.questionIds);

      case 'manufacturing-processes':
        return this.checkManufacturingProcesses(responses, rule.questionIds);

      case 'service-standardization':
        return this.checkServiceStandardization(responses, rule.questionIds);

      default:
        return null;
    }
  }

  private checkSubscriptionMetrics(responses: Record<string, QuestionResponse>, questionIds: string[]): string | null {
    // Check if SaaS-specific questions are answered
    const hasChurnTracking = questionIds.some(id => responses[id] && responses[id].value);

    if (!hasChurnTracking) {
      return 'SaaS businesses should track churn prediction and customer onboarding metrics';
    }

    return null;
  }

  private checkProductArchitecture(responses: Record<string, QuestionResponse>, questionIds: string[]): string | null {
    const architectureResponse = responses[questionIds[0]];

    if (!architectureResponse || typeof architectureResponse.value === 'number' && architectureResponse.value >= 4) {
      return 'SaaS products require scalable, maintainable architecture for multi-tenant operations';
    }

    return null;
  }

  private checkManufacturingProcesses(responses: Record<string, QuestionResponse>, questionIds: string[]): string | null {
    const processResponse = responses[questionIds[0]];

    if (!processResponse || typeof processResponse.value === 'number' && processResponse.value >= 4) {
      return 'Manufacturing operations require well-documented, standardized processes';
    }

    return null;
  }

  private checkServiceStandardization(responses: Record<string, QuestionResponse>, questionIds: string[]): string | null {
    const standardizationResponse = responses[questionIds[0]];

    if (!standardizationResponse || typeof standardizationResponse.value === 'number' && standardizationResponse.value >= 4) {
      return 'Service businesses benefit from standardized delivery processes for consistency and scalability';
    }

    return null;
  }

  getBusinessModelRules(businessModel: string): BusinessModelRules | null {
    return this.businessModelRules.get(businessModel) || null;
  }

  getDomainWeighting(businessModel: string): Record<DomainName, number> {
    const rules = this.businessModelRules.get(businessModel);
    return rules?.domainWeighting || {};
  }

  getKeyMetrics(businessModel: string): string[] {
    const rules = this.businessModelRules.get(businessModel);
    return rules?.keyMetrics || [];
  }
}