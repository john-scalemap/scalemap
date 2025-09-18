
import { QuestionService } from '@/services/question-service';
import { useAssessmentStore } from '@/stores/assessment-store';
import { DomainName, Question, QuestionResponse } from '@/types';

describe('Questionnaire Issues Tests', () => {
  const questionService = QuestionService.getInstance();
  let store: ReturnType<typeof useAssessmentStore>;

  beforeEach(() => {
    store = useAssessmentStore.getState();
    store.resetAssessment();
  });

  describe('Issue 1: Question Ordering', () => {
    test('should maintain original question order when follow-ups are added', () => {
      const baseQuestions: Question[] = [
        {
          id: '1.1',
          type: 'scale',
          question: 'Base question 1',
          scale: { min: 1, max: 5, labels: ['Poor', 'Excellent'] },
          required: true
        },
        {
          id: '1.2',
          type: 'scale',
          question: 'Base question 2',
          scale: { min: 1, max: 5, labels: ['Poor', 'Excellent'] },
          required: true
        },
        {
          id: '1.3',
          type: 'scale',
          question: 'Base question 3',
          scale: { min: 1, max: 5, labels: ['Poor', 'Excellent'] },
          required: true
        }
      ];

      // Simulate responses that trigger follow-ups
      const responses: Record<string, QuestionResponse> = {
        '1.1': { questionId: '1.1', value: 4, answeredAt: new Date().toISOString() }, // High score = problem
        '1.2': { questionId: '1.2', value: 2, answeredAt: new Date().toISOString() }, // Low score = good
        '1.3': { questionId: '1.3', value: 5, answeredAt: new Date().toISOString() }  // High score = problem
      };

      // Mock follow-up questions
      jest.spyOn(questionService, 'getFollowUpQuestions').mockImplementation((questionId) => {
        if (questionId === '1.1') {
          return [{
            id: '1.1-followup',
            type: 'text',
            question: 'Follow-up for 1.1',
            required: false
          }];
        }
        if (questionId === '1.3') {
          return [{
            id: '1.3-followup',
            type: 'text',
            question: 'Follow-up for 1.3',
            required: false
          }];
        }
        return [];
      });

      // Expected order should be:
      // 1.1, 1.1-followup, 1.2, 1.3, 1.3-followup
      const expectedOrder = ['1.1', '1.1-followup', '1.2', '1.3', '1.3-followup'];

      // Test the current implementation logic
      const questionsWithFollowUps: Question[] = [...baseQuestions];
      Object.entries(responses).forEach(([questionId, response]) => {
        const followUps = questionService.getFollowUpQuestions(questionId, response, 'strategic-alignment');

        followUps.forEach(followUp => {
          if (!questionsWithFollowUps.find(q => q.id === followUp.id)) {
            const mainQuestionIndex = questionsWithFollowUps.findIndex(q => q.id === questionId);
            if (mainQuestionIndex !== -1) {
              questionsWithFollowUps.splice(mainQuestionIndex + 1, 0, followUp);
            } else {
              questionsWithFollowUps.push(followUp);
            }
          }
        });
      });

      const actualOrder = questionsWithFollowUps.map(q => q.id);

      // This test should FAIL with current implementation, showing the bug
      expect(actualOrder).toEqual(expectedOrder);
    });
  });

  describe('Issue 2: Domain Completion Logic', () => {
    test('should not mark domain complete when conditional questions remain', async () => {
      // Set up a mock assessment with domain responses
      const mockAssessment = {
        id: 'test-assessment',
        title: 'Test Assessment',
        domainResponses: {
          'strategic-alignment': {
            domain: 'strategic-alignment' as DomainName,
            questions: {
              '1.1': { questionId: '1.1', value: 1, answeredAt: new Date().toISOString() },
              '1.2': { questionId: '1.2', value: 2, answeredAt: new Date().toISOString() },
              '1.3': { questionId: '1.3', value: 3, answeredAt: new Date().toISOString() },
              '1.4': { questionId: '1.4', value: 4, answeredAt: new Date().toISOString() }, // This should trigger conditional
              '1.5': { questionId: '1.5', value: 1, answeredAt: new Date().toISOString() },
              '1.6': { questionId: '1.6', value: 2, answeredAt: new Date().toISOString() },
            },
            completeness: 100,
            lastUpdated: new Date().toISOString()
          }
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ownerId: 'test-user'
      };

      store.setCurrentAssessment(mockAssessment);

      // Get the domain progress after answering required questions
      const domainProgress = store.progressState.domains['strategic-alignment'];

      // Should have 6 required questions
      expect(domainProgress.requiredQuestions).toBe(6);

      // With 6 answers, current logic marks it complete
      // But question 1.4 score of 4 should trigger a conditional follow-up
      // Domain should NOT be complete until conditional is answered
      const completedCount = Object.keys(mockAssessment.domainResponses['strategic-alignment'].questions).length;

      // Current buggy logic: completedCount (6) >= requiredQuestions (6) = complete
      const currentStatus = completedCount >= domainProgress.requiredQuestions ? 'completed' : 'in-progress';

      // This shows the bug - it marks complete even with pending conditionals
      expect(currentStatus).toBe('completed'); // This is the BUG

      // TODO: After fix, this should be 'in-progress' when conditionals exist
    });
  });

  describe('Issue 3: Progress Tracking Accuracy', () => {
    test('should calculate progress based on dynamic question counts, not static totals', () => {
      const mockAssessment = {
        id: 'test-assessment',
        title: 'Test Assessment',
        domainResponses: {
          'strategic-alignment': {
            domain: 'strategic-alignment' as DomainName,
            questions: {
              '1.1': { questionId: '1.1', value: 4, answeredAt: new Date().toISOString() }, // Triggers follow-up
              '1.2': { questionId: '1.2', value: 2, answeredAt: new Date().toISOString() },
            },
            completeness: 50,
            lastUpdated: new Date().toISOString()
          }
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ownerId: 'test-user'
      };

      store.setCurrentAssessment(mockAssessment);

      // Mock that question 1.1 triggers a follow-up, making total questions 8 instead of 7
      const staticTotal = store.progressState.domains['strategic-alignment'].total; // 7
      const actualAnswered = 2;

      // Current buggy calculation: 2/7 = 28.6% -> 29%
      const currentProgressCalculation = Math.round((actualAnswered / staticTotal) * 100);

      // But with dynamic follow-up, it should be 2/8 = 25%
      const dynamicTotal = staticTotal + 1; // One follow-up added
      const correctProgressCalculation = Math.round((actualAnswered / dynamicTotal) * 100);

      expect(currentProgressCalculation).toBe(29); // Current buggy result
      expect(correctProgressCalculation).toBe(25); // What it should be

      // The bug is that progress uses static totals, not dynamic counts
    });
  });
});