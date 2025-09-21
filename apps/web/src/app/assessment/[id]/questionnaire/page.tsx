'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '../../../../lib/auth/auth-context';
import { AssessmentQuestionnaire } from '../../../../components/assessment/AssessmentQuestionnaire';
import { Assessment, DomainResponse } from '../../../../types/assessment';

export default function QuestionnairePage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const assessmentId = params.id as string;

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    fetchAssessment();
  }, [user, assessmentId]);

  const fetchAssessment = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await fetch(`/api/assessment/${assessmentId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to fetch assessment');
      }

      const data = await response.json();
      setAssessment(data.data.assessment);
    } catch (error) {
      console.error('Error fetching assessment:', error);
      setError(error instanceof Error ? error.message : 'Failed to load assessment');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (domainResponses: Record<string, DomainResponse>) => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await fetch(`/api/assessment/${assessmentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          domainResponses
        })
      });

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to save responses');
      }

      const data = await response.json();
      setAssessment(data.data.assessment);
    } catch (error) {
      console.error('Error saving responses:', error);
      throw error;
    }
  };

  const handleComplete = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await fetch(`/api/assessment/${assessmentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          status: 'document-processing'
        })
      });

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to complete assessment');
      }

      // Redirect to progress tracking page
      router.push(`/assessment/${assessmentId}/progress`);
    } catch (error) {
      console.error('Error completing assessment:', error);
      throw error;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading assessment...</p>
        </div>
      </div>
    );
  }

  if (error || !assessment) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Unable to Load Assessment</h1>
          <p className="text-gray-600 mb-4">{error || 'The assessment could not be found.'}</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (assessment.status === 'completed') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-green-500 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Assessment Completed</h1>
          <p className="text-gray-600 mb-4">This assessment has already been completed.</p>
          <button
            onClick={() => router.push(`/assessment/${assessmentId}/results`)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            View Results
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AssessmentQuestionnaire
        assessment={assessment}
        onSave={handleSave}
        onComplete={handleComplete}
      />
    </div>
  );
}