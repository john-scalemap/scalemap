import { AgentPersonaStatus } from '@scalemap/shared';
import { clsx } from 'clsx';
import React from 'react';

interface AgentStatusProps {
  status: AgentPersonaStatus;
  progress?: number;
  activity?: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  showProgress?: boolean;
  className?: string;
}

export const AgentStatus: React.FC<AgentStatusProps> = ({
  status,
  progress,
  activity,
  size = 'md',
  showLabel = true,
  showProgress = false,
  className
}) => {
  const getStatusConfig = (status: AgentPersonaStatus) => {
    switch (status) {
      case 'available':
        return {
          color: 'text-green-700 bg-green-100 border-green-200',
          icon: '●',
          label: 'Available',
          pulse: false
        };
      case 'analyzing':
        return {
          color: 'text-blue-700 bg-blue-100 border-blue-200',
          icon: '⟳',
          label: 'Analyzing',
          pulse: true
        };
      case 'completed':
        return {
          color: 'text-gray-700 bg-gray-100 border-gray-200',
          icon: '✓',
          label: 'Completed',
          pulse: false
        };
      case 'offline':
        return {
          color: 'text-gray-500 bg-gray-50 border-gray-200',
          icon: '○',
          label: 'Offline',
          pulse: false
        };
      case 'maintenance':
        return {
          color: 'text-yellow-700 bg-yellow-100 border-yellow-200',
          icon: '⚠',
          label: 'Maintenance',
          pulse: true
        };
      default:
        return {
          color: 'text-gray-500 bg-gray-100 border-gray-200',
          icon: '○',
          label: 'Unknown',
          pulse: false
        };
    }
  };

  const getSizeClasses = (size: 'sm' | 'md' | 'lg') => {
    switch (size) {
      case 'sm':
        return {
          container: 'px-2 py-1 text-xs',
          icon: 'text-xs',
          progress: 'h-1'
        };
      case 'md':
        return {
          container: 'px-3 py-1 text-sm',
          icon: 'text-sm',
          progress: 'h-2'
        };
      case 'lg':
        return {
          container: 'px-4 py-2 text-base',
          icon: 'text-base',
          progress: 'h-3'
        };
    }
  };

  const statusConfig = getStatusConfig(status);
  const sizeClasses = getSizeClasses(size);

  return (
    <div className={clsx('inline-flex flex-col space-y-1', className)}>
      <div
        className={clsx(
          'inline-flex items-center rounded-full border font-medium',
          statusConfig.color,
          sizeClasses.container,
          {
            'animate-pulse': statusConfig.pulse
          }
        )}
        role="status"
        aria-label={`Agent status: ${statusConfig.label}${activity ? ` - ${activity}` : ''}`}
      >
        <span
          className={clsx(
            'mr-2',
            sizeClasses.icon,
            {
              'animate-spin': status === 'analyzing'
            }
          )}
          aria-hidden="true"
        >
          {statusConfig.icon}
        </span>
        {showLabel && (
          <span>
            {statusConfig.label}
            {activity && size !== 'sm' && (
              <span className="ml-1 font-normal opacity-75">
                - {activity}
              </span>
            )}
          </span>
        )}
      </div>

      {/* Progress bar for analyzing status */}
      {showProgress && status === 'analyzing' && progress !== undefined && (
        <div className="w-full bg-gray-200 rounded-full overflow-hidden">
          <div
            className={clsx(
              'bg-blue-500 transition-all duration-300 ease-out rounded-full',
              sizeClasses.progress
            )}
            style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Analysis progress: ${progress}%`}
          />
        </div>
      )}
    </div>
  );
};

interface AgentStatusBadgeProps {
  status: AgentPersonaStatus;
  className?: string;
}

export const AgentStatusBadge: React.FC<AgentStatusBadgeProps> = ({
  status,
  className
}) => {
  const getStatusConfig = (status: AgentPersonaStatus) => {
    switch (status) {
      case 'available':
        return {
          color: 'bg-green-500',
          label: 'Available'
        };
      case 'analyzing':
        return {
          color: 'bg-blue-500 animate-pulse',
          label: 'Analyzing'
        };
      case 'completed':
        return {
          color: 'bg-gray-400',
          label: 'Completed'
        };
      case 'offline':
        return {
          color: 'bg-gray-300',
          label: 'Offline'
        };
      case 'maintenance':
        return {
          color: 'bg-yellow-500 animate-pulse',
          label: 'Maintenance'
        };
      default:
        return {
          color: 'bg-gray-300',
          label: 'Unknown'
        };
    }
  };

  const statusConfig = getStatusConfig(status);

  return (
    <div
      className={clsx(
        'w-3 h-3 rounded-full border-2 border-white shadow-sm',
        statusConfig.color,
        className
      )}
      title={statusConfig.label}
      aria-label={`Status: ${statusConfig.label}`}
    />
  );
};

AgentStatus.displayName = 'AgentStatus';
AgentStatusBadge.displayName = 'AgentStatusBadge';