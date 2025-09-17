'use client';

import { IndustryClassification } from '@/types';
import { useRouter } from 'next/navigation';
import React, { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useAssessment } from '@/hooks/useAssessment';

interface CompanyContextForm {
  title: string;
  description: string;
  industryClassification: Partial<IndustryClassification>;
  primaryChallenges: string[];
  strategicObjectives: string[];
  resourceConstraints: {
    budget: 'limited' | 'moderate' | 'substantial';
    team: 'stretched' | 'adequate' | 'well-staffed';
    timeAvailability: 'minimal' | 'moderate' | 'flexible';
  };
}

const SECTOR_OPTIONS = [
  { value: 'technology', label: 'Technology' },
  { value: 'financial-services', label: 'Financial Services' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'retail', label: 'Retail' },
  { value: 'other', label: 'Other' }
];

const BUSINESS_MODEL_OPTIONS = [
  { value: 'b2b-saas', label: 'B2B SaaS' },
  { value: 'b2c-marketplace', label: 'B2C Marketplace' },
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'services', label: 'Services' },
  { value: 'hybrid', label: 'Hybrid' }
];

const COMPANY_STAGE_OPTIONS = [
  { value: 'startup', label: 'Startup (0-2 years)' },
  { value: 'growth', label: 'Growth (2-7 years)' },
  { value: 'mature', label: 'Mature (7+ years)' }
];

const REGULATORY_OPTIONS = [
  { value: 'non-regulated', label: 'Non-regulated' },
  { value: 'lightly-regulated', label: 'Lightly regulated' },
  { value: 'heavily-regulated', label: 'Heavily regulated' }
];

const CHALLENGE_OPTIONS = [
  'scaling-issues',
  'operational-inefficiency',
  'revenue-growth-stagnation',
  'team-alignment-problems',
  'technology-constraints',
  'customer-satisfaction-issues',
  'financial-management-challenges',
  'regulatory-compliance-burden',
  'supply-chain-disruptions',
  'talent-acquisition-retention',
  'digital-transformation-needs',
  'competitive-pressure'
];

const OBJECTIVE_OPTIONS = [
  'improve-margins',
  'accelerate-growth',
  'enhance-customer-satisfaction',
  'increase-operational-efficiency',
  'expand-market-share',
  'develop-new-products',
  'improve-team-performance',
  'reduce-costs',
  'enhance-technology-capabilities',
  'strengthen-competitive-position',
  'improve-compliance-posture',
  'build-organizational-capabilities'
];

