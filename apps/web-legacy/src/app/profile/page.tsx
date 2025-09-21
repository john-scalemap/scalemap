'use client';

import { useState } from 'react';

import { CompanyProfileForm } from '../../components/profile/CompanyProfileForm';
import { DataManagementPanel } from '../../components/profile/DataManagementPanel';
import { PreferencesForm } from '../../components/profile/PreferencesForm';
import { UserProfileForm } from '../../components/profile/UserProfileForm';

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState<'user' | 'company' | 'preferences' | 'data'>('user');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const tabs = [
    { id: 'user', label: 'Personal Info', icon: '👤' },
    { id: 'company', label: 'Company', icon: '🏢' },
    { id: 'preferences', label: 'Preferences', icon: '⚙️' },
    { id: 'data', label: 'Data & Privacy', icon: '🔒' }
  ] as const;

  const handleSuccess = (message: string) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(null), 5000);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Profile Settings</h1>
          <p className="mt-2 text-sm text-gray-600">
            Manage your personal information, company details, and preferences
          </p>
        </div>

        {successMessage && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-md p-4">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-green-800">
                  Success
                </h3>
                <div className="mt-2 text-sm text-green-700">
                  <p>{successMessage}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <span className="mr-2">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {activeTab === 'user' && (
            <UserProfileForm
              onSuccess={() => handleSuccess('Personal information updated successfully')}
            />
          )}

          {activeTab === 'company' && (
            <CompanyProfileForm
              onSuccess={() => handleSuccess('Company information updated successfully')}
            />
          )}

          {activeTab === 'preferences' && (
            <PreferencesForm
              onSuccess={() => handleSuccess('Preferences saved successfully')}
            />
          )}

          {activeTab === 'data' && <DataManagementPanel />}
        </div>
      </div>
    </div>
  );
}