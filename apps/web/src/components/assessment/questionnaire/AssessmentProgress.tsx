'use client';

import React from 'react';

import { DomainName, DomainProgress, AssessmentProgress as IAssessmentProgress } from '@/types';

interface AssessmentProgressProps {
  progress: IAssessmentProgress;
  onDomainClick?: (domain: DomainName) => void;
  currentDomain?: DomainName;
  className?: string;
  assessment?: any; // Add assessment prop for dynamic calculations
}

const DOMAIN_LABELS: Record<DomainName, string> = {
  'strategic-alignment': 'Strategic Alignment & Vision',
  'financial-management': 'Financial Management & Capital Efficiency',
  'revenue-engine': 'Revenue Engine & Growth Systems',
  'operational-excellence': 'Operational Excellence & Process Management',
  'people-organization': 'People & Organizational Development',
  'technology-data': 'Technology & Data Infrastructure',
  'customer-experience': 'Customer Experience & Product Development',
  'supply-chain': 'Supply Chain & Operations',
  'risk-compliance': 'Risk Management & Compliance',
  'partnerships': 'External Partnerships & Ecosystem',
  'customer-success': 'Customer Success & Growth',
  'change-management': 'Change Management & Implementation'
};

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

const DOMAIN_COLORS: Record<DomainName, { bg: string; border: string; text: string }> = {
  'strategic-alignment': { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700' },
  'financial-management': { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700' },
  'revenue-engine': { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' },
  'operational-excellence': { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700' },
  'people-organization': { bg: 'bg-pink-50', border: 'border-pink-200', text: 'text-pink-700' },
  'technology-data': { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700' },
  'customer-experience': { bg: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-700' },
  'supply-chain': { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700' },
  'risk-compliance': { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700' },
  'partnerships': { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-700' },
  'customer-success': { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' },
  'change-management': { bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-700' }
};

const getStatusColor = (status: DomainProgress['status']) => {
  switch (status) {
    case 'completed':
      return 'bg-green-500';
    case 'in-progress':
      return 'bg-blue-500';
    case 'not-started':
    default:
      return 'bg-gray-300';
  }
};

const getStatusIcon = (status: DomainProgress['status']) => {
  switch (status) {
    case 'completed':
      return (
        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      );
    case 'in-progress':
      return (
        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
        </svg>
      );
    default:
      return (
        <div className="w-2 h-2 bg-white rounded-full" />
      );
  }
};

const DomainCard: React.FC<{
  domain: DomainName;
  progress?: DomainProgress;
  isActive: boolean;
  onClick?: () => void;
  assessment?: any; // Pass assessment for dynamic calculation
}> = ({ domain, progress, isActive, onClick, assessment }) => {
  const colors = DOMAIN_COLORS[domain];

  // Calculate dynamic progress to handle the completed > total issue
  const calculateDynamicProgress = () => {
    // Use provided progress as baseline
    const baseProgress = progress || {
      completed: 0,
      total: 0,
      status: 'not-started' as const,
      requiredQuestions: 0,
      optionalQuestions: 0
    };

    if (!assessment?.domainResponses?.[domain]) {
      return baseProgress;
    }

    const domainResponse = assessment.domainResponses[domain];
    const completedCount = Object.keys(domainResponse.questions).length;

    // Calculate dynamic total
    // For now, ensure total is never less than completed to fix the immediate issue
    let dynamicTotal = Math.max(baseProgress.total, completedCount);

    // If we have a significant mismatch (completed > static total),
    // it likely means follow-ups were added
    if (completedCount > baseProgress.total) {
      // Estimate that the extra questions are follow-ups
      const followUpCount = completedCount - baseProgress.total;
      dynamicTotal = baseProgress.total + followUpCount;
    }

    return {
      ...baseProgress,
      completed: completedCount,
      total: dynamicTotal,
      status: completedCount === 0 ? 'not-started' as const :
              completedCount >= baseProgress.requiredQuestions ? 'completed' as const :
              'in-progress' as const
    };
  };

  const safeDomainProgress = calculateDynamicProgress();

  const completionPercentage = safeDomainProgress.total > 0 ? Math.round((safeDomainProgress.completed / safeDomainProgress.total) * 100) : 0;
  const requiredCompletionPercentage = safeDomainProgress.requiredQuestions > 0
    ? Math.round((Math.min(safeDomainProgress.completed, safeDomainProgress.requiredQuestions) / safeDomainProgress.requiredQuestions) * 100)
    : 0;

  const canAccess = safeDomainProgress.status !== 'not-started' || domain === 'strategic-alignment' || isActive;

  return (
    <div
      className={`
        relative rounded-lg border-2 p-4 transition-all duration-200 cursor-pointer
        ${isActive
          ? `${colors.bg} ${colors.border} ring-2 ring-blue-500 ring-opacity-50`
          : `bg-white ${colors.border} hover:${colors.bg}`
        }
        ${canAccess ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}
      `}
      onClick={canAccess ? onClick : undefined}
    >
      {/* Status indicator */}
      <div className={`absolute -top-2 -right-2 w-6 h-6 rounded-full ${getStatusColor(safeDomainProgress.status)} flex items-center justify-center`}>
        {getStatusIcon(safeDomainProgress.status)}
      </div>

      <div className="flex items-start space-x-3">
        <div className="text-2xl">{DOMAIN_ICONS[domain]}</div>
        <div className="flex-1 min-w-0">
          <h3 className={`font-medium text-sm ${colors.text} truncate`}>
            {DOMAIN_LABELS[domain]}
          </h3>

          <div className="mt-2 space-y-2">
            {/* Overall Progress */}
            <div>
              <div className="flex justify-between text-xs text-gray-600 mb-1">
                <span>Overall</span>
                <span>{completionPercentage}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div
                  className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${completionPercentage}%` }}
                />
              </div>
            </div>

            {/* Required Progress */}
            <div>
              <div className="flex justify-between text-xs text-gray-600 mb-1">
                <span>Required</span>
                <span>{requiredCompletionPercentage}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1">
                <div
                  className="bg-green-600 h-1 rounded-full transition-all duration-300"
                  style={{ width: `${requiredCompletionPercentage}%` }}
                />
              </div>
            </div>

            {/* Question counts */}
            <div className="flex justify-between text-xs text-gray-500">
              <span>{safeDomainProgress.completed} / {safeDomainProgress.total}</span>
              <span className="text-green-600">{safeDomainProgress.requiredQuestions} req</span>
            </div>
          </div>
        </div>
      </div>

      {/* Lock indicator for inaccessible domains */}
      {!canAccess && (
        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 rounded-lg">
          <svg className="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
          </svg>
        </div>
      )}
    </div>
  );
};

export const AssessmentProgress: React.FC<AssessmentProgressProps> = ({
  progress,
  onDomainClick,
  currentDomain,
  className = '',
  assessment
}) => {
  const domainOrder: DomainName[] = [
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

  const completedDomains = progress.domains ? Object.values(progress.domains).filter(d => d.status === 'completed').length : 0;
  const inProgressDomains = progress.domains ? Object.values(progress.domains).filter(d => d.status === 'in-progress').length : 0;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Overall Progress Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Assessment Progress</h2>
          <div className="text-right">
            <div className="text-3xl font-bold text-blue-600">{progress.overall}%</div>
            <div className="text-sm text-gray-600">Complete</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Overall Completion</span>
            <span>{progress.estimatedTimeRemaining} remaining</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress.overall}%` }}
            />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-green-600">{completedDomains}</div>
            <div className="text-sm text-gray-600">Completed</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-blue-600">{inProgressDomains}</div>
            <div className="text-sm text-gray-600">In Progress</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-600">{12 - completedDomains - inProgressDomains}</div>
            <div className="text-sm text-gray-600">Remaining</div>
          </div>
        </div>

        {/* Completeness Score */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700">Quality Score</span>
            <span className={`text-sm font-bold ${
              progress.completeness >= 85 ? 'text-green-600' :
              progress.completeness >= 70 ? 'text-yellow-600' :
              'text-red-600'
            }`}>
              {progress.completeness}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${
                progress.completeness >= 85 ? 'bg-green-600' :
                progress.completeness >= 70 ? 'bg-yellow-600' :
                'bg-red-600'
              }`}
              style={{ width: `${progress.completeness}%` }}
            />
          </div>
          {progress.completeness < 70 && (
            <p className="text-xs text-gray-600 mt-1">
              Complete more required questions to improve analysis quality
            </p>
          )}
        </div>
      </div>

      {/* Domain Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {domainOrder.map((domain) => (
          <DomainCard
            key={domain}
            domain={domain}
            progress={progress.domains?.[domain]}
            isActive={currentDomain === domain}
            onClick={() => onDomainClick?.(domain)}
            assessment={assessment}
          />
        ))}
      </div>

      {/* Domain Status Legend */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-900 mb-3">Status Legend</h3>
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <span className="text-gray-700">Completed</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
              </svg>
            </div>
            <span className="text-gray-700">In Progress</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-gray-300 rounded-full flex items-center justify-center">
              <div className="w-2 h-2 bg-white rounded-full" />
            </div>
            <span className="text-gray-700">Not Started</span>
          </div>
          <div className="flex items-center space-x-2">
            <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
            <span className="text-gray-700">Locked</span>
          </div>
        </div>
      </div>
    </div>
  );
};