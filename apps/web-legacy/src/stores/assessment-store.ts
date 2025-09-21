import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

import { assessmentService } from '@/lib/api/assessments';
import { QuestionService } from '@/services/question-service';
import {
  Assessment,
  DomainName,
  DomainResponse,
  QuestionResponse,
  AssessmentProgress,
  DomainProgress,
  IndustryClassification,
  AssessmentValidation,
} from '@/types';

interface AssessmentState {
  currentAssessment: Assessment | null;
  workflowState: {
    currentStep: 'company-context' | 'questionnaire' | 'review' | 'complete';
    currentDomain?: DomainName;
    currentQuestion?: string;
    canProceed: boolean;
    validationErrors: Record<string, string>;
    isLoading: boolean;
    autoSaveEnabled: boolean;
    lastAutoSave?: string;
  };
  progressState: AssessmentProgress;
  industryClassification?: IndustryClassification;
  validation?: AssessmentValidation;
}

interface AssessmentActions {
  setCurrentAssessment: (assessment: Assessment) => void;
  updateDomainResponses: (domain: DomainName, responses: Partial<DomainResponse>) => void;
  updateQuestionResponse: (
    domain: DomainName,
    questionId: string,
    response: QuestionResponse
  ) => void;
  setCurrentDomain: (domain: DomainName) => void;
  setCurrentQuestion: (questionId: string) => void;
  updateProgress: (progress: Partial<AssessmentProgress>) => void;
  updateDomainProgress: (domain: DomainName, progress: Partial<DomainProgress>) => void;
  setIndustryClassification: (classification: IndustryClassification) => void;
  setValidation: (validation: AssessmentValidation) => void;
  setLoading: (loading: boolean) => void;
  setValidationErrors: (errors: Record<string, string>) => void;
  clearValidationError: (field: string) => void;
  autoSave: () => Promise<void>;
  enableAutoSave: () => void;
  disableAutoSave: () => void;
  calculateCompleteness: () => number;
  canProgressToDomain: (domain: DomainName) => boolean;
  getEstimatedTimeRemaining: () => string;
  resetAssessment: () => void;
  createAssessment: (title: string, description?: string, companyId?: string) => Promise<void>;
  loadAssessment: (assessmentId: string) => Promise<void>;
  saveAssessment: () => Promise<void>;
  submitAssessment: () => Promise<void>;
}

type AssessmentStore = AssessmentState & AssessmentActions;

// Helper function to check for pending conditional questions
function checkForPendingConditionals(
  domain: DomainName,
  domainResponse?: DomainResponse,
  _industryClassification?: IndustryClassification
): boolean {
  if (!domainResponse) return false;

  const questionService = QuestionService.getInstance();

  // Check each answered question for potential follow-ups
  for (const [questionId, response] of Object.entries(domainResponse.questions)) {
    const followUps = questionService.getFollowUpQuestions(questionId, response, domain);

    // If any follow-up is not answered, there are pending conditionals
    for (const followUp of followUps) {
      if (!domainResponse.questions[followUp.id]) {
        return true;
      }
    }
  }

  return false;
}

// Helper function to calculate dynamic domain total (base questions + triggered follow-ups)
function calculateDynamicDomainTotal(
  domain: DomainName,
  domainResponse?: DomainResponse,
  industryClassification?: IndustryClassification,
  staticTotal: number = 0
): number {
  // Start with the static total as baseline
  const total = staticTotal;

  if (!domainResponse || Object.keys(domainResponse.questions).length === 0) {
    return total;
  }

  const questionService = QuestionService.getInstance();
  let triggeredFollowUpCount = 0;

  // Count follow-ups that have been triggered by answered questions
  for (const [questionId, response] of Object.entries(domainResponse.questions)) {
    // Skip if this is already a follow-up question
    if (questionId.includes('-followup')) continue;

    const followUps = questionService.getFollowUpQuestions(questionId, response, domain);
    triggeredFollowUpCount += followUps.length;
  }

  // The total should be: static base questions + actually triggered follow-ups
  return staticTotal + triggeredFollowUpCount;
}

