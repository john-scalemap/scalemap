'use client';

import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '../../../../lib/auth/auth-context';
import { ProgressTracker } from '../../../../components/assessment/ProgressTracker';
import { Assessment } from '../../../../types/assessment';

export default function ProgressPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();

  const assessmentId = params.id as string;

  const handleAssessmentComplete = (assessment: Assessment) => {
    // Redirect to results page when assessment is completed
    router.push(`/assessment/${assessmentId}/results`);
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Please log in to view assessment progress.</p>
          <button
            onClick={() => router.push('/login')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Log In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Assessment Progress</h1>
              <p className="text-gray-600 mt-2">
                Track the real-time progress of your operational assessment
              </p>
            </div>
            <button
              onClick={() => router.push('/dashboard')}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Back to Dashboard
            </button>
          </div>
        </div>

        {/* Progress Tracker */}
        <ProgressTracker
          assessmentId={assessmentId}
          onComplete={handleAssessmentComplete}
          showDetailedProgress={true}
        />

        {/* Help Section */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">What happens during processing?</h3>
          <div className="space-y-3 text-sm text-blue-800">
            <div className="flex items-start space-x-3">
              <span className="font-medium">1. Document Processing:</span>
              <span>AI extracts and analyzes key information from your uploaded documents</span>
            </div>
            <div className="flex items-start space-x-3">
              <span className="font-medium">2. Domain Triage:</span>
              <span>Our triage system identifies which business domains need specialist analysis</span>
            </div>
            <div className="flex items-start space-x-3">
              <span className="font-medium">3. Specialist Analysis:</span>
              <span>12 specialist AI agents analyze critical areas in parallel</span>
            </div>
            <div className="flex items-start space-x-3">
              <span className="font-medium">4. Synthesis & Prioritization:</span>
              <span>Advanced reasoning combines insights and ranks recommendations by impact</span>
            </div>
            <div className="flex items-start space-x-3">
              <span className="font-medium">5. Quality Validation:</span>
              <span>Final review ensures accuracy and completeness before delivery</span>
            </div>
          </div>
        </div>

        {/* Contact Support */}
        <div className="mt-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-900">Need assistance?</h4>
              <p className="text-sm text-gray-600">
                Our team monitors all assessments and will reach out if any issues arise.
              </p>
            </div>
            <button className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700">
              Contact Support
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}