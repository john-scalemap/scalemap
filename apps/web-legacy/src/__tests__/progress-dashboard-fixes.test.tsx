
import { QuestionService } from '@/services/question-service';
import { useAssessmentStore } from '@/stores/assessment-store';
import { DomainName, Question, QuestionResponse } from '@/types';

describe('Progress Dashboard Fixes Tests', () => {
  const questionService = QuestionService.getInstance();
  let store: ReturnType<typeof useAssessmentStore>;

  beforeEach(() => {
    store = useAssessmentStore.getState();
    store.resetAssessment();
  });

  describe('Issue: Question Count Mismatch (13 completed out of 9 questions)', () => {
    test('should show correct total questions when follow-ups are added', () => {
      // Mock assessment with answers that trigger follow-ups
      const mockAssessment = {
        id: 'test-assessment',
        title: 'Test Assessment',
        domainResponses: {
          'strategic-alignment': {
            domain: 'strategic-alignment' as DomainName,
            questions: {
              // Base questions
              '1.1': { questionId: '1.1', value: 4, answeredAt: new Date().toISOString() }, // Triggers follow-up
              '1.2': { questionId: '1.2', value: 2, answeredAt: new Date().toISOString() },
              '1.3': { questionId: '1.3', value: 5, answeredAt: new Date().toISOString() }, // Triggers follow-up
              '1.4': { questionId: '1.4', value: 1, answeredAt: new Date().toISOString() },
              '1.5': { questionId: '1.5', value: 4, answeredAt: new Date().toISOString() }, // Triggers follow-up
              '1.6': { questionId: '1.6', value: 2, answeredAt: new Date().toISOString() },

              // Follow-up questions (these caused the "13 out of 9" problem)
              '1.1-followup': { questionId: '1.1-followup', value: 'Process issues', answeredAt: new Date().toISOString() },
              '1.3-followup': { questionId: '1.3-followup', value: 'Resource constraints', answeredAt: new Date().toISOString() },
              '1.5-followup': { questionId: '1.5-followup', value: 'Communication gaps', answeredAt: new Date().toISOString() },

              // Additional follow-ups
              '1.1-followup-2': { questionId: '1.1-followup-2', value: 'Documentation', answeredAt: new Date().toISOString() },
              '1.3-followup-2': { questionId: '1.3-followup-2', value: 'Training needed', answeredAt: new Date().toISOString() },
              '1.5-followup-2': { questionId: '1.5-followup-2', value: 'Tool limitations', answeredAt: new Date().toISOString() },

              // Even more to hit 13 answered questions
              '1.1-followup-3': { questionId: '1.1-followup-3', value: 'Extra detail', answeredAt: new Date().toISOString() },
            },
            completeness: 100,
            lastUpdated: new Date().toISOString()
          }
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ownerId: 'test-user'
      };

      // Mock the question service to return follow-ups
      jest.spyOn(questionService, 'getFollowUpQuestions').mockImplementation((questionId) => {
        if (questionId === '1.1') {
          return [
            { id: '1.1-followup', type: 'text', question: 'Follow-up 1.1', required: false },
            { id: '1.1-followup-2', type: 'multiple-select', question: 'Follow-up 1.1-2', required: false },
            { id: '1.1-followup-3', type: 'text', question: 'Follow-up 1.1-3', required: false }
          ];
        }
        if (questionId === '1.3') {
          return [
            { id: '1.3-followup', type: 'text', question: 'Follow-up 1.3', required: false },
            { id: '1.3-followup-2', type: 'text', question: 'Follow-up 1.3-2', required: false }
          ];
        }
        if (questionId === '1.5') {
          return [
            { id: '1.5-followup', type: 'text', question: 'Follow-up 1.5', required: false },
            { id: '1.5-followup-2', type: 'text', question: 'Follow-up 1.5-2', required: false }
          ];
        }
        return [];
      });

      // Set the assessment (this should trigger dynamic total calculation)
      store.setCurrentAssessment(mockAssessment);

      const domainProgress = store.progressState.domains['strategic-alignment'];

      // We have 13 answered questions
      const completedCount = Object.keys(mockAssessment.domainResponses['strategic-alignment'].questions).length;
      expect(completedCount).toBe(13);

      // The dynamic total should now be AT LEAST 13 (base questions + all triggered follow-ups)
      // It might be higher if it estimates potential future follow-ups
      expect(domainProgress.total).toBeGreaterThanOrEqual(13);

      // Most importantly: completed should NEVER exceed total
      expect(domainProgress.completed).toBeLessThanOrEqual(domainProgress.total);

      // The old bug would show "13 / 9" - this should no longer happen
      expect(domainProgress.completed).toBe(13);
      expect(domainProgress.total).toBeGreaterThanOrEqual(13); // Should be 13 or more, not 9

      console.log(`Fixed progress: ${domainProgress.completed} / ${domainProgress.total}`);
    });

    test('should handle domains with no follow-ups correctly', () => {
      const mockAssessment = {
        id: 'test-assessment-2',
        title: 'Test Assessment 2',
        domainResponses: {
          'financial-management': {
            domain: 'financial-management' as DomainName,
            questions: {
              '2.1': { questionId: '2.1', value: 2, answeredAt: new Date().toISOString() },
              '2.2': { questionId: '2.2', value: 3, answeredAt: new Date().toISOString() },
              '2.3': { questionId: '2.3', value: 2, answeredAt: new Date().toISOString() },
            },
            completeness: 50,
            lastUpdated: new Date().toISOString()
          }
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ownerId: 'test-user'
      };

      // Mock no follow-ups for these questions
      jest.spyOn(questionService, 'getFollowUpQuestions').mockReturnValue([]);

      store.setCurrentAssessment(mockAssessment);

      const domainProgress = store.progressState.domains['financial-management'];

      // Should show normal ratio
      expect(domainProgress.completed).toBe(3);
      expect(domainProgress.total).toBeGreaterThanOrEqual(3); // At least the static total
      expect(domainProgress.completed).toBeLessThanOrEqual(domainProgress.total);
    });

    test('should update totals dynamically as questions are answered', () => {
      const mockAssessment = {
        id: 'test-assessment-3',
        title: 'Test Assessment 3',
        domainResponses: {
          'revenue-engine': {
            domain: 'revenue-engine' as DomainName,
            questions: {
              '3.1': { questionId: '3.1', value: 2, answeredAt: new Date().toISOString() },
            },
            completeness: 10,
            lastUpdated: new Date().toISOString()
          }
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ownerId: 'test-user'
      };

      store.setCurrentAssessment(mockAssessment);

      const initialProgress = store.progressState.domains['revenue-engine'];
      expect(initialProgress.completed).toBe(1);
      const initialTotal = initialProgress.total;

      // Now answer a question that triggers follow-ups
      jest.spyOn(questionService, 'getFollowUpQuestions').mockImplementation((questionId) => {
        if (questionId === '3.2') {
          return [
            { id: '3.2-followup', type: 'text', question: 'Follow-up 3.2', required: false }
          ];
        }
        return [];
      });

      // Answer a new question that triggers a follow-up
      store.updateQuestionResponse('revenue-engine', '3.2', {
        questionId: '3.2',
        value: 4, // This should trigger follow-up
        answeredAt: new Date().toISOString()
      });

      const updatedProgress = store.progressState.domains['revenue-engine'];

      // Should have more questions now
      expect(updatedProgress.completed).toBe(2);
      expect(updatedProgress.total).toBeGreaterThan(initialTotal); // Total should increase

      // Answer the follow-up
      store.updateQuestionResponse('revenue-engine', '3.2-followup', {
        questionId: '3.2-followup',
        value: 'Follow-up answer',
        answeredAt: new Date().toISOString()
      });

      const finalProgress = store.progressState.domains['revenue-engine'];
      expect(finalProgress.completed).toBe(3);
      expect(finalProgress.completed).toBeLessThanOrEqual(finalProgress.total);
    });
  });
});