const initialProgressState: AssessmentProgress = {
  overall: 0,
  domains: {
    'strategic-alignment': {
      completed: 0,
      total: 7,
      status: 'not-started',
      requiredQuestions: 6,
      optionalQuestions: 1,
    },
    'financial-management': {
      completed: 0,
      total: 9,
      status: 'not-started',
      requiredQuestions: 7,
      optionalQuestions: 2,
    },
    'revenue-engine': {
      completed: 0,
      total: 9,
      status: 'not-started',
      requiredQuestions: 7,
      optionalQuestions: 2,
    },
    'operational-excellence': {
      completed: 0,
      total: 8,
      status: 'not-started',
      requiredQuestions: 7,
      optionalQuestions: 1,
    },
    'people-organization': {
      completed: 0,
      total: 9,
      status: 'not-started',
      requiredQuestions: 7,
      optionalQuestions: 2,
    },
    'technology-data': {
      completed: 0,
      total: 8,
      status: 'not-started',
      requiredQuestions: 7,
      optionalQuestions: 1,
    },
    'customer-experience': {
      completed: 0,
      total: 8,
      status: 'not-started',
      requiredQuestions: 7,
      optionalQuestions: 1,
    },
    'supply-chain': {
      completed: 0,
      total: 6,
      status: 'not-started',
      requiredQuestions: 4,
      optionalQuestions: 2,
    },
    'risk-compliance': {
      completed: 0,
      total: 8,
      status: 'not-started',
      requiredQuestions: 6,
      optionalQuestions: 2,
    },
    partnerships: {
      completed: 0,
      total: 7,
      status: 'not-started',
      requiredQuestions: 6,
      optionalQuestions: 1,
    },
    'customer-success': {
      completed: 0,
      total: 8,
      status: 'not-started',
      requiredQuestions: 6,
      optionalQuestions: 2,
    },
    'change-management': {
      completed: 0,
      total: 8,
      status: 'not-started',
      requiredQuestions: 7,
      optionalQuestions: 1,
    },
  },
  completeness: 0,
  estimatedTimeRemaining: '45-60 minutes',
};

