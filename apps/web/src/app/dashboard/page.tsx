'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';

import AssessmentCard from '@/components/AssessmentCard';
import { useAssessment } from '@/hooks/useAssessment';
import { useAuth } from '@/lib/auth/auth-context';
import { Assessment } from '@/types';

export default function DashboardPage() {
  const router = useRouter();
  const { listAssessments } = useAssessment();
  const { user, company, isAuthenticated, isLoading } = useAuth();
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [assessmentsLoading, setAssessmentsLoading] = useState(false);
  const [assessmentsError, setAssessmentsError] = useState<string | null>(null);

  const loadDraftAssessments = useCallback(async () => {
    try {
      setAssessmentsLoading(true);
      setAssessmentsError(null);

      // Load draft/in-progress assessments
      const result = await listAssessments([
        'payment-pending',
        'document-processing',
        'triaging',
        'analyzing',
        'synthesizing',
        'validating',
      ]);

      // Defensive programming: ensure assessments is always an array
      const assessments = Array.isArray(result?.assessments) ? result.assessments : [];
      setAssessments(assessments);
    } catch (error) {
      console.error('Failed to load assessments:', error);
      setAssessmentsError(error instanceof Error ? error.message : 'Failed to load assessments');
    } finally {
      setAssessmentsLoading(false);
    }
  }, [listAssessments]);

  // Load assessments when user is available
  useEffect(() => {
    if (isAuthenticated && user && !isLoading) {
      loadDraftAssessments();
    }
  }, [isAuthenticated, user, isLoading, loadDraftAssessments]);

  const handleResumeAssessment = (assessmentId: string) => {
    router.push(`/assessment/${assessmentId}/questionnaire`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center">
                <h1 className="text-xl font-bold text-gray-900">ScaleMap Dashboard</h1>
              </div>
              <nav className="flex space-x-8">
                <a href="/monitoring" className="text-gray-500 hover:text-gray-900">
                  Monitoring
                </a>
                <a href="/settings" className="text-gray-500 hover:text-gray-900">
                  Settings
                </a>
                <a href="/profile" className="text-gray-500 hover:text-gray-900">
                  Profile
                </a>
                <a href="/" className="text-gray-500 hover:text-gray-900">
                  Public Site
                </a>
              </nav>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white p-6 rounded-lg shadow">
                  <div className="h-6 bg-gray-200 rounded w-3/4 mb-4"></div>
                  <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">ScaleMap Dashboard</h1>
            </div>
            <nav className="flex space-x-8">
              <a href="/monitoring" className="text-gray-500 hover:text-gray-900">
                Monitoring
              </a>
              <a href="/settings" className="text-gray-500 hover:text-gray-900">
                Settings
              </a>
              <a href="/profile" className="text-gray-500 hover:text-gray-900">
                Profile
              </a>
              <a href="/" className="text-gray-500 hover:text-gray-900">
                Public Site
              </a>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Welcome back{user?.firstName ? `, ${user.firstName}` : ''}!
          </h1>
          <p className="text-gray-600">
            Ready to scale your business with AI-powered insights and automation?
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <span className="text-2xl">📊</span>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-900">Assessments</h3>
                <p className="text-sm text-gray-600">Create new business assessment</p>
              </div>
            </div>
            <div className="mt-4">
              <Link
                href="/assessment/new"
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200"
              >
                Start Assessment
              </Link>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <span className="text-2xl">📈</span>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-900">Monitoring</h3>
                <p className="text-sm text-gray-600">View system performance</p>
              </div>
            </div>
            <div className="mt-4">
              <Link
                href="/monitoring"
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-green-700 bg-green-100 hover:bg-green-200"
              >
                View Dashboard
              </Link>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <span className="text-2xl">⚙️</span>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-900">Settings</h3>
                <p className="text-sm text-gray-600">Configure your account</p>
              </div>
            </div>
            <div className="mt-4">
              <Link
                href="/settings"
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-purple-700 bg-purple-100 hover:bg-purple-200"
              >
                Manage Settings
              </Link>
            </div>
          </div>
        </div>

        {/* User Info Section */}
        {user && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Account Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-sm font-medium text-gray-500">Email</div>
                <p className="mt-1 text-sm text-gray-900">{user.email}</p>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-500">Name</div>
                <p className="mt-1 text-sm text-gray-900">
                  {user.firstName} {user.lastName}
                </p>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-500">Email Status</div>
                <p className="mt-1">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      user.emailVerified
                        ? 'bg-green-100 text-green-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}
                  >
                    {user.emailVerified ? 'Verified' : 'Pending Verification'}
                  </span>
                </p>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-500">Company</div>
                <p className="mt-1 text-sm text-gray-900">{company?.name || 'No company set'}</p>
              </div>
            </div>
          </div>
        )}

        {/* My Assessments Section */}
        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">My Assessments</h2>
            <Link
              href="/assessment/new"
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200"
            >
              New Assessment
            </Link>
          </div>

          {assessmentsLoading ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <div key={i} className="animate-pulse bg-gray-50 rounded-lg p-4">
                  <div className="h-6 bg-gray-200 rounded w-3/4 mb-3"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                  <div className="h-2 bg-gray-200 rounded w-full"></div>
                </div>
              ))}
            </div>
          ) : assessmentsError ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto bg-red-100 rounded-full flex items-center justify-center mb-4">
                <span className="text-2xl text-red-400">⚠️</span>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to load assessments</h3>
              <p className="text-gray-500 mb-4">{assessmentsError}</p>
              <button
                onClick={loadDraftAssessments}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-600 bg-blue-100 hover:bg-blue-200"
              >
                Try Again
              </button>
            </div>
          ) : !assessments || assessments.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <span className="text-2xl text-gray-400">📊</span>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No assessments in progress</h3>
              <p className="text-gray-500 mb-4">
                Start your first assessment to see your progress here
              </p>
              <Link
                href="/assessment/new"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                Create Assessment
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {(assessments || []).map((assessment) => (
                <AssessmentCard
                  key={assessment.id}
                  assessment={assessment}
                  onResume={() => handleResumeAssessment(assessment.id)}
                />
              ))}
              {assessments && assessments.length > 0 && (
                <div className="pt-4 border-t border-gray-100">
                  <Link
                    href="/assessments"
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    View all assessments →
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
