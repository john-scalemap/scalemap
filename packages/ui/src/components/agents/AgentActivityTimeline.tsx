import { AgentActivityTimeline as AgentActivityTimelineType, AgentPersonaStatus } from '@scalemap/shared';
import { clsx } from 'clsx';
import React from 'react';

import { AgentStatusBadge } from './AgentStatus';

interface AgentActivityTimelineProps {
  activities: AgentActivityTimelineType[];
  variant?: 'full' | 'compact';
  maxItems?: number;
  showTimestamps?: boolean;
  className?: string;
}

export const AgentActivityTimeline: React.FC<AgentActivityTimelineProps> = ({
  activities,
  variant = 'full',
  maxItems = 10,
  showTimestamps = true,
  className
}) => {
  const sortedActivities = React.useMemo(() => {
    if (!activities || activities.length === 0) {
      return [];
    }
    return [...activities]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, maxItems);
  }, [activities, maxItems]);

  const formatTimestamp = React.useCallback((timestamp: string) => {
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) {
        return 'Invalid date';
      }

      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMins < 1) {
        return 'Just now';
      } else if (diffMins < 60) {
        return `${diffMins}m ago`;
      } else if (diffHours < 24) {
        return `${diffHours}h ago`;
      } else if (diffDays < 7) {
        return `${diffDays}d ago`;
      } else {
        return date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
        });
      }
    } catch (error) {
      console.warn('Error formatting timestamp:', timestamp, error);
      return 'Unknown time';
    }
  }, []);

  const getActivityIcon = (activity: string, status: AgentPersonaStatus) => {
    const lowercaseActivity = activity.toLowerCase();

    if (lowercaseActivity.includes('started') || lowercaseActivity.includes('beginning')) {
      return '🚀';
    } else if (lowercaseActivity.includes('completed') || lowercaseActivity.includes('finished')) {
      return '✅';
    } else if (lowercaseActivity.includes('analyzing') || lowercaseActivity.includes('processing')) {
      return '🔍';
    } else if (lowercaseActivity.includes('error') || lowercaseActivity.includes('failed')) {
      return '❌';
    } else if (lowercaseActivity.includes('paused') || lowercaseActivity.includes('stopped')) {
      return '⏸️';
    } else if (lowercaseActivity.includes('resumed') || lowercaseActivity.includes('restarted')) {
      return '▶️';
    } else {
      switch (status) {
        case 'analyzing':
          return '⚡';
        case 'completed':
          return '✓';
        case 'available':
          return '💡';
        case 'offline':
          return '💤';
        case 'maintenance':
          return '🔧';
        default:
          return '📊';
      }
    }
  };

  if (!activities || activities.length === 0 || sortedActivities.length === 0) {
    return (
      <div className={clsx('text-center text-gray-500 py-4', className)}>
        No agent activity to display
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={clsx('space-y-2', className)}>
        {sortedActivities.map((activity, index) => (
          <div
            key={`${activity.agentId}-${activity.timestamp}-${index}`}
            className="flex items-center justify-between p-2 bg-gray-50 rounded-md"
          >
            <div className="flex items-center space-x-2 flex-1 min-w-0">
              <span className="text-sm" aria-hidden="true">
                {getActivityIcon(activity.activity, activity.status)}
              </span>
              <span className="text-sm text-gray-900 truncate">
                {activity.activity}
              </span>
              <AgentStatusBadge status={activity.status} className="flex-shrink-0" />
            </div>
            {showTimestamps && (
              <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                {formatTimestamp(activity.timestamp)}
              </span>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={clsx('space-y-4', className)}>
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200" aria-hidden="true" />

        {sortedActivities.map((activity, index) => (
          <div
            key={`${activity.agentId}-${activity.timestamp}-${index}`}
            className="relative flex items-start space-x-4 pb-4"
          >
            {/* Timeline node */}
            <div className="relative flex items-center justify-center">
              <div
                className={clsx(
                  'flex items-center justify-center w-12 h-12 rounded-full border-4 border-white shadow-sm text-lg',
                  activity.status === 'analyzing'
                    ? 'bg-blue-100'
                    : activity.status === 'completed'
                    ? 'bg-green-100'
                    : activity.status === 'available'
                    ? 'bg-gray-100'
                    : activity.status === 'offline'
                    ? 'bg-gray-50'
                    : 'bg-yellow-100'
                )}
              >
                <span aria-hidden="true">
                  {getActivityIcon(activity.activity, activity.status)}
                </span>
              </div>
              <AgentStatusBadge
                status={activity.status}
                className="absolute -bottom-1 -right-1"
              />
            </div>

            {/* Activity content */}
            <div className="flex-1 min-w-0 pt-1">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {activity.activity}
                  </p>
                  {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                    <div className="mt-1 space-y-1">
                      {Object.entries(activity.metadata).map(([key, value]) => (
                        <p key={key} className="text-xs text-gray-600">
                          <span className="font-medium capitalize">{key.replace(/([A-Z])/g, ' $1').toLowerCase()}:</span>{' '}
                          {typeof value === 'string' ? value : JSON.stringify(value)}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
                {showTimestamps && (
                  <span className="text-xs text-gray-500 flex-shrink-0 ml-4">
                    {formatTimestamp(activity.timestamp)}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

AgentActivityTimeline.displayName = 'AgentActivityTimeline';