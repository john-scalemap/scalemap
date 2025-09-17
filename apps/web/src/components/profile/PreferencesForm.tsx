'use client';

import { useState } from 'react';

import { useAuth } from '../../stores/auth';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';

interface PreferencesFormProps {
  onSuccess?: () => void;
}

export function PreferencesForm({ onSuccess }: PreferencesFormProps) {
  const { user, updateProfile } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preferences, setPreferences] = useState({
    notifications: {
      email: user?.preferences?.notifications?.email ?? true,
      push: user?.preferences?.notifications?.push ?? false,
      assessmentComplete: user?.preferences?.notifications?.assessmentComplete ?? true,
      weeklyDigest: user?.preferences?.notifications?.weeklyDigest ?? true,
      marketingCommunications: user?.preferences?.notifications?.marketingCommunications ?? false
    },
    dashboard: {
      defaultView: user?.preferences?.dashboard?.defaultView ?? 'overview' as const,
      itemsPerPage: user?.preferences?.dashboard?.itemsPerPage ?? 20,
      compactMode: user?.preferences?.dashboard?.compactMode ?? false
    },
    privacy: {
      profileVisibility: user?.preferences?.privacy?.profileVisibility ?? 'private' as const,
      dataRetention: user?.preferences?.privacy?.dataRetention ?? 'standard' as const,
      analyticsOptOut: user?.preferences?.privacy?.analyticsOptOut ?? false
    }
  });

  const defaultViews = [
    { value: 'overview', label: 'Overview' },
    { value: 'assessments', label: 'Assessments' },
    { value: 'agents', label: 'Agents' },
    { value: 'analytics', label: 'Analytics' }
  ];

  const itemsPerPageOptions = [
    { value: 10, label: '10 items' },
    { value: 20, label: '20 items' },
    { value: 50, label: '50 items' },
    { value: 100, label: '100 items' }
  ];

  const profileVisibilityOptions = [
    { value: 'private', label: 'Private (only you)' },
    { value: 'company', label: 'Company (team members)' },
    { value: 'public', label: 'Public (everyone)' }
  ];

  const dataRetentionOptions = [
    { value: 'minimal', label: 'Minimal (1 year)' },
    { value: 'standard', label: 'Standard (3 years)' },
    { value: 'extended', label: 'Extended (7 years)' }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await updateProfile({ preferences });
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update preferences');
    } finally {
      setIsLoading(false);
    }
  };

  const handleNotificationChange = (key: string, value: boolean) => {
    setPreferences(prev => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [key]: value
      }
    }));
  };

  const handleDashboardChange = (key: string, value: string | number | boolean) => {
    setPreferences(prev => ({
      ...prev,
      dashboard: {
        ...prev.dashboard,
        [key]: value
      }
    }));
  };

  const handlePrivacyChange = (key: string, value: string | boolean) => {
    setPreferences(prev => ({
      ...prev,
      privacy: {
        ...prev.privacy,
        [key]: value
      }
    }));
  };

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <h3 className="text-lg leading-6 font-medium text-gray-900">
          Preferences
        </h3>
        <div className="mt-2 max-w-xl text-sm text-gray-500">
          <p>Customize your experience and privacy settings.</p>
        </div>

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
                  Update failed
                </h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{error}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-6">
          {/* Notification Preferences */}
          <div className="border-b border-gray-200 pb-6">
            <h4 className="text-base font-medium text-gray-900 mb-4">Notifications</h4>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Email Notifications
                  </label>
                  <p className="text-xs text-gray-500">
                    Receive important updates via email
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.notifications.email}
                  onChange={(e) => handleNotificationChange('email', e.target.checked)}
                  disabled={isLoading}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Push Notifications
                  </label>
                  <p className="text-xs text-gray-500">
                    Browser push notifications
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.notifications.push}
                  onChange={(e) => handleNotificationChange('push', e.target.checked)}
                  disabled={isLoading}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Assessment Completion
                  </label>
                  <p className="text-xs text-gray-500">
                    Notify when assessments are complete
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.notifications.assessmentComplete}
                  onChange={(e) => handleNotificationChange('assessmentComplete', e.target.checked)}
                  disabled={isLoading}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Weekly Digest
                  </label>
                  <p className="text-xs text-gray-500">
                    Weekly summary of your progress
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.notifications.weeklyDigest}
                  onChange={(e) => handleNotificationChange('weeklyDigest', e.target.checked)}
                  disabled={isLoading}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Marketing Communications
                  </label>
                  <p className="text-xs text-gray-500">
                    Product updates and promotional content
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.notifications.marketingCommunications}
                  onChange={(e) => handleNotificationChange('marketingCommunications', e.target.checked)}
                  disabled={isLoading}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
              </div>
            </div>
          </div>

          {/* Dashboard Preferences */}
          <div className="border-b border-gray-200 pb-6">
            <h4 className="text-base font-medium text-gray-900 mb-4">Dashboard</h4>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <label htmlFor="defaultView" className="block text-sm font-medium text-gray-700">
                  Default View
                </label>
                <Select
                  id="defaultView"
                  name="defaultView"
                  value={preferences.dashboard.defaultView}
                  onChange={(e) => handleDashboardChange('defaultView', e.target.value)}
                  className="mt-1"
                  disabled={isLoading}
                >
                  {defaultViews.map((view) => (
                    <option key={view.value} value={view.value}>
                      {view.label}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label htmlFor="itemsPerPage" className="block text-sm font-medium text-gray-700">
                  Items Per Page
                </label>
                <Select
                  id="itemsPerPage"
                  name="itemsPerPage"
                  value={preferences.dashboard.itemsPerPage.toString()}
                  onChange={(e) => handleDashboardChange('itemsPerPage', parseInt(e.target.value))}
                  className="mt-1"
                  disabled={isLoading}
                >
                  {itemsPerPageOptions.map((option) => (
                    <option key={option.value} value={option.value.toString()}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Compact Mode
                  </label>
                  <p className="text-xs text-gray-500">
                    Show more content in less space
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.dashboard.compactMode}
                  onChange={(e) => handleDashboardChange('compactMode', e.target.checked)}
                  disabled={isLoading}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
              </div>
            </div>
          </div>

          {/* Privacy Preferences */}
          <div>
            <h4 className="text-base font-medium text-gray-900 mb-4">Privacy</h4>

            <div className="space-y-4">
              <div>
                <label htmlFor="profileVisibility" className="block text-sm font-medium text-gray-700">
                  Profile Visibility
                </label>
                <Select
                  id="profileVisibility"
                  name="profileVisibility"
                  value={preferences.privacy.profileVisibility}
                  onChange={(e) => handlePrivacyChange('profileVisibility', e.target.value)}
                  className="mt-1"
                  disabled={isLoading}
                >
                  {profileVisibilityOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label htmlFor="dataRetention" className="block text-sm font-medium text-gray-700">
                  Data Retention
                </label>
                <Select
                  id="dataRetention"
                  name="dataRetention"
                  value={preferences.privacy.dataRetention}
                  onChange={(e) => handlePrivacyChange('dataRetention', e.target.value)}
                  className="mt-1"
                  disabled={isLoading}
                >
                  {dataRetentionOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
                <p className="mt-1 text-xs text-gray-500">
                  How long should we keep your data after account deletion
                </p>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Opt Out of Analytics
                  </label>
                  <p className="text-xs text-gray-500">
                    Disable usage analytics and tracking
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.privacy.analyticsOptOut}
                  onChange={(e) => handlePrivacyChange('analyticsOptOut', e.target.checked)}
                  disabled={isLoading}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
              </div>
            </div>
          </div>

          <div className="pt-5">
            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={isLoading}
                className="ml-3"
              >
                {isLoading ? 'Saving...' : 'Save Preferences'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}