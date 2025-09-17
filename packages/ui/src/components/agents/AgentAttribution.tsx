import { AgentAttribution as AgentAttributionType } from '@scalemap/shared';
import { clsx } from 'clsx';
import React from 'react';

interface AgentAttributionProps {
  attributions: AgentAttributionType[];
  variant?: 'inline' | 'detailed' | 'compact';
  maxVisible?: number;
  showTimestamp?: boolean;
  showConfidence?: boolean;
  className?: string;
}

export const AgentAttribution: React.FC<AgentAttributionProps> = ({
  attributions,
  variant = 'inline',
  maxVisible = 3,
  showTimestamp = false,
  showConfidence = false,
  className
}) => {
  if (!attributions || attributions.length === 0) {
    return null;
  }

  const sortedAttributions = [...attributions].sort((a, b) => {
    const contributionOrder = { primary: 1, supporting: 2, collaborative: 3 };
    return contributionOrder[a.contributionLevel] - contributionOrder[b.contributionLevel];
  });

  const visibleAttributions = sortedAttributions.slice(0, maxVisible);
  const hiddenCount = sortedAttributions.length - maxVisible;

  const getContributionIcon = (level: AgentAttributionType['contributionLevel']) => {
    switch (level) {
      case 'primary':
        return '⭐';
      case 'supporting':
        return '🤝';
      case 'collaborative':
        return '👥';
      default:
        return '📊';
    }
  };

  const getContributionColor = (level: AgentAttributionType['contributionLevel']) => {
    switch (level) {
      case 'primary':
        return 'text-blue-700 bg-blue-50 border-blue-200';
      case 'supporting':
        return 'text-green-700 bg-green-50 border-green-200';
      case 'collaborative':
        return 'text-purple-700 bg-purple-50 border-purple-200';
      default:
        return 'text-gray-700 bg-gray-50 border-gray-200';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatConfidence = (confidence: number) => {
    return `${Math.round(confidence * 100)}%`;
  };

  if (variant === 'compact') {
    return (
      <div className={clsx('flex items-center space-x-1', className)}>
        <span className="text-xs text-gray-500">Analyzed by:</span>
        <div className="flex items-center space-x-1">
          {visibleAttributions.map((attribution) => (
            <span
              key={attribution.agentId}
              className={clsx(
                'inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border',
                getContributionColor(attribution.contributionLevel)
              )}
              title={`${attribution.agentName} - ${attribution.contributionLevel} contributor`}
            >
              <span className="mr-1" aria-hidden="true">
                {getContributionIcon(attribution.contributionLevel)}
              </span>
              {attribution.agentName.split(' ')[0]}
            </span>
          ))}
          {hiddenCount > 0 && (
            <span className="text-xs text-gray-500">+{hiddenCount} more</span>
          )}
        </div>
      </div>
    );
  }

  if (variant === 'detailed') {
    return (
      <div className={clsx('space-y-3', className)}>
        <h4 className="text-sm font-semibold text-gray-900">Analysis Attribution</h4>
        <div className="space-y-2">
          {visibleAttributions.map((attribution) => (
            <div
              key={attribution.agentId}
              className="flex items-start justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div className="flex items-start space-x-3">
                <span
                  className={clsx(
                    'inline-flex items-center justify-center w-8 h-8 rounded-full text-sm',
                    getContributionColor(attribution.contributionLevel)
                  )}
                  aria-hidden="true"
                >
                  {getContributionIcon(attribution.contributionLevel)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {attribution.agentName}
                  </p>
                  <p className="text-xs text-gray-600 capitalize">
                    {attribution.contributionLevel} contributor • {attribution.analysisType}
                  </p>
                  {showTimestamp && (
                    <p className="text-xs text-gray-500 mt-1">
                      {formatTimestamp(attribution.timestamp)}
                    </p>
                  )}
                </div>
              </div>
              {showConfidence && (
                <div className="text-right">
                  <span className="text-sm font-medium text-gray-900">
                    {formatConfidence(attribution.confidence)}
                  </span>
                  <p className="text-xs text-gray-500">confidence</p>
                </div>
              )}
            </div>
          ))}
          {hiddenCount > 0 && (
            <p className="text-xs text-gray-500 text-center pt-2">
              +{hiddenCount} additional contributor{hiddenCount !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      </div>
    );
  }

  // Default inline variant
  return (
    <div className={clsx('flex items-center space-x-2 text-sm text-gray-600', className)}>
      <span>Analyzed by</span>
      <div className="flex items-center space-x-2">
        {visibleAttributions.map((attribution, index) => (
          <React.Fragment key={attribution.agentId}>
            {index > 0 && index === visibleAttributions.length - 1 && (
              <span className="text-gray-400">and</span>
            )}
            {index > 0 && index < visibleAttributions.length - 1 && (
              <span className="text-gray-400">,</span>
            )}
            <span
              className={clsx(
                'inline-flex items-center font-medium',
                attribution.contributionLevel === 'primary'
                  ? 'text-blue-700'
                  : attribution.contributionLevel === 'supporting'
                  ? 'text-green-700'
                  : 'text-purple-700'
              )}
              title={`${attribution.contributionLevel} contributor`}
            >
              <span className="mr-1" aria-hidden="true">
                {getContributionIcon(attribution.contributionLevel)}
              </span>
              {attribution.agentName}
            </span>
          </React.Fragment>
        ))}
        {hiddenCount > 0 && (
          <span className="text-gray-500">and {hiddenCount} other{hiddenCount !== 1 ? 's' : ''}</span>
        )}
      </div>
    </div>
  );
};

AgentAttribution.displayName = 'AgentAttribution';