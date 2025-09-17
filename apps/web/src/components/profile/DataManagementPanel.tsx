'use client';

import { useState } from 'react';

import { useAuth } from '../../stores/auth';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';

export function DataManagementPanel() {
  const { user, logout } = useAuth();
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteFeedback, setDeleteFeedback] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleExportData = async () => {
    setIsExporting(true);
    setError(null);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/user/export`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${user?.tokens?.accessToken}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to export data');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `scalemap-data-export-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export data');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== 'DELETE MY ACCOUNT PERMANENTLY') {
      setError('You must type the exact confirmation phrase to delete your account');
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/user/account`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.tokens?.accessToken}`
        },
        body: JSON.stringify({
          confirmationPhrase: deleteConfirmation,
          reason: deleteReason,
          feedback: deleteFeedback
        })
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to delete account');
      }

      // Log out user and redirect
      await logout();
      window.location.href = '/';

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete account');
      setIsDeleting(false);
    }
  };

  const retentionPeriod = user?.preferences?.privacy?.dataRetention || 'standard';
  const retentionDescription = {
    minimal: '1 year',
    standard: '3 years',
    extended: '7 years'
  }[retentionPeriod];

  return (
    <div className="space-y-6">
      {/* Data Export Section */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            Export Your Data
          </h3>
          <div className="mt-2 max-w-xl text-sm text-gray-500">
            <p>
              Download a complete copy of your personal data. This includes your profile information,
              company details, preferences, and activity history.
            </p>
          </div>

          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    Error
                  </h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p>{error}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="mt-5">
            <Button
              onClick={handleExportData}
              disabled={isExporting}
              variant="outline"
            >
              {isExporting ? 'Exporting Data...' : 'Export My Data'}
            </Button>
          </div>

          <div className="mt-4 text-xs text-gray-500">
            <p>
              This export complies with GDPR Article 15 (Right of Access) and provides your data
              in a machine-readable JSON format.
            </p>
          </div>
        </div>
      </div>

      {/* Data Retention Information */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-blue-900">
            Data Retention Policy
          </h3>
          <div className="mt-2 max-w-xl text-sm text-blue-700">
            <p>
              Your current data retention setting is <strong>{retentionPeriod}</strong>,
              which means your data will be kept for <strong>{retentionDescription}</strong> after
              account deletion before being permanently purged.
            </p>
            <p className="mt-2">
              You can change this setting in your Privacy preferences above.
            </p>
          </div>
        </div>
      </div>

      {/* Account Deletion Section */}
      <div className="bg-red-50 border border-red-200 rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-red-900">
            Delete Your Account
          </h3>
          <div className="mt-2 max-w-xl text-sm text-red-700">
            <p>
              Permanently delete your ScaleMap account and all associated data. This action cannot be undone.
            </p>
          </div>

          {!showDeleteConfirm ? (
            <div className="mt-5">
              <Button
                onClick={() => setShowDeleteConfirm(true)}
                variant="destructive"
              >
                Delete My Account
              </Button>
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              <div>
                <label htmlFor="deleteReason" className="block text-sm font-medium text-red-700">
                  Reason for leaving (optional)
                </label>
                <select
                  id="deleteReason"
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-red-300 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm rounded-md"
                >
                  <option value="">Select a reason</option>
                  <option value="not-useful">Product not useful</option>
                  <option value="too-expensive">Too expensive</option>
                  <option value="switching-competitor">Switching to competitor</option>
                  <option value="privacy-concerns">Privacy concerns</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label htmlFor="deleteFeedback" className="block text-sm font-medium text-red-700">
                  Additional feedback (optional)
                </label>
                <Textarea
                  id="deleteFeedback"
                  rows={3}
                  value={deleteFeedback}
                  onChange={(e) => setDeleteFeedback(e.target.value)}
                  className="mt-1 border-red-300 focus:ring-red-500 focus:border-red-500"
                  placeholder="Help us improve by sharing your feedback..."
                />
              </div>

              <div>
                <label htmlFor="deleteConfirm" className="block text-sm font-medium text-red-700">
                  Type "DELETE MY ACCOUNT PERMANENTLY" to confirm
                </label>
                <Input
                  id="deleteConfirm"
                  type="text"
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                  className="mt-1 border-red-300 focus:ring-red-500 focus:border-red-500"
                  placeholder="DELETE MY ACCOUNT PERMANENTLY"
                />
              </div>

              <div className="bg-red-100 border border-red-300 rounded-md p-3">
                <h4 className="text-sm font-medium text-red-800">⚠️ Warning</h4>
                <ul className="mt-2 text-xs text-red-700 list-disc list-inside space-y-1">
                  <li>Your account and all data will be permanently deleted</li>
                  <li>Your data will be anonymized immediately</li>
                  <li>Complete data purge will occur after {retentionDescription}</li>
                  <li>This action cannot be undone</li>
                  {user?.role === 'admin' && (
                    <li className="font-medium">As an admin, ensure another admin is assigned to your company first</li>
                  )}
                </ul>
              </div>

              <div className="flex space-x-3">
                <Button
                  onClick={handleDeleteAccount}
                  disabled={isDeleting || deleteConfirmation !== 'DELETE MY ACCOUNT PERMANENTLY'}
                  variant="destructive"
                >
                  {isDeleting ? 'Deleting Account...' : 'Permanently Delete Account'}
                </Button>
                <Button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteConfirmation('');
                    setDeleteReason('');
                    setDeleteFeedback('');
                    setError(null);
                  }}
                  variant="outline"
                  disabled={isDeleting}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}