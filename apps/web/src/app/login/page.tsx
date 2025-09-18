'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

import LoginForm from '../../components/auth/LoginForm';

import { LoginCredentials, ApiResponse } from '@/types';

export const dynamic = 'force-dynamic';

interface LoginResponse {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    companyId: string;
    role: string;
    emailVerified: boolean;
  };
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    tokenType: 'Bearer';
    scope: string[];
  };
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  // Check for redirect parameter or success messages
  const redirectTo = searchParams?.get('redirect') || '/dashboard';
  const verified = searchParams?.get('verified');
  const registered = searchParams?.get('registered');

  const handleLogin = async (credentials: LoginCredentials) => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      const result: ApiResponse<LoginResponse> = await response.json();

      if (!result.success) {
        setError(result.error?.message || 'Login failed. Please try again.');
        return;
      }

      // Store tokens securely
      if (typeof window !== 'undefined') {
        const storage = credentials.rememberMe ? localStorage : sessionStorage;
        storage.setItem('accessToken', result.data!.tokens.accessToken);
        storage.setItem('refreshToken', result.data!.tokens.refreshToken);
        storage.setItem('user', JSON.stringify(result.data!.user));

        // Mirror to sessionStorage so AuthContext always finds it
        // This ensures compatibility regardless of storage choice
        try {
          sessionStorage.setItem('user', JSON.stringify(result.data!.user));
        } catch (err) {
          console.warn('Failed to mirror user data to sessionStorage:', err);
        }
      }

      // Redirect to intended destination
      router.push(redirectTo);
    } catch (err) {
      console.error('Login error:', err);
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
          <p className="mt-2 text-gray-600">Scale your business with AI-powered insights</p>
        </div>

        {/* Success Messages */}
        {verified && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-md">
            <div className="flex items-center">
              <svg
                className="w-5 h-5 text-green-600 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <div className="text-sm text-green-800">
                Email verified successfully! You can now sign in to your account.
              </div>
            </div>
          </div>
        )}

        {registered && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
            <div className="flex items-center">
              <svg
                className="w-5 h-5 text-blue-600 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div className="text-sm text-blue-800">
                Registration successful! Please sign in with your new account.
              </div>
            </div>
          </div>
        )}

        {/* Login Form */}
        <LoginForm onSubmit={handleLogin} loading={loading} error={error} />

        {/* Features */}
        <div className="mt-8 bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Why ScaleMap?</h3>
          <ul className="space-y-3 text-sm text-gray-600">
            <li className="flex items-start">
              <svg
                className="w-5 h-5 text-blue-600 mr-2 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              AI-powered business assessments to identify growth opportunities
            </li>
            <li className="flex items-start">
              <svg
                className="w-5 h-5 text-blue-600 mr-2 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Intelligent agents that automate routine business processes
            </li>
            <li className="flex items-start">
              <svg
                className="w-5 h-5 text-blue-600 mr-2 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Real-time analytics and insights to guide strategic decisions
            </li>
            <li className="flex items-start">
              <svg
                className="w-5 h-5 text-blue-600 mr-2 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Secure, GDPR-compliant platform built for scaling businesses
            </li>
          </ul>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-xs text-gray-500">
            By signing in, you agree to our{' '}
            <a
              href="/terms"
              target="_blank"
              className="text-blue-600 hover:text-blue-500 underline"
            >
              Terms of Service
            </a>{' '}
            and{' '}
            <a
              href="/privacy"
              target="_blank"
              className="text-blue-600 hover:text-blue-500 underline"
            >
              Privacy Policy
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
