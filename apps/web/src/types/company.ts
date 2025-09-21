// Company types based on backend validation rules and API contract

export interface Company {
  id: string;
  name: string;
  industry: Industry;
  businessModel: BusinessModel;
  size: CompanySize;
  description: string;
  website?: string;
  headquarters: Headquarters;
  subscription: Subscription;
  createdAt: string;
  updatedAt: string;
}

export interface Industry {
  sector: IndustrySector;
  subSector: string;
  regulatoryClassification: RegulatoryClassification;
  specificRegulations: string[];
}

export interface Headquarters {
  country: string;
  city: string;
}

export interface Subscription {
  planId: string;
  status: SubscriptionStatus;
  billingPeriod: BillingPeriod;
  startDate: string;
  features: string[];
  limits: SubscriptionLimits;
}

export interface SubscriptionLimits {
  maxAssessments: number;
  maxAgents: number;
  maxUsers: number;
  maxStorageGB: number;
}

// Enums based on backend validation
export type IndustrySector =
  | 'technology'
  | 'financial-services'
  | 'healthcare'
  | 'manufacturing'
  | 'retail'
  | 'other';

export type BusinessModel =
  | 'b2b-saas'
  | 'b2c-saas'
  | 'marketplace'
  | 'ecommerce'
  | 'consulting'
  | 'manufacturing'
  | 'retail'
  | 'healthcare'
  | 'fintech'
  | 'other';

export type CompanySize =
  | 'micro'
  | 'small'
  | 'medium'
  | 'large'
  | 'enterprise';

export type RegulatoryClassification =
  | 'highly-regulated'
  | 'moderately-regulated'
  | 'lightly-regulated';

export type SubscriptionStatus =
  | 'trial'
  | 'active'
  | 'cancelled'
  | 'expired';

export type BillingPeriod =
  | 'monthly'
  | 'yearly';

// Industry sector configurations
export const INDUSTRY_SECTORS: Record<IndustrySector, {
  label: string;
  subSectors: string[];
  commonRegulations: string[];
}> = {
  'technology': {
    label: 'Technology',
    subSectors: [
      'software-development',
      'fintech',
      'healthtech',
      'edtech',
      'artificial-intelligence',
      'cybersecurity',
      'cloud-services',
      'mobile-apps',
      'web-development',
      'data-analytics',
      'other'
    ],
    commonRegulations: ['GDPR', 'CCPA', 'SOC2', 'ISO27001']
  },
  'financial-services': {
    label: 'Financial Services',
    subSectors: [
      'banking',
      'insurance',
      'investment-management',
      'payment-processing',
      'cryptocurrency',
      'lending',
      'wealth-management',
      'accounting',
      'financial-advisory',
      'other'
    ],
    commonRegulations: ['PCI-DSS', 'SOX', 'GDPR', 'BASEL-III', 'MIFID-II', 'DODD-FRANK']
  },
  'healthcare': {
    label: 'Healthcare',
    subSectors: [
      'medical-devices',
      'pharmaceuticals',
      'biotechnology',
      'digital-health',
      'telemedicine',
      'medical-research',
      'healthcare-services',
      'health-insurance',
      'medical-software',
      'other'
    ],
    commonRegulations: ['HIPAA', 'FDA', 'GDPR', 'ISO13485', 'MDR', 'HITECH']
  },
  'manufacturing': {
    label: 'Manufacturing',
    subSectors: [
      'automotive',
      'aerospace',
      'electronics',
      'food-beverage',
      'textiles',
      'chemicals',
      'machinery',
      'consumer-goods',
      'industrial-equipment',
      'other'
    ],
    commonRegulations: ['ISO9001', 'ISO14001', 'OSHA', 'REACH', 'RoHS', 'CE-MARKING']
  },
  'retail': {
    label: 'Retail',
    subSectors: [
      'fashion',
      'food-grocery',
      'electronics',
      'home-garden',
      'sports-outdoors',
      'beauty-cosmetics',
      'books-media',
      'automotive-parts',
      'specialty-retail',
      'other'
    ],
    commonRegulations: ['GDPR', 'CCPA', 'PCI-DSS', 'CPSC', 'FTC', 'ADA']
  },
  'other': {
    label: 'Other',
    subSectors: [
      'education',
      'non-profit',
      'government',
      'real-estate',
      'transportation',
      'energy-utilities',
      'media-entertainment',
      'agriculture',
      'construction',
      'other'
    ],
    commonRegulations: ['GDPR', 'CCPA', 'FERPA', 'COPPA', 'ADA']
  }
};