export default function NewAssessmentPage() {
  const router = useRouter();
  const { createAssessment, setIndustryClassification, isLoading, error } = useAssessment();

  const [formData, setFormData] = useState<CompanyContextForm>({
    title: '',
    description: '',
    industryClassification: {
      sector: undefined,
      subSector: '',
      regulatoryClassification: 'non-regulated',
      businessModel: undefined,
      companyStage: undefined,
      employeeCount: 0
    },
    primaryChallenges: [],
    strategicObjectives: [],
    resourceConstraints: {
      budget: 'moderate',
      team: 'adequate',
      timeAvailability: 'moderate'
    }
  });

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.title.trim()) {
      errors.title = 'Assessment title is required';
    }

    if (!formData.description.trim()) {
      errors.description = 'Assessment description is required';
    }

    if (!formData.industryClassification.sector) {
      errors.sector = 'Please select your industry sector';
    }

    if (!formData.industryClassification.businessModel) {
      errors.businessModel = 'Please select your business model';
    }

    if (!formData.industryClassification.companyStage) {
      errors.companyStage = 'Please select your company stage';
    }

    if (!formData.industryClassification.employeeCount || formData.industryClassification.employeeCount < 1) {
      errors.employeeCount = 'Please enter a valid employee count';
    }

    if (formData.primaryChallenges.length === 0) {
      errors.primaryChallenges = 'Please select at least one primary business challenge';
    }

    if (formData.strategicObjectives.length === 0) {
      errors.strategicObjectives = 'Please select at least one strategic objective';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      const assessment = await createAssessment(formData.title, formData.description);

      // Set industry classification
      await setIndustryClassification({
        ...formData.industryClassification,
        sector: formData.industryClassification.sector!,
        subSector: formData.industryClassification.subSector || formData.industryClassification.sector!,
        regulatoryClassification: formData.industryClassification.regulatoryClassification!,
        businessModel: formData.industryClassification.businessModel!,
        companyStage: formData.industryClassification.companyStage!,
        employeeCount: formData.industryClassification.employeeCount!
      });

      // Navigate to questionnaire
      router.push(`/assessment/${assessment.id}/questionnaire`);
    } catch (err) {
      console.error('Failed to create assessment:', err);
    }
  };

  const handleChallengeToggle = (challenge: string) => {
    const current = formData.primaryChallenges;
    const updated = current.includes(challenge)
      ? current.filter(c => c !== challenge)
      : [...current, challenge];

    if (updated.length <= 5) { // Max 5 challenges
      setFormData(prev => ({
        ...prev,
        primaryChallenges: updated
      }));
    }
  };

  const handleObjectiveToggle = (objective: string) => {
    const current = formData.strategicObjectives;
    const updated = current.includes(objective)
      ? current.filter(o => o !== objective)
      : [...current, objective];

    if (updated.length <= 5) { // Max 5 objectives
      setFormData(prev => ({
        ...prev,
        strategicObjectives: updated
      }));
    }
  };

  const formatLabel = (value: string) => {
    return value.split('-').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Create New Assessment</h1>
          <p className="mt-2 text-lg text-gray-600">
            Help us understand your company context to provide personalized analysis
          </p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Basic Information */}
          <div className="bg-white shadow-sm rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Basic Information</h2>

            <div className="grid grid-cols-1 gap-6">
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                  Assessment Title *
                </label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g., Q4 2024 Operational Assessment"
                  className={validationErrors.title ? 'border-red-300' : ''}
                />
                {validationErrors.title && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.title}</p>
                )}
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                  Description *
                </label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe the purpose and scope of this assessment..."
                  className={validationErrors.description ? 'border-red-300' : ''}
                  rows={3}
                />
                {validationErrors.description && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.description}</p>
                )}
              </div>
            </div>
          </div>

          {/* Company Profile */}
          <div className="bg-white shadow-sm rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Company Profile</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="sector" className="block text-sm font-medium text-gray-700">
                  Industry Sector *
                </label>
                <Select
                  value={formData.industryClassification.sector || ''}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    industryClassification: { ...prev.industryClassification, sector: e.target.value as any }
                  }))}
                  className={validationErrors.sector ? 'border-red-300' : ''}
                >
                  <option value="">Select sector...</option>
                  {SECTOR_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </Select>
                {validationErrors.sector && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.sector}</p>
                )}
              </div>

              <div>
                <label htmlFor="subSector" className="block text-sm font-medium text-gray-700">
                  Sub-sector
                </label>
                <Input
                  id="subSector"
                  value={formData.industryClassification.subSector}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    industryClassification: { ...prev.industryClassification, subSector: e.target.value }
                  }))}
                  placeholder="e.g., Enterprise Software, FinTech..."
                />
              </div>

              <div>
                <label htmlFor="businessModel" className="block text-sm font-medium text-gray-700">
                  Business Model *
                </label>
                <Select
                  value={formData.industryClassification.businessModel || ''}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    industryClassification: { ...prev.industryClassification, businessModel: e.target.value as any }
                  }))}
                  className={validationErrors.businessModel ? 'border-red-300' : ''}
                >
                  <option value="">Select business model...</option>
                  {BUSINESS_MODEL_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </Select>
                {validationErrors.businessModel && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.businessModel}</p>
                )}
              </div>

              <div>
                <label htmlFor="companyStage" className="block text-sm font-medium text-gray-700">
                  Company Stage *
                </label>
                <Select
                  value={formData.industryClassification.companyStage || ''}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    industryClassification: { ...prev.industryClassification, companyStage: e.target.value as any }
                  }))}
                  className={validationErrors.companyStage ? 'border-red-300' : ''}
                >
                  <option value="">Select company stage...</option>
                  {COMPANY_STAGE_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </Select>
                {validationErrors.companyStage && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.companyStage}</p>
                )}
              </div>

              <div>
                <label htmlFor="employeeCount" className="block text-sm font-medium text-gray-700">
                  Employee Count *
                </label>
                <Input
                  id="employeeCount"
                  type="number"
                  min="1"
                  value={formData.industryClassification.employeeCount || ''}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    industryClassification: { ...prev.industryClassification, employeeCount: parseInt(e.target.value) || 0 }
                  }))}
                  placeholder="Number of employees"
                  className={validationErrors.employeeCount ? 'border-red-300' : ''}
                />
                {validationErrors.employeeCount && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.employeeCount}</p>
                )}
              </div>

              <div>
                <label htmlFor="regulatory" className="block text-sm font-medium text-gray-700">
                  Regulatory Environment
                </label>
                <Select
                  value={formData.industryClassification.regulatoryClassification || 'non-regulated'}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    industryClassification: { ...prev.industryClassification, regulatoryClassification: e.target.value as any }
                  }))}
                >
                  {REGULATORY_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </Select>
              </div>
            </div>
          </div>

          {/* Business Context */}
          <div className="bg-white shadow-sm rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Business Context</h2>

            <div className="space-y-6">
              {/* Primary Challenges */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Primary Business Challenges * (Select up to 5)
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {CHALLENGE_OPTIONS.map(challenge => (
                    <label key={challenge} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.primaryChallenges.includes(challenge)}
                        onChange={() => handleChallengeToggle(challenge)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        disabled={!formData.primaryChallenges.includes(challenge) && formData.primaryChallenges.length >= 5}
                      />
                      <span className="text-sm text-gray-700">{formatLabel(challenge)}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Selected: {formData.primaryChallenges.length}/5
                </p>
                {validationErrors.primaryChallenges && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.primaryChallenges}</p>
                )}
              </div>

              {/* Strategic Objectives */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Strategic Objectives * (Select up to 5)
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {OBJECTIVE_OPTIONS.map(objective => (
                    <label key={objective} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.strategicObjectives.includes(objective)}
                        onChange={() => handleObjectiveToggle(objective)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        disabled={!formData.strategicObjectives.includes(objective) && formData.strategicObjectives.length >= 5}
                      />
                      <span className="text-sm text-gray-700">{formatLabel(objective)}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Selected: {formData.strategicObjectives.length}/5
                </p>
                {validationErrors.strategicObjectives && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.strategicObjectives}</p>
                )}
              </div>
            </div>
          </div>

          {/* Resource Constraints */}
          <div className="bg-white shadow-sm rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Resource Constraints</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Budget</label>
                <Select
                  value={formData.resourceConstraints.budget}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    resourceConstraints: { ...prev.resourceConstraints, budget: e.target.value as any }
                  }))}
                >
                  <option value="limited">Limited</option>
                  <option value="moderate">Moderate</option>
                  <option value="substantial">Substantial</option>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Team Capacity</label>
                <Select
                  value={formData.resourceConstraints.team}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    resourceConstraints: { ...prev.resourceConstraints, team: e.target.value as any }
                  }))}
                >
                  <option value="stretched">Stretched</option>
                  <option value="adequate">Adequate</option>
                  <option value="well-staffed">Well-staffed</option>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Time Availability</label>
                <Select
                  value={formData.resourceConstraints.timeAvailability}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    resourceConstraints: { ...prev.resourceConstraints, timeAvailability: e.target.value as any }
                  }))}
                >
                  <option value="minimal">Minimal</option>
                  <option value="moderate">Moderate</option>
                  <option value="flexible">Flexible</option>
                </Select>
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-center">
            <Button
              type="submit"
              disabled={isLoading}
              className="px-8 py-3 text-lg"
            >
              {isLoading ? 'Creating Assessment...' : 'Start Assessment'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}