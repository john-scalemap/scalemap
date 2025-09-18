'use client';

import { useState } from 'react';
import { useAssessmentApi } from '@/hooks/useAuthenticatedFetch';

interface AssessmentFormData {
  companyName: string;
  contactEmail: string;
  title: string;
  description: string;
}

/**
 * Example assessment form component that uses authenticated API calls
 * Replace your existing assessment creation code with this pattern
 */
export function AssessmentForm() {
  const { createAssessment, loading, error } = useAssessmentApi();
  const [formData, setFormData] = useState<AssessmentFormData>({
    companyName: '',
    contactEmail: '',
    title: '',
    description: '',
  });
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const result = await createAssessment(formData);
      console.log('Assessment created successfully:', result);
      setSuccess(true);

      // Reset form
      setFormData({
        companyName: '',
        contactEmail: '',
        title: '',
        description: '',
      });
    } catch (err) {
      console.error('Assessment creation failed:', err);
      // Error is already set by the hook
    }
  };

  const handleInputChange = (field: keyof AssessmentFormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData(prev => ({
      ...prev,
      [field]: e.target.value
    }));
  };

  if (success) {
    return (
      <div className="p-4 bg-green-100 border border-green-400 text-green-700 rounded">
        Assessment created successfully!
        <button
          onClick={() => setSuccess(false)}
          className="ml-2 underline"
        >
          Create another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md mx-auto p-6 border rounded-lg">
      <h2 className="text-xl font-bold">Create Assessment</h2>

      {error && (
        <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="companyName" className="block text-sm font-medium mb-1">
          Company Name *
        </label>
        <input
          id="companyName"
          type="text"
          value={formData.companyName}
          onChange={handleInputChange('companyName')}
          required
          className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label htmlFor="contactEmail" className="block text-sm font-medium mb-1">
          Contact Email *
        </label>
        <input
          id="contactEmail"
          type="email"
          value={formData.contactEmail}
          onChange={handleInputChange('contactEmail')}
          required
          className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label htmlFor="title" className="block text-sm font-medium mb-1">
          Assessment Title *
        </label>
        <input
          id="title"
          type="text"
          value={formData.title}
          onChange={handleInputChange('title')}
          required
          className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium mb-1">
          Description *
        </label>
        <textarea
          id="description"
          value={formData.description}
          onChange={handleInputChange('description')}
          required
          rows={3}
          className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Creating Assessment...' : 'Create Assessment'}
      </button>
    </form>
  );
}