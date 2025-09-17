'use client';

import { DomainName, Question, QuestionResponse, DomainProgress, IndustryClassification } from '@/types';
import React, { useState, useEffect } from 'react';

import { Button } from '@/components/ui/Button';
import { QuestionService } from '@/services/question-service';

import { QuestionCard } from './QuestionCard';


interface DomainSectionProps {
  domain: DomainName;
  title: string;
  description: string;
  questions: Question[];
  responses: Record<string, QuestionResponse>;
  progress: DomainProgress;
  industryClassification?: IndustryClassification;
  onAnswer: (questionId: string, value: any) => void;
  onNext?: () => void;
  onPrevious?: () => void;
  onComplete?: () => void;
  canProceed?: boolean;
  isLastDomain?: boolean;
  className?: string;
}

const DOMAIN_ICONS: Record<DomainName, string> = {
  'strategic-alignment': '🎯',
  'financial-management': '💰',
  'revenue-engine': '📈',
  'operational-excellence': '⚙️',
  'people-organization': '👥',
  'technology-data': '💻',
  'customer-experience': '🤝',
  'supply-chain': '🔗',
  'risk-compliance': '🛡️',
  'partnerships': '🤝',
  'customer-success': '⭐',
  'change-management': '🔄'
};

const DOMAIN_COLORS: Record<DomainName, string> = {
  'strategic-alignment': 'bg-purple-100 border-purple-200',
  'financial-management': 'bg-green-100 border-green-200',
  'revenue-engine': 'bg-blue-100 border-blue-200',
  'operational-excellence': 'bg-orange-100 border-orange-200',
  'people-organization': 'bg-pink-100 border-pink-200',
  'technology-data': 'bg-indigo-100 border-indigo-200',
  'customer-experience': 'bg-teal-100 border-teal-200',
  'supply-chain': 'bg-yellow-100 border-yellow-200',
  'risk-compliance': 'bg-red-100 border-red-200',
  'partnerships': 'bg-cyan-100 border-cyan-200',
  'customer-success': 'bg-emerald-100 border-emerald-200',
  'change-management': 'bg-violet-100 border-violet-200'
};

