'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../lib/auth/auth-context';
import { AssessmentContext, CreateAssessmentRequest } from '../../../types/assessment';

interface AssessmentFormData {
  title: string;
  description: string;
  primaryBusinessChallenges: string[];
  strategicObjectives: string[];
  resourceConstraints: {
    budget: 'limited' | 'moderate' | 'substantial';
    team: 'stretched' | 'adequate' | 'well-staffed';
    timeAvailability: 'minimal' | 'moderate' | 'flexible';
  };
}

const businessChallengeOptions = [
  'Scaling operations efficiently',
  'Customer acquisition and retention',
  'Revenue growth and profitability',
  'Team building and talent retention',
  'Technology infrastructure and data management',
  'Market expansion and competition',
  'Financial management and cash flow',
  'Operational efficiency and process optimization',
  'Strategic planning and execution',
  'Risk management and compliance',
  'Supply chain and vendor management',
  'Customer experience and satisfaction'
];

const strategicObjectiveOptions = [
  'Increase market share',
  'Expand to new markets or regions',
  'Launch new products or services',
  'Improve operational efficiency',
  'Enhance customer satisfaction',
  'Build strategic partnerships',
  'Strengthen financial position',
  'Develop organizational capabilities',
  'Implement new technologies',
  'Achieve regulatory compliance',
  'Optimize cost structure',
  'Improve competitive positioning'
];

