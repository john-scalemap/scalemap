'use client';

import { useEffect, useState } from 'react';
import { Assessment, AssessmentStatus } from '../../types/assessment';
import { useProgressTracking } from '../../hooks/useProgressTracking';

interface ProgressTrackerProps {
  assessmentId: string;
  onComplete?: (assessment: Assessment) => void;
  showDetailedProgress?: boolean;
}

const statusDisplayInfo: Record<AssessmentStatus, {
  label: string;
  color: string;
  icon: string;
  description: string;
  estimatedTime: string;
}> = {
  'payment-pending': {
    label: 'Payment Pending',
    color: 'bg-yellow-500',
    icon: '💳',
    description: 'Waiting for payment confirmation',
    estimatedTime: 'Pending payment'
  },
  'document-processing': {
    label: 'Processing Documents',
    color: 'bg-blue-500',
    icon: '📄',
    description: 'Analyzing uploaded documents and extracting key information',
    estimatedTime: '5-15 minutes'
  },
  'triaging': {
    label: 'Triaging Domains',
    color: 'bg-purple-500',
    icon: '🎯',
    description: 'AI agents identifying critical business areas requiring analysis',
    estimatedTime: '10-20 minutes'
  },
  'analyzing': {
    label: 'Domain Analysis',
    color: 'bg-orange-500',
    icon: '🔍',
    description: 'Specialist agents analyzing identified domains in detail',
    estimatedTime: '30-45 minutes'
  },
  'synthesizing': {
    label: 'Synthesizing Results',
    color: 'bg-indigo-500',
    icon: '⚡',
    description: 'Combining insights and creating prioritized recommendations',
    estimatedTime: '15-25 minutes'
  },
  'validating': {
    label: 'Client Validation',
    color: 'bg-green-500',
    icon: '✅',
    description: 'Awaiting client review and validation of findings',
    estimatedTime: 'Client action required'
  },
  'completed': {
    label: 'Completed',
    color: 'bg-green-600',
    icon: '🎉',
    description: 'Assessment complete with all deliverables ready',
    estimatedTime: 'Complete'
  },
  'failed': {
    label: 'Failed',
    color: 'bg-red-500',
    icon: '❌',
    description: 'Assessment encountered an error and requires attention',
    estimatedTime: 'Manual intervention required'
  },
  'paused-for-gaps': {
    label: 'Paused - Information Gaps',
    color: 'bg-amber-500',
    icon: '⏸️',
    description: 'Additional information required to continue analysis',
    estimatedTime: 'Client input required'
  },
  'paused-for-clarification': {
    label: 'Paused - Clarification Needed',
    color: 'bg-amber-500',
    icon: '❓',
    description: 'Clarification needed on assessment responses',
    estimatedTime: 'Client clarification required'
  }
};

const getProgressPercentage = (status: AssessmentStatus): number => {
  const progressMap: Record<AssessmentStatus, number> = {
    'payment-pending': 0,
    'document-processing': 15,
    'triaging': 30,
    'analyzing': 60,
    'synthesizing': 85,
    'validating': 95,
    'completed': 100,
    'failed': 0,
    'paused-for-gaps': 50,
    'paused-for-clarification': 50
  };
  return progressMap[status] || 0;
};

