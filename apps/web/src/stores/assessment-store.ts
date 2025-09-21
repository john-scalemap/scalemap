import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  Assessment,
  DomainResponse,
  QuestionResponse,
  DomainName,
  AssessmentProgress,
  AssessmentValidation
} from '../types/assessment';
import { AssessmentValidator } from '../lib/validation/assessment-validation';

interface AssessmentState {
  // Current assessment being worked on
  currentAssessment: Assessment | null;

  // Local draft responses (not yet saved to server)
  draftResponses: Record<string, DomainResponse>;

  // Current domain being worked on
  currentDomain: DomainName | null;
  currentDomainIndex: number;

  // Validation state
  validationErrors: Record<string, string>;
  validationWarnings: Record<string, string>;

  // UI state
  isLoading: boolean;
  isSaving: boolean;
  lastSaved: string | null;
  hasUnsavedChanges: boolean;

  // Progress tracking
  localProgress: AssessmentProgress | null;

  // Auto-save settings
  autoSaveEnabled: boolean;
  autoSaveInterval: number; // in milliseconds
}

interface AssessmentActions {
  // Assessment management
  setCurrentAssessment: (assessment: Assessment) => void;
  clearCurrentAssessment: () => void;
  updateAssessmentStatus: (status: Assessment['status']) => void;

  // Domain navigation
  setCurrentDomain: (domain: DomainName, index: number) => void;
  goToNextDomain: () => boolean;
  goToPreviousDomain: () => boolean;

  // Response management
  updateQuestionResponse: (domain: DomainName, questionId: string, value: QuestionResponse['value']) => void;
  updateDomainResponse: (domain: DomainName, response: Partial<DomainResponse>) => void;
  setDraftResponses: (responses: Record<string, DomainResponse>) => void;
  clearDraftResponses: () => void;

  // Validation
  validateCurrentDomain: () => boolean;
  validateAllDomains: () => AssessmentValidation;
  clearValidationErrors: (domain?: DomainName) => void;

  // Persistence
  saveResponses: () => Promise<void>;
  loadDraftFromStorage: (assessmentId: string) => void;
  saveDraftToStorage: () => void;
  clearDraftFromStorage: () => void;

  // UI state management
  setLoading: (loading: boolean) => void;
  setSaving: (saving: boolean) => void;
  markSaved: () => void;
  markUnsaved: () => void;

  // Progress calculation
  calculateProgress: () => AssessmentProgress;
  updateLocalProgress: () => void;

  // Auto-save
  enableAutoSave: () => void;
  disableAutoSave: () => void;
  triggerAutoSave: () => void;

  // Cleanup
  reset: () => void;
}

const initialState: AssessmentState = {
  currentAssessment: null,
  draftResponses: {},
  currentDomain: null,
  currentDomainIndex: 0,
  validationErrors: {},
  validationWarnings: {},
  isLoading: false,
  isSaving: false,
  lastSaved: null,
  hasUnsavedChanges: false,
  localProgress: null,
  autoSaveEnabled: true,
  autoSaveInterval: 30000, // 30 seconds
};

// Domain order for navigation
const domainOrder: DomainName[] = [
  'strategic-alignment',
  'financial-management',
  'revenue-engine',
  'operational-excellence',
  'people-organization',
  'technology-data',
  'customer-experience',
  'supply-chain',
  'risk-compliance',
  'partnerships',
  'customer-success',
  'change-management'
];

