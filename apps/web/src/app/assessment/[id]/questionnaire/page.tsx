'use client';

import { useParams, useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';

import { AssessmentProgress } from '@/components/assessment/questionnaire/AssessmentProgress';
import { DomainSection } from '@/components/assessment/questionnaire/DomainSection';
import { QuestionNavigation } from '@/components/assessment/questionnaire/QuestionNavigation';
import { DocumentManager } from '@/components/documents/DocumentManager';
import { Button } from '@/components/ui/Button';
import { useAssessment } from '@/hooks/useAssessment';
import { QuestionService } from '@/services/question-service';
import { DomainName } from '@/types';

export default function QuestionnairePage() {
  const params = useParams();
  const router = useRouter();
  const assessmentId = params.id as string;

  const {
    assessment,
    progress,
    isLoading,
    error,
    navigateToDomain,
    answerQuestion,
    getCurrentDomainQuestions,
    saveAssessment,
    submitAssessment,
    canAccessDomain,
    isAutoSaveEnabled,
    lastAutoSave,
  } = useAssessment({
    assessmentId,
    autoSave: true,
  });

  const [questionService] = useState(() => QuestionService.getInstance());
  // const [showProgress, setShowProgress] = useState(false);
  const [currentView, setCurrentView] = useState<
    'questionnaire' | 'progress' | 'summary' | 'documents'
  >('questionnaire');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    questionService.loadQuestionDatabase();
  }, [questionService]);

  useEffect(() => {
    // Set initial domain if none selected
    if (assessment && !progress.currentDomain) {
      navigateToDomain('strategic-alignment');
    }
  }, [assessment, progress.currentDomain, navigateToDomain]);

  const handleDomainChange = async (domain: DomainName) => {
    if (canAccessDomain(domain)) {
      await navigateToDomain(domain);
      setCurrentView('questionnaire');
    }
  };

  const handleAnswerQuestion = async (questionId: string, value: unknown) => {
    try {
      await answerQuestion(questionId, value);
    } catch (err) {
      console.error('Failed to answer question:', err);
    }
  };

  const handleSaveAndExit = async () => {
    setIsSaving(true);
    setSaveError(null);

    try {
      await saveAssessment();
      // Small delay to show success state
      await new Promise((resolve) => setTimeout(resolve, 500));
      router.push('/dashboard');
    } catch (err) {
      console.error('Failed to save assessment:', err);
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to save assessment. Please try again.';
      setSaveError(errorMessage);

      // Auto-clear error after 5 seconds
      setTimeout(() => setSaveError(null), 5000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmitAssessment = async () => {
    setIsSubmitting(true);
    try {
      const submittedAssessment = await submitAssessment();
      router.push(`/assessment/${submittedAssessment.id}/results`);
    } catch (err) {
      console.error('Failed to submit assessment:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getCurrentDomainInfo = () => {
    if (!progress.currentDomain) return null;

    const domain = progress.currentDomain;
    const domainProgress = progress.domains?.[domain];
    if (!domainProgress) return null;
    const questions = getCurrentDomainQuestions();
    const responses = assessment?.domainResponses[domain]?.questions || {};

    return {
      domain,
      progress: domainProgress,
      questions,
      responses,
    };
  };

  const getOverallCompletion = () => {
    if (!progress.domains) {
      return { completedRequired: 0, totalRequired: 0 };
    }

    const totalRequired = Object.values(progress.domains).reduce(
      (sum, domain) => sum + domain.requiredQuestions,
      0
    );
    const completedRequired = Object.entries(assessment?.domainResponses || {}).reduce(
      (sum, [domainName, domainResponse]) => {
        const domainProgress = progress.domains[domainName as DomainName];
        if (!domainProgress) return sum;
        return (
          sum +
          Math.min(Object.keys(domainResponse.questions).length, domainProgress.requiredQuestions)
        );
      },
      0
    );

    return { completedRequired, totalRequired };
  };

  const canSubmit = () => {
    const { completedRequired, totalRequired } = getOverallCompletion();
    return completedRequired >= Math.ceil(totalRequired * 0.7); // 70% of required questions
  };

  if (isLoading && !assessment) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-600">Loading assessment...</p>
        </div>
      </div>
    );
  }

  if (error || !assessment) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Assessment Not Found</h1>
          <p className="text-gray-600 mb-4">{error || 'The assessment could not be loaded.'}</p>
          <Button onClick={() => router.push('/dashboard')}>Return to Dashboard</Button>
        </div>
      </div>
    );
  }

  const currentDomainInfo = getCurrentDomainInfo();
  const { completedRequired, totalRequired } = getOverallCompletion();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <QuestionNavigation
        currentDomain={progress.currentDomain || 'strategic-alignment'}
        progress={progress}
        onDomainChange={handleDomainChange}
        onSaveAndExit={handleSaveAndExit}
        canProceed={true}
        isAutoSaving={isLoading && isAutoSaveEnabled}
        lastSaved={lastAutoSave}
        isSaving={isSaving}
        saveError={saveError}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* View Toggle */}
        <div className="mb-6">
          <div className="flex space-x-1 bg-white p-1 rounded-lg border border-gray-200 w-fit">
            <button
              onClick={() => setCurrentView('questionnaire')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                currentView === 'questionnaire'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Questionnaire
            </button>
            <button
              onClick={() => setCurrentView('progress')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                currentView === 'progress'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Progress Overview
            </button>
            <button
              onClick={() => setCurrentView('summary')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                currentView === 'summary'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Summary
            </button>
            <button
              onClick={() => setCurrentView('documents')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                currentView === 'documents'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Documents
            </button>
          </div>
        </div>

        {/* Main Content */}
        {currentView === 'questionnaire' && currentDomainInfo && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Main Questionnaire */}
            <div className="lg:col-span-3">
              <DomainSection
                domain={currentDomainInfo.domain}
                title={getDomainTitle(currentDomainInfo.domain)}
                description={getDomainDescription(currentDomainInfo.domain)}
                questions={currentDomainInfo.questions}
                responses={currentDomainInfo.responses}
                progress={currentDomainInfo.progress}
                industryClassification={assessment.industryClassification}
                onAnswer={handleAnswerQuestion}
                onNext={() => {
                  const nextDomain = getNextDomain(currentDomainInfo.domain);
                  if (nextDomain) {
                    handleDomainChange(nextDomain);
                  }
                }}
                onPrevious={() => {
                  const previousDomain = getPreviousDomain(currentDomainInfo.domain);
                  if (previousDomain) {
                    handleDomainChange(previousDomain);
                  }
                }}
                canProceed={canAccessDomain(
                  getNextDomain(currentDomainInfo.domain) || currentDomainInfo.domain
                )}
                isLastDomain={currentDomainInfo.domain === 'change-management'}
              />
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-1">
              <div className="sticky top-24 space-y-6">
                {/* Mini Progress */}
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Quick Progress</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Overall:</span>
                      <span className="font-medium">{progress.overall}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Required:</span>
                      <span className="font-medium">
                        {completedRequired}/{totalRequired}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Time Left:</span>
                      <span className="font-medium">{progress.estimatedTimeRemaining}</span>
                    </div>
                  </div>

                  <Button
                    onClick={() => setCurrentView('progress')}
                    variant="outline"
                    size="sm"
                    className="w-full mt-3"
                  >
                    View Full Progress
                  </Button>
                </div>

                {/* Submit Button */}
                {canSubmit() && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h3 className="text-sm font-medium text-green-900 mb-2">Ready to Submit</h3>
                    <p className="text-sm text-green-700 mb-3">
                      You&apos;ve completed enough questions for analysis. Submit now or continue to
                      improve accuracy.
                    </p>
                    <Button
                      onClick={handleSubmitAssessment}
                      disabled={isSubmitting}
                      className="w-full bg-green-600 hover:bg-green-700"
                    >
                      {isSubmitting ? 'Submitting...' : 'Submit Assessment'}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {currentView === 'progress' && (
          <AssessmentProgress
            progress={progress}
            onDomainClick={handleDomainChange}
            currentDomain={progress.currentDomain}
            assessment={assessment}
          />
        )}

        {currentView === 'documents' && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Supporting Documents</h2>
              <p className="text-gray-600">
                Upload documents to support your assessment responses. These documents help provide
                context and evidence for your answers across all domains.
              </p>
            </div>
            <DocumentManager
              assessmentId={assessmentId}
              allowUpload={true}
              allowDelete={true}
              domain={progress.currentDomain}
            />
          </div>
        )}

        {currentView === 'summary' && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Assessment Summary</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Overall Progress</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Total Progress:</span>
                    <span className="font-medium">{progress.overall}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Required Questions:</span>
                    <span className="font-medium">
                      {completedRequired} of {totalRequired}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Quality Score:</span>
                    <span
                      className={`font-medium ${
                        progress.completeness >= 85
                          ? 'text-green-600'
                          : progress.completeness >= 70
                            ? 'text-yellow-600'
                            : 'text-red-600'
                      }`}
                    >
                      {progress.completeness}%
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Assessment Details</h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium">Title:</span> {assessment.title}
                  </div>
                  <div>
                    <span className="font-medium">Created:</span>{' '}
                    {new Date(assessment.createdAt).toLocaleDateString()}
                  </div>
                  <div>
                    <span className="font-medium">Last Updated:</span>{' '}
                    {new Date(assessment.updatedAt).toLocaleDateString()}
                  </div>
                  {assessment.industryClassification && (
                    <>
                      <div>
                        <span className="font-medium">Sector:</span>{' '}
                        {assessment.industryClassification.sector}
                      </div>
                      <div>
                        <span className="font-medium">Stage:</span>{' '}
                        {assessment.industryClassification.companyStage}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="border-t pt-6">
              <div className="flex justify-between items-center">
                <div>
                  {canSubmit() ? (
                    <div className="text-green-600">
                      <span className="font-medium">✓ Ready to submit</span> - You have sufficient
                      responses for analysis
                    </div>
                  ) : (
                    <div className="text-yellow-600">
                      <span className="font-medium">⏳ In progress</span> - Complete more required
                      questions to submit
                    </div>
                  )}
                </div>

                <div className="flex space-x-3">
                  <Button variant="outline" onClick={() => setCurrentView('questionnaire')}>
                    Continue Assessment
                  </Button>
                  {canSubmit() && (
                    <Button
                      onClick={handleSubmitAssessment}
                      disabled={isSubmitting}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {isSubmitting ? 'Submitting...' : 'Submit Assessment'}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper functions
const DOMAIN_TITLES: Record<DomainName, string> = {
  'strategic-alignment': 'Strategic Alignment & Vision',
  'financial-management': 'Financial Management & Capital Efficiency',
  'revenue-engine': 'Revenue Engine & Growth Systems',
  'operational-excellence': 'Operational Excellence & Process Management',
  'people-organization': 'People & Organizational Development',
  'technology-data': 'Technology & Data Infrastructure',
  'customer-experience': 'Customer Experience & Product Development',
  'supply-chain': 'Supply Chain & Operations',
  'risk-compliance': 'Risk Management & Compliance',
  partnerships: 'External Partnerships & Ecosystem',
  'customer-success': 'Customer Success & Growth',
  'change-management': 'Change Management & Implementation',
};

const DOMAIN_DESCRIPTIONS: Record<DomainName, string> = {
  'strategic-alignment':
    'Assess how well your organization aligns strategy across all levels and adapts to market changes.',
  'financial-management':
    'Evaluate financial planning, cash flow management, and capital efficiency practices.',
  'revenue-engine': 'Analyze sales processes, customer acquisition, and revenue growth systems.',
  'operational-excellence': 'Review process management, efficiency, and scalability of operations.',
  'people-organization':
    'Examine talent management, culture, and organizational development capabilities.',
  'technology-data': 'Assess technology infrastructure, data management, and digital capabilities.',
  'customer-experience':
    'Evaluate customer satisfaction, product development, and experience optimization.',
  'supply-chain':
    'Review supply chain efficiency, vendor relationships, and operational resilience.',
  'risk-compliance': 'Analyze risk management practices and regulatory compliance capabilities.',
  partnerships: 'Assess strategic partnerships, ecosystem integration, and external relationships.',
  'customer-success':
    'Evaluate customer lifecycle management, retention, and expansion strategies.',
  'change-management':
    'Review organizational change capabilities and implementation effectiveness.',
};

const DOMAIN_ORDER: DomainName[] = [
  'strategic-alignment',
  'financial-management',
  'revenue-engine',
  'operational-excellence',
  'people-organization',
  'technology-data',
  'customer-experience',
  'supply-chain',
  'risk-compliance',
  'partnerships',
  'customer-success',
  'change-management',
];

function getDomainTitle(domain: DomainName): string {
  return DOMAIN_TITLES[domain] || domain;
}

function getDomainDescription(domain: DomainName): string {
  return DOMAIN_DESCRIPTIONS[domain] || '';
}

function getNextDomain(current: DomainName): DomainName | null {
  const currentIndex = DOMAIN_ORDER.indexOf(current);
  return currentIndex < DOMAIN_ORDER.length - 1 ? (DOMAIN_ORDER[currentIndex + 1] ?? null) : null;
}

function getPreviousDomain(current: DomainName): DomainName | null {
  const currentIndex = DOMAIN_ORDER.indexOf(current);
  return currentIndex > 0 ? (DOMAIN_ORDER[currentIndex - 1] ?? null) : null;
}
