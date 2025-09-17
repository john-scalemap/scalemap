import { IndustryClassification } from '@scalemap/shared';

import { IndustryRulesEngine } from '../industry-rules';

describe('IndustryRulesEngine', () => {
  describe('getIndustryContext', () => {
    it('should return correct context for financial services', () => {
      const classification: IndustryClassification = {
        sector: 'financial-services',
        subSector: 'Banking',
        regulatoryClassification: 'heavily-regulated',
        businessModel: 'b2b-saas',
        companyStage: 'mature',
        employeeCount: 1000,
        revenue: '$100M+'
      };

      const context = IndustryRulesEngine.getIndustryContext(classification);

      expect(context.sector).toBe('financial-services');
      expect(context.regulatoryClassification).toBe('heavily-regulated');
      expect(context.specificRules).toContain('risk-compliance');
      expect(context.specificRules).toContain('financial-management');
      expect(context.weightingMultipliers['risk-compliance']).toBe(1.5);
      expect(context.weightingMultipliers['financial-management']).toBe(1.3);
    });

    it('should return correct context for technology sector', () => {
      const classification: IndustryClassification = {
        sector: 'technology',
        subSector: 'SaaS',
        regulatoryClassification: 'lightly-regulated',
        businessModel: 'b2b-saas',
        companyStage: 'growth',
        employeeCount: 50,
        revenue: '$5M-10M'
      };

      const context = IndustryRulesEngine.getIndustryContext(classification);

      expect(context.sector).toBe('technology');
      expect(context.regulatoryClassification).toBe('lightly-regulated');
      expect(context.weightingMultipliers['technology-data']).toBe(1.4);
      expect(context.weightingMultipliers['revenue-engine']).toBe(1.3);
      expect(context.specificRules).toEqual([]); // No required domains for tech
    });

    it('should return correct context for healthcare', () => {
      const classification: IndustryClassification = {
        sector: 'healthcare',
        subSector: 'Digital Health',
        regulatoryClassification: 'heavily-regulated',
        businessModel: 'b2b-saas',
        companyStage: 'growth',
        employeeCount: 200,
        revenue: '$20M-50M'
      };

      const context = IndustryRulesEngine.getIndustryContext(classification);

      expect(context.sector).toBe('healthcare');
      expect(context.regulatoryClassification).toBe('heavily-regulated');
      expect(context.specificRules).toContain('risk-compliance');
      expect(context.weightingMultipliers['risk-compliance']).toBe(1.4);
      expect(context.weightingMultipliers['operational-excellence']).toBe(1.3);
    });

    it('should return default context for unknown industry', () => {
      const context = IndustryRulesEngine.getIndustryContext(undefined);

      expect(context.sector).toBe('unknown');
      expect(context.regulatoryClassification).toBe('lightly-regulated');
      expect(context.specificRules).toEqual([]);
      expect(context.benchmarks).toEqual({});
      expect(context.weightingMultipliers).toEqual({});
    });

    it('should handle unsupported industry sectors', () => {
      const classification: IndustryClassification = {
        sector: 'agriculture' as any, // Unsupported sector
        subSector: 'Farming',
        regulatoryClassification: 'lightly-regulated',
        businessModel: 'b2b-saas',
        companyStage: 'mature',
        employeeCount: 25,
        revenue: '$1M-5M'
      };

      const context = IndustryRulesEngine.getIndustryContext(classification);

      expect(context.sector).toBe('unknown');
      expect(context.regulatoryClassification).toBe('lightly-regulated');
    });
  });

  describe('applyIndustryWeighting', () => {
    it('should apply financial services weighting correctly', () => {
      const domainScores = {
        'risk-compliance': 4.0,
        'financial-management': 3.5,
        'operational-excellence': 3.8,
        'strategic-alignment': 3.2
      };

      const weightedScores = IndustryRulesEngine.applyIndustryWeighting(domainScores, 'financial-services');

      expect(weightedScores['risk-compliance']).toBe(5.0); // 4.0 * 1.5 = 6.0, capped at 5.0
      expect(weightedScores['financial-management']).toBeCloseTo(4.55); // 3.5 * 1.3
      expect(weightedScores['operational-excellence']).toBeCloseTo(4.56); // 3.8 * 1.2
      expect(weightedScores['strategic-alignment']).toBeCloseTo(3.52); // 3.2 * 1.1
    });

    it('should apply technology sector weighting correctly', () => {
      const domainScores = {
        'technology-data': 3.0,
        'revenue-engine': 3.5,
        'people-organization': 4.0,
        'strategic-alignment': 3.8
      };

      const weightedScores = IndustryRulesEngine.applyIndustryWeighting(domainScores, 'technology');

      expect(weightedScores['technology-data']).toBeCloseTo(4.2); // 3.0 * 1.4
      expect(weightedScores['revenue-engine']).toBeCloseTo(4.55); // 3.5 * 1.3
      expect(weightedScores['people-organization']).toBeCloseTo(4.8); // 4.0 * 1.2
      expect(weightedScores['strategic-alignment']).toBeCloseTo(4.56); // 3.8 * 1.2
    });

    it('should cap scores at 5.0 maximum', () => {
      const domainScores = {
        'risk-compliance': 4.5
      };

      const weightedScores = IndustryRulesEngine.applyIndustryWeighting(domainScores, 'financial-services');

      expect(weightedScores['risk-compliance']).toBe(5.0); // 4.5 * 1.5 = 6.75, capped at 5.0
    });

    it('should return original scores for unknown industry', () => {
      const domainScores = {
        'strategic-alignment': 4.0,
        'operational-excellence': 3.5
      };

      const weightedScores = IndustryRulesEngine.applyIndustryWeighting(domainScores, 'unknown-industry');

      expect(weightedScores).toEqual(domainScores);
    });
  });

  describe('validateIndustryCompliance', () => {
    it('should validate financial services compliance requirements', () => {
      const selectedDomains = ['risk-compliance', 'financial-management', 'operational-excellence'];

      const result = IndustryRulesEngine.validateIndustryCompliance(selectedDomains, 'financial-services');

      expect(result.isCompliant).toBe(true);
      expect(result.violations).toEqual([]);
    });

    it('should detect missing required domains for financial services', () => {
      const selectedDomains = ['operational-excellence', 'strategic-alignment']; // Missing required domains

      const result = IndustryRulesEngine.validateIndustryCompliance(selectedDomains, 'financial-services');

      expect(result.isCompliant).toBe(false);
      expect(result.violations).toContain('Missing required domain for financial-services: risk-compliance');
      expect(result.violations).toContain('Missing required domain for financial-services: financial-management');
    });

    it('should generate recommendations for preferred domains', () => {
      const selectedDomains = ['risk-compliance', 'financial-management']; // Missing preferred domains

      const result = IndustryRulesEngine.validateIndustryCompliance(selectedDomains, 'financial-services');

      expect(result.isCompliant).toBe(true);
      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.recommendations.some(r => r.includes('operational-excellence'))).toBe(true);
    });

    it('should detect excluded domains for technology sector', () => {
      const selectedDomains = ['technology-data', 'supply-chain']; // supply-chain excluded for pure tech

      const result = IndustryRulesEngine.validateIndustryCompliance(selectedDomains, 'technology');

      expect(result.isCompliant).toBe(false);
      expect(result.violations).toContain('Should not include supply-chain domain for technology industry');
    });

    it('should handle unknown industries gracefully', () => {
      const selectedDomains = ['strategic-alignment', 'operational-excellence'];

      const result = IndustryRulesEngine.validateIndustryCompliance(selectedDomains, 'unknown-sector');

      expect(result.isCompliant).toBe(true);
      expect(result.violations).toEqual([]);
      expect(result.recommendations).toEqual([]);
    });
  });

  describe('getIndustryBenchmarks', () => {
    it('should return benchmarks for financial services', () => {
      const benchmarks = IndustryRulesEngine.getIndustryBenchmarks('financial-services');

      expect(benchmarks['risk-compliance']).toBe(4.2);
      expect(benchmarks['financial-management']).toBe(4.0);
      expect(benchmarks['operational-excellence']).toBe(3.8);
      expect(benchmarks['strategic-alignment']).toBe(3.5);
    });

    it('should return benchmarks for technology sector', () => {
      const benchmarks = IndustryRulesEngine.getIndustryBenchmarks('technology');

      expect(benchmarks['technology-data']).toBe(4.1);
      expect(benchmarks['revenue-engine']).toBe(3.9);
      expect(benchmarks['people-organization']).toBe(3.7);
      expect(benchmarks['strategic-alignment']).toBe(3.8);
    });

    it('should return empty benchmarks for unknown industry', () => {
      const benchmarks = IndustryRulesEngine.getIndustryBenchmarks('unknown-industry');

      expect(benchmarks).toEqual({});
    });
  });

  describe('getSpecialConsiderations', () => {
    it('should return special considerations for financial services', () => {
      const considerations = IndustryRulesEngine.getSpecialConsiderations('financial-services');

      expect(considerations).toContain('Regulatory compliance is mandatory');
      expect(considerations).toContain('Financial risk management takes precedence');
      expect(considerations).toContain('Operational resilience is critical');
      expect(considerations).toContain('Customer data protection is paramount');
    });

    it('should return special considerations for healthcare', () => {
      const considerations = IndustryRulesEngine.getSpecialConsiderations('healthcare');

      expect(considerations).toContain('Patient safety is paramount');
      expect(considerations).toContain('HIPAA compliance required');
      expect(considerations).toContain('Clinical workflow efficiency critical');
      expect(considerations).toContain('Staff training and retention essential');
    });

    it('should return empty array for unknown industry', () => {
      const considerations = IndustryRulesEngine.getSpecialConsiderations('unknown-industry');

      expect(considerations).toEqual([]);
    });
  });

  describe('getRegulatoryImpact', () => {
    it('should return correct impact for heavily regulated industries', () => {
      const impact = IndustryRulesEngine.getRegulatoryImpact('heavily-regulated');

      expect(impact.complianceWeight).toBe(1.5);
      expect(impact.riskTolerance).toBe(0.2);
      expect(impact.auditRequirements).toContain('Complete audit trail required');
      expect(impact.auditRequirements).toContain('External validation necessary');
    });

    it('should return correct impact for moderately regulated industries', () => {
      const impact = IndustryRulesEngine.getRegulatoryImpact('moderately-regulated');

      expect(impact.complianceWeight).toBe(1.2);
      expect(impact.riskTolerance).toBe(0.4);
      expect(impact.auditRequirements).toContain('Standard audit trail');
      expect(impact.auditRequirements).toContain('Periodic compliance checks');
    });

    it('should return correct impact for lightly regulated industries', () => {
      const impact = IndustryRulesEngine.getRegulatoryImpact('lightly-regulated');

      expect(impact.complianceWeight).toBe(1.0);
      expect(impact.riskTolerance).toBe(0.6);
      expect(impact.auditRequirements).toContain('Basic audit trail');
      expect(impact.auditRequirements).toContain('Self-assessment acceptable');
    });
  });

  describe('getStageAdjustments', () => {
    it('should return correct adjustments for startup stage', () => {
      const adjustments = IndustryRulesEngine.getStageAdjustments('startup');

      expect(adjustments.focusDomains).toContain('strategic-alignment');
      expect(adjustments.focusDomains).toContain('revenue-engine');
      expect(adjustments.focusDomains).toContain('people-organization');

      expect(adjustments.weightingAdjustments['revenue-engine']).toBe(1.4);
      expect(adjustments.weightingAdjustments['strategic-alignment']).toBe(1.3);
      expect(adjustments.weightingAdjustments['operational-excellence']).toBe(0.9); // Reduced for startups

      expect(adjustments.priorityShifts['product-market-fit']).toBe(1.5);
    });

    it('should return correct adjustments for growth stage', () => {
      const adjustments = IndustryRulesEngine.getStageAdjustments('growth');

      expect(adjustments.focusDomains).toContain('operational-excellence');
      expect(adjustments.focusDomains).toContain('people-organization');
      expect(adjustments.focusDomains).toContain('strategic-alignment');

      expect(adjustments.weightingAdjustments['operational-excellence']).toBe(1.4);
      expect(adjustments.weightingAdjustments['people-organization']).toBe(1.3);

      expect(adjustments.priorityShifts['scaling']).toBe(1.4);
    });

    it('should return correct adjustments for mature stage', () => {
      const adjustments = IndustryRulesEngine.getStageAdjustments('mature');

      expect(adjustments.focusDomains).toContain('strategic-alignment');
      expect(adjustments.focusDomains).toContain('operational-excellence');
      expect(adjustments.focusDomains).toContain('risk-compliance');

      expect(adjustments.weightingAdjustments['strategic-alignment']).toBe(1.3);
      expect(adjustments.weightingAdjustments['risk-compliance']).toBe(1.2);

      expect(adjustments.priorityShifts['optimization']).toBe(1.3);
    });
  });

  describe('generateIndustryReasoning', () => {
    it('should generate reasoning for financial services', () => {
      const reasoning = IndustryRulesEngine.generateIndustryReasoning(
        'financial-services',
        ['risk-compliance', 'financial-management', 'operational-excellence'],
        'heavily-regulated'
      );

      expect(reasoning).toContain('financial-services');
      expect(reasoning).toContain('heavily-regulated');
      expect(reasoning).toContain('risk-compliance');
      expect(reasoning).toContain('financial-management');
      expect(reasoning).toContain('Required domains');
    });

    it('should generate reasoning for technology sector', () => {
      const reasoning = IndustryRulesEngine.generateIndustryReasoning(
        'technology',
        ['technology-data', 'revenue-engine', 'people-organization'],
        'lightly-regulated'
      );

      expect(reasoning).toContain('technology');
      expect(reasoning).toContain('lightly-regulated');
      expect(reasoning).toContain('technology-data');
      expect(reasoning).not.toContain('Required domains'); // Tech has no required domains
    });

    it('should generate generic reasoning for unknown industry', () => {
      const reasoning = IndustryRulesEngine.generateIndustryReasoning(
        'unknown-sector',
        ['strategic-alignment', 'operational-excellence'],
        'lightly-regulated'
      );

      expect(reasoning).toContain('Standard domain selection for general business analysis');
      expect(reasoning).toContain('strategic-alignment, operational-excellence');
    });
  });

  describe('getIndustryConfiguration', () => {
    it('should return configuration for financial services', () => {
      const config = IndustryRulesEngine.getIndustryConfiguration('financial-services');

      expect(config.industryRules).toBeDefined();
      expect(config.industryRules?.['financial-services']).toBeDefined();
      expect(config.industryRules?.['financial-services']?.requiredDomains).toContain('risk-compliance');
      expect(config.thresholds).toBeDefined();
      expect(config.thresholds!.confidenceMinimum).toBe(0.8); // Higher for heavily regulated
    });

    it('should return empty configuration for unknown industry', () => {
      const config = IndustryRulesEngine.getIndustryConfiguration('unknown-industry');

      expect(config).toEqual({});
    });
  });
});