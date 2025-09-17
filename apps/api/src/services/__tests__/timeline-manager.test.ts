import { Assessment, AssessmentGap } from '@scalemap/shared';

import { TimelineManager } from '../timeline-manager';

// Mock the SES service
jest.mock('../ses-service');

describe('TimelineManager', () => {
  let timelineManager: TimelineManager;
  let mockAssessment: Assessment;
  let mockCriticalGaps: AssessmentGap[];

  beforeEach(() => {
    jest.clearAllMocks();
    timelineManager = new TimelineManager();

    mockAssessment = {
      id: 'test-assessment-123',
      companyId: 'company-123',
      companyName: 'Test Company',
      contactEmail: 'founder@testcompany.com',
      title: 'Strategic Assessment',
      description: 'Test assessment',
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
        description: 'Missing strategic objectives definition',
        detectedAt: new Date().toISOString(),
        suggestedQuestions: ['What are your primary strategic objectives?'],
        followUpPrompts: ['Please provide details about your 3-year vision'],
        resolved: false,
        impactOnTimeline: true,
        priority: 8,
        estimatedResolutionTime: 30
      },
      {
        gapId: 'gap-2',
        assessmentId: 'test-assessment-123',
        domain: 'financial-management',
        category: 'critical',
        description: 'Revenue model unclear',
        detectedAt: new Date().toISOString(),
        suggestedQuestions: ['How do you generate revenue?'],
        followUpPrompts: ['Please explain your pricing strategy'],
        resolved: false,
        impactOnTimeline: true,
        priority: 9,
        estimatedResolutionTime: 20
      }
    ];
  });

  describe('pauseForCriticalGaps', () => {
    it('should pause timeline for critical gaps', async () => {
      // Mock the getAssessment method
      jest.spyOn(timelineManager as any, 'getAssessment').mockResolvedValue(mockAssessment);
      jest.spyOn(timelineManager as any, 'validateTimelinePause').mockResolvedValue(undefined);
      jest.spyOn(timelineManager as any, 'storePauseEvent').mockResolvedValue(undefined);
      jest.spyOn(timelineManager as any, 'updateAssessmentStatus').mockResolvedValue(undefined);
      jest.spyOn(timelineManager as any, 'sendTimelinePauseNotifications').mockResolvedValue(undefined);

      const pauseEvent = await timelineManager.pauseForCriticalGaps(
        'test-assessment-123',
        mockCriticalGaps,
        'system'
      );

      expect(pauseEvent).toBeDefined();
      expect(pauseEvent.assessmentId).toBe('test-assessment-123');
      expect(pauseEvent.pauseReason).toBe('critical-gaps');
      expect(pauseEvent.pausedBy).toBe('system');
      expect(pauseEvent.affectedGaps).toEqual(['gap-1', 'gap-2']);
      expect(pauseEvent.estimatedResolutionTime).toBeGreaterThan(0);
    });

    it('should calculate correct estimated resolution time', async () => {
      jest.spyOn(timelineManager as any, 'getAssessment').mockResolvedValue(mockAssessment);
      jest.spyOn(timelineManager as any, 'validateTimelinePause').mockResolvedValue(undefined);
      jest.spyOn(timelineManager as any, 'storePauseEvent').mockResolvedValue(undefined);
      jest.spyOn(timelineManager as any, 'updateAssessmentStatus').mockResolvedValue(undefined);
      jest.spyOn(timelineManager as any, 'sendTimelinePauseNotifications').mockResolvedValue(undefined);

      const pauseEvent = await timelineManager.pauseForCriticalGaps(
        'test-assessment-123',
        mockCriticalGaps,
        'system'
      );

      // Expected: (30 * 1.5) + (20 * 1.5) = 45 + 30 = 75 minutes
      expect(pauseEvent.estimatedResolutionTime).toBe(75);
    });

    it('should throw error if assessment not found', async () => {
      jest.spyOn(timelineManager as any, 'getAssessment').mockResolvedValue(null);

      await expect(
        timelineManager.pauseForCriticalGaps('non-existent', mockCriticalGaps, 'system')
      ).rejects.toThrow('Assessment non-existent not found');
    });

    it('should include proper next steps description', async () => {
      jest.spyOn(timelineManager as any, 'getAssessment').mockResolvedValue(mockAssessment);
      jest.spyOn(timelineManager as any, 'validateTimelinePause').mockResolvedValue(undefined);
      jest.spyOn(timelineManager as any, 'storePauseEvent').mockResolvedValue(undefined);
      jest.spyOn(timelineManager as any, 'updateAssessmentStatus').mockResolvedValue(undefined);
      jest.spyOn(timelineManager as any, 'sendTimelinePauseNotifications').mockResolvedValue(undefined);

      const pauseEvent = await timelineManager.pauseForCriticalGaps(
        'test-assessment-123',
        mockCriticalGaps,
        'system'
      );

      expect(pauseEvent.nextStepsDescription).toContain('Review 2 critical gap(s)');
      expect(pauseEvent.nextStepsDescription).toContain('gap resolution interface');
      expect(pauseEvent.nextStepsDescription).toContain('high priority');
    });
  });

  describe('resumeAfterGapResolution', () => {
    it('should resume timeline when all critical gaps are resolved', async () => {
      const mockPauseEvent = {
        assessmentId: 'test-assessment-123',
        pauseReason: 'critical-gaps',
        pausedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1 hour ago
        pausedBy: 'system',
        affectedGaps: ['gap-1', 'gap-2'],
        estimatedResolutionTime: 50,
        nextStepsDescription: 'Test next steps'
      };

      jest.spyOn(timelineManager as any, 'getActivePauseEvent').mockResolvedValue(mockPauseEvent);
      jest.spyOn(timelineManager as any, 'calculateTimelineExtension').mockResolvedValue(null);
      jest.spyOn(timelineManager as any, 'completePauseEvent').mockResolvedValue(undefined);
      jest.spyOn(timelineManager as any, 'getAssessment').mockResolvedValue(mockAssessment);
      jest.spyOn(timelineManager as any, 'updateAssessmentStatus').mockResolvedValue(undefined);
      jest.spyOn(timelineManager as any, 'sendTimelineResumeNotifications').mockResolvedValue(undefined);

      const result = await timelineManager.resumeAfterGapResolution(
        'test-assessment-123',
        ['gap-1', 'gap-2'],
        'system'
      );

      expect(result).toBe(true);
    });

    it('should not resume if critical gaps remain unresolved', async () => {
      const mockPauseEvent = {
        assessmentId: 'test-assessment-123',
        pauseReason: 'critical-gaps',
        pausedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        pausedBy: 'system',
        affectedGaps: ['gap-1', 'gap-2', 'gap-3'],
        estimatedResolutionTime: 50,
        nextStepsDescription: 'Test next steps'
      };

      jest.spyOn(timelineManager as any, 'getActivePauseEvent').mockResolvedValue(mockPauseEvent);

      const result = await timelineManager.resumeAfterGapResolution(
        'test-assessment-123',
        ['gap-1'], // Only one gap resolved
        'system'
      );

      expect(result).toBe(false);
    });

    it('should return false if no active pause event exists', async () => {
      jest.spyOn(timelineManager as any, 'getActivePauseEvent').mockResolvedValue(null);

      const result = await timelineManager.resumeAfterGapResolution(
        'test-assessment-123',
        ['gap-1', 'gap-2'],
        'system'
      );

      expect(result).toBe(false);
    });
  });

  describe('requestTimelineExtension', () => {
    it('should create timeline extension request', async () => {
      jest.spyOn(timelineManager as any, 'getAssessment').mockResolvedValue(mockAssessment);
      jest.spyOn(timelineManager as any, 'validateExtensionRequest').mockResolvedValue(undefined);
      jest.spyOn(timelineManager as any, 'applyTimelineExtension').mockResolvedValue(undefined);
      jest.spyOn(timelineManager as any, 'storeExtensionRequest').mockResolvedValue(undefined);
      jest.spyOn(timelineManager as any, 'sendExtensionNotifications').mockResolvedValue(undefined);

      const extension = await timelineManager.requestTimelineExtension(
        'test-assessment-123',
        'gap-resolution',
        4 * 60 * 60 * 1000, // 4 hours
        'Critical gaps require additional time for resolution',
        'system'
      );

      expect(extension).toBeDefined();
      expect(extension.assessmentId).toBe('test-assessment-123');
      expect(extension.extensionType).toBe('gap-resolution');
      expect(extension.extensionDuration).toBe(4 * 60 * 60 * 1000);
      expect(extension.requestedBy).toBe('system');
      expect(extension.justification).toContain('Critical gaps');
    });

    it('should auto-approve extensions under threshold', async () => {
      jest.spyOn(timelineManager as any, 'getAssessment').mockResolvedValue(mockAssessment);
      jest.spyOn(timelineManager as any, 'validateExtensionRequest').mockResolvedValue(undefined);
      jest.spyOn(timelineManager as any, 'applyTimelineExtension').mockResolvedValue(undefined);
      jest.spyOn(timelineManager as any, 'storeExtensionRequest').mockResolvedValue(undefined);
      jest.spyOn(timelineManager as any, 'sendExtensionNotifications').mockResolvedValue(undefined);

      const extension = await timelineManager.requestTimelineExtension(
        'test-assessment-123',
        'gap-resolution',
        2 * 60 * 60 * 1000, // 2 hours (under 6 hour threshold)
        'Minor gaps need resolution',
        'system'
      );

      expect(extension.approvedBy).toBe('system');
      expect(extension.approvedAt).toBeDefined();
    });

    it('should not auto-approve extensions over threshold', async () => {
      jest.spyOn(timelineManager as any, 'getAssessment').mockResolvedValue(mockAssessment);
      jest.spyOn(timelineManager as any, 'validateExtensionRequest').mockResolvedValue(undefined);
      jest.spyOn(timelineManager as any, 'storeExtensionRequest').mockResolvedValue(undefined);
      jest.spyOn(timelineManager as any, 'sendExtensionNotifications').mockResolvedValue(undefined);

      const extension = await timelineManager.requestTimelineExtension(
        'test-assessment-123',
        'gap-resolution',
        8 * 60 * 60 * 1000, // 8 hours (over 6 hour threshold)
        'Major gaps need resolution',
        'system'
      );

      expect(extension.approvedBy).toBeUndefined();
      expect(extension.approvedAt).toBeUndefined();
    });
  });

  describe('getTimelineStatus', () => {
    it('should return on-track status for normal timeline', async () => {
      jest.spyOn(timelineManager as any, 'getAssessment').mockResolvedValue(mockAssessment);
      jest.spyOn(timelineManager as any, 'getActivePauseEvent').mockResolvedValue(null);
      jest.spyOn(timelineManager as any, 'getExtensions').mockResolvedValue([]);

      const status = await timelineManager.getTimelineStatus('test-assessment-123');

      expect(status.status).toBe('on-track');
      expect(status.pauseEvent).toBeUndefined();
      expect(status.extensions).toEqual([]);
      expect(status.remainingTime.executive24h).toBeGreaterThan(0);
    });

    it('should return paused status when pause event exists', async () => {
      const mockPauseEvent = {
        assessmentId: 'test-assessment-123',
        pauseReason: 'critical-gaps',
        pausedAt: new Date().toISOString(),
        pausedBy: 'system',
        affectedGaps: ['gap-1'],
        estimatedResolutionTime: 30,
        nextStepsDescription: 'Test'
      };

      jest.spyOn(timelineManager as any, 'getAssessment').mockResolvedValue(mockAssessment);
      jest.spyOn(timelineManager as any, 'getActivePauseEvent').mockResolvedValue(mockPauseEvent);
      jest.spyOn(timelineManager as any, 'getExtensions').mockResolvedValue([]);

      const status = await timelineManager.getTimelineStatus('test-assessment-123');

      expect(status.status).toBe('paused');
      expect(status.pauseEvent).toBeDefined();
      expect(status.pauseEvent!.pauseReason).toBe('critical-gaps');
    });

    it('should return at-risk status when approaching deadline', async () => {
      // Mock assessment with deadline in 2 hours
      const riskAssessment = {
        ...mockAssessment,
        deliverySchedule: {
          executive24h: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours from now
          detailed48h: new Date(Date.now() + 26 * 60 * 60 * 1000).toISOString(),
          implementation72h: new Date(Date.now() + 50 * 60 * 60 * 1000).toISOString()
        }
      };

      jest.spyOn(timelineManager as any, 'getAssessment').mockResolvedValue(riskAssessment);
      jest.spyOn(timelineManager as any, 'getActivePauseEvent').mockResolvedValue(null);
      jest.spyOn(timelineManager as any, 'getExtensions').mockResolvedValue([]);

      const status = await timelineManager.getTimelineStatus('test-assessment-123');

      expect(status.status).toBe('at-risk');
      expect(status.riskFactors).toContain('Approaching 24h deadline');
    });

    it('should return overdue status when deadline has passed', async () => {
      // Mock assessment with past deadline
      const overdueAssessment = {
        ...mockAssessment,
        deliverySchedule: {
          executive24h: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
          detailed48h: new Date(Date.now() + 22 * 60 * 60 * 1000).toISOString(),
          implementation72h: new Date(Date.now() + 46 * 60 * 60 * 1000).toISOString()
        }
      };

      jest.spyOn(timelineManager as any, 'getAssessment').mockResolvedValue(overdueAssessment);
      jest.spyOn(timelineManager as any, 'getActivePauseEvent').mockResolvedValue(null);
      jest.spyOn(timelineManager as any, 'getExtensions').mockResolvedValue([]);

      const status = await timelineManager.getTimelineStatus('test-assessment-123');

      expect(status.status).toBe('overdue');
      expect(status.riskFactors).toContain('Timeline deadline exceeded');
    });

    it('should identify risk factors based on assessment state', async () => {
      const assessmentWithGaps = {
        ...mockAssessment,
        gapAnalysis: {
          detectedGaps: new Array(8).fill({}).map((_, i) => ({ gapId: `gap-${i}` })), // 8 gaps
          overallCompletenessScore: 75,
          criticalGapsCount: 3,
          totalGapsCount: 8,
          lastAnalyzedAt: new Date().toISOString()
        }
      };

      jest.spyOn(timelineManager as any, 'getAssessment').mockResolvedValue(assessmentWithGaps);
      jest.spyOn(timelineManager as any, 'getActivePauseEvent').mockResolvedValue(null);
      jest.spyOn(timelineManager as any, 'getExtensions').mockResolvedValue([]);

      const status = await timelineManager.getTimelineStatus('test-assessment-123');

      expect(status.riskFactors).toContain('High number of detected gaps');
    });
  });

  describe('business rule validation', () => {
    it('should validate maximum extension duration for gap resolution', async () => {
      jest.spyOn(timelineManager as any, 'getAssessment').mockResolvedValue(mockAssessment);
      jest.spyOn(timelineManager as any, 'getExtensions').mockResolvedValue([]);

      await expect(
        timelineManager.requestTimelineExtension(
          'test-assessment-123',
          'gap-resolution',
          30 * 60 * 60 * 1000, // 30 hours (exceeds 24 hour limit)
          'Too long extension',
          'system'
        )
      ).rejects.toThrow('Extension duration exceeds maximum allowed');
    });

    it('should validate maximum number of extensions', async () => {
      const existingExtensions = [
        { extensionId: '1' },
        { extensionId: '2' },
        { extensionId: '3' }
      ];

      jest.spyOn(timelineManager as any, 'getAssessment').mockResolvedValue(mockAssessment);
      jest.spyOn(timelineManager as any, 'getExtensions').mockResolvedValue(existingExtensions);

      await expect(
        timelineManager.requestTimelineExtension(
          'test-assessment-123',
          'gap-resolution',
          2 * 60 * 60 * 1000,
          'Fourth extension',
          'system'
        )
      ).rejects.toThrow('Maximum timeline extensions reached');
    });
  });
});