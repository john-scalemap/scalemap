import { AssessmentValidator } from '../../lib/validation/assessment-validation';
import { Assessment, DomainResponse } from '../../types/assessment';

// Mock assessment data
const mockAssessment: Assessment = {
  id: 'test-assessment-1',
  companyId: 'test-company-1',
  companyName: 'Test Company',
  contactEmail: 'test@example.com',
  title: 'Test Assessment',
  description: 'A test assessment for validation',
  status: 'document-processing',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  domainResponses: {},
  deliverySchedule: {
    executive24h: '2024-01-02T00:00:00Z',
    detailed48h: '2024-01-03T00:00:00Z',
    implementation72h: '2024-01-04T00:00:00Z'
  },
  clarificationPolicy: {
    allowClarificationUntil: '2024-01-03T00:00:00Z',
    maxClarificationRequests: 3,
    maxTimelineExtension: 24
  }
};

const mockDomainResponse: DomainResponse = {
  domain: 'strategic-alignment',
  questions: {
    'sa-1.1': {
      questionId: 'sa-1.1',
      value: 3,
      timestamp: '2024-01-01T00:00:00Z'
    },
    'sa-1.2': {
      questionId: 'sa-1.2',
      value: 3,
      timestamp: '2024-01-01T00:00:00Z'
    },
    'sa-1.3': {
      questionId: 'sa-1.3',
      value: 3,
      timestamp: '2024-01-01T00:00:00Z'
    },
    'sa-1.4': {
      questionId: 'sa-1.4',
      value: 3,
      timestamp: '2024-01-01T00:00:00Z'
    }
  },
  completeness: 100,
  lastUpdated: '2024-01-01T00:00:00Z'
};

describe('AssessmentValidator', () => {
  describe('validateAssessment', () => {
    it('should validate a complete assessment successfully', () => {
      const assessment = {
        ...mockAssessment,
        domainResponses: {
          'strategic-alignment': mockDomainResponse
        }
      };

      const result = AssessmentValidator.validateAssessment(assessment);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing required fields', () => {
      const invalidAssessment = {
        ...mockAssessment,
        companyName: '',
        contactEmail: '',
        title: '',
        description: ''
      };

      const result = AssessmentValidator.validateAssessment(invalidAssessment);

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'companyName',
            message: 'Company name is required',
            type: 'required'
          }),
          expect.objectContaining({
            field: 'contactEmail',
            message: 'Contact email is required',
            type: 'required'
          }),
          expect.objectContaining({
            field: 'title',
            message: 'Assessment title is required',
            type: 'required'
          }),
          expect.objectContaining({
            field: 'description',
            message: 'Assessment description is required',
            type: 'required'
          })
        ])
      );
    });

    it('should detect invalid email format', () => {
      const invalidAssessment = {
        ...mockAssessment,
        contactEmail: 'invalid-email'
      };

      const result = AssessmentValidator.validateAssessment(invalidAssessment);

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'contactEmail',
            message: 'Invalid email format',
            type: 'format'
          })
        ])
      );
    });

    it('should calculate completeness correctly', () => {
      const assessment = {
        ...mockAssessment,
        domainResponses: {
          'strategic-alignment': { ...mockDomainResponse, completeness: 100 },
          'financial-management': { ...mockDomainResponse, domain: 'financial-management' as const, completeness: 50 }
        }
      };

      const result = AssessmentValidator.validateAssessment(assessment);

      expect(result.completeness).toBe(13); // (100 + 50) / 12 domains = 12.5, rounded to 13
    });
  });

  describe('validateDomain', () => {
    it('should validate domain response successfully', () => {
      const result = AssessmentValidator.validateDomain(
        'strategic-alignment',
        mockDomainResponse,
        mockAssessment
      );

      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing required responses', () => {
      const incompleteDomainResponse: DomainResponse = {
        ...mockDomainResponse,
        questions: {} // No responses
      };

      const result = AssessmentValidator.validateDomain(
        'strategic-alignment',
        incompleteDomainResponse,
        mockAssessment
      );

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].type).toBe('required');
    });
  });

  describe('validateAssessmentContext', () => {
    it('should validate complete assessment context', () => {
      const context = {
        primaryBusinessChallenges: ['Scaling operations'],
        strategicObjectives: ['Increase market share'],
        resourceConstraints: {
          budget: 'moderate',
          team: 'adequate',
          timeAvailability: 'flexible'
        }
      };

      const result = AssessmentValidator.validateAssessmentContext(context);

      expect(result).toHaveLength(0);
    });

    it('should detect missing business challenges', () => {
      const context = {
        primaryBusinessChallenges: [],
        strategicObjectives: ['Increase market share'],
        resourceConstraints: {
          budget: 'moderate',
          team: 'adequate',
          timeAvailability: 'flexible'
        }
      };

      const result = AssessmentValidator.validateAssessmentContext(context);

      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'primaryBusinessChallenges',
            message: 'At least one business challenge must be selected',
            type: 'required'
          })
        ])
      );
    });

    it('should detect invalid resource constraint values', () => {
      const context = {
        primaryBusinessChallenges: ['Scaling operations'],
        strategicObjectives: ['Increase market share'],
        resourceConstraints: {
          budget: 'invalid-option',
          team: 'invalid-option',
          timeAvailability: 'invalid-option'
        }
      };

      const result = AssessmentValidator.validateAssessmentContext(context);

      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'resourceConstraints.budget',
            type: 'format'
          }),
          expect.objectContaining({
            field: 'resourceConstraints.team',
            type: 'format'
          }),
          expect.objectContaining({
            field: 'resourceConstraints.timeAvailability',
            type: 'format'
          })
        ])
      );
    });
  });
});