'use client';

import { useAuth } from '@/lib/auth/auth-context';
import { PERMISSIONS } from '@/types/auth';

export default function DashboardPage() {
  const { user, logout, hasPermission, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">
            Access Denied
          </h1>
          <p>Please log in to access the dashboard.</p>
        </div>
      </div>
    );
  }

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-white shadow-lg rounded-lg p-6 mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-secondary-900">
                Welcome, {user.firstName}!
              </h1>
              <p className="text-secondary-600 mt-2">
                Company: {user.companyId} | Role: {user.role}
              </p>
            </div>
            <button onClick={handleLogout} className="btn-secondary px-4 py-2">
              Logout
            </button>
          </div>
        </div>

        {/* User Info Card */}
        <div className="grid md:grid-cols-2 gap-8 mb-8">
          <div className="bg-white shadow-lg rounded-lg p-6">
            <h2 className="text-xl font-semibold text-secondary-900 mb-4">
              User Information
            </h2>
            <div className="space-y-3">
              <div>
                <span className="font-medium text-secondary-700">Email:</span>
                <span className="ml-2 text-secondary-600">{user.email}</span>
              </div>
              <div>
                <span className="font-medium text-secondary-700">Name:</span>
                <span className="ml-2 text-secondary-600">
                  {user.firstName} {user.lastName}
                </span>
              </div>
              <div>
                <span className="font-medium text-secondary-700">Role:</span>
                <span className="ml-2 text-secondary-600 capitalize">
                  {user.role}
                </span>
              </div>
              <div>
                <span className="font-medium text-secondary-700">
                  Email Verified:
                </span>
                <span
                  className={`ml-2 ${user.emailVerified ? 'text-success-600' : 'text-warning-600'}`}
                >
                  {user.emailVerified ? 'Yes' : 'No'}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white shadow-lg rounded-lg p-6">
            <h2 className="text-xl font-semibold text-secondary-900 mb-4">
              Permissions
            </h2>
            <div className="space-y-2">
              {(user.permissions || []).map((permission) => (
                <span
                  key={permission}
                  className="inline-block bg-primary-100 text-primary-800 text-xs px-2 py-1 rounded mr-2 mb-2"
                >
                  {permission}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white shadow-lg rounded-lg p-6">
          <h2 className="text-xl font-semibold text-secondary-900 mb-4">
            Quick Actions
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {hasPermission(PERMISSIONS.ASSESSMENTS_CREATE) && (
              <button className="btn-primary p-4 text-left">
                <div className="font-medium">Start Assessment</div>
                <div className="text-sm opacity-90">
                  Create a new business assessment
                </div>
              </button>
            )}

            {hasPermission(PERMISSIONS.ASSESSMENTS_READ) && (
              <button className="btn-secondary p-4 text-left">
                <div className="font-medium">View Assessments</div>
                <div className="text-sm opacity-90">
                  Browse existing assessments
                </div>
              </button>
            )}

            {hasPermission(PERMISSIONS.COMPANY_UPDATE) && (
              <button className="btn-secondary p-4 text-left">
                <div className="font-medium">Company Settings</div>
                <div className="text-sm opacity-90">
                  Manage company information
                </div>
              </button>
            )}

            {hasPermission(PERMISSIONS.ANALYTICS_READ) && (
              <button className="btn-secondary p-4 text-left">
                <div className="font-medium">Analytics</div>
                <div className="text-sm opacity-90">
                  View performance metrics
                </div>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