export default function NewAssessmentPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState<AssessmentFormData>({
    title: '',
    description: '',
    primaryBusinessChallenges: [],
    strategicObjectives: [],
    resourceConstraints: {
      budget: 'moderate',
      team: 'adequate',
      timeAvailability: 'moderate'
    }
  });

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Assessment title is required';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Assessment description is required';
    }

    if (formData.primaryBusinessChallenges.length === 0) {
      newErrors.primaryBusinessChallenges = 'Please select at least one business challenge';
    }

    if (formData.strategicObjectives.length === 0) {
      newErrors.strategicObjectives = 'Please select at least one strategic objective';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    if (!user) {
      router.push('/login');
      return;
    }

    setIsSubmitting(true);

    try {
      const assessmentContext: AssessmentContext = {
        primaryBusinessChallenges: formData.primaryBusinessChallenges,
        strategicObjectives: formData.strategicObjectives,
        resourceConstraints: formData.resourceConstraints
      };

      const request: CreateAssessmentRequest = {
        companyName: 'Company Name', // TODO: Fetch from API
        contactEmail: user.email,
        title: formData.title,
        description: formData.description,
        assessmentContext
      };

      // Call API to create assessment
      const response = await fetch('/api/assessment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to create assessment');
      }

      const data = await response.json();
      const assessmentId = data.data.assessment.id;

      // Redirect to questionnaire
      router.push(`/assessment/${assessmentId}/questionnaire`);

    } catch (error) {
      console.error('Error creating assessment:', error);
      setErrors({ general: error instanceof Error ? error.message : 'Failed to create assessment' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChallengeToggle = (challenge: string) => {
    setFormData(prev => ({
      ...prev,
      primaryBusinessChallenges: prev.primaryBusinessChallenges.includes(challenge)
        ? prev.primaryBusinessChallenges.filter(c => c !== challenge)
        : [...prev.primaryBusinessChallenges, challenge]
    }));
  };

  const handleObjectiveToggle = (objective: string) => {
    setFormData(prev => ({
      ...prev,
      strategicObjectives: prev.strategicObjectives.includes(objective)
        ? prev.strategicObjectives.filter(o => o !== objective)
        : [...prev.strategicObjectives, objective]
    }));
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Please log in to create an assessment.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Create New Assessment</h1>
            <p className="text-gray-600 mt-2">
              Tell us about your business challenges and objectives to customize your assessment experience.
            </p>
          </div>

          {errors.general && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-600">{errors.general}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Basic Information */}
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900">Assessment Details</h2>

              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                  Assessment Title *
                </label>
                <input
                  type="text"
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Q1 2024 Operational Assessment"
                />
                {errors.title && <p className="text-sm text-red-600 mt-1">{errors.title}</p>}
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                  Description *
                </label>
                <textarea
                  id="description"
                  rows={4}
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Describe the purpose and scope of this assessment..."
                />
                {errors.description && <p className="text-sm text-red-600 mt-1">{errors.description}</p>}
              </div>
            </div>

            {/* Business Challenges */}
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900">Primary Business Challenges</h2>
              <p className="text-sm text-gray-600">
                Select the main challenges your organization is currently facing. This helps us focus the assessment on areas most relevant to your situation.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {businessChallengeOptions.map((challenge) => (
                  <label
                    key={challenge}
                    className="flex items-center space-x-3 p-3 border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={formData.primaryBusinessChallenges.includes(challenge)}
                      onChange={() => handleChallengeToggle(challenge)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="text-sm text-gray-700">{challenge}</span>
                  </label>
                ))}
              </div>
              {errors.primaryBusinessChallenges && (
                <p className="text-sm text-red-600">{errors.primaryBusinessChallenges}</p>
              )}
            </div>

            {/* Strategic Objectives */}
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900">Strategic Objectives</h2>
              <p className="text-sm text-gray-600">
                Select your key strategic objectives for the next 12-18 months. This helps us align recommendations with your goals.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {strategicObjectiveOptions.map((objective) => (
                  <label
                    key={objective}
                    className="flex items-center space-x-3 p-3 border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={formData.strategicObjectives.includes(objective)}
                      onChange={() => handleObjectiveToggle(objective)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="text-sm text-gray-700">{objective}</span>
                  </label>
                ))}
              </div>
              {errors.strategicObjectives && (
                <p className="text-sm text-red-600">{errors.strategicObjectives}</p>
              )}
            </div>

            {/* Resource Constraints */}
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900">Resource Assessment</h2>
              <p className="text-sm text-gray-600">
                Help us understand your current resource situation to provide more realistic recommendations.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">Budget Availability</label>
                  <div className="space-y-2">
                    {(['limited', 'moderate', 'substantial'] as const).map((option) => (
                      <label key={option} className="flex items-center space-x-3 cursor-pointer">
                        <input
                          type="radio"
                          name="budget"
                          value={option}
                          checked={formData.resourceConstraints.budget === option}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            resourceConstraints: {
                              ...prev.resourceConstraints,
                              budget: e.target.value as typeof option
                            }
                          }))}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                        />
                        <span className="text-sm text-gray-700 capitalize">{option}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">Team Capacity</label>
                  <div className="space-y-2">
                    {(['stretched', 'adequate', 'well-staffed'] as const).map((option) => (
                      <label key={option} className="flex items-center space-x-3 cursor-pointer">
                        <input
                          type="radio"
                          name="team"
                          value={option}
                          checked={formData.resourceConstraints.team === option}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            resourceConstraints: {
                              ...prev.resourceConstraints,
                              team: e.target.value as typeof option
                            }
                          }))}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                        />
                        <span className="text-sm text-gray-700 capitalize">{option.replace('-', ' ')}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">Time Availability</label>
                  <div className="space-y-2">
                    {(['minimal', 'moderate', 'flexible'] as const).map((option) => (
                      <label key={option} className="flex items-center space-x-3 cursor-pointer">
                        <input
                          type="radio"
                          name="timeAvailability"
                          value={option}
                          checked={formData.resourceConstraints.timeAvailability === option}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            resourceConstraints: {
                              ...prev.resourceConstraints,
                              timeAvailability: e.target.value as typeof option
                            }
                          }))}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                        />
                        <span className="text-sm text-gray-700 capitalize">{option}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end pt-6 border-t border-gray-200">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-8 py-3 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Creating Assessment...' : 'Create Assessment'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}