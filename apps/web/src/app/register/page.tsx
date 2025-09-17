'use client';

import { RegisterCredentials, CompanyRegistration, ApiResponse } from '@/types';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import CompanyRegistrationForm from '../../components/auth/CompanyRegistrationForm';
import UserRegistrationForm from '../../components/auth/UserRegistrationForm';


enum RegistrationStep {
  USER_INFO = 1,
  COMPANY_INFO = 2,
  VERIFICATION = 3
}

export default function RegisterPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<RegistrationStep>(RegistrationStep.USER_INFO);
  const [userInfo, setUserInfo] = useState<RegisterCredentials | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');

  const handleUserSubmit = (data: RegisterCredentials) => {
    setUserInfo(data);
    setCurrentStep(RegistrationStep.COMPANY_INFO);
    setError('');
  };

  const handleCompanySubmit = async (companyData: CompanyRegistration) => {
    if (!userInfo) {
      setError('User information is missing. Please start over.');
      setCurrentStep(RegistrationStep.USER_INFO);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const registrationData = {
        user: userInfo,
        company: companyData
      };

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(registrationData),
      });

      const result: ApiResponse = await response.json();

      if (!result.success) {
        setError(result.error?.message || 'Registration failed. Please try again.');
        return;
      }

      setSuccessMessage('Account created successfully! Please check your email to verify your account.');
      setCurrentStep(RegistrationStep.VERIFICATION);

    } catch (err) {
      console.error('Registration error:', err);
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (currentStep === RegistrationStep.COMPANY_INFO) {
      setCurrentStep(RegistrationStep.USER_INFO);
    }
    setError('');
  };

  const getStepIndicator = () => (
    <div className="flex items-center justify-center mb-8">
      <div className="flex items-center space-x-4">
        {/* Step 1 */}
        <div className={`flex items-center space-x-2 ${currentStep >= RegistrationStep.USER_INFO ? 'text-blue-600' : 'text-gray-400'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
            currentStep > RegistrationStep.USER_INFO ? 'bg-blue-600 text-white' :
            currentStep === RegistrationStep.USER_INFO ? 'bg-blue-100 text-blue-600 border-2 border-blue-600' :
            'bg-gray-100 text-gray-400'
          }`}>
            {currentStep > RegistrationStep.USER_INFO ? '✓' : '1'}
          </div>
          <span className="text-sm font-medium">Personal Info</span>
        </div>

        {/* Connector */}
        <div className={`w-12 h-0.5 ${currentStep > RegistrationStep.USER_INFO ? 'bg-blue-600' : 'bg-gray-300'}`}></div>

        {/* Step 2 */}
        <div className={`flex items-center space-x-2 ${currentStep >= RegistrationStep.COMPANY_INFO ? 'text-blue-600' : 'text-gray-400'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
            currentStep > RegistrationStep.COMPANY_INFO ? 'bg-blue-600 text-white' :
            currentStep === RegistrationStep.COMPANY_INFO ? 'bg-blue-100 text-blue-600 border-2 border-blue-600' :
            'bg-gray-100 text-gray-400'
          }`}>
            {currentStep > RegistrationStep.COMPANY_INFO ? '✓' : '2'}
          </div>
          <span className="text-sm font-medium">Company Info</span>
        </div>

        {/* Connector */}
        <div className={`w-12 h-0.5 ${currentStep > RegistrationStep.COMPANY_INFO ? 'bg-blue-600' : 'bg-gray-300'}`}></div>

        {/* Step 3 */}
        <div className={`flex items-center space-x-2 ${currentStep >= RegistrationStep.VERIFICATION ? 'text-blue-600' : 'text-gray-400'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
            currentStep === RegistrationStep.VERIFICATION ? 'bg-blue-100 text-blue-600 border-2 border-blue-600' :
            'bg-gray-100 text-gray-400'
          }`}>
            3
          </div>
          <span className="text-sm font-medium">Verification</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Join ScaleMap</h1>
          <p className="mt-2 text-gray-600">Scale your business with AI-powered insights and automation</p>
        </div>

        {/* Step Indicator */}
        {getStepIndicator()}

        {/* Form Content */}
        <div className="bg-white rounded-lg shadow-sm">
          {currentStep === RegistrationStep.USER_INFO && (
            <UserRegistrationForm
              onSubmit={handleUserSubmit}
              loading={loading}
              error={error}
            />
          )}

          {currentStep === RegistrationStep.COMPANY_INFO && (
            <div>
              <div className="p-6 pb-0">
                <button
                  onClick={handleBack}
                  className="flex items-center text-sm text-blue-600 hover:text-blue-500 mb-4"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Back to Personal Info
                </button>
              </div>
              <CompanyRegistrationForm
                onSubmit={handleCompanySubmit}
                loading={loading}
                error={error}
              />
            </div>
          )}

          {currentStep === RegistrationStep.VERIFICATION && (
            <div className="p-8 text-center">
              <div className="mb-6">
                <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Check Your Email</h2>
                <p className="text-gray-600 mb-6">{successMessage}</p>
              </div>

              <div className="bg-blue-50 rounded-lg p-6 mb-6">
                <h3 className="font-medium text-blue-900 mb-2">What's Next?</h3>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Check your email inbox for a verification message</li>
                  <li>• Click the verification link in the email</li>
                  <li>• You'll be redirected to complete your account setup</li>
                </ul>
              </div>

              <div className="space-y-4">
                <button
                  onClick={() => router.push('/login')}
                  className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Go to Sign In
                </button>

                <p className="text-xs text-gray-500">
                  Didn't receive the email? Check your spam folder or{' '}
                  <button
                    onClick={() => {
                      setCurrentStep(RegistrationStep.USER_INFO);
                      setUserInfo(null);
                      setSuccessMessage('');
                    }}
                    className="text-blue-600 hover:text-blue-500 underline"
                  >
                    try again
                  </button>
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            By creating an account, you agree to our{' '}
            <a href="/terms" target="_blank" className="text-blue-600 hover:text-blue-500 underline">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="/privacy" target="_blank" className="text-blue-600 hover:text-blue-500 underline">
              Privacy Policy
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}