'use client';

import { useMemo } from 'react';

import { passwordValidator } from '../../lib/utils/password-validation';

interface PasswordStrengthMeterProps {
  password: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  showRequirements?: boolean;
  className?: string;
}

export default function PasswordStrengthMeter({
  password,
  email,
  firstName,
  lastName,
  showRequirements = true,
  className = ''
}: PasswordStrengthMeterProps) {
  const validation = useMemo(() => {
    if (!password) {
      return {
        isValid: false,
        errors: [],
        strength: {
          score: 0,
          feedback: [],
          isValid: false
        }
      };
    }
    return passwordValidator.validatePassword(password, email, firstName, lastName);
  }, [password, email, firstName, lastName]);

  const strengthInfo = passwordValidator.getStrengthDescription(validation.strength.score);
  const progressWidth = passwordValidator.getStrengthBarWidth(validation.strength.score);

  if (!password) {
    return null;
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Password Strength Bar */}
      <div>
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm text-gray-600">Password Strength</span>
          <span className={`text-sm font-medium ${strengthInfo.color}`}>
            {strengthInfo.label}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${
              validation.strength.score === 0
                ? 'bg-red-500'
                : validation.strength.score === 1
                ? 'bg-red-500'
                : validation.strength.score === 2
                ? 'bg-orange-500'
                : validation.strength.score === 3
                ? 'bg-yellow-500'
                : 'bg-green-500'
            }`}
            style={{ width: `${progressWidth}%` }}
          />
        </div>
      </div>

      {/* Validation Errors */}
      {validation.errors.length > 0 && (
        <div className="space-y-1">
          {validation.errors.map((error, index) => (
            <div key={index} className="flex items-center space-x-2 text-sm text-red-600">
              <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                  clipRule="evenodd"
                />
              </svg>
              <span>{error.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Password Requirements Checklist */}
      {showRequirements && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">Password Requirements:</h4>
          <div className="space-y-1">
            {/* Length requirement */}
            <RequirementItem
              met={password.length >= 12}
              text="At least 12 characters long"
            />

            {/* Uppercase requirement */}
            <RequirementItem
              met={/[A-Z]/.test(password)}
              text="At least one uppercase letter"
            />

            {/* Lowercase requirement */}
            <RequirementItem
              met={/[a-z]/.test(password)}
              text="At least one lowercase letter"
            />

            {/* Number requirement */}
            <RequirementItem
              met={/[0-9]/.test(password)}
              text="At least one number"
            />

            {/* Special character requirement */}
            <RequirementItem
              met={/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)}
              text="At least one special character"
            />

            {/* No common patterns */}
            <RequirementItem
              met={!validation.errors.some(e =>
                e.code === 'PASSWORD_COMMON_PATTERN' ||
                e.code === 'PASSWORD_COMMON_WORD'
              )}
              text="No common patterns or dictionary words"
            />

            {/* No personal information */}
            <RequirementItem
              met={!validation.errors.some(e =>
                e.code === 'PASSWORD_CONTAINS_EMAIL' ||
                e.code === 'PASSWORD_CONTAINS_NAME'
              )}
              text="No personal information (name, email)"
            />
          </div>
        </div>
      )}

      {/* Additional Feedback */}
      {validation.strength.feedback.length > 0 && (
        <div className="space-y-1">
          <h4 className="text-sm font-medium text-gray-700">Suggestions:</h4>
          {validation.strength.feedback.map((feedback, index) => (
            <div key={index} className="flex items-center space-x-2 text-sm text-blue-600">
              <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z"
                  clipRule="evenodd"
                />
              </svg>
              <span>{feedback}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface RequirementItemProps {
  met: boolean;
  text: string;
}

function RequirementItem({ met, text }: RequirementItemProps) {
  return (
    <div className={`flex items-center space-x-2 text-sm ${met ? 'text-green-600' : 'text-gray-500'}`}>
      {met ? (
        <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.236 4.53L8.343 10.75a.75.75 0 00-1.086 1.036l2.1 2.2a.75.75 0 001.15-.043l3.857-5.4z"
            clipRule="evenodd"
          />
        </svg>
      ) : (
        <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
            clipRule="evenodd"
          />
        </svg>
      )}
      <span>{text}</span>
    </div>
  );
}