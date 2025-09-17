'use client';

import { Assessment } from '@/types';
import Link from 'next/link';

interface AssessmentCardProps {
  assessment: Assessment;
  onResume: () => void;
}

const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInMilliseconds = now.getTime() - date.getTime();
  const diffInMinutes = Math.floor(diffInMilliseconds / (1000 * 60));
  const diffInHours = Math.floor(diffInMinutes / 60);
  const diffInDays = Math.floor(diffInHours / 24);

  if (diffInMinutes < 1) return 'Just now';
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  if (diffInHours < 24) return `${diffInHours}h ago`;
  if (diffInDays === 1) return 'Yesterday';
  if (diffInDays < 7) return `${diffInDays}d ago`;

  return date.toLocaleDateString();
};

const getStatusColor = (status: Assessment['status']): string => {
  switch (status) {
    case 'document-processing':
      return 'bg-blue-100 text-blue-800';
    case 'triaging':
    case 'analyzing':
      return 'bg-yellow-100 text-yellow-800';
    case 'synthesizing':
    case 'validating':
      return 'bg-orange-100 text-orange-800';
    case 'completed':
      return 'bg-green-100 text-green-800';
    case 'failed':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const getStatusLabel = (status: Assessment['status']): string => {
  switch (status) {
    case 'document-processing':
      return 'In Progress';
    case 'triaging':
      return 'Triaging';
    case 'analyzing':
      return 'Analyzing';
    case 'synthesizing':
      return 'Synthesizing';
    case 'validating':
      return 'Validating';
    case 'completed':
      return 'Completed';
    case 'failed':
      return 'Failed';
    default:
      return status;
  }
};

export default function AssessmentCard({ assessment, onResume }: AssessmentCardProps) {
  const progressPercentage = assessment.progress?.completeness || 0;
  const isCompleted = assessment.status === 'completed';
  const canResume = ['document-processing', 'triaging', 'analyzing', 'synthesizing', 'validating'].includes(assessment.status);

  return (
    <div className="bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-colors p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-gray-900 truncate">
            {assessment.title || 'Untitled Assessment'}
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            {assessment.companyName}
          </p>
          {assessment.description && (
            <p className="text-sm text-gray-500 mt-2 line-clamp-2">
              {assessment.description}
            </p>
          )}
        </div>
        <div className="ml-4 flex-shrink-0">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(assessment.status)}`}>
            {getStatusLabel(assessment.status)}
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      {!isCompleted && (
        <div className="mb-4">
          <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
            <span>Progress</span>
            <span>{progressPercentage}% complete</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          {assessment.progress?.estimatedTimeRemaining && (
            <p className="text-xs text-gray-500 mt-1">
              Est. {assessment.progress.estimatedTimeRemaining} remaining
            </p>
          )}
        </div>
      )}

      {/* Assessment Info */}
      <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
        <span>
          Created {formatRelativeTime(assessment.createdAt)}
        </span>
        <span>
          Updated {formatRelativeTime(assessment.updatedAt)}
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
        <div className="flex space-x-2">
          {isCompleted ? (
            <Link
              href={`/assessment/${assessment.id}/results`}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-green-700 bg-green-100 hover:bg-green-200 transition-colors"
            >
              View Results
            </Link>
          ) : canResume ? (
            <button
              onClick={onResume}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 transition-colors"
            >
              Resume Assessment
            </button>
          ) : (
            <span className="inline-flex items-center px-3 py-2 text-sm text-gray-500">
              Processing...
            </span>
          )}
        </div>

        <Link
          href={`/assessment/${assessment.id}`}
          className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          View Details →
        </Link>
      </div>
    </div>
  );
}