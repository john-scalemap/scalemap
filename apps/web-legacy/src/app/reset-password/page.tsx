'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';

import { PasswordResetConfirm, ApiResponse } from '@/types';

import ResetPasswordForm from '../../components/auth/ResetPasswordForm';

export const dynamic = 'force-dynamic';


export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [token, setToken] = useState<string>('');

  useEffect(() => {
    const tokenParam = searchParams?.get('token');
    if (tokenParam) {
      setToken(tokenParam);
    } else {
      setError('Invalid or missing reset token. Please request a new password reset.');
    }
  }, [searchParams]);

  const handleResetPassword = async (data: PasswordResetConfirm) => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result: ApiResponse = await response.json();

      if (!result.success) {
        const errorMessage = result.error?.message || 'Failed to reset password. Please try again.';
        setError(errorMessage);

        // If token is invalid/expired, redirect to forgot password after a delay
        if (result.error?.code === 'INVALID_TOKEN' ||
            result.error?.code === 'TOKEN_EXPIRED' ||
            result.error?.code === 'TOKEN_ALREADY_USED') {
          setTimeout(() => {
            router.push('/forgot-password?expired=true');
          }, 3000);
        }
        return;
      }

      setSuccess((result.data as { message?: string })?.message || 'Password has been reset successfully. Please log in with your new password.');

    } catch (err) {
      console.error('Reset password error:', err);
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  // Show error if no token
  if (!token && !error) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md mx-auto">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto bg-yellow-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Loading...</h2>
            <p className="text-gray-600">Validating reset token...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show invalid token error
  if (error && !token) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto bg-red-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>

              <h2 className="text-xl font-bold text-gray-900 mb-2">Invalid Reset Link</h2>
              <p className="text-gray-600 mb-6">{error}</p>

              <div className="space-y-3">
                <button
                  onClick={() => router.push('/forgot-password')}
                  className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Request New Reset Link
                </button>

                <button
                  onClick={() => router.push('/login')}
                  className="w-full py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Back to Sign In
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">ScaleMap</h1>
          <p className="mt-2 text-gray-600">Reset Your Password</p>
        </div>

        {/* Token Expiry Warning */}
        {error && (error.includes('expired') || error.includes('invalid')) && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-yellow-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm text-yellow-800">
                <strong>Redirecting:</strong> You'll be redirected to request a new reset link in a few seconds...
              </div>
            </div>
          </div>
        )}

        {/* Form */}
        <ResetPasswordForm
          token={token}
          onSubmit={handleResetPassword}
          loading={loading}
          error={error}
          success={success}
        />

        {/* Password Tips */}
        {!success && !error && (
          <div className="mt-8 bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Password Security Tips</h3>
            <ul className="space-y-3 text-sm text-gray-600">
              <li className="flex items-start">
                <svg className="w-5 h-5 text-green-600 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Use a unique password that you haven't used elsewhere
              </li>
              <li className="flex items-start">
                <svg className="w-5 h-5 text-green-600 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Consider using a password manager
              </li>
              <li className="flex items-start">
                <svg className="w-5 h-5 text-green-600 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Mix uppercase, lowercase, numbers, and symbols
              </li>
              <li className="flex items-start">
                <svg className="w-5 h-5 text-green-600 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Avoid common words or personal information
              </li>
            </ul>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-xs text-gray-500">
            Secure password reset powered by industry-standard encryption
          </p>
        </div>
      </div>
    </div>
  );
}