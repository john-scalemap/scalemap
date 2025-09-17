import { DomainName } from '@/types';

import { QuestionService } from '@/services/question-service';
import { useAssessmentStore } from '@/stores/assessment-store';

describe('Debug Progress Fixes', () => {
  const questionService = QuestionService.getInstance();
  let store: ReturnType<typeof useAssessmentStore>;

  beforeEach(() => {
    store = useAssessmentStore.getState();
    store.resetAssessment();
  });

  test('debug the completed count issue', () => {
    const mockAssessment = {
      id: 'debug-test',
      title: 'Debug Test',
      domainResponses: {
        'strategic-alignment': {
          domain: 'strategic-alignment' as DomainName,
          questions: {
            '1.1': { questionId: '1.1', value: 4, answeredAt: new Date().toISOString() },
            '1.2': { questionId: '1.2', value: 2, answeredAt: new Date().toISOString() },
            '1.3': { questionId: '1.3', value: 5, answeredAt: new Date().toISOString() },
          },
          completeness: 50,
          lastUpdated: new Date().toISOString()
        }
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ownerId: 'test-user'
    };

    // Debug what happens during setCurrentAssessment
    console.log('Before setCurrentAssessment:');
    console.log('Strategic alignment domain:', store.progressState.domains['strategic-alignment']);

    store.setCurrentAssessment(mockAssessment);

    console.log('After setCurrentAssessment:');
    const domainProgress = store.progressState.domains['strategic-alignment'];
    console.log('Strategic alignment domain:', domainProgress);
    console.log('Assessment domainResponses:', mockAssessment.domainResponses);

    // Check what the completed count shows
    const questionCount = Object.keys(mockAssessment.domainResponses['strategic-alignment'].questions).length;
    console.log('Actual questions in mockAssessment:', questionCount);
    console.log('Domain progress completed:', domainProgress.completed);
    console.log('Domain progress total:', domainProgress.total);

    // Simple assertions to see what's actually happening
    expect(questionCount).toBe(3); // This should pass
    expect(domainProgress.completed).toBe(questionCount); // This might be failing
  });

  test('debug follow-up calculation', () => {
    // Mock the question service
    const mockGetFollowUpQuestions = jest.spyOn(questionService, 'getFollowUpQuestions')
      .mockImplementation((questionId) => {
        console.log('getFollowUpQuestions called with:', questionId);
        if (questionId === '1.1') {
          return [
            { id: '1.1-followup', type: 'text', question: 'Follow-up 1.1', required: false }
          ];
        }
        return [];
      });

    const mockAssessmentWithFollowUp = {
      id: 'debug-followup-test',
      title: 'Debug Follow-up Test',
      domainResponses: {
        'strategic-alignment': {
          domain: 'strategic-alignment' as DomainName,
          questions: {
            '1.1': { questionId: '1.1', value: 4, answeredAt: new Date().toISOString() },
            '1.1-followup': { questionId: '1.1-followup', value: 'Follow-up answer', answeredAt: new Date().toISOString() },
          },
          completeness: 50,
          lastUpdated: new Date().toISOString()
        }
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ownerId: 'test-user'
    };

    store.setCurrentAssessment(mockAssessmentWithFollowUp);

    const domainProgress = store.progressState.domains['strategic-alignment'];

    console.log('With follow-up - Domain progress:', domainProgress);
    console.log('Mock was called times:', mockGetFollowUpQuestions.mock.calls.length);
    console.log('Mock call arguments:', mockGetFollowUpQuestions.mock.calls);

    // What we expect: 2 completed (base + follow-up), at least 8 total (7 base + 1 follow-up)
    expect(domainProgress.completed).toBe(2);
    expect(domainProgress.total).toBeGreaterThanOrEqual(8);
  });
});