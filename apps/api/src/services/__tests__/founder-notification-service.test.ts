import { Assessment, AssessmentGap } from '@scalemap/shared';

import { FounderNotificationService } from '../founder-notification-service';

// Mock dependencies
jest.mock('../ses-service');
jest.mock('../timeline-manager');

describe('FounderNotificationService', () => {
  let founderNotificationService: FounderNotificationService;
  let mockAssessment: Assessment;
  let mockCriticalGaps: AssessmentGap[];

  beforeEach(() => {
    jest.clearAllMocks();
    founderNotificationService = new FounderNotificationService();

    mockAssessment = {
      id: 'test-assessment-123',
      companyId: 'company-123',
      companyName: 'Test Company Inc.',
      contactEmail: 'founder@testcompany.com',
      title: 'Strategic Assessment',
      description: 'Test assessment description',
      status: 'analyzing',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deliverySchedule: {
        executive24h: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        detailed48h: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        implementation72h: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()
      },
      clarificationPolicy: {
        allowClarificationUntil: 'detailed48h',
        maxClarificationRequests: 3,
        maxTimelineExtension: 24 * 60 * 60 * 1000
      }
    } as Assessment;

    mockCriticalGaps = [
      {
        gapId: 'gap-1',
        assessmentId: 'test-assessment-123',
        domain: 'strategic-alignment',
        category: 'critical',
        description: 'Missing strategic vision clarity',
        detectedAt: new Date().toISOString(),
        suggestedQuestions: ['What is your 3-year strategic vision?'],
        followUpPrompts: ['Please describe your core strategic objectives'],
        resolved: false,
        impactOnTimeline: true,
        priority: 9,
        estimatedResolutionTime: 25
      },
      {
        gapId: 'gap-2',
        assessmentId: 'test-assessment-123',
        domain: 'financial-management',
        category: 'critical',
        description: 'Revenue model needs clarification',
        detectedAt: new Date().toISOString(),
        suggestedQuestions: ['How do you generate recurring revenue?'],
        followUpPrompts: ['Please explain your pricing strategy'],
        resolved: false,
        impactOnTimeline: true,
        priority: 8,
        estimatedResolutionTime: 20
      },
      {
        gapId: 'gap-3',
        assessmentId: 'test-assessment-123',
        domain: 'risk-compliance',
        category: 'critical',
        description: 'Compliance framework incomplete',
        detectedAt: new Date().toISOString(),
        suggestedQuestions: ['What regulatory requirements apply to your business?'],
        followUpPrompts: ['Please describe your compliance monitoring'],
        resolved: false,
        impactOnTimeline: true,
        priority: 9,
        estimatedResolutionTime: 30
      }
    ];
  });

  describe('evaluateCriticalGapsNotification', () => {
    it('should send notification when critical gaps meet threshold', async () => {
      const sendNotificationSpy = jest.spyOn(founderNotificationService as any, 'sendFounderNotification').mockResolvedValue(undefined);
      const suppressSpy = jest.spyOn(founderNotificationService as any, 'shouldSuppressDuplicate').mockResolvedValue(false);
      const escalationSpy = jest.spyOn(founderNotificationService as any, 'scheduleEscalation').mockResolvedValue(undefined);

      const result = await founderNotificationService.evaluateCriticalGapsNotification(
        mockAssessment,
        mockCriticalGaps
      );

      expect(result).toBe(true);
      expect(suppressSpy).toHaveBeenCalledWith('test-assessment-123', 'critical-gaps');
      expect(sendNotificationSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          assessmentId: 'test-assessment-123',
          companyName: 'Test Company Inc.',
          founderEmail: 'founder@testcompany.com',
          urgencyLevel: 'high'
        }),
        'critical-gaps'
      );
      expect(escalationSpy).toHaveBeenCalledWith(
        expect.any(Object),
        120 // 2 hours escalation delay
      );
    });

    it('should not send notification when gaps below threshold', async () => {
      const sendNotificationSpy = jest.spyOn(founderNotificationService as any, 'sendFounderNotification').mockResolvedValue(undefined);

      const result = await founderNotificationService.evaluateCriticalGapsNotification(
        mockAssessment,
        mockCriticalGaps.slice(0, 2) // Only 2 gaps, below threshold of 3
      );

      expect(result).toBe(false);
      expect(sendNotificationSpy).not.toHaveBeenCalled();
    });

    it('should suppress duplicate notifications', async () => {
      const sendNotificationSpy = jest.spyOn(founderNotificationService as any, 'sendFounderNotification').mockResolvedValue(undefined);
      const suppressSpy = jest.spyOn(founderNotificationService as any, 'shouldSuppressDuplicate').mockResolvedValue(true);

      const result = await founderNotificationService.evaluateCriticalGapsNotification(
        mockAssessment,
        mockCriticalGaps
      );

      expect(result).toBe(false);
      expect(suppressSpy).toHaveBeenCalledWith('test-assessment-123', 'critical-gaps');
      expect(sendNotificationSpy).not.toHaveBeenCalled();
    });

    it('should set urgency level to critical for many gaps', async () => {
      const sendNotificationSpy = jest.spyOn(founderNotificationService as any, 'sendFounderNotification').mockResolvedValue(undefined);
      const suppressSpy = jest.spyOn(founderNotificationService as any, 'shouldSuppressDuplicate').mockResolvedValue(false);

      // Create 6 critical gaps
      const manyGaps = Array.from({ length: 6 }, (_, i) => ({
        ...mockCriticalGaps[0],
        gapId: `gap-${i + 1}`,
        description: `Critical gap ${i + 1}`
      })) as AssessmentGap[];

      const result = await founderNotificationService.evaluateCriticalGapsNotification(
        mockAssessment,
        manyGaps
      );

      expect(result).toBe(true);
      expect(sendNotificationSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          urgencyLevel: 'critical'
        }),
        'critical-gaps'
      );
    });
  });

  describe('evaluateTimelineRiskNotification', () => {
    it('should send notification for at-risk timeline', async () => {
      const mockTimelineStatus = {
        status: 'at-risk' as const,
        extensions: [],
        remainingTime: {
          executive24h: 2 * 60 * 60 * 1000, // 2 hours remaining
          detailed48h: 26 * 60 * 60 * 1000,
          implementation72h: 50 * 60 * 60 * 1000
        },
        riskFactors: ['Approaching 24h deadline']
      };

      const timelineManagerSpy = jest.spyOn(founderNotificationService['timelineManager'], 'getTimelineStatus').mockResolvedValue(mockTimelineStatus);
      const sendNotificationSpy = jest.spyOn(founderNotificationService as any, 'sendFounderNotification').mockResolvedValue(undefined);
      const suppressSpy = jest.spyOn(founderNotificationService as any, 'shouldSuppressDuplicate').mockResolvedValue(false);

      const result = await founderNotificationService.evaluateTimelineRiskNotification(mockAssessment);

      expect(result).toBe(true);
      expect(timelineManagerSpy).toHaveBeenCalledWith('test-assessment-123');
      expect(sendNotificationSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          assessmentId: 'test-assessment-123',
          timelineStatus: mockTimelineStatus,
          urgencyLevel: 'high'
        }),
        'timeline-risk'
      );
    });

    it('should send critical notification for overdue timeline', async () => {
      const mockTimelineStatus = {
        status: 'overdue' as const,
        extensions: [],
        remainingTime: {
          executive24h: -2 * 60 * 60 * 1000, // 2 hours overdue
          detailed48h: 22 * 60 * 60 * 1000,
          implementation72h: 46 * 60 * 60 * 1000
        },
        riskFactors: ['Timeline deadline exceeded']
      };

      const timelineManagerSpy = jest.spyOn(founderNotificationService['timelineManager'], 'getTimelineStatus').mockResolvedValue(mockTimelineStatus);
      const sendNotificationSpy = jest.spyOn(founderNotificationService as any, 'sendFounderNotification').mockResolvedValue(undefined);
      const suppressSpy = jest.spyOn(founderNotificationService as any, 'shouldSuppressDuplicate').mockResolvedValue(false);

      const result = await founderNotificationService.evaluateTimelineRiskNotification(mockAssessment);

      expect(result).toBe(true);
      expect(sendNotificationSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          urgencyLevel: 'critical'
        }),
        'timeline-risk'
      );
    });

    it('should not send notification for on-track timeline', async () => {
      const mockTimelineStatus = {
        status: 'on-track' as const,
        extensions: [],
        remainingTime: {
          executive24h: 20 * 60 * 60 * 1000, // 20 hours remaining
          detailed48h: 44 * 60 * 60 * 1000,
          implementation72h: 68 * 60 * 60 * 1000
        },
        riskFactors: []
      };

      const timelineManagerSpy = jest.spyOn(founderNotificationService['timelineManager'], 'getTimelineStatus').mockResolvedValue(mockTimelineStatus);
      const sendNotificationSpy = jest.spyOn(founderNotificationService as any, 'sendFounderNotification').mockResolvedValue(undefined);

      const result = await founderNotificationService.evaluateTimelineRiskNotification(mockAssessment);

      expect(result).toBe(false);
      expect(sendNotificationSpy).not.toHaveBeenCalled();
    });
  });

  describe('notifyAssessmentStuck', () => {
    it('should send medium urgency notification for 24 hour delay', async () => {
      const sendNotificationSpy = jest.spyOn(founderNotificationService as any, 'sendFounderNotification').mockResolvedValue(undefined);

      await founderNotificationService.notifyAssessmentStuck(mockAssessment, 25);

      expect(sendNotificationSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          urgencyLevel: 'high'
        }),
        'assessment-stuck'
      );
    });

    it('should send critical urgency notification for 48+ hour delay', async () => {
      const sendNotificationSpy = jest.spyOn(founderNotificationService as any, 'sendFounderNotification').mockResolvedValue(undefined);

      await founderNotificationService.notifyAssessmentStuck(mockAssessment, 50);

      expect(sendNotificationSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          urgencyLevel: 'critical'
        }),
        'assessment-stuck'
      );
    });
  });

  describe('notifyClarificationNeeded', () => {
    it('should send medium urgency clarification notification', async () => {
      const sendNotificationSpy = jest.spyOn(founderNotificationService as any, 'sendFounderNotification').mockResolvedValue(undefined);

      await founderNotificationService.notifyClarificationNeeded(
        mockAssessment,
        'Need more details about revenue projections'
      );

      expect(sendNotificationSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          urgencyLevel: 'medium'
        }),
        'clarification-needed'
      );
    });
  });

  describe('notification content generation', () => {
    it('should generate appropriate subject for critical gaps', () => {
      const context = {
        assessmentId: 'test-assessment-123',
        companyName: 'Test Company Inc.',
        founderEmail: 'founder@testcompany.com',
        supportContactEmail: 'support@scalemap.ai',
        assessment: mockAssessment,
        gaps: mockCriticalGaps,
        urgencyLevel: 'high' as const
      };

      const subject = (founderNotificationService as any).generateSubject(context, 'critical-gaps');

      expect(subject).toBe('[HIGH PRIORITY] Critical Information Gaps in Your Test Company Inc. Assessment');
    });

    it('should generate urgent prefix for critical urgency', () => {
      const context = {
        assessmentId: 'test-assessment-123',
        companyName: 'Test Company Inc.',
        founderEmail: 'founder@testcompany.com',
        supportContactEmail: 'support@scalemap.ai',
        assessment: mockAssessment,
        urgencyLevel: 'critical' as const
      };

      const subject = (founderNotificationService as any).generateSubject(context, 'timeline-risk');

      expect(subject).toBe('[URGENT] Assessment Timeline at Risk - Test Company Inc.');
    });

    it('should generate critical gaps content with gap details', () => {
      const context = {
        assessmentId: 'test-assessment-123',
        companyName: 'Test Company Inc.',
        founderEmail: 'founder@testcompany.com',
        supportContactEmail: 'support@scalemap.ai',
        assessment: mockAssessment,
        gaps: mockCriticalGaps,
        urgencyLevel: 'high' as const
      };

      const baseTemplate = {
        htmlBody: '{{CONTENT}}',
        textBody: '{{CONTENT}}'
      };

      const content = (founderNotificationService as any).generateCriticalGapsContent(context, baseTemplate);

      expect(content.textBody).toContain('3 critical information gap(s)');
      expect(content.textBody).toContain('Missing strategic vision clarity');
      expect(content.textBody).toContain('Revenue model needs clarification');
      expect(content.textBody).toContain('Compliance framework incomplete');
      expect(content.textBody).toContain('timeline is currently paused');
      expect(content.textBody).toContain('automatically resume');
    });

    it('should generate timeline risk content for overdue status', () => {
      const mockTimelineStatus = {
        status: 'overdue',
        remainingTime: {
          executive24h: -2 * 60 * 60 * 1000,
          detailed48h: 22 * 60 * 60 * 1000,
          implementation72h: 46 * 60 * 60 * 1000
        }
      };

      const context = {
        assessmentId: 'test-assessment-123',
        companyName: 'Test Company Inc.',
        founderEmail: 'founder@testcompany.com',
        supportContactEmail: 'support@scalemap.ai',
        assessment: mockAssessment,
        timelineStatus: mockTimelineStatus,
        urgencyLevel: 'critical' as const
      };

      const baseTemplate = {
        htmlBody: '{{CONTENT}}',
        textBody: '{{CONTENT}}'
      };

      const content = (founderNotificationService as any).generateTimelineRiskContent(context, baseTemplate);

      expect(content.textBody).toContain('OVERDUE');
      expect(content.textBody).toContain('deadline has passed');
      expect(content.textBody).toContain('contact our support team immediately');
    });

    it('should limit gap details to first 3 gaps with overflow indicator', () => {
      const manyGaps = Array.from({ length: 5 }, (_, i) => ({
        ...mockCriticalGaps[0],
        gapId: `gap-${i + 1}`,
        description: `Critical gap number ${i + 1}`
      })) as AssessmentGap[];

      const context = {
        assessmentId: 'test-assessment-123',
        companyName: 'Test Company Inc.',
        founderEmail: 'founder@testcompany.com',
        supportContactEmail: 'support@scalemap.ai',
        assessment: mockAssessment,
        gaps: manyGaps,
        urgencyLevel: 'critical' as const
      };

      const baseTemplate = {
        htmlBody: '{{CONTENT}}',
        textBody: '{{CONTENT}}'
      };

      const content = (founderNotificationService as any).generateCriticalGapsContent(context, baseTemplate);

      expect(content.textBody).toContain('Critical gap number 1');
      expect(content.textBody).toContain('Critical gap number 2');
      expect(content.textBody).toContain('Critical gap number 3');
      expect(content.textBody).toContain('...and 2 more gaps');
      expect(content.textBody).not.toContain('Critical gap number 4');
    });
  });

  describe('HTML template generation', () => {
    it('should generate proper HTML structure', () => {
      const context = {
        assessmentId: 'test-assessment-123',
        companyName: 'Test Company Inc.',
        founderEmail: 'founder@testcompany.com',
        supportContactEmail: 'support@scalemap.ai',
        assessment: mockAssessment,
        urgencyLevel: 'medium' as const
      };

      const htmlTemplate = (founderNotificationService as any).getBaseHtmlTemplate(context);

      expect(htmlTemplate).toContain('<!DOCTYPE html>');
      expect(htmlTemplate).toContain('<title>ScaleMap Assessment Update</title>');
      expect(htmlTemplate).toContain('Assessment ID: test-assessment-123');
      expect(htmlTemplate).toContain('support@scalemap.ai');
      expect(htmlTemplate).toContain('{{CONTENT}}');
      expect(htmlTemplate).toContain('© 2024 ScaleMap');
    });

    it('should generate plain text template', () => {
      const context = {
        assessmentId: 'test-assessment-123',
        companyName: 'Test Company Inc.',
        founderEmail: 'founder@testcompany.com',
        supportContactEmail: 'support@scalemap.ai',
        assessment: mockAssessment,
        urgencyLevel: 'medium' as const
      };

      const textTemplate = (founderNotificationService as any).getBaseTextTemplate(context);

      expect(textTemplate).toContain('ScaleMap Assessment Update');
      expect(textTemplate).toContain('Assessment ID: test-assessment-123');
      expect(textTemplate).toContain('support@scalemap.ai');
      expect(textTemplate).toContain('{{CONTENT}}');
      expect(textTemplate).toContain('© 2024 ScaleMap');
    });
  });
});