export const DomainSection: React.FC<DomainSectionProps> = ({
  domain,
  title,
  description,
  questions,
  responses,
  progress,
  industryClassification,
  onAnswer,
  onNext,
  onPrevious,
  onComplete,
  canProceed = true,
  isLastDomain = false,
  className = ''
}) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [visibleQuestions, setVisibleQuestions] = useState<Question[]>([]);

  // Filter questions based on conditional logic and industry classification, and add follow-up questions
  useEffect(() => {
    const questionService = QuestionService.getInstance();

    const filtered = questions.filter(question => {
      // Check industry-specific conditions
      if (question.industrySpecific) {
        if (industryClassification) {
          // Use the question service for proper industry-specific filtering
          const filter = {
            industryClassification,
            // TODO: Get company profile from props or context
            companyProfile: {
              employeeCount: 100, // Default/example - should come from assessment context
              revenue: '£5M-£10M', // Default/example - should come from assessment context
              hasInternationalOperations: false,
              hasPhysicalProducts: false,
              hasChannelSales: false,
              isRapidGrowth: false
            }
          };

          // Use the service's filtering logic instead of duplicating it here
          const filteredByService = questionService.getQuestionsForDomain(domain, filter);
          return filteredByService.some(q => q.id === question.id);
        }
      }

      // Check conditional logic
      if (question.conditional) {
        const dependentResponse = responses[question.conditional.dependsOn];
        if (!dependentResponse) return false;

        const shouldShow = question.conditional.showIf.includes(String(dependentResponse.value));
        return shouldShow;
      }

      return true;
    });

    // Add follow-up questions for answered questions that have concerning responses
    // Build a map of question -> follow-ups first to avoid insertion order issues
    const followUpMap = new Map<string, Question[]>();

    Object.entries(responses).forEach(([questionId, response]) => {
      const followUps = questionService.getFollowUpQuestions(questionId, response, domain);
      if (followUps.length > 0) {
        followUpMap.set(questionId, followUps);
      }
    });

    // Now build the final ordered list
    const questionsWithFollowUps: Question[] = [];

    filtered.forEach(question => {
      questionsWithFollowUps.push(question);

      // Add any follow-ups for this question
      const followUps = followUpMap.get(question.id);
      if (followUps) {
        followUps.forEach(followUp => {
          // Only add if not already in the list
          if (!questionsWithFollowUps.find(q => q.id === followUp.id)) {
            questionsWithFollowUps.push(followUp);
          }
        });
      }
    });

    setVisibleQuestions(questionsWithFollowUps);

    // Reset current question index if it's out of bounds
    if (currentQuestionIndex >= questionsWithFollowUps.length && questionsWithFollowUps.length > 0) {
      setCurrentQuestionIndex(0);
    }
  }, [questions, responses, industryClassification, currentQuestionIndex, domain]);

  const handleValidationError = (questionId: string, error: string | null) => {
    setValidationErrors(prev => {
      const updated = { ...prev };
      if (error) {
        updated[questionId] = error;
      } else {
        delete updated[questionId];
      }
      return updated;
    });
  };

  const canNavigateNext = () => {
    if (currentQuestionIndex >= visibleQuestions.length - 1) return false;

    const currentQuestion = visibleQuestions[currentQuestionIndex];
    if (currentQuestion.required) {
      const hasResponse = currentQuestion.id in responses;
      const hasValidationError = currentQuestion.id in validationErrors;
      return hasResponse && !hasValidationError;
    }

    return true;
  };

  const canNavigatePrevious = () => {
    return currentQuestionIndex > 0;
  };

  const canCompleteDomain = () => {
    const requiredQuestions = visibleQuestions.filter(q => q.required);
    const answeredRequired = requiredQuestions.filter(q => q.id in responses && !(q.id in validationErrors));
    return answeredRequired.length >= requiredQuestions.length * 0.8; // 80% of required questions
  };

  const getProgressPercentage = () => {
    if (visibleQuestions.length === 0) return 0;
    const answeredCount = visibleQuestions.filter(q => q.id in responses).length;
    return Math.round((answeredCount / visibleQuestions.length) * 100);
  };

  const getRequiredProgress = () => {
    const requiredQuestions = visibleQuestions.filter(q => q.required);
    if (requiredQuestions.length === 0) return 100;
    const answeredRequired = requiredQuestions.filter(q => q.id in responses).length;
    return Math.round((answeredRequired / requiredQuestions.length) * 100);
  };

  const nextQuestion = () => {
    if (canNavigateNext()) {
      setCurrentQuestionIndex(prev => Math.min(prev + 1, visibleQuestions.length - 1));
    }
  };

  const previousQuestion = () => {
    if (canNavigatePrevious()) {
      setCurrentQuestionIndex(prev => Math.max(prev - 1, 0));
    }
  };

  const jumpToQuestion = (index: number) => {
    if (index >= 0 && index < visibleQuestions.length) {
      setCurrentQuestionIndex(index);
    }
  };

  if (visibleQuestions.length === 0) {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
        <div className="text-center py-8">
          <div className="text-4xl mb-4">{DOMAIN_ICONS[domain]}</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">{title}</h2>
          <p className="text-gray-600 mb-4">No questions available for this domain based on your company profile.</p>
          <Button onClick={onNext} disabled={!canProceed}>
            Continue to Next Domain
          </Button>
        </div>
      </div>
    );
  }

  const currentQuestion = visibleQuestions[currentQuestionIndex];

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Domain Header */}
      <div className={`rounded-lg border p-6 ${DOMAIN_COLORS[domain]}`}>
        <div className="flex items-center space-x-4">
          <div className="text-4xl">{DOMAIN_ICONS[domain]}</div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
            <p className="text-gray-700 mt-1">{description}</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-900">{getProgressPercentage()}%</div>
            <div className="text-sm text-gray-600">Complete</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-4">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Overall Progress</span>
            <span>{Object.keys(responses).length} of {visibleQuestions.length} answered</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${getProgressPercentage()}%` }}
            />
          </div>

          {/* Required Questions Progress */}
          <div className="flex justify-between text-sm text-gray-600 mb-1 mt-2">
            <span>Required Questions</span>
            <span>{getRequiredProgress()}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1">
            <div
              className="bg-green-600 h-1 rounded-full transition-all duration-300"
              style={{ width: `${getRequiredProgress()}%` }}
            />
          </div>
        </div>
      </div>

      {/* Question Navigation */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            Question {currentQuestionIndex + 1} of {visibleQuestions.length}
          </h3>
          <div className="flex space-x-2">
            {visibleQuestions.map((_, index) => (
              <button
                key={index}
                onClick={() => jumpToQuestion(index)}
                className={`
                  w-8 h-8 rounded-full text-sm font-medium transition-colors
                  ${index === currentQuestionIndex
                    ? 'bg-blue-600 text-white'
                    : responses[visibleQuestions[index].id]
                    ? 'bg-green-100 text-green-800 border border-green-200'
                    : 'bg-gray-100 text-gray-600 border border-gray-200'
                  }
                `}
              >
                {index + 1}
              </button>
            ))}
          </div>
        </div>

        {/* Current Question */}
        <QuestionCard
          question={currentQuestion}
          response={responses[currentQuestion.id]}
          onAnswer={onAnswer}
          onValidationError={handleValidationError}
          isRequired={currentQuestion.required}
          showValidation={true}
        />

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-6">
          <Button
            variant="outline"
            onClick={previousQuestion}
            disabled={!canNavigatePrevious()}
          >
            Previous Question
          </Button>

          <div className="flex space-x-3">
            {currentQuestionIndex < visibleQuestions.length - 1 ? (
              <Button
                onClick={nextQuestion}
                disabled={!canNavigateNext()}
              >
                Next Question
              </Button>
            ) : (
              <div className="space-x-3">
                {canCompleteDomain() && (
                  <Button
                    onClick={onComplete}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    Complete Domain
                  </Button>
                )}
                {!isLastDomain && (
                  <Button
                    onClick={onNext}
                    disabled={!canProceed}
                  >
                    Next Domain
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Domain Summary */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-2">Domain Summary</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Total Questions:</span>
            <span className="ml-2 font-medium">{visibleQuestions.length}</span>
          </div>
          <div>
            <span className="text-gray-600">Required:</span>
            <span className="ml-2 font-medium">
              {visibleQuestions.filter(q => q.required).length}
            </span>
          </div>
          <div>
            <span className="text-gray-600">Optional:</span>
            <span className="ml-2 font-medium">
              {visibleQuestions.filter(q => !q.required).length}
            </span>
          </div>
        </div>

        {getRequiredProgress() < 100 && (
          <div className="mt-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
            <p>Complete at least 80% of required questions to activate specialist agent analysis for this domain.</p>
          </div>
        )}
      </div>
    </div>
  );
};