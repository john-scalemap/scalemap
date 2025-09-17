import { AgentPersona } from '@scalemap/shared';
import { clsx } from 'clsx';
import React from 'react';

import { Card, CardContent, CardHeader } from '../Card';

interface AgentModalProps {
  agent: AgentPersona | null;
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

export const AgentModal: React.FC<AgentModalProps> = ({
  agent,
  isOpen,
  onClose,
  className
}) => {
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Store previous overflow value to restore correctly
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      return () => {
        document.removeEventListener('keydown', handleEscape);
        document.body.style.overflow = previousOverflow || 'unset';
      };
    }

    return () => {}; // Return empty cleanup function when not open
  }, [isOpen, onClose]);

  if (!isOpen || !agent) {
    return null;
  }

  const formatExperience = (years: number) => {
    return `${years} year${years !== 1 ? 's' : ''} of experience`;
  };

  const formatPerformanceMetric = (value: number, isPercentage = false, decimals = 1) => {
    if (isPercentage) {
      return `${(value * 100).toFixed(decimals)}%`;
    }
    return value.toLocaleString();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="agent-modal-title"
    >
      <button
        className="absolute inset-0 bg-black bg-opacity-50 cursor-default"
        onClick={onClose}
        aria-label="Close modal"
      />
      <div className="relative">
      <Card
        variant="elevated"
        className={clsx(
          'max-w-2xl w-full max-h-[90vh] overflow-y-auto',
          'transform transition-all duration-200',
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <CardHeader className="relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close modal"
          >
            <span className="text-xl">&times;</span>
          </button>

          <div className="flex items-start space-x-4 pr-8">
            <div className="flex-shrink-0">
              {agent.avatar ? (
                <img
                  src={agent.avatar}
                  alt={`${agent.name} avatar`}
                  className="w-20 h-20 rounded-full object-cover border-4 border-gray-200"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-2xl border-4 border-gray-200">
                  {agent.name.split(' ').map(n => n[0]).join('')}
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <h2 id="agent-modal-title" className="text-2xl font-bold text-gray-900 mb-1">
                {agent.name}
              </h2>
              <p className="text-lg text-gray-600 mb-3">
                {agent.title}
              </p>
              <p className="text-sm text-gray-500">
                {formatExperience(agent.domainExpertise.yearsExperience)} • {agent.personality.communicationStyle} style
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Key Phrase */}
          <div>
            <blockquote className="text-lg italic text-gray-700 border-l-4 border-blue-500 pl-4 py-2 bg-blue-50 rounded-r-md">
              &ldquo;{agent.personality.keyPhrase}&rdquo;
            </blockquote>
          </div>

          {/* Professional Background */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Professional Background</h3>
            <p className="text-gray-700 leading-relaxed">
              {agent.personality.backstory}
            </p>
          </div>

          {/* Domain Expertise */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Domain Expertise</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Primary Domains</h4>
                <div className="flex flex-wrap gap-2">
                  {agent.domainExpertise.primaryDomains.map((domain) => (
                    <span
                      key={domain}
                      className="inline-flex items-center px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-sm font-medium"
                    >
                      {domain.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 mb-2">Industry Specializations</h4>
                <div className="flex flex-wrap gap-2">
                  {agent.domainExpertise.industrySpecializations.map((industry) => (
                    <span
                      key={industry}
                      className="inline-flex items-center px-3 py-1 rounded-full bg-green-100 text-green-800 text-sm font-medium"
                    >
                      {industry.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {agent.domainExpertise.regulatoryExpertise.length > 0 && (
              <div className="mt-4">
                <h4 className="font-medium text-gray-900 mb-2">Regulatory Expertise</h4>
                <div className="flex flex-wrap gap-2">
                  {agent.domainExpertise.regulatoryExpertise.map((regulation) => (
                    <span
                      key={regulation}
                      className="inline-flex items-center px-3 py-1 rounded-full bg-purple-100 text-purple-800 text-sm font-medium"
                    >
                      {regulation}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {agent.domainExpertise.certifications && agent.domainExpertise.certifications.length > 0 && (
              <div className="mt-4">
                <h4 className="font-medium text-gray-900 mb-2">Certifications & Credentials</h4>
                <div className="flex flex-wrap gap-2">
                  {agent.domainExpertise.certifications.map((cert) => (
                    <span
                      key={cert}
                      className="inline-flex items-center px-3 py-1 rounded-full bg-yellow-100 text-yellow-800 text-sm font-medium"
                    >
                      {cert}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Strength Areas */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Core Competencies</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {agent.personality.strengthAreas.map((area, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <span className="text-green-500" aria-hidden="true">✓</span>
                  <span className="text-gray-700">{area}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Performance Metrics */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Performance Metrics</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {formatPerformanceMetric(agent.performance.assessmentsCompleted)}
                </div>
                <div className="text-sm text-gray-600">Assessments</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {formatPerformanceMetric(agent.performance.avgConfidenceScore, true, 0)}
                </div>
                <div className="text-sm text-gray-600">Confidence</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  {formatPerformanceMetric(agent.performance.successRate, true, 0)}
                </div>
                <div className="text-sm text-gray-600">Success Rate</div>
              </div>
              {agent.performance.clientSatisfactionScore && (
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">
                    {agent.performance.clientSatisfactionScore.toFixed(1)}/5
                  </div>
                  <div className="text-sm text-gray-600">Client Rating</div>
                </div>
              )}
            </div>
          </div>

          {/* Analytical Approach */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Analytical Approach</h3>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-gray-600">Communication Style:</span>
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-indigo-100 text-indigo-800 text-sm font-medium capitalize">
                  {agent.personality.communicationStyle.replace('-', ' ')}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-gray-600">Approach:</span>
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-teal-100 text-teal-800 text-sm font-medium capitalize">
                  {agent.personality.approach.replace('-', ' ')}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
};

AgentModal.displayName = 'AgentModal';