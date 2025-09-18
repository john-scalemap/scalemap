'use client';

import { AlertTriangle, CheckCircle, Clock, HelpCircle } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { AssessmentGap, GapCategory, DomainName } from '@/types';

import { useGapAnalysis } from '../../../hooks/useGapAnalysis';

interface GapDetectionPanelProps {
  assessmentId: string;
  currentDomain?: DomainName;
  isVisible: boolean;
  onToggleVisibility: () => void;
}

export const GapDetectionPanel: React.FC<GapDetectionPanelProps> = ({
  assessmentId,
  currentDomain,
  isVisible,
  onToggleVisibility
}) => {
  const {
    gaps,
    isAnalyzing,
    completenessScore,
    triggerRealTimeAnalysis,
    markGapAsReviewed
  } = useGapAnalysis(assessmentId);

  const [recentlyDetectedGaps, setRecentlyDetectedGaps] = useState<AssessmentGap[]>([]);

  // Filter gaps for current domain if specified
  const relevantGaps = currentDomain
    ? gaps.filter(gap => gap.domain === currentDomain)
    : gaps;

  const criticalGaps = relevantGaps.filter(gap => gap.category === 'critical');
  const importantGaps = relevantGaps.filter(gap => gap.category === 'important');

  // Track newly detected gaps
  useEffect(() => {
    const newGaps = gaps.filter(gap => {
      const detectedTime = new Date(gap.detectedAt).getTime();
      const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
      return detectedTime > fiveMinutesAgo;
    });
    setRecentlyDetectedGaps(newGaps);
  }, [gaps]);

  const handleAnalyzeCurrentResponse = () => {
    if (currentDomain) {
      triggerRealTimeAnalysis(currentDomain);
    }
  };

  const getCategoryIcon = (category: GapCategory) => {
    switch (category) {
      case 'critical':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'important':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'nice-to-have':
        return <HelpCircle className="w-4 h-4 text-blue-500" />;
    }
  };

  const getCategoryColor = (category: GapCategory) => {
    switch (category) {
      case 'critical':
        return 'border-red-200 bg-red-50';
      case 'important':
        return 'border-yellow-200 bg-yellow-50';
      case 'nice-to-have':
        return 'border-blue-200 bg-blue-50';
    }
  };

  if (!isVisible) {
    return (
      <div className="fixed right-4 top-1/2 transform -translate-y-1/2 z-50">
        <button
          onClick={onToggleVisibility}
          className="bg-white shadow-lg rounded-l-lg p-3 border-r-0 border-2 border-gray-200 hover:bg-gray-50 transition-colors"
          aria-label="Show gap detection panel"
        >
          <div className="flex flex-col items-center space-y-1">
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
            {relevantGaps.length > 0 && (
              <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {relevantGaps.length}
              </span>
            )}
          </div>
        </button>
      </div>
    );
  }

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-white shadow-xl border-l border-gray-200 z-50 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
            <h3 className="font-semibold text-gray-900">Gap Detection</h3>
          </div>
          <button
            onClick={onToggleVisibility}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Hide gap detection panel"
          >
            ×
          </button>
        </div>

        {/* Completeness score */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Completeness</span>
            <span className="font-medium text-gray-900">{completenessScore}%</span>
          </div>
          <div className="mt-1 w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${
                completenessScore >= 85 ? 'bg-green-500' :
                completenessScore >= 70 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{ width: `${completenessScore}%` }}
            />
          </div>
        </div>

        {/* Analysis trigger */}
        {currentDomain && (
          <div className="mt-3">
            <button
              onClick={handleAnalyzeCurrentResponse}
              disabled={isAnalyzing}
              className="w-full px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isAnalyzing ? 'Analyzing...' : 'Check Current Responses'}
            </button>
          </div>
        )}
      </div>

      {/* Gap summary */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div className="text-center">
            <div className="text-lg font-semibold text-red-600">{criticalGaps.length}</div>
            <div className="text-gray-600">Critical</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-yellow-600">{importantGaps.length}</div>
            <div className="text-gray-600">Important</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-gray-600">{relevantGaps.length}</div>
            <div className="text-gray-600">Total</div>
          </div>
        </div>
      </div>

      {/* Gap list */}
      <div className="flex-1 overflow-y-auto">
        {relevantGaps.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500" />
            <p className="text-sm">No gaps detected yet</p>
            <p className="text-xs text-gray-400 mt-1">
              Keep answering questions to improve completeness
            </p>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {relevantGaps.map((gap) => (
              <GapCard
                key={gap.gapId}
                gap={gap}
                isRecent={recentlyDetectedGaps.some(g => g.gapId === gap.gapId)}
                onMarkReviewed={() => markGapAsReviewed(gap.gapId)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

interface GapCardProps {
  gap: AssessmentGap;
  isRecent: boolean;
  onMarkReviewed: () => void;
}

const GapCard: React.FC<GapCardProps> = ({ gap, isRecent, onMarkReviewed }) => {
  const [isExpanded, setIsExpanded] = useState(isRecent);

  return (
    <div className={`border rounded-lg p-3 transition-all duration-200 ${
      isRecent ? 'ring-2 ring-blue-200 border-blue-300' : 'border-gray-200'
    } ${getCategoryColor(gap.category)}`}>
      <div className="flex items-start space-x-2">
        {getCategoryIcon(gap.category)}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-gray-900 truncate">
              {gap.domain.replace('-', ' ')}
            </div>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-gray-400 hover:text-gray-600 ml-2"
            >
              {isExpanded ? '−' : '+'}
            </button>
          </div>

          <p className="text-xs text-gray-600 mt-1">
            {gap.description}
          </p>

          {isExpanded && (
            <div className="mt-2 space-y-2">
              {/* Suggested questions */}
              {gap.suggestedQuestions.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-700 mb-1">
                    Suggested clarifications:
                  </p>
                  <ul className="text-xs text-gray-600 space-y-1">
                    {gap.suggestedQuestions.map((question, index) => (
                      <li key={index} className="list-disc list-inside">
                        {question}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Follow-up prompts */}
              {gap.followUpPrompts.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-700 mb-1">
                    Helpful prompts:
                  </p>
                  <ul className="text-xs text-gray-600 space-y-1">
                    {gap.followUpPrompts.map((prompt, index) => (
                      <li key={index} className="italic">
                        "{prompt}"
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Estimated time */}
              <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                <span className="text-xs text-gray-500">
                  ~{gap.estimatedResolutionTime} min to resolve
                </span>
                <button
                  onClick={onMarkReviewed}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  Mark as reviewed
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

function getCategoryColor(category: GapCategory): string {
  switch (category) {
    case 'critical':
      return 'border-red-200 bg-red-50';
    case 'important':
      return 'border-yellow-200 bg-yellow-50';
    case 'nice-to-have':
      return 'border-blue-200 bg-blue-50';
  }
}

function getCategoryIcon(category: GapCategory): JSX.Element {
  switch (category) {
    case 'critical':
      return <AlertTriangle className="w-4 h-4 text-red-500" />;
    case 'important':
      return <Clock className="w-4 h-4 text-yellow-500" />;
    case 'nice-to-have':
      return <HelpCircle className="w-4 h-4 text-blue-500" />;
  }
}