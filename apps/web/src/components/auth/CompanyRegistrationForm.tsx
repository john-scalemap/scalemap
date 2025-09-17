'use client';

import {
  CompanyRegistration,
  CompanyIndustry,
  CompanySize,
  BusinessModel
} from '@/types';
import { useState } from 'react';

interface CompanyRegistrationFormProps {
  onSubmit: (data: CompanyRegistration) => void;
  loading?: boolean;
  error?: string;
}

const INDUSTRY_SECTORS = [
  { value: 'technology', label: 'Technology' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'finance', label: 'Finance & Banking' },
  { value: 'retail', label: 'Retail & E-commerce' },
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'consulting', label: 'Consulting & Services' },
  { value: 'education', label: 'Education' },
  { value: 'real-estate', label: 'Real Estate' },
  { value: 'other', label: 'Other' }
];

const INDUSTRY_SUBSECTORS: Record<string, { value: string; label: string }[]> = {
  technology: [
    { value: 'saas', label: 'Software as a Service (SaaS)' },
    { value: 'fintech', label: 'Financial Technology' },
    { value: 'healthtech', label: 'Health Technology' },
    { value: 'edtech', label: 'Education Technology' },
    { value: 'ai-ml', label: 'AI & Machine Learning' },
    { value: 'cybersecurity', label: 'Cybersecurity' },
    { value: 'devtools', label: 'Developer Tools' },
    { value: 'other', label: 'Other Technology' }
  ],
  healthcare: [
    { value: 'medical-devices', label: 'Medical Devices' },
    { value: 'pharmaceuticals', label: 'Pharmaceuticals' },
    { value: 'digital-health', label: 'Digital Health' },
    { value: 'healthcare-services', label: 'Healthcare Services' },
    { value: 'other', label: 'Other Healthcare' }
  ],
  finance: [
    { value: 'banking', label: 'Banking' },
    { value: 'insurance', label: 'Insurance' },
    { value: 'payments', label: 'Payments' },
    { value: 'lending', label: 'Lending' },
    { value: 'investment', label: 'Investment Management' },
    { value: 'other', label: 'Other Finance' }
  ]
};

const COMPANY_SIZES: { value: CompanySize; label: string; description: string }[] = [
  { value: 'micro', label: 'Micro (1-10 employees)', description: 'Small team, early stage' },
  { value: 'small', label: 'Small (11-50 employees)', description: 'Growing startup or small business' },
  { value: 'medium', label: 'Medium (51-250 employees)', description: 'Established business' },
  { value: 'large', label: 'Large (251-1000 employees)', description: 'Large corporation' },
  { value: 'enterprise', label: 'Enterprise (1000+ employees)', description: 'Enterprise organization' }
];

const BUSINESS_MODELS: { value: BusinessModel; label: string; description: string }[] = [
  { value: 'b2b-saas', label: 'B2B SaaS', description: 'Business-to-business software' },
  { value: 'b2c-saas', label: 'B2C SaaS', description: 'Business-to-consumer software' },
  { value: 'marketplace', label: 'Marketplace', description: 'Platform connecting buyers and sellers' },
  { value: 'ecommerce', label: 'E-commerce', description: 'Online retail business' },
  { value: 'consulting', label: 'Consulting', description: 'Professional services' },
  { value: 'manufacturing', label: 'Manufacturing', description: 'Physical product creation' },
  { value: 'retail', label: 'Retail', description: 'Physical or online store' },
  { value: 'healthcare', label: 'Healthcare', description: 'Medical services or products' },
  { value: 'fintech', label: 'FinTech', description: 'Financial technology services' },
  { value: 'other', label: 'Other', description: 'Other business model' }
];

const REGULATORY_CLASSIFICATIONS = [
  {
    value: 'lightly-regulated',
    label: 'Lightly Regulated',
    description: 'Standard business regulations only'
  },
  {
    value: 'moderately-regulated',
    label: 'Moderately Regulated',
    description: 'Some industry-specific regulations'
  },
  {
    value: 'highly-regulated',
    label: 'Highly Regulated',
    description: 'Heavy compliance requirements (finance, healthcare, etc.)'
  }
];