export const ProgressTracker: React.FC<ProgressTrackerProps> = ({
  assessmentId,
  onComplete,
  showDetailedProgress = true
}) => {
  const [notifications, setNotifications] = useState<string[]>([]);

  const {
    assessment,
    isPolling,
    isConnected,
    lastUpdated,
    error,
    retryCount,
    canRetry,
    retry,
    forceRefresh
  } = useProgressTracking({
    assessmentId,
    pollingInterval: 30000, // 30 seconds
    onStatusChange: (newStatus) => {
      const info = statusDisplayInfo[newStatus];
      const message = `Status updated: ${info.label}`;
      setNotifications(prev => [message, ...prev.slice(0, 4)]); // Keep last 5 notifications
    },
    onError: (errorMessage) => {
      setNotifications(prev => [`Error: ${errorMessage}`, ...prev.slice(0, 4)]);
    },
    onComplete: (completedAssessment) => {
      setNotifications(prev => ['🎉 Assessment completed!', ...prev.slice(0, 4)]);
      if (onComplete) {
        onComplete(completedAssessment);
      }
    }
  });

  if (!assessment) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading assessment status...</p>
        </div>
      </div>
    );
  }

  const statusInfo = statusDisplayInfo[assessment.status];
  const progressPercentage = getProgressPercentage(assessment.status);
  const isComplete = assessment.status === 'completed';
  const isFailed = assessment.status === 'failed';
  const isPaused = assessment.status.includes('paused');

  return (
    <div className="space-y-6">
      {/* Main Progress Card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">{statusInfo.icon}</span>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{statusInfo.label}</h2>
              <p className="text-sm text-gray-600">{statusInfo.description}</p>
            </div>
          </div>

          <div className="text-right">
            <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium text-white ${statusInfo.color}`}>
              {progressPercentage}% Complete
            </div>
            <p className="text-xs text-gray-500 mt-1">{statusInfo.estimatedTime}</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
          <div
            className={`h-3 rounded-full transition-all duration-500 ${statusInfo.color.replace('bg-', 'bg-')}`}
            style={{ width: `${progressPercentage}%` }}
          />
        </div>

        {/* Assessment Details */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Assessment ID:</span>
            <p className="font-medium">{assessment.id.slice(-8)}</p>
          </div>
          <div>
            <span className="text-gray-500">Started:</span>
            <p className="font-medium">{new Date(assessment.createdAt).toLocaleDateString()}</p>
          </div>
          <div>
            <span className="text-gray-500">Company:</span>
            <p className="font-medium">{assessment.companyName}</p>
          </div>
          <div>
            <span className="text-gray-500">Expected Delivery:</span>
            <p className="font-medium">
              {new Date(assessment.deliverySchedule.implementation72h).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>

      {/* Connection Status */}
      <div className="flex items-center justify-between bg-gray-50 rounded-lg p-4">
        <div className="flex items-center space-x-3">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-sm text-gray-700">
            {isConnected ? 'Connected' : 'Connection Issues'}
          </span>
          {lastUpdated && (
            <span className="text-xs text-gray-500">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {error && canRetry && (
            <button
              onClick={retry}
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Retry ({retryCount}/{3})
            </button>
          )}

          <button
            onClick={forceRefresh}
            disabled={isPolling}
            className="px-3 py-1 text-sm border border-gray-300 rounded text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {isPolling ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <span className="text-red-500">⚠️</span>
            <span className="text-red-700 font-medium">Connection Error</span>
          </div>
          <p className="text-red-600 text-sm mt-1">{error}</p>
        </div>
      )}

      {/* Detailed Progress */}
      {showDetailedProgress && assessment.progress && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Domain Analysis Progress</h3>
          <div className="space-y-3">
            {Object.entries(assessment.progress.domains || {}).map(([domain, progress]) => (
              <div key={domain} className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 capitalize">
                  {domain.replace('-', ' ')}
                </span>
                <div className="flex items-center space-x-3">
                  <div className="w-24 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full"
                      style={{ width: `${progress.completed}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 w-12 text-right">
                    {progress.completed}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Notifications */}
      {notifications.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Updates</h3>
          <div className="space-y-2">
            {notifications.map((notification, index) => (
              <div key={index} className="flex items-center space-x-2 text-sm">
                <div className="w-2 h-2 bg-blue-500 rounded-full" />
                <span className="text-gray-700">{notification}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Delivery Timeline */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Delivery Timeline</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Executive Summary (24h)</span>
            <span className="text-sm text-gray-600">
              {new Date(assessment.deliverySchedule.executive24h).toLocaleDateString()}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Detailed Analysis (48h)</span>
            <span className="text-sm text-gray-600">
              {new Date(assessment.deliverySchedule.detailed48h).toLocaleDateString()}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Implementation Kit (72h)</span>
            <span className="text-sm text-gray-600">
              {new Date(assessment.deliverySchedule.implementation72h).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};