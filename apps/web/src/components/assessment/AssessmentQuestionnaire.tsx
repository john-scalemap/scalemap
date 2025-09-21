'use client';

import { useState, useEffect } from 'react';
import { DomainName, Question, QuestionResponse, DomainResponse, Assessment } from '../../types/assessment';
import { assessmentDomains, getDomainQuestions, domainDisplayNames } from '../../data/assessment-questions';

interface AssessmentQuestionnaireProps {
  assessment: Assessment;
  onSave: (domainResponses: Record<string, DomainResponse>) => Promise<void>;
  onComplete: () => Promise<void>;
}

interface QuestionComponentProps {
  question: Question;
  value: QuestionResponse['value'] | undefined;
  onChange: (value: QuestionResponse['value']) => void;
  error?: string;
}

const QuestionComponent: React.FC<QuestionComponentProps> = ({
  question,
  value,
  onChange,
  error
}) => {
  const handleChange = (newValue: QuestionResponse['value']) => {
    onChange(newValue);
  };

  const renderInput = () => {
    switch (question.type) {
      case 'scale':
        return (
          <div className="space-y-3">
            {question.scale?.labels.map((label, index) => {
              const scaleValue = question.scale!.min + index;
              return (
                <label key={index} className="flex items-start space-x-3 cursor-pointer">
                  <input
                    type="radio"
                    name={question.id}
                    value={scaleValue}
                    checked={value === scaleValue}
                    onChange={() => handleChange(scaleValue)}
                    className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">
                      {scaleValue} - {label}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        );

      case 'multiple-choice':
        return (
          <div className="space-y-2">
            {question.options?.map((option, index) => (
              <label key={index} className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="radio"
                  name={question.id}
                  value={option}
                  checked={value === option}
                  onChange={() => handleChange(option)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <span className="text-sm text-gray-900">{option}</span>
              </label>
            ))}
          </div>
        );

      case 'multiple-select':
        return (
          <div className="space-y-2">
            {question.options?.map((option, index) => {
              const currentValues = Array.isArray(value) ? value : [];
              const isChecked = currentValues.includes(option);

              return (
                <label key={index} className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => {
                      if (e.target.checked) {
                        handleChange([...currentValues, option]);
                      } else {
                        handleChange(currentValues.filter(v => v !== option));
                      }
                    }}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="text-sm text-gray-900">{option}</span>
                </label>
              );
            })}
          </div>
        );

      case 'text':
        return (
          <textarea
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => handleChange(e.target.value)}
            rows={3}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            placeholder="Enter your response..."
          />
        );

      case 'number':
        return (
          <input
            type="number"
            value={typeof value === 'number' ? value : ''}
            onChange={(e) => handleChange(parseInt(e.target.value) || 0)}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            placeholder="Enter a number..."
          />
        );

      case 'boolean':
        return (
          <div className="space-y-2">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="radio"
                name={question.id}
                checked={value === true}
                onChange={() => handleChange(true)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
              />
              <span className="text-sm text-gray-900">Yes</span>
            </label>
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="radio"
                name={question.id}
                checked={value === false}
                onChange={() => handleChange(false)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
              />
              <span className="text-sm text-gray-900">No</span>
            </label>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start space-x-2">
        <h3 className="text-lg font-medium text-gray-900 flex-1">
          {question.question}
        </h3>
        {question.required && (
          <span className="text-red-500 text-sm font-medium">*</span>
        )}
      </div>

      {renderInput()}

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  );
};

export const AssessmentQuestionnaire: React.FC<AssessmentQuestionnaireProps> = ({
  assessment,
  onSave,
  onComplete
}) => {
  const [currentDomainIndex, setCurrentDomainIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, DomainResponse>>(assessment.domainResponses || {});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  const domains = assessmentDomains.map(d => d.domain);
  const currentDomain = domains[currentDomainIndex];

  const isRegulated = assessment.industryClassification?.regulatoryClassification === 'heavily-regulated';
  const companyStage = assessment.companyStage;

  const currentQuestions = getDomainQuestions(currentDomain, companyStage, isRegulated);

  useEffect(() => {
    // Initialize domain response if it doesn't exist
    if (!responses[currentDomain]) {
      setResponses(prev => ({
        ...prev,
        [currentDomain]: {
          domain: currentDomain,
          questions: {},
          completeness: 0,
          lastUpdated: new Date().toISOString()
        }
      }));
    }
  }, [currentDomain, responses]);

  const handleQuestionResponse = (questionId: string, value: QuestionResponse['value']) => {
    const now = new Date().toISOString();

    setResponses(prev => {
      const domainResponse = prev[currentDomain] || {
        domain: currentDomain,
        questions: {},
        completeness: 0,
        lastUpdated: now
      };

      const updatedQuestions = {
        ...domainResponse.questions,
        [questionId]: {
          questionId,
          value,
          timestamp: now
        } as QuestionResponse
      };

      // Calculate completeness
      const requiredQuestions = currentQuestions.filter(q => q.required);
      const completedRequired = requiredQuestions.filter(q =>
        updatedQuestions[q.id] && updatedQuestions[q.id].value !== undefined && updatedQuestions[q.id].value !== ''
      ).length;
      const completeness = requiredQuestions.length > 0 ? (completedRequired / requiredQuestions.length) * 100 : 100;

      return {
        ...prev,
        [currentDomain]: {
          ...domainResponse,
          questions: updatedQuestions,
          completeness,
          lastUpdated: now
        }
      };
    });

    // Clear error for this question
    if (errors[questionId]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[questionId];
        return newErrors;
      });
    }
  };

  const validateCurrentDomain = (): boolean => {
    const domainResponse = responses[currentDomain];
    const newErrors: Record<string, string> = {};

    if (!domainResponse) {
      return false;
    }

    const requiredQuestions = currentQuestions.filter(q => q.required);

    for (const question of requiredQuestions) {
      const response = domainResponse.questions[question.id];
      if (!response || response.value === undefined || response.value === '') {
        newErrors[question.id] = 'This question is required';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = async () => {
    if (!validateCurrentDomain()) {
      return;
    }

    setIsLoading(true);
    try {
      await onSave(responses);

      if (currentDomainIndex < domains.length - 1) {
        setCurrentDomainIndex(prev => prev + 1);
      } else {
        await onComplete();
      }
    } catch (error) {
      console.error('Error saving responses:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrevious = () => {
    if (currentDomainIndex > 0) {
      setCurrentDomainIndex(prev => prev - 1);
    }
  };

  const handleSaveDraft = async () => {
    setIsLoading(true);
    try {
      await onSave(responses);
    } catch (error) {
      console.error('Error saving draft:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const currentDomainResponse = responses[currentDomain];
  const progress = ((currentDomainIndex + (currentDomainResponse?.completeness || 0) / 100) / domains.length) * 100;

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>Domain {currentDomainIndex + 1} of {domains.length}</span>
          <span>{Math.round(progress)}% Complete</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Domain Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {domainDisplayNames[currentDomain]}
        </h1>
        <p className="text-gray-600">
          {assessmentDomains.find(d => d.domain === currentDomain)?.description}
        </p>
      </div>

      {/* Questions */}
      <div className="space-y-8">
        {currentQuestions.map((question, index) => {
          const response = currentDomainResponse?.questions[question.id];
          return (
            <div key={question.id} className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="mb-4">
                <span className="text-sm text-gray-500 font-medium">
                  Question {index + 1} of {currentQuestions.length}
                </span>
              </div>

              <QuestionComponent
                question={question}
                value={response?.value}
                onChange={(value) => handleQuestionResponse(question.id, value)}
                error={errors[question.id]}
              />
            </div>
          );
        })}
      </div>

      {/* Navigation */}
      <div className="flex justify-between items-center mt-12 pt-6 border-t border-gray-200">
        <button
          onClick={handlePrevious}
          disabled={currentDomainIndex === 0}
          className="px-6 py-3 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Previous Domain
        </button>

        <div className="flex space-x-4">
          <button
            onClick={handleSaveDraft}
            disabled={isLoading}
            className="px-6 py-3 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            {isLoading ? 'Saving...' : 'Save Draft'}
          </button>

          <button
            onClick={handleNext}
            disabled={isLoading}
            className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? 'Processing...' :
             currentDomainIndex === domains.length - 1 ? 'Complete Assessment' : 'Next Domain'}
          </button>
        </div>
      </div>

      {/* Domain Completion Summary */}
      <div className="mt-8 bg-gray-50 rounded-lg p-4">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Assessment Progress</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {domains.map((domain, index) => {
            const domainResponse = responses[domain];
            const completeness = domainResponse?.completeness || 0;
            const isActive = index === currentDomainIndex;
            const isCompleted = completeness === 100;

            return (
              <div
                key={domain}
                className={`p-3 rounded border text-sm ${
                  isActive
                    ? 'border-blue-500 bg-blue-50'
                    : isCompleted
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 bg-white'
                }`}
              >
                <div className={`font-medium ${
                  isActive ? 'text-blue-700' : isCompleted ? 'text-green-700' : 'text-gray-700'
                }`}>
                  {domainDisplayNames[domain]}
                </div>
                <div className={`text-xs ${
                  isActive ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-500'
                }`}>
                  {Math.round(completeness)}% complete
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};