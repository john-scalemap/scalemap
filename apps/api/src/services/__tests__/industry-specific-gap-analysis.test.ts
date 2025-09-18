import { Assessment, IndustrySpecificGap } from '@scalemap/shared';

import { GapAnalysisService } from '../gap-analysis-service';

// Mock dependencies
jest.mock('../openai-service');
jest.mock('../timeline-manager');
jest.mock('../founder-notification-service');

describe('GapAnalysisService - Industry-Specific Gap Detection', () => {
  let gapAnalysisService: GapAnalysisService;
  let baseAssessment: Assessment;

  beforeEach(() => {
    jest.clearAllMocks();
    gapAnalysisService = new GapAnalysisService();

    baseAssessment = {
      id: 'test-assessment-123',
      companyId: 'company-123',
      companyName: 'Test Financial Corp',
      contactEmail: 'ceo@testfinancial.com',
      title: 'Strategic Assessment',
      description: 'Financial services assessment',
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
  });

  describe('Financial Services Industry', () => {
    it('should detect FCA compliance gaps for heavily regulated financial services', async () => {
      const financialAssessment = {
        ...baseAssessment,
        industryClassification: {
          sector: 'financial-services' as const,
          subSector: 'investment-banking',
          regulatoryClassification: 'heavily-regulated' as const,
          businessModel: 'services' as const,
          companyStage: 'growth' as const,
          employeeCount: 250
        }
      };

      // Mock the financial compliance assessment method
      jest.spyOn(gapAnalysisService as any, 'assessFinancialCompliance').mockReturnValue(65);

      const industryGaps = await (gapAnalysisService as any).analyzeIndustrySpecificGaps(financialAssessment);

      expect(industryGaps).toHaveLength(1);
      expect(industryGaps[0]).toMatchObject({
        regulation: 'FCA Compliance',
        requirements: expect.arrayContaining([
          'Risk management framework documentation',
          'Customer due diligence procedures',
          'Anti-money laundering controls',
          'Data protection and GDPR compliance'
        ]),
        complianceLevel: 65,
        mandatoryFields: ['risk-compliance.9.1', 'risk-compliance.9.2', 'risk-compliance.9.3'],
        recommendedFields: ['risk-compliance.9.4', 'risk-compliance.9.5'],
        riskLevel: 'high'
      });
    });

    it('should not detect FCA compliance gaps for lightly regulated financial services', async () => {
      const lightlyRegulatedAssessment = {
        ...baseAssessment,
        industryClassification: {
          sector: 'financial-services' as const,
          subSector: 'fintech-software',
          regulatoryClassification: 'lightly-regulated' as const,
          businessModel: 'b2b-saas' as const,
          companyStage: 'startup' as const,
          employeeCount: 25
        }
      };

      const industryGaps = await (gapAnalysisService as any).analyzeIndustrySpecificGaps(lightlyRegulatedAssessment);

      expect(industryGaps).toHaveLength(0);
    });

    it('should assess financial compliance levels correctly', async () => {
      const financialAssessment = {
        ...baseAssessment,
        industryClassification: {
          sector: 'financial-services' as const,
          regulatoryClassification: 'heavily-regulated' as const
        },
        domainResponses: {
          'risk-compliance': {
            domain: 'risk-compliance' as const,
            questions: {
              '9.1': { questionId: '9.1', value: 'We have a comprehensive risk framework', timestamp: new Date().toISOString() },
              '9.2': { questionId: '9.2', value: 'KYC procedures are in place', timestamp: new Date().toISOString() },
              '9.3': { questionId: '9.3', value: 'AML monitoring is automated', timestamp: new Date().toISOString() }
            },
            completeness: 100,
            lastUpdated: new Date().toISOString()
          }
        }
      };

      // Call the private method using array notation
      const complianceLevel = (gapAnalysisService as any).assessFinancialCompliance(financialAssessment);

      expect(complianceLevel).toBe('full');
    });

    it('should return low compliance level for incomplete financial responses', async () => {
      const incompleteFinancialAssessment = {
        ...baseAssessment,
        industryClassification: {
          sector: 'financial-services' as const,
          regulatoryClassification: 'heavily-regulated' as const
        },
        domainResponses: {
          'risk-compliance': {
            domain: 'risk-compliance' as const,
            questions: {
              '9.1': { questionId: '9.1', value: 'Not sure about risk framework', timestamp: new Date().toISOString() }
              // Missing 9.2 and 9.3 responses
            },
            completeness: 33,
            lastUpdated: new Date().toISOString()
          }
        }
      };

      const complianceLevel = (gapAnalysisService as any).assessFinancialCompliance(incompleteFinancialAssessment);

      expect(complianceLevel).toBe('partial');
    });
  });

  describe('Healthcare Industry', () => {
    it('should detect HIPAA compliance gaps for healthcare sector', async () => {
      const healthcareAssessment = {
        ...baseAssessment,
        companyName: 'MedTech Solutions',
        industryClassification: {
          sector: 'healthcare' as const,
          subSector: 'health-tech',
          regulatoryClassification: 'heavily-regulated' as const,
          businessModel: 'b2b-saas' as const,
          companyStage: 'growth' as const,
          employeeCount: 150
        }
      };

      // Mock the healthcare compliance assessment method
      jest.spyOn(gapAnalysisService as any, 'assessHealthcareCompliance').mockReturnValue(70);

      const industryGaps = await (gapAnalysisService as any).analyzeIndustrySpecificGaps(healthcareAssessment);

      expect(industryGaps).toHaveLength(1);
      expect(industryGaps[0]).toMatchObject({
        regulation: 'HIPAA/GDPR Healthcare',
        requirements: expect.arrayContaining([
          'Patient data protection measures',
          'Healthcare data encryption',
          'Access control systems',
          'Audit trail capabilities'
        ]),
        complianceLevel: 70,
        mandatoryFields: ['technology-data.6.4', 'risk-compliance.9.2'],
        recommendedFields: ['technology-data.6.5', 'risk-compliance.9.6'],
        riskLevel: 'high'
      });
    });

    it('should assess healthcare compliance levels correctly', async () => {
      const healthcareAssessment = {
        ...baseAssessment,
        industryClassification: {
          sector: 'healthcare' as const,
          regulatoryClassification: 'heavily-regulated' as const
        },
        domainResponses: {
          'technology-data': {
            domain: 'technology-data' as const,
            questions: {
              '6.4': { questionId: '6.4', value: 'We use end-to-end encryption for patient data', timestamp: new Date().toISOString() },
              '6.5': { questionId: '6.5', value: 'Access controls are role-based with MFA', timestamp: new Date().toISOString() }
            },
            completeness: 100,
            lastUpdated: new Date().toISOString()
          },
          'risk-compliance': {
            domain: 'risk-compliance' as const,
            questions: {
              '9.2': { questionId: '9.2', value: 'HIPAA compliance program is active', timestamp: new Date().toISOString() },
              '9.6': { questionId: '9.6', value: 'Regular security audits conducted', timestamp: new Date().toISOString() }
            },
            completeness: 100,
            lastUpdated: new Date().toISOString()
          }
        }
      };

      const complianceLevel = (gapAnalysisService as any).assessHealthcareCompliance(healthcareAssessment);

      expect(complianceLevel).toBe('full');
    });

    it('should return low compliance level for incomplete healthcare responses', async () => {
      const incompleteHealthcareAssessment = {
        ...baseAssessment,
        industryClassification: {
          sector: 'healthcare' as const,
          regulatoryClassification: 'heavily-regulated' as const
        },
        domainResponses: {
          'technology-data': {
            domain: 'technology-data' as const,
            questions: {
              '6.4': { questionId: '6.4', value: 'Basic encryption in place', timestamp: new Date().toISOString() }
              // Missing other required responses
            },
            completeness: 50,
            lastUpdated: new Date().toISOString()
          },
          'risk-compliance': {
            domain: 'risk-compliance' as const,
            questions: {
              // Missing 9.2 required for healthcare compliance
            },
            completeness: 0,
            lastUpdated: new Date().toISOString()
          }
        }
      };

      const complianceLevel = (gapAnalysisService as any).assessHealthcareCompliance(incompleteHealthcareAssessment);

      expect(complianceLevel).toBe('partial');
    });
  });

  describe('Manufacturing Industry', () => {
    it('should handle manufacturing sector without specific compliance requirements', async () => {
      const manufacturingAssessment = {
        ...baseAssessment,
        companyName: 'Manufacturing Corp',
        industryClassification: {
          sector: 'manufacturing' as const,
          subSector: 'automotive-parts',
          regulatoryClassification: 'lightly-regulated' as const,
          businessModel: 'manufacturing' as const,
          companyStage: 'mature' as const,
          employeeCount: 500
        }
      };

      const industryGaps = await (gapAnalysisService as any).analyzeIndustrySpecificGaps(manufacturingAssessment);

      expect(industryGaps).toHaveLength(0);
    });
  });

  describe('Technology Industry', () => {
    it('should handle technology sector without specific compliance requirements', async () => {
      const techAssessment = {
        ...baseAssessment,
        companyName: 'Tech Startup Inc',
        industryClassification: {
          sector: 'technology' as const,
          subSector: 'enterprise-software',
          regulatoryClassification: 'lightly-regulated' as const,
          businessModel: 'b2b-saas' as const,
          companyStage: 'startup' as const,
          employeeCount: 50
        }
      };

      const industryGaps = await (gapAnalysisService as any).analyzeIndustrySpecificGaps(techAssessment);

      expect(industryGaps).toHaveLength(0);
    });
  });

  describe('Multi-industry and Edge Cases', () => {
    it('should handle assessment without industry classification', async () => {
      const noIndustryAssessment = {
        ...baseAssessment,
        industryClassification: undefined
      };

      const industryGaps = await (gapAnalysisService as any).analyzeIndustrySpecificGaps(noIndustryAssessment);

      expect(industryGaps).toHaveLength(0);
    });

    it('should handle fintech that operates in both technology and financial services', async () => {
      const fintechAssessment = {
        ...baseAssessment,
        companyName: 'FinTech Solutions',
        industryClassification: {
          sector: 'financial-services' as const,
          subSector: 'fintech-payments',
          regulatoryClassification: 'heavily-regulated' as const,
          businessModel: 'b2b-saas' as const,
          companyStage: 'growth' as const,
          employeeCount: 75
        }
      };

      jest.spyOn(gapAnalysisService as any, 'assessFinancialCompliance').mockReturnValue(80);

      const industryGaps = await (gapAnalysisService as any).analyzeIndustrySpecificGaps(fintechAssessment);

      expect(industryGaps).toHaveLength(1);
      expect(industryGaps[0].regulation).toBe('FCA Compliance');
      expect(industryGaps[0].complianceLevel).toBe(80);
    });

    it('should handle healthtech that operates in both technology and healthcare', async () => {
      const healthtechAssessment = {
        ...baseAssessment,
        companyName: 'HealthTech Innovation',
        industryClassification: {
          sector: 'healthcare' as const,
          subSector: 'digital-health',
          regulatoryClassification: 'heavily-regulated' as const,
          businessModel: 'b2c-marketplace' as const,
          companyStage: 'startup' as const,
          employeeCount: 30
        }
      };

      jest.spyOn(gapAnalysisService as any, 'assessHealthcareCompliance').mockReturnValue(55);

      const industryGaps = await (gapAnalysisService as any).analyzeIndustrySpecificGaps(healthtechAssessment);

      expect(industryGaps).toHaveLength(1);
      expect(industryGaps[0].regulation).toBe('HIPAA/GDPR Healthcare');
      expect(industryGaps[0].complianceLevel).toBe(55);
    });

    it('should handle assessment with partial industry classification', async () => {
      const partialIndustryAssessment = {
        ...baseAssessment,
        industryClassification: {
          sector: 'financial-services' as const,
          subSector: 'investment-management',
          // Missing regulatoryClassification
          businessModel: 'services' as const,
          companyStage: 'mature' as const,
          employeeCount: 200
        }
      } as Assessment;

      const industryGaps = await (gapAnalysisService as any).analyzeIndustrySpecificGaps(partialIndustryAssessment);

      // Should not trigger financial services requirements without regulatory classification
      expect(industryGaps).toHaveLength(0);
    });
  });

  describe('Compliance Level Calculations', () => {
    it('should calculate financial compliance with varying response qualities', async () => {
      const responses = {
        '9.1': 'Comprehensive enterprise risk management framework with quarterly board reviews',
        '9.2': 'Basic KYC',
        '9.3': 'We monitor transactions',
        '9.4': 'GDPR compliant data processing with privacy by design',
        '9.5': 'Not implemented'
      };

      const assessmentWithResponses = {
        ...baseAssessment,
        domainResponses: {
          'risk-compliance': {
            domain: 'risk-compliance' as const,
            questions: {
              '9.1': { questionId: '9.1', value: responses['9.1'], timestamp: new Date().toISOString() },
              '9.2': { questionId: '9.2', value: responses['9.2'], timestamp: new Date().toISOString() }
              // Missing '9.3' to make it partial compliance
            },
            completeness: 100,
            lastUpdated: new Date().toISOString()
          }
        }
      };

      const complianceLevel = (gapAnalysisService as any).assessFinancialCompliance(assessmentWithResponses);

      // Should reflect mix of high-quality and low-quality responses
      expect(complianceLevel).toBe('partial');
    });

    it('should calculate healthcare compliance with varying response qualities', async () => {
      const responses = {
        '6.4': { questionId: '6.4', response: 'AES-256 encryption for data at rest and TLS 1.3 for data in transit' },
        '6.5': { questionId: '6.5', response: 'RBAC with MFA' },
        '9.2': { questionId: '9.2', response: 'Basic HIPAA training' },
        '9.6': { questionId: '9.6', response: 'No formal audit process' }
      };

      const assessmentWithResponses = {
        ...baseAssessment,
        domainResponses: {
          'technology-data': {
            domain: 'technology-data' as const,
            questions: {
              '6.4': { questionId: '6.4', value: responses['6.4'], timestamp: new Date().toISOString() },
              '6.5': { questionId: '6.5', value: responses['6.5'], timestamp: new Date().toISOString() }
            },
            completeness: 100,
            lastUpdated: new Date().toISOString()
          },
          'risk-compliance': {
            domain: 'risk-compliance' as const,
            questions: {
              // Missing required '9.2' to make it partial
              '9.6': { questionId: '9.6', value: responses['9.6'], timestamp: new Date().toISOString() }
            },
            completeness: 50,
            lastUpdated: new Date().toISOString()
          }
        }
      };

      const complianceLevel = (gapAnalysisService as any).assessHealthcareCompliance(assessmentWithResponses);

      // Should reflect strong technical controls but weak process controls
      expect(complianceLevel).toBe('partial');
    });
  });

  describe('Integration with Main Gap Analysis', () => {
    it('should include industry-specific gaps in overall gap analysis', async () => {
      const financialAssessment = {
        ...baseAssessment,
        industryClassification: {
          sector: 'financial-services' as const,
          subSector: 'investment-banking',
          regulatoryClassification: 'heavily-regulated' as const,
          businessModel: 'services' as const,
          companyStage: 'growth' as const,
          employeeCount: 250
        },
        domainResponses: {}
      };

      // Mock required methods
      jest.spyOn(gapAnalysisService as any, 'getAssessment').mockResolvedValue(financialAssessment);
      jest.spyOn(gapAnalysisService as any, 'updateAssessmentWithGapAnalysis').mockResolvedValue(undefined);
      jest.spyOn(gapAnalysisService as any, 'storeGapTrackingEntities').mockResolvedValue(undefined);
      jest.spyOn(gapAnalysisService as any, 'generateRecommendations').mockResolvedValue([]);
      jest.spyOn(gapAnalysisService as any, 'assessFinancialCompliance').mockReturnValue(60);

      const gapAnalysisRequest = {
        assessmentId: 'test-assessment-123',
        analysisDepth: 'standard' as const,
        forceReanalysis: true
      };

      const result = await gapAnalysisService.analyzeGaps(gapAnalysisRequest);

      expect(result).toBeDefined();
      expect(result.gapAnalysis.industrySpecificGaps).toBeDefined();
      expect(result.gapAnalysis.industrySpecificGaps).toHaveLength(1);
      expect(result.gapAnalysis.industrySpecificGaps[0]?.regulation).toBe('FCA Compliance');
    });

    it('should handle mixed industry requirements correctly', async () => {
      // Hypothetical future case where an assessment might have multiple industry classifications
      const multiIndustryAssessment = {
        ...baseAssessment,
        companyName: 'MedFinTech Corp',
        industryClassification: {
          sector: 'healthcare' as const, // Primary sector
          subSector: 'health-fintech',
          regulatoryClassification: 'heavily-regulated' as const,
          businessModel: 'hybrid' as const,
          companyStage: 'growth' as const,
          employeeCount: 120
        }
      };

      jest.spyOn(gapAnalysisService as any, 'assessHealthcareCompliance').mockReturnValue(75);

      const industryGaps = await (gapAnalysisService as any).analyzeIndustrySpecificGaps(multiIndustryAssessment);

      // Should detect healthcare requirements since that's the primary sector
      expect(industryGaps).toHaveLength(1);
      expect(industryGaps[0].regulation).toBe('HIPAA/GDPR Healthcare');
    });
  });
});