export const useAssessmentStore = create<AssessmentState & AssessmentActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      // Assessment management
      setCurrentAssessment: (assessment) => {
        set({
          currentAssessment: assessment,
          draftResponses: assessment.domainResponses || {},
          hasUnsavedChanges: false,
          validationErrors: {},
          validationWarnings: {}
        });
        get().updateLocalProgress();
      },

      clearCurrentAssessment: () => {
        set({
          currentAssessment: null,
          draftResponses: {},
          currentDomain: null,
          currentDomainIndex: 0,
          hasUnsavedChanges: false,
          validationErrors: {},
          validationWarnings: {},
          localProgress: null
        });
      },

      updateAssessmentStatus: (status) => {
        const { currentAssessment } = get();
        if (currentAssessment) {
          set({
            currentAssessment: {
              ...currentAssessment,
              status,
              updatedAt: new Date().toISOString()
            }
          });
        }
      },

      // Domain navigation
      setCurrentDomain: (domain, index) => {
        set({
          currentDomain: domain,
          currentDomainIndex: index
        });
      },

      goToNextDomain: () => {
        const { currentDomainIndex } = get();
        const nextIndex = currentDomainIndex + 1;
        if (nextIndex < domainOrder.length) {
          set({
            currentDomain: domainOrder[nextIndex],
            currentDomainIndex: nextIndex
          });
          return true;
        }
        return false;
      },

      goToPreviousDomain: () => {
        const { currentDomainIndex } = get();
        const prevIndex = currentDomainIndex - 1;
        if (prevIndex >= 0) {
          set({
            currentDomain: domainOrder[prevIndex],
            currentDomainIndex: prevIndex
          });
          return true;
        }
        return false;
      },

      // Response management
      updateQuestionResponse: (domain, questionId, value) => {
        const { draftResponses, currentAssessment } = get();
        const now = new Date().toISOString();

        const existingDomainResponse = draftResponses[domain] || {
          domain,
          questions: {},
          completeness: 0,
          lastUpdated: now
        };

        const updatedQuestions = {
          ...existingDomainResponse.questions,
          [questionId]: {
            questionId,
            value,
            timestamp: now
          } as QuestionResponse
        };

        const updatedDomainResponse: DomainResponse = {
          ...existingDomainResponse,
          questions: updatedQuestions,
          lastUpdated: now
        };

        // Calculate completeness for this domain
        if (currentAssessment) {
          const isRegulated = currentAssessment.industryClassification?.regulatoryClassification === 'heavily-regulated';
          const companyStage = currentAssessment.companyStage;

          // Note: We'd need to import getDomainQuestions here
          // For now, we'll calculate a simple completeness
          const totalQuestions = Object.keys(updatedQuestions).length;
          const completedQuestions = Object.values(updatedQuestions)
            .filter(q => q.value !== undefined && q.value !== '').length;

          updatedDomainResponse.completeness = totalQuestions > 0
            ? (completedQuestions / totalQuestions) * 100
            : 0;
        }

        set({
          draftResponses: {
            ...draftResponses,
            [domain]: updatedDomainResponse
          },
          hasUnsavedChanges: true
        });

        get().updateLocalProgress();

        // Clear validation errors for this question
        const { validationErrors } = get();
        const errorKey = `${domain}.${questionId}`;
        if (validationErrors[errorKey]) {
          const newErrors = { ...validationErrors };
          delete newErrors[errorKey];
          set({ validationErrors: newErrors });
        }

        // Trigger auto-save if enabled
        if (get().autoSaveEnabled) {
          setTimeout(() => get().triggerAutoSave(), 2000); // Debounce 2 seconds
        }
      },

      updateDomainResponse: (domain, responseUpdate) => {
        const { draftResponses } = get();
        const existingResponse = draftResponses[domain];

        if (existingResponse) {
          set({
            draftResponses: {
              ...draftResponses,
              [domain]: {
                ...existingResponse,
                ...responseUpdate,
                lastUpdated: new Date().toISOString()
              }
            },
            hasUnsavedChanges: true
          });
          get().updateLocalProgress();
        }
      },

      setDraftResponses: (responses) => {
        set({
          draftResponses: responses,
          hasUnsavedChanges: false
        });
        get().updateLocalProgress();
      },

      clearDraftResponses: () => {
        set({
          draftResponses: {},
          hasUnsavedChanges: false,
          validationErrors: {},
          validationWarnings: {}
        });
      },

      // Validation
      validateCurrentDomain: () => {
        const { currentDomain, draftResponses, currentAssessment } = get();
        if (!currentDomain || !currentAssessment) return false;

        const domainResponse = draftResponses[currentDomain];
        if (!domainResponse) return false;

        const { errors, warnings } = AssessmentValidator.validateDomain(
          currentDomain,
          domainResponse,
          currentAssessment
        );

        // Update validation state
        const newErrors: Record<string, string> = {};
        const newWarnings: Record<string, string> = {};

        errors.forEach(error => {
          newErrors[error.field] = error.message;
        });

        warnings.forEach(warning => {
          newWarnings[warning.field] = warning.message;
        });

        set({
          validationErrors: { ...get().validationErrors, ...newErrors },
          validationWarnings: { ...get().validationWarnings, ...newWarnings }
        });

        return errors.length === 0;
      },

      validateAllDomains: () => {
        const { currentAssessment, draftResponses } = get();
        if (!currentAssessment) {
          return {
            isValid: false,
            errors: [],
            warnings: [],
            completeness: 0,
            requiredFieldsMissing: [],
            crossDomainInconsistencies: []
          };
        }

        const assessmentWithDrafts = {
          ...currentAssessment,
          domainResponses: draftResponses
        };

        const validation = AssessmentValidator.validateAssessment(assessmentWithDrafts);

        // Update validation state
        const newErrors: Record<string, string> = {};
        const newWarnings: Record<string, string> = {};

        validation.errors.forEach(error => {
          newErrors[error.field] = error.message;
        });

        validation.warnings.forEach(warning => {
          newWarnings[warning.field] = warning.message;
        });

        set({
          validationErrors: newErrors,
          validationWarnings: newWarnings
        });

        return validation;
      },

      clearValidationErrors: (domain) => {
        if (domain) {
          const { validationErrors, validationWarnings } = get();
          const newErrors = { ...validationErrors };
          const newWarnings = { ...validationWarnings };

          Object.keys(newErrors).forEach(key => {
            if (key.startsWith(`${domain}.`)) {
              delete newErrors[key];
            }
          });

          Object.keys(newWarnings).forEach(key => {
            if (key.startsWith(`${domain}.`)) {
              delete newWarnings[key];
            }
          });

          set({
            validationErrors: newErrors,
            validationWarnings: newWarnings
          });
        } else {
          set({
            validationErrors: {},
            validationWarnings: {}
          });
        }
      },

      // Persistence
      saveResponses: async () => {
        const { currentAssessment, draftResponses } = get();
        if (!currentAssessment) return;

        set({ isSaving: true });

        try {
          const token = localStorage.getItem('accessToken');
          if (!token) throw new Error('Not authenticated');

          const response = await fetch(`/api/assessment/${currentAssessment.id}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              domainResponses: draftResponses
            })
          });

          if (!response.ok) {
            throw new Error('Failed to save responses');
          }

          const data = await response.json();

          set({
            currentAssessment: data.data.assessment,
            hasUnsavedChanges: false,
            lastSaved: new Date().toISOString()
          });

        } catch (error) {
          console.error('Error saving responses:', error);
          throw error;
        } finally {
          set({ isSaving: false });
        }
      },

      loadDraftFromStorage: (assessmentId) => {
        try {
          const stored = localStorage.getItem(`assessment-draft-${assessmentId}`);
          if (stored) {
            const draft = JSON.parse(stored);
            set({
              draftResponses: draft.responses || {},
              lastSaved: draft.lastSaved || null
            });
          }
        } catch (error) {
          console.error('Error loading draft from storage:', error);
        }
      },

      saveDraftToStorage: () => {
        const { currentAssessment, draftResponses, lastSaved } = get();
        if (!currentAssessment) return;

        try {
          const draft = {
            responses: draftResponses,
            lastSaved,
            timestamp: new Date().toISOString()
          };
          localStorage.setItem(
            `assessment-draft-${currentAssessment.id}`,
            JSON.stringify(draft)
          );
        } catch (error) {
          console.error('Error saving draft to storage:', error);
        }
      },

      clearDraftFromStorage: () => {
        const { currentAssessment } = get();
        if (!currentAssessment) return;

        try {
          localStorage.removeItem(`assessment-draft-${currentAssessment.id}`);
        } catch (error) {
          console.error('Error clearing draft from storage:', error);
        }
      },

      // UI state management
      setLoading: (loading) => set({ isLoading: loading }),
      setSaving: (saving) => set({ isSaving: saving }),

      markSaved: () => {
        set({
          hasUnsavedChanges: false,
          lastSaved: new Date().toISOString()
        });
      },

      markUnsaved: () => set({ hasUnsavedChanges: true }),

      // Progress calculation
      calculateProgress: () => {
        const { draftResponses } = get();
        const totalDomains = domainOrder.length;

        if (Object.keys(draftResponses).length === 0) {
          return {
            overall: 0,
            domains: {} as Record<DomainName, any>,
            completeness: 0,
            estimatedTimeRemaining: '60-90 minutes',
          };
        }

        const domainProgress: Record<DomainName, any> = {};
        let totalCompleteness = 0;

        domainOrder.forEach(domain => {
          const response = draftResponses[domain];
          const completeness = response?.completeness || 0;

          domainProgress[domain] = {
            completed: completeness,
            total: 100,
            status: completeness === 100 ? 'completed' :
                   completeness > 0 ? 'in-progress' : 'not-started',
            requiredQuestions: 5, // Simplified - would need actual count
            optionalQuestions: 2
          };

          totalCompleteness += completeness;
        });

        const overall = totalCompleteness / totalDomains;
        const remainingDomains = domainOrder.filter(d =>
          (draftResponses[d]?.completeness || 0) < 100
        ).length;

        const estimatedTimeRemaining = remainingDomains > 8 ? '60-90 minutes' :
                                     remainingDomains > 4 ? '30-60 minutes' :
                                     remainingDomains > 0 ? '15-30 minutes' : 'Complete';

        return {
          overall,
          domains: domainProgress,
          completeness: overall,
          estimatedTimeRemaining
        };
      },

      updateLocalProgress: () => {
        const progress = get().calculateProgress();
        set({ localProgress: progress });
      },

      // Auto-save
      enableAutoSave: () => set({ autoSaveEnabled: true }),
      disableAutoSave: () => set({ autoSaveEnabled: false }),

      triggerAutoSave: async () => {
        const { hasUnsavedChanges, isSaving, autoSaveEnabled } = get();
        if (hasUnsavedChanges && !isSaving && autoSaveEnabled) {
          try {
            await get().saveResponses();
            get().saveDraftToStorage();
          } catch (error) {
            console.error('Auto-save failed:', error);
          }
        }
      },

      // Cleanup
      reset: () => {
        set({ ...initialState });
      }
    }),
    {
      name: 'assessment-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Only persist certain fields
        currentAssessment: state.currentAssessment,
        draftResponses: state.draftResponses,
        currentDomain: state.currentDomain,
        currentDomainIndex: state.currentDomainIndex,
        lastSaved: state.lastSaved,
        autoSaveEnabled: state.autoSaveEnabled,
        autoSaveInterval: state.autoSaveInterval
      }),
    }
  )
);