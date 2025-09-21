import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import React from 'react';


import { AssessmentProgress } from '@/components/assessment/questionnaire/AssessmentProgress';
import { DomainName } from '@/types';

describe('Final Progress Dashboard Test', () => {
  test('should fix the 13 out of 9 questions display issue', () => {
    const mockProgressWithIssue = {
      overall: 50,
      domains: {
        'strategic-alignment': {
          completed: 13, // The bug: more completed than total
          total: 9,     // Static total that doesn't account for follow-ups
          status: 'in-progress' as const,
          requiredQuestions: 6,
          optionalQuestions: 3
        },
        'financial-management': {
          completed: 5,
          total: 9,
          status: 'in-progress' as const,
          requiredQuestions: 7,
          optionalQuestions: 2
        }
      } as Record<DomainName, any>,
      completeness: 75,
      estimatedTimeRemaining: '15-30 minutes'
    };

    const mockAssessment = {
      id: 'test',
      title: 'Test Assessment',
      domainResponses: {
        'strategic-alignment': {
          domain: 'strategic-alignment' as DomainName,
          questions: {
            // 13 questions including follow-ups
            '1.1': { questionId: '1.1', value: 4, answeredAt: new Date().toISOString() },
            '1.2': { questionId: '1.2', value: 2, answeredAt: new Date().toISOString() },
            '1.3': { questionId: '1.3', value: 5, answeredAt: new Date().toISOString() },
            '1.4': { questionId: '1.4', value: 1, answeredAt: new Date().toISOString() },
            '1.5': { questionId: '1.5', value: 3, answeredAt: new Date().toISOString() },
            '1.6': { questionId: '1.6', value: 4, answeredAt: new Date().toISOString() },
            '1.7': { questionId: '1.7', value: 2, answeredAt: new Date().toISOString() },
            // Follow-up questions that caused the issue
            '1.1-followup': { questionId: '1.1-followup', value: 'Follow-up 1', answeredAt: new Date().toISOString() },
            '1.3-followup': { questionId: '1.3-followup', value: 'Follow-up 2', answeredAt: new Date().toISOString() },
            '1.6-followup': { questionId: '1.6-followup', value: 'Follow-up 3', answeredAt: new Date().toISOString() },
            '1.1-followup-2': { questionId: '1.1-followup-2', value: 'Follow-up 4', answeredAt: new Date().toISOString() },
            '1.3-followup-2': { questionId: '1.3-followup-2', value: 'Follow-up 5', answeredAt: new Date().toISOString() },
            '1.6-followup-2': { questionId: '1.6-followup-2', value: 'Follow-up 6', answeredAt: new Date().toISOString() }
          },
          completeness: 100,
          lastUpdated: new Date().toISOString()
        },
        'financial-management': {
          domain: 'financial-management' as DomainName,
          questions: {
            '2.1': { questionId: '2.1', value: 3, answeredAt: new Date().toISOString() },
            '2.2': { questionId: '2.2', value: 4, answeredAt: new Date().toISOString() },
            '2.3': { questionId: '2.3', value: 2, answeredAt: new Date().toISOString() },
            '2.4': { questionId: '2.4', value: 5, answeredAt: new Date().toISOString() },
            '2.5': { questionId: '2.5', value: 3, answeredAt: new Date().toISOString() }
          },
          completeness: 50,
          lastUpdated: new Date().toISOString()
        }
      }
    };

    render(
      <AssessmentProgress
        progress={mockProgressWithIssue}
        assessment={mockAssessment}
        onDomainClick={jest.fn()}
        currentDomain='strategic-alignment'
      />
    );

    // The old bug would show "13 / 9"
    // Our fix should show "13 / 13" or higher (never completed > total)

    // Strategic alignment domain should show corrected ratio
    const strategicAlignmentText = screen.getByText('Strategic Alignment & Vision');
    expect(strategicAlignmentText).toBeInTheDocument();

    // Look for the progress numbers - should not see "13 / 9" anywhere
    expect(screen.queryByText('13 / 9')).not.toBeInTheDocument();

    // Should see corrected ratio like "13 / 13" or similar
    const progressTexts = screen.getAllByText(/\d+ \/ \d+/);

    for (const progressText of progressTexts) {
      const match = progressText.textContent?.match(/(\d+) \/ (\d+)/);
      if (match) {
        const completed = parseInt(match[1]);
        const total = parseInt(match[2]);

        // The critical fix: completed should never exceed total
        expect(completed).toBeLessThanOrEqual(total);

        console.log(`Found progress: ${completed} / ${total} ✅`);
      }
    }

    // Financial management should show 5 / 9 (no follow-ups, so stays normal)
    expect(screen.getByText('5 / 9')).toBeInTheDocument();
  });

  test('should handle domains without responses correctly', () => {
    const mockProgressEmptyDomains = {
      overall: 0,
      domains: {
        'supply-chain': {
          completed: 0,
          total: 6,
          status: 'not-started' as const,
          requiredQuestions: 4,
          optionalQuestions: 2
        }
      } as Record<DomainName, any>,
      completeness: 0,
      estimatedTimeRemaining: '45-60 minutes'
    };

    const mockAssessmentEmpty = {
      id: 'empty-test',
      title: 'Empty Test Assessment',
      domainResponses: {}
    };

    render(
      <AssessmentProgress
        progress={mockProgressEmptyDomains}
        assessment={mockAssessmentEmpty}
        onDomainClick={jest.fn()}
      />
    );

    // Should show 0 / 6 correctly
    expect(screen.getByText('0 / 6')).toBeInTheDocument();
  });
});