// Business model configurations
export const BUSINESS_MODELS: Record<BusinessModel, {
  label: string;
  description: string;
}> = {
  'b2b-saas': {
    label: 'B2B SaaS',
    description: 'Software as a Service for business customers'
  },
  'b2c-saas': {
    label: 'B2C SaaS',
    description: 'Software as a Service for individual consumers'
  },
  'marketplace': {
    label: 'Marketplace',
    description: 'Platform connecting buyers and sellers'
  },
  'ecommerce': {
    label: 'E-commerce',
    description: 'Direct online sales to consumers'
  },
  'consulting': {
    label: 'Consulting',
    description: 'Professional services and advisory'
  },
  'manufacturing': {
    label: 'Manufacturing',
    description: 'Physical product manufacturing'
  },
  'retail': {
    label: 'Retail',
    description: 'Traditional retail business'
  },
  'healthcare': {
    label: 'Healthcare',
    description: 'Healthcare services and products'
  },
  'fintech': {
    label: 'FinTech',
    description: 'Financial technology solutions'
  },
  'other': {
    label: 'Other',
    description: 'Other business model'
  }
};

// Company size configurations
export const COMPANY_SIZES: Record<CompanySize, {
  label: string;
  description: string;
  employeeRange: string;
}> = {
  'micro': {
    label: 'Micro',
    description: 'Very small business',
    employeeRange: '1-10 employees'
  },
  'small': {
    label: 'Small',
    description: 'Small business',
    employeeRange: '11-50 employees'
  },
  'medium': {
    label: 'Medium',
    description: 'Medium-sized business',
    employeeRange: '51-250 employees'
  },
  'large': {
    label: 'Large',
    description: 'Large business',
    employeeRange: '251-1000 employees'
  },
  'enterprise': {
    label: 'Enterprise',
    description: 'Enterprise corporation',
    employeeRange: '1000+ employees'
  }
};

// Regulatory classification configurations
export const REGULATORY_CLASSIFICATIONS: Record<RegulatoryClassification, {
  label: string;
  description: string;
  examples: string[];
}> = {
  'highly-regulated': {
    label: 'Highly Regulated',
    description: 'Subject to strict regulatory oversight and compliance requirements',
    examples: ['Banking', 'Healthcare', 'Pharmaceuticals', 'Aviation']
  },
  'moderately-regulated': {
    label: 'Moderately Regulated',
    description: 'Subject to some regulatory requirements and industry standards',
    examples: ['Technology', 'Manufacturing', 'Insurance', 'Food & Beverage']
  },
  'lightly-regulated': {
    label: 'Lightly Regulated',
    description: 'Subject to basic business regulations and minimal industry-specific rules',
    examples: ['Consulting', 'Retail', 'Media', 'Professional Services']
  }
};

// Common countries for headquarters
export const COUNTRIES = [
  'United States',
  'United Kingdom',
  'Canada',
  'Germany',
  'France',
  'Netherlands',
  'Australia',
  'Japan',
  'Singapore',
  'Switzerland',
  'Sweden',
  'Denmark',
  'Norway',
  'Ireland',
  'Belgium',
  'Austria',
  'Other'
];

// Form data interfaces
export interface CompanyRegistrationData {
  name: string;
  industry: {
    sector: IndustrySector;
    subSector: string;
    regulatoryClassification: RegulatoryClassification;
    specificRegulations: string[];
  };
  businessModel: BusinessModel;
  size: CompanySize;
  description: string;
  website?: string;
  headquarters: {
    country: string;
    city: string;
  };
}

// Validation interfaces
export interface CompanyValidationErrors {
  name?: string;
  'industry.sector'?: string;
  'industry.subSector'?: string;
  'industry.regulatoryClassification'?: string;
  'industry.specificRegulations'?: string;
  businessModel?: string;
  size?: string;
  description?: string;
  website?: string;
  'headquarters.country'?: string;
  'headquarters.city'?: string;
}