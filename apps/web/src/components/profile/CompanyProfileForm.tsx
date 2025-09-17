'use client';

import type { BusinessModel, CompanySize } from '@/types';
import { useState } from 'react';

import { useAuth } from '../../stores/auth';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';

interface CompanyProfileFormProps {
  onSuccess?: () => void;
}

export function CompanyProfileForm({ onSuccess }: CompanyProfileFormProps) {
  const { user, updateCompanyProfile } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: user?.company?.name || '',
    description: user?.company?.description || '',
    website: user?.company?.website || '',
    businessModel: user?.company?.businessModel || '' as BusinessModel,
    size: user?.company?.size || '' as CompanySize,
    industry: {
      sector: user?.company?.industry?.sector || '',
      subSector: user?.company?.industry?.subSector || '',
      regulatoryClassification: user?.company?.industry?.regulatoryClassification || 'lightly-regulated' as const,
      specificRegulations: user?.company?.industry?.specificRegulations || []
    },
    headquarters: {
      country: user?.company?.headquarters?.country || '',
      city: user?.company?.headquarters?.city || ''
    }
  });

  const businessModels: Array<{ value: BusinessModel; label: string }> = [
    { value: 'b2b-saas', label: 'B2B SaaS' },
    { value: 'b2c-saas', label: 'B2C SaaS' },
    { value: 'marketplace', label: 'Marketplace' },
    { value: 'ecommerce', label: 'E-commerce' },
    { value: 'consulting', label: 'Consulting' },
    { value: 'manufacturing', label: 'Manufacturing' },
    { value: 'retail', label: 'Retail' },
    { value: 'healthcare', label: 'Healthcare' },
    { value: 'fintech', label: 'Fintech' },
    { value: 'other', label: 'Other' }
  ];

  const companySizes: Array<{ value: CompanySize; label: string }> = [
    { value: 'micro', label: 'Micro (1-9 employees)' },
    { value: 'small', label: 'Small (10-49 employees)' },
    { value: 'medium', label: 'Medium (50-249 employees)' },
    { value: 'large', label: 'Large (250-999 employees)' },
    { value: 'enterprise', label: 'Enterprise (1000+ employees)' }
  ];

  const regulatoryClassifications = [
    { value: 'highly-regulated', label: 'Highly Regulated' },
    { value: 'moderately-regulated', label: 'Moderately Regulated' },
    { value: 'lightly-regulated', label: 'Lightly Regulated' }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await updateCompanyProfile(formData);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update company profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent as keyof typeof prev],
          [child]: value
        }
      }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  const handleRegulationsChange = (regulations: string) => {
    const regulationArray = regulations.split(',').map(r => r.trim()).filter(r => r.length > 0);
    setFormData(prev => ({
      ...prev,
      industry: {
        ...prev.industry,
        specificRegulations: regulationArray
      }
    }));
  };

  if (user?.role !== 'admin') {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
        <div className="flex">
          <div className="ml-3">
            <h3 className="text-sm font-medium text-yellow-800">
              Admin Access Required
            </h3>
            <div className="mt-2 text-sm text-yellow-700">
              <p>Only company administrators can update company details.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <h3 className="text-lg leading-6 font-medium text-gray-900">
          Company Information
        </h3>
        <div className="mt-2 max-w-xl text-sm text-gray-500">
          <p>Update your company profile and business details.</p>
        </div>

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
                  Update failed
                </h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{error}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Company Name *
            </label>
            <Input
              id="name"
              name="name"
              type="text"
              required
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className="mt-1"
              disabled={isLoading}
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700">
              Company Description
            </label>
            <Textarea
              id="description"
              name="description"
              rows={3}
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              className="mt-1"
              disabled={isLoading}
              placeholder="Brief description of your company..."
            />
          </div>

          <div>
            <label htmlFor="website" className="block text-sm font-medium text-gray-700">
              Website
            </label>
            <Input
              id="website"
              name="website"
              type="url"
              value={formData.website}
              onChange={(e) => handleInputChange('website', e.target.value)}
              className="mt-1"
              disabled={isLoading}
              placeholder="https://www.company.com"
            />
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label htmlFor="businessModel" className="block text-sm font-medium text-gray-700">
                Business Model
              </label>
              <Select
                id="businessModel"
                name="businessModel"
                value={formData.businessModel}
                onChange={(e) => handleInputChange('businessModel', e.target.value)}
                className="mt-1"
                disabled={isLoading}
              >
                <option value="">Select business model</option>
                {businessModels.map((model) => (
                  <option key={model.value} value={model.value}>
                    {model.label}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label htmlFor="size" className="block text-sm font-medium text-gray-700">
                Company Size
              </label>
              <Select
                id="size"
                name="size"
                value={formData.size}
                onChange={(e) => handleInputChange('size', e.target.value)}
                className="mt-1"
                disabled={isLoading}
              >
                <option value="">Select company size</option>
                {companySizes.map((size) => (
                  <option key={size.value} value={size.value}>
                    {size.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <h4 className="text-base font-medium text-gray-900 mb-4">Industry Information</h4>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <label htmlFor="sector" className="block text-sm font-medium text-gray-700">
                  Industry Sector
                </label>
                <Input
                  id="sector"
                  name="sector"
                  type="text"
                  value={formData.industry.sector}
                  onChange={(e) => handleInputChange('industry.sector', e.target.value)}
                  className="mt-1"
                  disabled={isLoading}
                  placeholder="e.g., Technology, Healthcare"
                />
              </div>

              <div>
                <label htmlFor="subSector" className="block text-sm font-medium text-gray-700">
                  Sub-Sector
                </label>
                <Input
                  id="subSector"
                  name="subSector"
                  type="text"
                  value={formData.industry.subSector}
                  onChange={(e) => handleInputChange('industry.subSector', e.target.value)}
                  className="mt-1"
                  disabled={isLoading}
                  placeholder="e.g., SaaS, Medical Devices"
                />
              </div>
            </div>

            <div className="mt-4">
              <label htmlFor="regulatoryClassification" className="block text-sm font-medium text-gray-700">
                Regulatory Classification
              </label>
              <Select
                id="regulatoryClassification"
                name="regulatoryClassification"
                value={formData.industry.regulatoryClassification}
                onChange={(e) => handleInputChange('industry.regulatoryClassification', e.target.value)}
                className="mt-1"
                disabled={isLoading}
              >
                {regulatoryClassifications.map((classification) => (
                  <option key={classification.value} value={classification.value}>
                    {classification.label}
                  </option>
                ))}
              </Select>
            </div>

            <div className="mt-4">
              <label htmlFor="specificRegulations" className="block text-sm font-medium text-gray-700">
                Specific Regulations
              </label>
              <Input
                id="specificRegulations"
                name="specificRegulations"
                type="text"
                value={formData.industry.specificRegulations.join(', ')}
                onChange={(e) => handleRegulationsChange(e.target.value)}
                className="mt-1"
                disabled={isLoading}
                placeholder="GDPR, HIPAA, SOX (comma-separated)"
              />
              <p className="mt-1 text-xs text-gray-500">
                Enter regulations separated by commas
              </p>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <h4 className="text-base font-medium text-gray-900 mb-4">Headquarters</h4>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <label htmlFor="country" className="block text-sm font-medium text-gray-700">
                  Country
                </label>
                <Input
                  id="country"
                  name="country"
                  type="text"
                  value={formData.headquarters.country}
                  onChange={(e) => handleInputChange('headquarters.country', e.target.value)}
                  className="mt-1"
                  disabled={isLoading}
                  placeholder="United States"
                />
              </div>

              <div>
                <label htmlFor="city" className="block text-sm font-medium text-gray-700">
                  City
                </label>
                <Input
                  id="city"
                  name="city"
                  type="text"
                  value={formData.headquarters.city}
                  onChange={(e) => handleInputChange('headquarters.city', e.target.value)}
                  className="mt-1"
                  disabled={isLoading}
                  placeholder="San Francisco"
                />
              </div>
            </div>
          </div>

          <div className="pt-5">
            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={isLoading}
                className="ml-3"
              >
                {isLoading ? 'Updating...' : 'Update Company'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}