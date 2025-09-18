'use client';

import React, { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { DomainName, AssessmentProgress, DomainProgress } from '@/types';

interface QuestionNavigationProps {
  currentDomain: DomainName;
  progress: AssessmentProgress;
  onDomainChange: (domain: DomainName) => void;
  onSaveAndExit?: () => void;
  canProceed?: boolean;
  isAutoSaving?: boolean;
  lastSaved?: string;
  className?: string;
}

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
  'change-management'
];

const DOMAIN_LABELS: Record<DomainName, string> = {
  'strategic-alignment': 'Strategic Alignment',
  'financial-management': 'Financial Management',
  'revenue-engine': 'Revenue Engine',
  'operational-excellence': 'Operational Excellence',
  'people-organization': 'People & Organization',
  'technology-data': 'Technology & Data',
  'customer-experience': 'Customer Experience',
  'supply-chain': 'Supply Chain',
  'risk-compliance': 'Risk & Compliance',
  'partnerships': 'Partnerships',
  'customer-success': 'Customer Success',
  'change-management': 'Change Management'
};

export const QuestionNavigation: React.FC<QuestionNavigationProps> = ({
  currentDomain,
  progress,
  onDomainChange,
  onSaveAndExit,
  canProceed = true,
  isAutoSaving = false,
  lastSaved,
  className = ''
}) => {
  const [showAllDomains, setShowAllDomains] = useState(false);

  const currentIndex = DOMAIN_ORDER.indexOf(currentDomain);
  const canGoNext = currentIndex < DOMAIN_ORDER.length - 1;
  const canGoPrevious = currentIndex > 0;

  const nextDomain = canGoNext ? DOMAIN_ORDER[currentIndex + 1] : null;
  const previousDomain = canGoPrevious ? DOMAIN_ORDER[currentIndex - 1] : null;

  const canAccessDomain = (domain: DomainName): boolean => {
    if (domain === 'strategic-alignment') return true;

    const domainIndex = DOMAIN_ORDER.indexOf(domain);
    const currentDomainIndex = DOMAIN_ORDER.indexOf(currentDomain);

    // Can access current domain and previously accessed domains
    if (domainIndex <= currentDomainIndex) return true;

    // Can access next domain if current has minimum completion
    const currentDomainProgress = progress.domains?.[currentDomain];
    if (!currentDomainProgress) return false;
    const requiredCompletion = Math.ceil(currentDomainProgress.requiredQuestions * 0.6); // 60% of required questions

    return domainIndex === currentDomainIndex + 1 && currentDomainProgress.completed >= requiredCompletion;
  };

  const getDomainAccessibilityInfo = (domain: DomainName): { accessible: boolean; reason?: string } => {
    if (canAccessDomain(domain)) {
      return { accessible: true };
    }

    const domainIndex = DOMAIN_ORDER.indexOf(domain);
    const currentDomainIndex = DOMAIN_ORDER.indexOf(currentDomain);

    if (domainIndex > currentDomainIndex + 1) {
      return {
        accessible: false,
        reason: 'Complete previous domains first'
      };
    }

    const currentDomainProgress = progress.domains?.[currentDomain];
    if (!currentDomainProgress) {
      return { accessible: false, reason: 'Domain progress not available' };
    }
    const requiredCompletion = Math.ceil(currentDomainProgress.requiredQuestions * 0.6);

    return {
      accessible: false,
      reason: `Complete ${requiredCompletion} required questions in ${DOMAIN_LABELS[currentDomain]} first`
    };
  };

  const handleDomainClick = (domain: DomainName) => {
    const { accessible } = getDomainAccessibilityInfo(domain);
    if (accessible) {
      onDomainChange(domain);
      setShowAllDomains(false);
    }
  };

  const formatLastSaved = () => {
    if (!lastSaved) return null;
    const now = new Date();
    const saved = new Date(lastSaved);
    const diffMs = now.getTime() - saved.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));

    if (diffMins < 1) return 'Saved just now';
    if (diffMins === 1) return 'Saved 1 minute ago';
    if (diffMins < 60) return `Saved ${diffMins} minutes ago`;
    return `Saved at ${saved.toLocaleTimeString()}`;
  };

  // Get visible domains for compact navigation
  const getVisibleDomains = (): DomainName[] => {
    const maxVisible = 5;
    const halfVisible = Math.floor(maxVisible / 2);

    let start = Math.max(0, currentIndex - halfVisible);
    const end = Math.min(DOMAIN_ORDER.length, start + maxVisible);

    // Adjust start if we're near the end
    if (end - start < maxVisible) {
      start = Math.max(0, end - maxVisible);
    }

    return DOMAIN_ORDER.slice(start, end);
  };

  const visibleDomains = showAllDomains ? DOMAIN_ORDER : getVisibleDomains();

  return (
    <div className={`bg-white border-b border-gray-200 sticky top-0 z-10 ${className}`}>
      <div className="px-6 py-4">
        {/* Top Row: Progress and Actions */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-600">
              <span className="font-medium">Domain {currentIndex + 1} of {DOMAIN_ORDER.length}</span>
            </div>
            <div className="text-sm text-gray-600">
              <span className="font-medium">{progress.overall}% Complete</span>
            </div>
            <div className="text-sm text-gray-600">
              Est. {progress.estimatedTimeRemaining} remaining
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Auto-save indicator */}
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              {isAutoSaving ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full" />
                  <span>Saving...</span>
                </>
              ) : lastSaved ? (
                <>
                  <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>{formatLastSaved()}</span>
                </>
              ) : null}
            </div>

            {/* Save and Exit */}
            {onSaveAndExit && (
              <Button variant="outline" onClick={onSaveAndExit} size="sm">
                Save & Exit
              </Button>
            )}
          </div>
        </div>

        {/* Domain Navigation */}
        <div className="flex items-center space-x-2">
          {/* Previous Domain Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => previousDomain && handleDomainClick(previousDomain)}
            disabled={!canGoPrevious}
            className="flex-shrink-0"
          >
            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Previous
          </Button>

          {/* Domain Pills */}
          <div className="flex-1 flex items-center space-x-1 overflow-x-auto">
            {!showAllDomains && currentIndex > 2 && (
              <button
                onClick={() => setShowAllDomains(true)}
                className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
              >
                ...
              </button>
            )}

            {visibleDomains.map((domain) => {
              const domainProgress = progress.domains?.[domain];
              if (!domainProgress) return null;
              const { accessible, reason } = getDomainAccessibilityInfo(domain);
              const isActive = domain === currentDomain;

              return (
                <button
                  key={domain}
                  onClick={() => handleDomainClick(domain)}
                  disabled={!accessible}
                  title={accessible ? DOMAIN_LABELS[domain] : reason}
                  className={`
                    relative px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 flex-shrink-0
                    ${isActive
                      ? 'bg-blue-600 text-white shadow-md'
                      : accessible
                      ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      : 'bg-gray-50 text-gray-400 cursor-not-allowed'
                    }
                  `}
                >
                  {DOMAIN_LABELS[domain]}

                  {/* Progress indicator */}
                  {domainProgress.completed > 0 && (
                    <div
                      className={`
                        absolute -top-1 -right-1 w-3 h-3 rounded-full text-xs flex items-center justify-center
                        ${domainProgress.status === 'completed'
                          ? 'bg-green-500 text-white'
                          : domainProgress.status === 'in-progress'
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-300 text-gray-600'
                        }
                      `}
                    >
                      {domainProgress.status === 'completed' ? (
                        <svg className="w-2 h-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <span>{Math.round((domainProgress.completed / domainProgress.total) * 100) || 0}%</span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}

            {!showAllDomains && currentIndex < DOMAIN_ORDER.length - 3 && (
              <button
                onClick={() => setShowAllDomains(true)}
                className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
              >
                ...
              </button>
            )}

            {showAllDomains && (
              <button
                onClick={() => setShowAllDomains(false)}
                className="px-2 py-1 text-xs text-blue-600 hover:text-blue-700"
              >
                Show Less
              </button>
            )}
          </div>

          {/* Next Domain Button */}
          <Button
            size="sm"
            onClick={() => nextDomain && handleDomainClick(nextDomain)}
            disabled={!canGoNext || !canProceed}
            className="flex-shrink-0"
          >
            Next
            <svg className="w-4 h-4 ml-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
          </Button>
        </div>

        {/* Current Domain Progress Bar */}
        <div className="mt-3">
          <div className="flex justify-between text-xs text-gray-600 mb-1">
            <span>{DOMAIN_LABELS[currentDomain]}</span>
            <span>
              {progress.domains?.[currentDomain]?.completed || 0} of {progress.domains?.[currentDomain]?.total || 0} questions
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div
              className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
              style={{
                width: `${(progress.domains?.[currentDomain]?.total || 0) > 0
                  ? Math.round(((progress.domains?.[currentDomain]?.completed || 0) / (progress.domains?.[currentDomain]?.total || 1)) * 100)
                  : 0}%`
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};