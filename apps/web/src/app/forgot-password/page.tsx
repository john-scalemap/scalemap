'use client';

import { PasswordResetRequest, ApiResponse } from '@/types';
import { useState } from 'react';

import ForgotPasswordForm from '../../components/auth/ForgotPasswordForm';

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  const handleForgotPassword = async (data: PasswordResetRequest) => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result: ApiResponse<{ message?: string }> = await response.json();

      if (!result.success) {
        setError(result.error?.message || 'Failed to send reset instructions. Please try again.');
        return;
      }

      setSuccess(result.data?.message || 'If the email address exists in our system, you will receive password reset instructions.');

    } catch (err) {
      console.error('Forgot password error:', err);
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">ScaleMap</h1>
          <p className="mt-2 text-gray-600">Password Recovery</p>
        </div>

        {/* Form */}
        <ForgotPasswordForm
          onSubmit={handleForgotPassword}
          loading={loading}
          error={error}
          success={success}
        />

        {/* Security Note */}
        {!success && (
          <div className="mt-8 bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Security & Privacy</h3>
            <ul className="space-y-3 text-sm text-gray-600">
              <li className="flex items-start">
                <svg className="w-5 h-5 text-blue-600 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.2 2a9 9 0 11-17.4 0" />
                </svg>
                Reset links expire after 1 hour for security
              </li>
              <li className="flex items-start">
                <svg className="w-5 h-5 text-blue-600 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.2 2a9 9 0 11-17.4 0" />
                </svg>
                Each reset link can only be used once
              </li>
              <li className="flex items-start">
                <svg className="w-5 h-5 text-blue-600 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.2 2a9 9 0 11-17.4 0" />
                </svg>
                All existing sessions will be logged out after reset
              </li>
              <li className="flex items-start">
                <svg className="w-5 h-5 text-blue-600 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.2 2a9 9 0 11-17.4 0" />
                </svg>
                We never store your password in plain text
              </li>
            </ul>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-xs text-gray-500">
            Need help? Contact our{' '}
            <a href="/support" className="text-blue-600 hover:text-blue-500 underline">
              support team
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}