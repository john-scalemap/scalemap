'use client';

import { useState } from 'react';

import { useRouter } from 'next/navigation';

import { useAuth } from '@/lib/auth/auth-context';
import type { RegisterRequest } from '@/types/auth';
import type { CompanyRegistrationData, CompanyValidationErrors } from '@/types/company';
import {
  INDUSTRY_SECTORS,
  BUSINESS_MODELS,
  COMPANY_SIZES,
  REGULATORY_CLASSIFICATIONS,
  COUNTRIES
} from '@/types/company';

interface RegistrationFormProps {
  onSuccess?: () => void;
}

interface RegistrationData {
  user: {
    email: string;
    password: string;
    confirmPassword: string;
    firstName: string;
    lastName: string;
    gdprConsent: boolean;
    marketingConsent: boolean;
  };
  company: CompanyRegistrationData;
}

interface ValidationErrors {
  user?: {
    email?: string;
    password?: string;
    confirmPassword?: string;
    firstName?: string;
    lastName?: string;
    gdprConsent?: string;
  };
  company?: CompanyValidationErrors;
}

export function RegistrationForm({ onSuccess }: RegistrationFormProps) {
  const router = useRouter();
  const { register, isLoading, error, clearError } = useAuth();

  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<RegistrationData>({
    user: {
      email: '',
      password: '',
      confirmPassword: '',
      firstName: '',
      lastName: '',
      gdprConsent: false,
      marketingConsent: false,
    },
    company: {
      name: '',
      industry: {
        sector: 'technology',
        subSector: '',
        regulatoryClassification: 'moderately-regulated',
        specificRegulations: [],
      },
      businessModel: 'b2b-saas',
      size: 'small',
      description: '',
      website: '',
      headquarters: {
        country: '',
        city: '',
      },
    },
  });

  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});

  // Handle user data changes
  const handleUserChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;

    setFormData(prev => ({
      ...prev,
      user: {
        ...prev.user,
        [name]: type === 'checkbox' ? checked : value,
      },
    }));

    // Clear validation errors when user starts typing
    if (validationErrors.user?.[name as keyof typeof validationErrors.user]) {
      setValidationErrors(prev => ({
        ...prev,
        user: {
          ...prev.user,
          [name]: undefined,
        },
      }));
    }

    // Clear auth errors
    if (error) {
      clearError();
    }
  };

  // Handle company data changes
  const handleCompanyChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;

    if (name.includes('.')) {
      // Handle nested object updates
      const [parent, child] = name.split('.');
      setFormData(prev => ({
        ...prev,
        company: {
          ...prev.company,
          [parent]: {
            ...(prev.company[parent as keyof CompanyRegistrationData] as Record<string, any>),
            [child]: value,
          },
        },
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        company: {
          ...prev.company,
          [name]: value,
        },
      }));
    }

    // Clear validation errors
    if (validationErrors.company?.[name as keyof CompanyValidationErrors]) {
      setValidationErrors(prev => ({
        ...prev,
        company: {
          ...prev.company,
          [name]: undefined,
        },
      }));
    }
  };

  // Handle regulation selection
  const handleRegulationChange = (regulation: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      company: {
        ...prev.company,
        industry: {
          ...prev.company.industry,
          specificRegulations: checked
            ? [...prev.company.industry.specificRegulations, regulation]
            : prev.company.industry.specificRegulations.filter(r => r !== regulation),
        },
      },
    }));
  };

  // Validate user data
  const validateUserData = (): boolean => {
    const errors: ValidationErrors['user'] = {};

    if (!formData.user.email) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.user.email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (!formData.user.password) {
      errors.password = 'Password is required';
    } else if (formData.user.password.length < 12) {
      errors.password = 'Password must be at least 12 characters';
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{}|;:,.<>?])/.test(formData.user.password)) {
      errors.password = 'Password must include uppercase, lowercase, number, and special character';
    }

    if (!formData.user.confirmPassword) {
      errors.confirmPassword = 'Please confirm your password';
    } else if (formData.user.password !== formData.user.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    if (!formData.user.firstName.trim()) {
      errors.firstName = 'First name is required';
    }

    if (!formData.user.lastName.trim()) {
      errors.lastName = 'Last name is required';
    }

    if (!formData.user.gdprConsent) {
      errors.gdprConsent = 'You must agree to the privacy policy';
    }

    setValidationErrors(prev => ({ ...prev, user: errors }));
    return Object.keys(errors).length === 0;
  };

  // Validate company data
  const validateCompanyData = (): boolean => {
    const errors: CompanyValidationErrors = {};

    if (!formData.company.name.trim()) {
      errors.name = 'Company name is required';
    }

    if (!formData.company.industry.subSector) {
      errors['industry.subSector'] = 'Please select a sub-sector';
    }

    if (!formData.company.description.trim()) {
      errors.description = 'Company description is required';
    } else if (formData.company.description.length < 20) {
      errors.description = 'Description must be at least 20 characters';
    }

    if (formData.company.website && !/^https?:\/\/.+/.test(formData.company.website)) {
      errors.website = 'Please enter a valid website URL';
    }

    if (!formData.company.headquarters.country) {
      errors['headquarters.country'] = 'Please select a country';
    }

    if (!formData.company.headquarters.city.trim()) {
      errors['headquarters.city'] = 'City is required';
    }

    setValidationErrors(prev => ({ ...prev, company: errors }));
    return Object.keys(errors).length === 0;
  };

  // Handle step navigation
  const handleNextStep = () => {
    if (currentStep === 1 && validateUserData()) {
      setCurrentStep(2);
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateUserData() || !validateCompanyData()) {
      return;
    }

    try {
      const registrationData: RegisterRequest = {
        user: {
          email: formData.user.email.toLowerCase().trim(),
          password: formData.user.password,
          confirmPassword: formData.user.confirmPassword,
          firstName: formData.user.firstName.trim(),
          lastName: formData.user.lastName.trim(),
          gdprConsent: formData.user.gdprConsent,
          marketingConsent: formData.user.marketingConsent,
        },
        company: formData.company,
      };

      await register(registrationData);

      if (onSuccess) {
        onSuccess();
      } else {
        router.push('/verify-email');
      }
    } catch (error) {
      // Error is handled by the auth context
      console.error('Registration failed:', error);
    }
  };

  const currentSector = INDUSTRY_SECTORS[formData.company.industry.sector];

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="bg-white shadow-lg rounded-lg p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-secondary-900 mb-2">
            Create Your ScaleMap Account
          </h1>
          <p className="text-secondary-600">
            Join thousands of businesses transforming their operations
          </p>
        </div>

        {/* Progress indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-center space-x-4">
            <div className={`flex items-center ${currentStep >= 1 ? 'text-primary-600' : 'text-secondary-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                currentStep >= 1 ? 'border-primary-600 bg-primary-600 text-white' : 'border-secondary-300'
              }`}>
                1
              </div>
              <span className="ml-2 font-medium">User Details</span>
            </div>
            <div className={`w-16 h-0.5 ${currentStep > 1 ? 'bg-primary-600' : 'bg-secondary-300'}`} />
            <div className={`flex items-center ${currentStep >= 2 ? 'text-primary-600' : 'text-secondary-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                currentStep >= 2 ? 'border-primary-600 bg-primary-600 text-white' : 'border-secondary-300'
              }`}>
                2
              </div>
              <span className="ml-2 font-medium">Company Info</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-danger-50 border border-danger-200 rounded-md">
            <p className="text-danger-700 text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Step 1: User Details */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="firstName" className="block text-sm font-medium text-secondary-700 mb-2">
                    First Name *
                  </label>
                  <input
                    id="firstName"
                    name="firstName"
                    type="text"
                    required
                    value={formData.user.firstName}
                    onChange={handleUserChange}
                    className={`input w-full ${
                      validationErrors.user?.firstName ? 'border-danger-300 focus-visible:ring-danger-600' : ''
                    }`}
                    placeholder="Enter your first name"
                  />
                  {validationErrors.user?.firstName && (
                    <p className="mt-1 text-sm text-danger-600">{validationErrors.user.firstName}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="lastName" className="block text-sm font-medium text-secondary-700 mb-2">
                    Last Name *
                  </label>
                  <input
                    id="lastName"
                    name="lastName"
                    type="text"
                    required
                    value={formData.user.lastName}
                    onChange={handleUserChange}
                    className={`input w-full ${
                      validationErrors.user?.lastName ? 'border-danger-300 focus-visible:ring-danger-600' : ''
                    }`}
                    placeholder="Enter your last name"
                  />
                  {validationErrors.user?.lastName && (
                    <p className="mt-1 text-sm text-danger-600">{validationErrors.user.lastName}</p>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-secondary-700 mb-2">
                  Email Address *
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={formData.user.email}
                  onChange={handleUserChange}
                  className={`input w-full ${
                    validationErrors.user?.email ? 'border-danger-300 focus-visible:ring-danger-600' : ''
                  }`}
                  placeholder="Enter your email address"
                />
                {validationErrors.user?.email && (
                  <p className="mt-1 text-sm text-danger-600">{validationErrors.user.email}</p>
                )}
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-secondary-700 mb-2">
                  Password *
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={formData.user.password}
                  onChange={handleUserChange}
                  className={`input w-full ${
                    validationErrors.user?.password ? 'border-danger-300 focus-visible:ring-danger-600' : ''
                  }`}
                  placeholder="Create a strong password"
                />
                {validationErrors.user?.password && (
                  <p className="mt-1 text-sm text-danger-600">{validationErrors.user.password}</p>
                )}
                <p className="mt-1 text-xs text-secondary-500">
                  Must be 12+ characters with uppercase, lowercase, number, and special character
                </p>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-secondary-700 mb-2">
                  Confirm Password *
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={formData.user.confirmPassword}
                  onChange={handleUserChange}
                  className={`input w-full ${
                    validationErrors.user?.confirmPassword ? 'border-danger-300 focus-visible:ring-danger-600' : ''
                  }`}
                  placeholder="Confirm your password"
                />
                {validationErrors.user?.confirmPassword && (
                  <p className="mt-1 text-sm text-danger-600">{validationErrors.user.confirmPassword}</p>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-start">
                  <input
                    id="gdprConsent"
                    name="gdprConsent"
                    type="checkbox"
                    checked={formData.user.gdprConsent}
                    onChange={handleUserChange}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-secondary-300 rounded mt-1"
                  />
                  <label htmlFor="gdprConsent" className="ml-3 text-sm text-secondary-700">
                    I agree to the{' '}
                    <a href="/privacy" className="text-primary-600 hover:text-primary-500">
                      Privacy Policy
                    </a>{' '}
                    and{' '}
                    <a href="/terms" className="text-primary-600 hover:text-primary-500">
                      Terms of Service
                    </a>{' '}
                    *
                  </label>
                </div>
                {validationErrors.user?.gdprConsent && (
                  <p className="text-sm text-danger-600">{validationErrors.user.gdprConsent}</p>
                )}

                <div className="flex items-start">
                  <input
                    id="marketingConsent"
                    name="marketingConsent"
                    type="checkbox"
                    checked={formData.user.marketingConsent}
                    onChange={handleUserChange}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-secondary-300 rounded mt-1"
                  />
                  <label htmlFor="marketingConsent" className="ml-3 text-sm text-secondary-700">
                    I&apos;d like to receive product updates and marketing communications
                  </label>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="btn-primary px-8 py-3"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Company Information */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-secondary-700 mb-2">
                  Company Name *
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  value={formData.company.name}
                  onChange={handleCompanyChange}
                  className={`input w-full ${
                    validationErrors.company?.name ? 'border-danger-300 focus-visible:ring-danger-600' : ''
                  }`}
                  placeholder="Enter your company name"
                />
                {validationErrors.company?.name && (
                  <p className="mt-1 text-sm text-danger-600">{validationErrors.company.name}</p>
                )}
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="industry.sector" className="block text-sm font-medium text-secondary-700 mb-2">
                    Industry Sector *
                  </label>
                  <select
                    id="industry.sector"
                    name="industry.sector"
                    required
                    value={formData.company.industry.sector}
                    onChange={handleCompanyChange}
                    className="input w-full"
                  >
                    {Object.entries(INDUSTRY_SECTORS).map(([key, sector]) => (
                      <option key={key} value={key}>
                        {sector.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="industry.subSector" className="block text-sm font-medium text-secondary-700 mb-2">
                    Sub-Sector *
                  </label>
                  <select
                    id="industry.subSector"
                    name="industry.subSector"
                    required
                    value={formData.company.industry.subSector}
                    onChange={handleCompanyChange}
                    className={`input w-full ${
                      validationErrors.company?.['industry.subSector'] ? 'border-danger-300' : ''
                    }`}
                  >
                    <option value="">Select a sub-sector</option>
                    {currentSector.subSectors.map(subSector => (
                      <option key={subSector} value={subSector}>
                        {subSector.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </option>
                    ))}
                  </select>
                  {validationErrors.company?.['industry.subSector'] && (
                    <p className="mt-1 text-sm text-danger-600">{validationErrors.company['industry.subSector']}</p>
                  )}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="businessModel" className="block text-sm font-medium text-secondary-700 mb-2">
                    Business Model *
                  </label>
                  <select
                    id="businessModel"
                    name="businessModel"
                    required
                    value={formData.company.businessModel}
                    onChange={handleCompanyChange}
                    className="input w-full"
                  >
                    {Object.entries(BUSINESS_MODELS).map(([key, model]) => (
                      <option key={key} value={key}>
                        {model.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="size" className="block text-sm font-medium text-secondary-700 mb-2">
                    Company Size *
                  </label>
                  <select
                    id="size"
                    name="size"
                    required
                    value={formData.company.size}
                    onChange={handleCompanyChange}
                    className="input w-full"
                  >
                    {Object.entries(COMPANY_SIZES).map(([key, size]) => (
                      <option key={key} value={key}>
                        {size.label} ({size.employeeRange})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="industry.regulatoryClassification" className="block text-sm font-medium text-secondary-700 mb-2">
                  Regulatory Classification *
                </label>
                <select
                  id="industry.regulatoryClassification"
                  name="industry.regulatoryClassification"
                  required
                  value={formData.company.industry.regulatoryClassification}
                  onChange={handleCompanyChange}
                  className="input w-full"
                >
                  {Object.entries(REGULATORY_CLASSIFICATIONS).map(([key, classification]) => (
                    <option key={key} value={key}>
                      {classification.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-secondary-500">
                  {REGULATORY_CLASSIFICATIONS[formData.company.industry.regulatoryClassification].description}
                </p>
              </div>

              <div>
                <div className="block text-sm font-medium text-secondary-700 mb-2">
                  Specific Regulations (if applicable)
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {currentSector.commonRegulations.map(regulation => (
                    <label key={regulation} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.company.industry.specificRegulations.includes(regulation)}
                        onChange={(e) => handleRegulationChange(regulation, e.target.checked)}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-secondary-300 rounded"
                      />
                      <span className="ml-2 text-sm text-secondary-700">{regulation}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-secondary-700 mb-2">
                  Company Description *
                </label>
                <textarea
                  id="description"
                  name="description"
                  required
                  rows={4}
                  value={formData.company.description}
                  onChange={handleCompanyChange}
                  className={`input w-full ${
                    validationErrors.company?.description ? 'border-danger-300' : ''
                  }`}
                  placeholder="Describe your company, products, and services (minimum 20 characters)"
                />
                {validationErrors.company?.description && (
                  <p className="mt-1 text-sm text-danger-600">{validationErrors.company.description}</p>
                )}
              </div>

              <div>
                <label htmlFor="website" className="block text-sm font-medium text-secondary-700 mb-2">
                  Website (optional)
                </label>
                <input
                  id="website"
                  name="website"
                  type="url"
                  value={formData.company.website}
                  onChange={handleCompanyChange}
                  className={`input w-full ${
                    validationErrors.company?.website ? 'border-danger-300' : ''
                  }`}
                  placeholder="https://www.yourcompany.com"
                />
                {validationErrors.company?.website && (
                  <p className="mt-1 text-sm text-danger-600">{validationErrors.company.website}</p>
                )}
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="headquarters.country" className="block text-sm font-medium text-secondary-700 mb-2">
                    Headquarters Country *
                  </label>
                  <select
                    id="headquarters.country"
                    name="headquarters.country"
                    required
                    value={formData.company.headquarters.country}
                    onChange={handleCompanyChange}
                    className={`input w-full ${
                      validationErrors.company?.['headquarters.country'] ? 'border-danger-300' : ''
                    }`}
                  >
                    <option value="">Select a country</option>
                    {COUNTRIES.map(country => (
                      <option key={country} value={country}>
                        {country}
                      </option>
                    ))}
                  </select>
                  {validationErrors.company?.['headquarters.country'] && (
                    <p className="mt-1 text-sm text-danger-600">{validationErrors.company['headquarters.country']}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="headquarters.city" className="block text-sm font-medium text-secondary-700 mb-2">
                    Headquarters City *
                  </label>
                  <input
                    id="headquarters.city"
                    name="headquarters.city"
                    type="text"
                    required
                    value={formData.company.headquarters.city}
                    onChange={handleCompanyChange}
                    className={`input w-full ${
                      validationErrors.company?.['headquarters.city'] ? 'border-danger-300' : ''
                    }`}
                    placeholder="Enter city name"
                  />
                  {validationErrors.company?.['headquarters.city'] && (
                    <p className="mt-1 text-sm text-danger-600">{validationErrors.company['headquarters.city']}</p>
                  )}
                </div>
              </div>

              <div className="flex justify-between">
                <button
                  type="button"
                  onClick={handlePrevStep}
                  className="btn-secondary px-8 py-3"
                >
                  Back
                </button>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="btn-primary px-8 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Creating Account...
                    </span>
                  ) : (
                    'Create Account'
                  )}
                </button>
              </div>
            </div>
          )}
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-secondary-600">
            Already have an account?{' '}
            <a
              href="/login"
              className="font-medium text-primary-600 hover:text-primary-500"
            >
              Sign in here
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}