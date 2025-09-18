'use client';

import { AlertCircle, ChevronDown, ChevronUp, Lightbulb } from 'lucide-react';
import React, { useState, useEffect } from 'react';

import { AssessmentGap, DomainName } from '@/types';

import { useRealTimeGapDetection } from '../../../hooks/useGapAnalysis';

interface InlineGapPromptProps {
  assessmentId: string;
  domain: DomainName;
  questionId: string;
  currentValue: string;
  gaps: AssessmentGap[];
  onResponseUpdate?: (response: string) => void;
  className?: string;
}

export const InlineGapPrompt: React.FC<InlineGapPromptProps> = ({
  assessmentId,
  domain,
  questionId,
  currentValue,
  gaps,
  onResponseUpdate,
  className = ''
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const { triggerAnalysis } = useRealTimeGapDetection(assessmentId, domain, 3000);

  // Filter gaps relevant to this question
  const relevantGaps = gaps.filter(gap =>
    gap.domain === domain &&
    gap.description.toLowerCase().includes(questionId.toLowerCase())
  );

  // Trigger analysis when value changes
  useEffect(() => {
    if (hasUserInteracted && currentValue) {
      triggerAnalysis();
    }
  }, [currentValue, hasUserInteracted, triggerAnalysis]);

  // Auto-expand if there are critical gaps
  useEffect(() => {
    const hasCriticalGaps = relevantGaps.some(gap => gap.category === 'critical');
    if (hasCriticalGaps && !hasUserInteracted) {
      setIsExpanded(true);
    }
  }, [relevantGaps, hasUserInteracted]);

  const handleExpansionToggle = () => {
    setIsExpanded(!isExpanded);
    setHasUserInteracted(true);
  };

  const handleSuggestionClick = (suggestion: string) => {
    if (onResponseUpdate) {
      const updatedResponse = currentValue
        ? `${currentValue}\n\n${suggestion}`
        : suggestion;
      onResponseUpdate(updatedResponse);
    }
    setHasUserInteracted(true);
  };

  // Don't render if no relevant gaps
  if (relevantGaps.length === 0) {
    return null;
  }

  const criticalGaps = relevantGaps.filter(gap => gap.category === 'critical');
  const importantGaps = relevantGaps.filter(gap => gap.category === 'important');

  return (
    <div className={`mt-3 ${className}`}>
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg overflow-hidden">
        {/* Header */}
        <div
          className="p-3 cursor-pointer hover:bg-yellow-100 transition-colors"
          onClick={handleExpansionToggle}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-yellow-600" />
              <span className="text-sm font-medium text-yellow-800">
                {criticalGaps.length > 0
                  ? `${criticalGaps.length} critical gap${criticalGaps.length === 1 ? '' : 's'} detected`
                  : `${relevantGaps.length} suggestion${relevantGaps.length === 1 ? '' : 's'} available`
                }
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-yellow-600">
                Click to {isExpanded ? 'hide' : 'show'} details
              </span>
              {isExpanded ? (
                <ChevronUp className="w-4 h-4 text-yellow-600" />
              ) : (
                <ChevronDown className="w-4 h-4 text-yellow-600" />
              )}
            </div>
          </div>
        </div>

        {/* Expandable content */}
        {isExpanded && (
          <div className="border-t border-yellow-200 bg-white">
            <div className="p-4 space-y-3">
              {relevantGaps.map((gap) => (
                <GapPromptCard
                  key={gap.gapId}
                  gap={gap}
                  onSuggestionClick={handleSuggestionClick}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

interface GapPromptCardProps {
  gap: AssessmentGap;
  onSuggestionClick: (suggestion: string) => void;
}

const GapPromptCard: React.FC<GapPromptCardProps> = ({ gap, onSuggestionClick }) => {
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(null);

  const getBorderColor = () => {
    switch (gap.category) {
      case 'critical':
        return 'border-red-200';
      case 'important':
        return 'border-yellow-200';
      case 'nice-to-have':
        return 'border-blue-200';
      default:
        return 'border-gray-200';
    }
  };

  const getCategoryLabel = () => {
    switch (gap.category) {
      case 'critical':
        return { label: 'Critical', color: 'text-red-600 bg-red-100' };
      case 'important':
        return { label: 'Important', color: 'text-yellow-600 bg-yellow-100' };
      case 'nice-to-have':
        return { label: 'Optional', color: 'text-blue-600 bg-blue-100' };
      default:
        return { label: 'Info', color: 'text-gray-600 bg-gray-100' };
    }
  };

  const categoryInfo = getCategoryLabel();

  return (
    <div className={`border rounded-lg p-3 ${getBorderColor()}`}>
      {/* Gap info */}
      <div className="flex items-start justify-between mb-2">
        <p className="text-sm text-gray-700 flex-1">{gap.description}</p>
        <span className={`px-2 py-1 text-xs rounded-full ${categoryInfo.color} ml-2`}>
          {categoryInfo.label}
        </span>
      </div>

      {/* Suggested questions */}
      {gap.suggestedQuestions.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center space-x-1 mb-2">
            <Lightbulb className="w-3 h-3 text-gray-500" />
            <span className="text-xs font-medium text-gray-600">
              Consider addressing:
            </span>
          </div>
          <div className="space-y-1">
            {gap.suggestedQuestions.map((question, index) => (
              <button
                key={index}
                onClick={() => {
                  setSelectedSuggestion(question);
                  onSuggestionClick(question);
                }}
                className={`w-full text-left text-xs p-2 rounded border transition-colors ${
                  selectedSuggestion === question
                    ? 'bg-blue-50 border-blue-200 text-blue-800'
                    : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                }`}
              >
                {question}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Follow-up prompts */}
      {gap.followUpPrompts.length > 0 && (
        <div className="pt-2 border-t border-gray-100">
          <p className="text-xs font-medium text-gray-600 mb-1">
            Helpful prompts:
          </p>
          <div className="space-y-1">
            {gap.followUpPrompts.map((prompt, index) => (
              <p key={index} className="text-xs text-gray-500 italic">
                "{prompt}"
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Estimated time */}
      <div className="mt-2 text-xs text-gray-400">
        Estimated time to resolve: ~{gap.estimatedResolutionTime} minutes
      </div>
    </div>
  );
};