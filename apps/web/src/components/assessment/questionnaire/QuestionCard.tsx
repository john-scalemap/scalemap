'use client';

import React, { useState, useEffect } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Question, QuestionResponse, QuestionType } from '@/types';

interface QuestionCardProps {
  question: Question;
  response?: QuestionResponse;
  onAnswer: (questionId: string, value: any) => void;
  onValidationError?: (questionId: string, error: string | null) => void;
  isRequired?: boolean;
  disabled?: boolean;
  showValidation?: boolean;
  className?: string;
}

export const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  response,
  onAnswer,
  onValidationError,
  isRequired = false,
  disabled = false,
  showValidation = true,
  className = ''
}) => {
  const [value, setValue] = useState<any>(response?.value || '');
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  // Initialize value from response
  useEffect(() => {
    if (response) {
      setValue(response.value);
    }
  }, [response]);

  const validateValue = (val: any): string | null => {
    if (question.required && (val === null || val === undefined || val === '')) {
      return 'This question is required';
    }

    switch (question.type) {
      case 'scale':
        if (question.scale) {
          const numValue = Number(val);
          if (isNaN(numValue) || numValue < question.scale.min || numValue > question.scale.max) {
            return `Value must be between ${question.scale.min} and ${question.scale.max}`;
          }
        }
        break;

      case 'multiple-choice':
        if (question.options && val && !question.options.includes(val)) {
          return 'Please select a valid option';
        }
        break;

      case 'multiple-select':
        if (question.options && Array.isArray(val)) {
          const invalidOptions = val.filter(v => !question.options!.includes(v));
          if (invalidOptions.length > 0) {
            return 'Please select only valid options';
          }
        }
        break;

      case 'number':
        if (val !== '' && isNaN(Number(val))) {
          return 'Please enter a valid number';
        }
        break;
    }

    return null;
  };

  const handleValueChange = (newValue: any) => {
    setValue(newValue);
    setTouched(true);

    const validationError = validateValue(newValue);
    setError(validationError);

    if (onValidationError) {
      onValidationError(question.id, validationError);
    }

    // Always save response, handle validation separately
    onAnswer(question.id, newValue);
  };

  const handleBlur = () => {
    setTouched(true);
    const validationError = validateValue(value);
    setError(validationError);

    if (onValidationError) {
      onValidationError(question.id, validationError);
    }
  };

  const renderInput = () => {
    switch (question.type) {
      case 'multiple-choice':
        return (
          <Select
            value={value}
            onChange={(e) => handleValueChange(e.target.value)}
            disabled={disabled}
            className="w-full"
          >
            <option value="">Select an option...</option>
            {question.options?.map((option, index) => (
              <option key={index} value={option}>
                {option}
              </option>
            ))}
          </Select>
        );

      case 'scale':
        if (!question.scale) return null;

        return (
          <div className="space-y-4">
            {question.scale.labels && question.scale.labels.length > 0 && (
              <div className="flex justify-between text-sm text-gray-600">
                <span>{question.scale.labels[0]}</span>
                <span>{question.scale.labels[1] || question.scale.labels[0]}</span>
              </div>
            )}

            <div className="flex items-center space-x-2">
              {Array.from(
                { length: question.scale.max - question.scale.min + 1 },
                (_, i) => question.scale!.min + i
              ).map((scaleValue) => (
                <button
                  key={scaleValue}
                  type="button"
                  onClick={() => handleValueChange(scaleValue)}
                  disabled={disabled}
                  className={`
                    w-12 h-12 rounded-full border-2 text-sm font-medium transition-colors
                    ${value === scaleValue
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-blue-300'
                    }
                    ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                  `}
                >
                  {scaleValue}
                </button>
              ))}
            </div>

            <div className="flex justify-between text-xs text-gray-500">
              {Array.from(
                { length: question.scale.max - question.scale.min + 1 },
                (_, i) => question.scale!.min + i
              ).map((scaleValue) => (
                <span key={scaleValue} className="w-12 text-center">
                  {scaleValue}
                </span>
              ))}
            </div>
          </div>
        );

      case 'multiple-select':
        return (
          <div className="space-y-2">
            {question.options?.map((option, index) => (
              <label key={index} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={Array.isArray(value) ? value.includes(option) : false}
                  onChange={(e) => {
                    const currentValues = Array.isArray(value) ? value : [];
                    const newValues = e.target.checked
                      ? [...currentValues, option]
                      : currentValues.filter(v => v !== option);
                    handleValueChange(newValues);
                  }}
                  disabled={disabled}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm">{option}</span>
              </label>
            ))}
          </div>
        );

      case 'text':
        return (
          <Textarea
            value={value}
            onChange={(e) => handleValueChange(e.target.value)}
            onBlur={handleBlur}
            disabled={disabled}
            placeholder="Enter your response..."
            className="w-full min-h-[100px]"
          />
        );

      case 'number':
        return (
          <Input
            type="number"
            value={value}
            onChange={(e) => handleValueChange(e.target.value)}
            onBlur={handleBlur}
            disabled={disabled}
            placeholder="Enter a number..."
            className="w-full"
          />
        );

      case 'boolean':
        return (
          <div className="flex space-x-4">
            <label className="flex items-center space-x-2">
              <input
                type="radio"
                name={question.id}
                checked={value === true}
                onChange={() => handleValueChange(true)}
                disabled={disabled}
                className="text-blue-600 focus:ring-blue-500"
              />
              <span>Yes</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="radio"
                name={question.id}
                checked={value === false}
                onChange={() => handleValueChange(false)}
                disabled={disabled}
                className="text-blue-600 focus:ring-blue-500"
              />
              <span>No</span>
            </label>
          </div>
        );

      default:
        return (
          <Input
            type="text"
            value={value}
            onChange={(e) => handleValueChange(e.target.value)}
            onBlur={handleBlur}
            disabled={disabled}
            placeholder="Enter your response..."
            className="w-full"
          />
        );
    }
  };

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
      <div className="space-y-4">
        {/* Question Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-medium text-gray-900">
              {question.question}
              {(question.required || isRequired) && (
                <span className="text-red-500 ml-1">*</span>
              )}
            </h3>
          </div>

          {/* Question Type Badge */}
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            {question.type.replace('-', ' ')}
          </span>
        </div>

        {/* Question Input */}
        <div className="space-y-2">
          {renderInput()}

          {/* Validation Error */}
          {showValidation && touched && error && (
            <p className="text-sm text-red-600 flex items-center space-x-1">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span>{error}</span>
            </p>
          )}
        </div>

        {/* Response Status */}
        {response && (
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <span>Answered {new Date(response.timestamp).toLocaleDateString()}</span>
          </div>
        )}

        {/* Conditional Questions Info */}
        {question.conditional && (
          <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
            <p>This question appears based on your answer to a previous question.</p>
          </div>
        )}
      </div>
    </div>
  );
};