export const useAssessmentStore = create<AssessmentStore>()(
  devtools(
    persist(
      (set, get) => ({
        currentAssessment: null,
        workflowState: {
          currentStep: 'company-context',
          canProceed: false,
          validationErrors: {},
          isLoading: false,
          autoSaveEnabled: true,
        },
        progressState: initialProgressState,

        setCurrentAssessment: (assessment) => {
          set(
            (state) => {
              // Initialize domains with dynamic totals
              const updatedDomains = { ...state.progressState.domains };

              Object.keys(updatedDomains).forEach((domainKey) => {
                const domainName = domainKey as DomainName;
                const domainResponse = assessment.domainResponses?.[domainName];

                // Always use our baseline progress, not assessment progress which might be stale
                const baseProgress = updatedDomains[domainName];

                // Calculate completed count
                const completedCount = domainResponse
                  ? Object.keys(domainResponse.questions).length
                  : 0;

                // Calculate dynamic total
                const dynamicTotal = calculateDynamicDomainTotal(
                  domainName,
                  domainResponse,
                  assessment.industryClassification,
                  baseProgress.total
                );

                // Update with dynamic total and accurate completed count
                updatedDomains[domainName] = {
                  ...baseProgress,
                  total: dynamicTotal,
                  completed: completedCount,
                  // Update status based on new counts
                  status:
                    completedCount === 0
                      ? ('not-started' as const)
                      : completedCount >= baseProgress.requiredQuestions
                        ? ('completed' as const)
                        : ('in-progress' as const),
                };
              });

              return {
                currentAssessment: assessment,
                progressState: {
                  ...state.progressState,
                  // Don't override our calculated domains with potentially stale assessment progress
                  domains: updatedDomains,
                  // Recalculate overall progress based on our updated domains
                  overall:
                    Object.values(updatedDomains).reduce((sum, dp) => sum + dp.completed, 0) > 0
                      ? Math.round(
                          (Object.values(updatedDomains).reduce(
                            (sum, dp) => sum + dp.completed,
                            0
                          ) /
                            Object.values(updatedDomains).reduce((sum, dp) => sum + dp.total, 0)) *
                            100
                        )
                      : 0,
                },
                industryClassification: assessment.industryClassification,
                workflowState: {
                  ...state.workflowState,
                  currentStep:
                    Object.values(updatedDomains).reduce((sum, dp) => sum + dp.completed, 0) === 0
                      ? 'company-context'
                      : 'questionnaire',
                },
              };
            },
            false,
            'setCurrentAssessment'
          );
        },

        updateDomainResponses: (domain, responses) => {
          set(
            (state) => {
              if (!state.currentAssessment) return state;

              const updatedDomainResponses = {
                ...state.currentAssessment.domainResponses,
                [domain]: {
                  ...state.currentAssessment.domainResponses[domain],
                  ...responses,
                  lastUpdated: new Date().toISOString(),
                },
              };

              return {
                currentAssessment: {
                  ...state.currentAssessment,
                  domainResponses: updatedDomainResponses,
                  updatedAt: new Date().toISOString(),
                },
              };
            },
            false,
            'updateDomainResponses'
          );

          // Trigger auto-save if enabled
          if (get().workflowState.autoSaveEnabled) {
            setTimeout(() => get().autoSave(), 1000);
          }
        },

        updateQuestionResponse: (domain, questionId, response) => {
          set(
            (state) => {
              if (!state.currentAssessment) return state;

              const domainResponse = state.currentAssessment.domainResponses[domain] || {
                domain,
                questions: {},
                completeness: 0,
                lastUpdated: new Date().toISOString(),
              };

              const updatedQuestions = {
                ...domainResponse.questions,
                [questionId]: response,
              };

              const completedCount = Object.keys(updatedQuestions).length;
              const totalQuestions = state.progressState.domains[domain]?.total || 0;
              const completeness = totalQuestions > 0 ? (completedCount / totalQuestions) * 100 : 0;

              const updatedDomainResponse = {
                ...domainResponse,
                questions: updatedQuestions,
                completeness,
                lastUpdated: new Date().toISOString(),
              };

              return {
                currentAssessment: {
                  ...state.currentAssessment,
                  domainResponses: {
                    ...state.currentAssessment.domainResponses,
                    [domain]: updatedDomainResponse,
                  },
                  updatedAt: new Date().toISOString(),
                },
              };
            },
            false,
            'updateQuestionResponse'
          );

          // Update domain progress and overall progress
          get().updateDomainProgress(domain, {});

          // Trigger auto-save if enabled
          if (get().workflowState.autoSaveEnabled) {
            setTimeout(() => get().autoSave(), 1000);
          }
        },

        setCurrentDomain: (domain) => {
          set(
            (state) => ({
              workflowState: {
                ...state.workflowState,
                currentDomain: domain,
                currentStep: 'questionnaire',
              },
            }),
            false,
            'setCurrentDomain'
          );
        },

        setCurrentQuestion: (questionId) => {
          set(
            (state) => ({
              workflowState: {
                ...state.workflowState,
                currentQuestion: questionId,
              },
            }),
            false,
            'setCurrentQuestion'
          );
        },

        updateProgress: (progress) => {
          set(
            (state) => ({
              progressState: {
                ...state.progressState,
                ...progress,
              },
            }),
            false,
            'updateProgress'
          );
        },

        updateDomainProgress: (domain, progress) => {
          set(
            (state) => {
              const currentDomainProgress = state.progressState.domains[domain];
              if (!currentDomainProgress) return state;

              const domainResponse = state.currentAssessment?.domainResponses[domain];
              const completedCount = domainResponse
                ? Object.keys(domainResponse.questions).length
                : 0;

              // Calculate dynamic total including follow-ups and conditional questions
              const dynamicTotal = calculateDynamicDomainTotal(
                domain,
                domainResponse,
                state.industryClassification,
                currentDomainProgress.total
              );

              // Check if there are pending conditional questions that need answering
              const hasPendingConditionals = state.currentAssessment
                ? checkForPendingConditionals(
                    domain,
                    state.currentAssessment.domainResponses[domain],
                    state.industryClassification
                  )
                : false;

              // Domain is only complete if required questions are answered AND no pending conditionals
              const hasMinimumRequired = completedCount >= currentDomainProgress.requiredQuestions;
              const isComplete = hasMinimumRequired && !hasPendingConditionals;

              const updatedDomainProgress = {
                ...currentDomainProgress,
                ...progress,
                completed: completedCount,
                total: dynamicTotal, // Use dynamic total instead of static
                status:
                  completedCount === 0
                    ? ('not-started' as const)
                    : isComplete
                      ? ('completed' as const)
                      : ('in-progress' as const),
              };

              const updatedDomains = {
                ...state.progressState.domains,
                [domain]: updatedDomainProgress,
              };

              // Calculate overall progress using updated dynamic totals
              const totalCompleted = Object.values(updatedDomains).reduce(
                (sum, dp) => sum + dp.completed,
                0
              );
              const totalQuestions = Object.values(updatedDomains).reduce(
                (sum, dp) => sum + dp.total,
                0
              );
              const overallProgress =
                totalQuestions > 0 ? Math.round((totalCompleted / totalQuestions) * 100) : 0;

              return {
                progressState: {
                  ...state.progressState,
                  domains: updatedDomains,
                  overall: overallProgress,
                  completeness: get().calculateCompleteness(),
                  estimatedTimeRemaining: get().getEstimatedTimeRemaining(),
                },
              };
            },
            false,
            'updateDomainProgress'
          );
        },

        setIndustryClassification: (classification) => {
          set(
            (state) => ({
              industryClassification: classification,
              currentAssessment: state.currentAssessment
                ? {
                    ...state.currentAssessment,
                    industryClassification: classification,
                    updatedAt: new Date().toISOString(),
                  }
                : null,
            }),
            false,
            'setIndustryClassification'
          );
        },

        setValidation: (validation) => {
          set({ validation }, false, 'setValidation');
        },

        setLoading: (loading) => {
          set(
            (state) => ({
              workflowState: {
                ...state.workflowState,
                isLoading: loading,
              },
            }),
            false,
            'setLoading'
          );
        },

        setValidationErrors: (errors) => {
          set(
            (state) => ({
              workflowState: {
                ...state.workflowState,
                validationErrors: errors,
                canProceed: Object.keys(errors).length === 0,
              },
            }),
            false,
            'setValidationErrors'
          );
        },

        clearValidationError: (field) => {
          set(
            (state) => {
              const { [field]: removed, ...remainingErrors } = state.workflowState.validationErrors;
              void removed; // Mark as used
              return {
                workflowState: {
                  ...state.workflowState,
                  validationErrors: remainingErrors,
                  canProceed: Object.keys(remainingErrors).length === 0,
                },
              };
            },
            false,
            'clearValidationError'
          );
        },

        autoSave: async () => {
          const state = get();
          if (!state.currentAssessment || !state.workflowState.autoSaveEnabled) return;

          try {
            await get().saveAssessment();
            set(
              (state) => ({
                workflowState: {
                  ...state.workflowState,
                  lastAutoSave: new Date().toISOString(),
                },
              }),
              false,
              'autoSave'
            );
          } catch (error) {
            console.error('Auto-save failed:', error);
          }
        },

        enableAutoSave: () => {
          set(
            (state) => ({
              workflowState: {
                ...state.workflowState,
                autoSaveEnabled: true,
              },
            }),
            false,
            'enableAutoSave'
          );
        },

        disableAutoSave: () => {
          set(
            (state) => ({
              workflowState: {
                ...state.workflowState,
                autoSaveEnabled: false,
              },
            }),
            false,
            'disableAutoSave'
          );
        },

        calculateCompleteness: () => {
          const state = get();
          if (!state.currentAssessment || !state.progressState.domains) return 0;

          const totalRequiredQuestions = Object.values(state.progressState.domains).reduce(
            (sum, domain) => sum + domain.requiredQuestions,
            0
          );

          const completedRequiredQuestions = Object.entries(
            state.currentAssessment.domainResponses
          ).reduce((sum, [domainName, domainResponse]) => {
            const domainProgress = state.progressState.domains[domainName as DomainName];
            const completedInDomain = Math.min(
              Object.keys(domainResponse.questions).length,
              domainProgress.requiredQuestions
            );
            return sum + completedInDomain;
          }, 0);

          return totalRequiredQuestions > 0
            ? Math.round((completedRequiredQuestions / totalRequiredQuestions) * 100)
            : 0;
        },

        canProgressToDomain: (domain) => {
          const state = get();

          // Can always access strategic alignment first
          if (domain === 'strategic-alignment') return true;

          // For other domains, check if previous domains meet minimum requirements
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
            'change-management',
          ];

          const currentIndex = domainOrder.indexOf(domain);
          if (currentIndex <= 0) return true;

          // Check if at least 50% of previous domains are adequately completed
          const previousDomains = domainOrder.slice(0, currentIndex);
          const adequatelyCompleted = previousDomains.filter((d) => {
            const progress = state.progressState.domains[d];
            return progress.completed >= Math.ceil(progress.requiredQuestions * 0.7);
          });

          return adequatelyCompleted.length >= Math.ceil(previousDomains.length * 0.5);
        },

        getEstimatedTimeRemaining: () => {
          const state = get();
          if (!state.progressState.domains) return '45-60 minutes';

          const totalQuestions = Object.values(state.progressState.domains).reduce(
            (sum, domain) => sum + domain.total,
            0
          );
          const completedQuestions = Object.values(state.progressState.domains).reduce(
            (sum, domain) => sum + domain.completed,
            0
          );

          const remainingQuestions = totalQuestions - completedQuestions;
          const estimatedMinutes = Math.ceil(remainingQuestions * 0.75); // ~45 seconds per question

          if (estimatedMinutes <= 5) return '< 5 minutes';
          if (estimatedMinutes <= 15) return '5-15 minutes';
          if (estimatedMinutes <= 30) return '15-30 minutes';
          if (estimatedMinutes <= 45) return '30-45 minutes';
          return '45-60 minutes';
        },

        resetAssessment: () => {
          set(
            {
              currentAssessment: null,
              workflowState: {
                currentStep: 'company-context',
                canProceed: false,
                validationErrors: {},
                isLoading: false,
                autoSaveEnabled: true,
              },
              progressState: initialProgressState,
              industryClassification: undefined,
              validation: undefined,
            },
            false,
            'resetAssessment'
          );
        },

        createAssessment: async (title, description, companyId) => {
          set(
            (state) => ({
              workflowState: {
                ...state.workflowState,
                isLoading: true,
              },
            }),
            false,
            'createAssessment'
          );

          try {
            const response = await assessmentService.createAssessment({
              title,
              description: description || '',
              companyName: 'Default Company', // TODO: Get from auth context
              contactEmail: 'user@example.com', // TODO: Get from auth context
              companyId: companyId || 'default-company-id', // Should be from auth store
            });

            if (!response.success) {
              throw new Error(response.error?.message || 'Failed to create assessment');
            }

            get().setCurrentAssessment(response.data);
          } catch (error) {
            console.error('Failed to create assessment:', error);
            throw error;
          } finally {
            set(
              (state) => ({
                workflowState: {
                  ...state.workflowState,
                  isLoading: false,
                },
              }),
              false,
              'createAssessment'
            );
          }
        },

        loadAssessment: async (assessmentId) => {
          set(
            (state) => ({
              workflowState: {
                ...state.workflowState,
                isLoading: true,
              },
            }),
            false,
            'loadAssessment'
          );

          try {
            const response = await assessmentService.getAssessment(assessmentId);

            if (!response.success) {
              throw new Error(response.error?.message || 'Failed to load assessment');
            }

            get().setCurrentAssessment(response.data);
          } catch (error) {
            console.error('Failed to load assessment:', error);
            throw error;
          } finally {
            set(
              (state) => ({
                workflowState: {
                  ...state.workflowState,
                  isLoading: false,
                },
              }),
              false,
              'loadAssessment'
            );
          }
        },

        saveAssessment: async () => {
          const state = get();
          if (!state.currentAssessment) return;

          const updateData = {
            domainResponses: state.currentAssessment.domainResponses,
            progress: state.progressState,
            industryClassification: state.industryClassification,
            assessmentContext: state.currentAssessment.assessmentContext,
          };

          const response = await assessmentService.updateAssessment(
            state.currentAssessment.id,
            updateData
          );

          if (!response.success) {
            throw new Error(response.error?.message || 'Failed to save assessment');
          }
        },

        submitAssessment: async () => {
          const state = get();
          if (!state.currentAssessment) return;

          set(
            (state) => ({
              workflowState: {
                ...state.workflowState,
                isLoading: true,
              },
            }),
            false,
            'submitAssessment'
          );

          try {
            // First save the current assessment state
            await get().saveAssessment();

            // Then start the assessment processing
            const response = await assessmentService.startAssessment(state.currentAssessment.id);

            if (!response.success) {
              throw new Error(response.error?.message || 'Failed to submit assessment');
            }

            get().setCurrentAssessment(response.data);
          } catch (error) {
            console.error('Failed to submit assessment:', error);
            throw error;
          } finally {
            set(
              (state) => ({
                workflowState: {
                  ...state.workflowState,
                  isLoading: false,
                },
              }),
              false,
              'submitAssessment'
            );
          }
        },
      }),
      {
        name: 'assessment-store',
        partialize: (state) => ({
          currentAssessment: state.currentAssessment,
          progressState: state.progressState,
          industryClassification: state.industryClassification,
          workflowState: {
            currentStep: state.workflowState.currentStep,
            currentDomain: state.workflowState.currentDomain,
            currentQuestion: state.workflowState.currentQuestion,
            autoSaveEnabled: state.workflowState.autoSaveEnabled,
          },
        }),
      }
    ),
    { name: 'assessment-store' }
  )
);
