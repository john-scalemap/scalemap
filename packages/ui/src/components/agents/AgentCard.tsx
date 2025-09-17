import { AgentPersona, AgentPersonaStatus } from '@scalemap/shared';
import { clsx } from 'clsx';
import React from 'react';

import { Card, CardContent, CardFooter, CardHeader } from '../Card';

interface AgentCardProps {
  agent: AgentPersona;
  onClick?: () => void;
  showStatus?: boolean;
  showExpertise?: boolean;
  className?: string;
}

export const AgentCard: React.FC<AgentCardProps> = ({
  agent,
  onClick,
  showStatus = true,
  showExpertise = true,
  className
}) => {
  const handleClick = () => {
    onClick?.();
  };

  const getStatusColor = (status: AgentPersonaStatus) => {
    switch (status) {
      case 'available':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'analyzing':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'completed':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'offline':
        return 'bg-gray-100 text-gray-500 border-gray-200';
      case 'maintenance':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: AgentPersonaStatus) => {
    switch (status) {
      case 'available':
        return '●';
      case 'analyzing':
        return '⟳';
      case 'completed':
        return '✓';
      case 'offline':
        return '○';
      case 'maintenance':
        return '⚠';
      default:
        return '○';
    }
  };

  const formatExperience = (years: number) => {
    return `${years} year${years !== 1 ? 's' : ''} experience`;
  };

  return (
    <Card
      variant="elevated"
      className={clsx(
        'cursor-pointer transition-all duration-200 hover:shadow-xl hover:scale-[1.02]',
        'min-h-[320px] flex flex-col',
        className
      )}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-label={`View details for ${agent.name}, ${agent.title}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3 flex-1">
            <div className="relative">
              {agent.avatar ? (
                <img
                  src={agent.avatar}
                  alt={`${agent.name} avatar`}
                  className="w-12 h-12 rounded-full object-cover border-2 border-gray-200"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-lg">
                  {agent.name.split(' ').map(n => n[0]).join('')}
                </div>
              )}
              {showStatus && (
                <div
                  className={clsx(
                    'absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white',
                    'flex items-center justify-center text-xs font-bold',
                    getStatusColor(agent.status)
                  )}
                  aria-label={`Status: ${agent.status}`}
                >
                  {getStatusIcon(agent.status)}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900 text-lg leading-tight truncate">
                {agent.name}
              </h3>
              <p className="text-sm text-gray-600 leading-tight truncate">
                {agent.title}
              </p>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 py-0">
        <div className="space-y-3">
          {/* Key Phrase */}
          <blockquote className="text-sm italic text-gray-700 border-l-3 border-blue-500 pl-3">
            &ldquo;{agent.personality.keyPhrase}&rdquo;
          </blockquote>

          {/* Primary Domains */}
          {showExpertise && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Primary Expertise
              </h4>
              <div className="flex flex-wrap gap-1">
                {agent.domainExpertise.primaryDomains.slice(0, 2).map((domain) => (
                  <span
                    key={domain}
                    className="inline-flex items-center px-2 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-medium border border-blue-200"
                  >
                    {domain.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </span>
                ))}
                {agent.domainExpertise.primaryDomains.length > 2 && (
                  <span className="inline-flex items-center px-2 py-1 rounded-md bg-gray-50 text-gray-500 text-xs font-medium">
                    +{agent.domainExpertise.primaryDomains.length - 2} more
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Industry Specializations */}
          {showExpertise && agent.domainExpertise.industrySpecializations.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Industry Focus
              </h4>
              <div className="flex flex-wrap gap-1">
                {agent.domainExpertise.industrySpecializations.slice(0, 3).map((industry) => (
                  <span
                    key={industry}
                    className="inline-flex items-center px-2 py-1 rounded-md bg-green-50 text-green-700 text-xs font-medium border border-green-200"
                  >
                    {industry.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </span>
                ))}
                {agent.domainExpertise.industrySpecializations.length > 3 && (
                  <span className="inline-flex items-center px-2 py-1 rounded-md bg-gray-50 text-gray-500 text-xs font-medium">
                    +{agent.domainExpertise.industrySpecializations.length - 3} more
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="pt-3 border-t border-gray-100">
        <div className="flex items-center justify-between w-full text-xs text-gray-500">
          <span className="flex items-center space-x-1">
            <span>📊</span>
            <span>{agent.performance.assessmentsCompleted} assessments</span>
          </span>
          <span className="flex items-center space-x-1">
            <span>⭐</span>
            <span>{(agent.performance.avgConfidenceScore * 100).toFixed(0)}% confidence</span>
          </span>
          <span className="flex items-center space-x-1">
            <span>🎯</span>
            <span>{formatExperience(agent.domainExpertise.yearsExperience)}</span>
          </span>
        </div>
      </CardFooter>
    </Card>
  );
};

AgentCard.displayName = 'AgentCard';