export default function CompanyRegistrationForm({
  onSubmit,
  loading = false,
  error
}: CompanyRegistrationFormProps) {
  const [formData, setFormData] = useState<CompanyRegistration>({
    name: '',
    industry: {
      sector: '',
      subSector: '',
      regulatoryClassification: 'lightly-regulated',
      specificRegulations: []
    },
    businessModel: 'other',
    size: 'small',
    description: '',
    website: '',
    headquarters: {
      country: '',
      city: ''
    }
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Company name is required';
    }

    if (!formData.industry.sector) {
      newErrors.sector = 'Industry sector is required';
    }

    if (!formData.industry.subSector) {
      newErrors.subSector = 'Industry subsector is required';
    }

    if (!formData.businessModel) {
      newErrors.businessModel = 'Business model is required';
    }

    if (!formData.size) {
      newErrors.size = 'Company size is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit(formData);
    }
  };

  const updateFormData = (field: string, value: any) => {
    setFormData(prev => {
      if (field.includes('.')) {
        const [parent, child] = field.split('.');
        return {
          ...prev,
          [parent]: {
            ...(prev as any)[parent],
            [child]: value
          }
        };
      }
      return {
        ...prev,
        [field]: value
      };
    });
  };

  const availableSubsectors = formData.industry.sector
    ? INDUSTRY_SUBSECTORS[formData.industry.sector] || [{ value: 'other', label: 'Other' }]
    : [];

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Company Information</h2>
        <p className="text-gray-600">
          Tell us about your company to help us customize your ScaleMap experience.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
          <div className="text-sm text-red-800">{error}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Company Name */}
        <div>
          <label htmlFor="company-name" className="block text-sm font-medium text-gray-700 mb-1">
            Company Name *
          </label>
          <input
            id="company-name"
            type="text"
            value={formData.name}
            onChange={(e) => updateFormData('name', e.target.value)}
            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.name ? 'border-red-300' : 'border-gray-300'
            }`}
            placeholder="Enter your company name"
            required
          />
          {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
        </div>

        {/* Industry Sector */}
        <div>
          <label htmlFor="industry-sector" className="block text-sm font-medium text-gray-700 mb-1">
            Industry Sector *
          </label>
          <select
            id="industry-sector"
            value={formData.industry.sector}
            onChange={(e) => {
              updateFormData('industry.sector', e.target.value);
              updateFormData('industry.subSector', ''); // Reset subsector
            }}
            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.sector ? 'border-red-300' : 'border-gray-300'
            }`}
            required
          >
            <option value="">Select industry sector</option>
            {INDUSTRY_SECTORS.map(sector => (
              <option key={sector.value} value={sector.value}>
                {sector.label}
              </option>
            ))}
          </select>
          {errors.sector && <p className="mt-1 text-sm text-red-600">{errors.sector}</p>}
        </div>

        {/* Industry Subsector */}
        <div>
          <label htmlFor="industry-subsector" className="block text-sm font-medium text-gray-700 mb-1">
            Industry Subsector *
          </label>
          <select
            id="industry-subsector"
            value={formData.industry.subSector}
            onChange={(e) => updateFormData('industry.subSector', e.target.value)}
            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.subSector ? 'border-red-300' : 'border-gray-300'
            }`}
            disabled={!formData.industry.sector}
            required
          >
            <option value="">Select subsector</option>
            {availableSubsectors.map(subsector => (
              <option key={subsector.value} value={subsector.value}>
                {subsector.label}
              </option>
            ))}
          </select>
          {errors.subSector && <p className="mt-1 text-sm text-red-600">{errors.subSector}</p>}
        </div>

        {/* Regulatory Classification */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Regulatory Environment *
          </label>
          <div className="space-y-2">
            {REGULATORY_CLASSIFICATIONS.map(classification => (
              <label key={classification.value} className="flex items-start">
                <input
                  type="radio"
                  name="regulatory-classification"
                  value={classification.value}
                  checked={formData.industry.regulatoryClassification === classification.value}
                  onChange={(e) => updateFormData('industry.regulatoryClassification', e.target.value)}
                  className="mt-1 mr-3 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <div className="font-medium text-gray-900">{classification.label}</div>
                  <div className="text-sm text-gray-600">{classification.description}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Business Model */}
        <div>
          <label htmlFor="business-model" className="block text-sm font-medium text-gray-700 mb-1">
            Business Model *
          </label>
          <select
            id="business-model"
            value={formData.businessModel}
            onChange={(e) => updateFormData('businessModel', e.target.value as BusinessModel)}
            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.businessModel ? 'border-red-300' : 'border-gray-300'
            }`}
            required
          >
            <option value="">Select business model</option>
            {BUSINESS_MODELS.map(model => (
              <option key={model.value} value={model.value}>
                {model.label} - {model.description}
              </option>
            ))}
          </select>
          {errors.businessModel && <p className="mt-1 text-sm text-red-600">{errors.businessModel}</p>}
        </div>

        {/* Company Size */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Company Size *
          </label>
          <div className="space-y-2">
            {COMPANY_SIZES.map(size => (
              <label key={size.value} className="flex items-start">
                <input
                  type="radio"
                  name="company-size"
                  value={size.value}
                  checked={formData.size === size.value}
                  onChange={(e) => updateFormData('size', e.target.value as CompanySize)}
                  className="mt-1 mr-3 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <div className="font-medium text-gray-900">{size.label}</div>
                  <div className="text-sm text-gray-600">{size.description}</div>
                </div>
              </label>
            ))}
          </div>
          {errors.size && <p className="mt-1 text-sm text-red-600">{errors.size}</p>}
        </div>

        {/* Company Description */}
        <div>
          <label htmlFor="company-description" className="block text-sm font-medium text-gray-700 mb-1">
            Company Description
          </label>
          <textarea
            id="company-description"
            value={formData.description || ''}
            onChange={(e) => updateFormData('description', e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Briefly describe what your company does (optional)"
          />
        </div>

        {/* Website */}
        <div>
          <label htmlFor="website" className="block text-sm font-medium text-gray-700 mb-1">
            Company Website
          </label>
          <input
            id="website"
            type="url"
            value={formData.website || ''}
            onChange={(e) => updateFormData('website', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="https://www.yourcompany.com (optional)"
          />
        </div>

        {/* Headquarters Location */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="country" className="block text-sm font-medium text-gray-700 mb-1">
              Country
            </label>
            <input
              id="country"
              type="text"
              value={formData.headquarters?.country || ''}
              onChange={(e) => updateFormData('headquarters.country', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., United States (optional)"
            />
          </div>
          <div>
            <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1">
              City
            </label>
            <input
              id="city"
              type="text"
              value={formData.headquarters?.city || ''}
              onChange={(e) => updateFormData('headquarters.city', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., San Francisco (optional)"
            />
          </div>
        </div>

        {/* Submit Button */}
        <div className="pt-4">
          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating Account...' : 'Continue with Registration'}
          </button>
        </div>
      </form>
    </div>
  );
}