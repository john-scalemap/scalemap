import { AgentPersona } from '../../types/agent';
import { validateAgentPersona, validateAgentPersonaId, validateAgentPersonaStatus, sanitizeAgentPersonaInput } from '../agent-validation';

const validAgent: AgentPersona = {
  id: 'strategic-alignment',
  name: 'Dr. Alexandra Chen',
  title: 'Strategic Transformation Consultant',
  domainExpertise: {
    primaryDomains: ['strategic-alignment'],
    industrySpecializations: ['technology'],
    regulatoryExpertise: ['GDPR'],
    yearsExperience: 12,
    certifications: ['McKinsey Principal'],
    specializations: ['Strategic transformation']
  },
  personality: {
    communicationStyle: 'analytical',
    approach: 'data-driven',
    backstory: 'Former McKinsey Principal',
    keyPhrase: 'Strategy without execution is hallucination',
    professionalBackground: 'Strategic transformation',
    strengthAreas: ['Strategic vision development']
  },
  performance: {
    assessmentsCompleted: 127,
    avgConfidenceScore: 0.89,
    avgProcessingTimeMs: 38000,
    successRate: 0.94,
    clientSatisfactionScore: 4.7
  },
  status: 'available',
  createdAt: '2023-01-01T00:00:00Z',
  updatedAt: '2023-01-01T00:00:00Z'
};

describe('validateAgentPersona', () => {
  it('validates a complete valid agent persona', () => {
    const result = validateAgentPersona(validAgent);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('requires agent ID', () => {
    const invalidAgent = { ...validAgent };
    delete (invalidAgent as any).id;

    const result = validateAgentPersona(invalidAgent);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Agent ID is required and must be a non-empty string');
  });

  it('requires agent name', () => {
    const invalidAgent = { ...validAgent, name: '' };

    const result = validateAgentPersona(invalidAgent);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Agent name is required and must be a non-empty string');
  });

  it('requires agent title', () => {
    const invalidAgent = { ...validAgent, title: '' };

    const result = validateAgentPersona(invalidAgent);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Agent title is required and must be a non-empty string');
  });

  it('requires domain expertise', () => {
    const invalidAgent = { ...validAgent };
    delete (invalidAgent as any).domainExpertise;

    const result = validateAgentPersona(invalidAgent);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Domain expertise is required');
  });

  it('requires at least one primary domain', () => {
    const invalidAgent = {
      ...validAgent,
      domainExpertise: {
        ...validAgent.domainExpertise,
        primaryDomains: []
      }
    };

    const result = validateAgentPersona(invalidAgent);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('At least one primary domain is required');
  });

  it('validates years of experience is non-negative', () => {
    const invalidAgent = {
      ...validAgent,
      domainExpertise: {
        ...validAgent.domainExpertise,
        yearsExperience: -1
      }
    };

    const result = validateAgentPersona(invalidAgent);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Years of experience must be a non-negative number');
  });

  it('requires personality profile', () => {
    const invalidAgent = { ...validAgent };
    delete (invalidAgent as any).personality;

    const result = validateAgentPersona(invalidAgent);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Personality profile is required');
  });

  it('validates communication style', () => {
    const invalidAgent = {
      ...validAgent,
      personality: {
        ...validAgent.personality,
        communicationStyle: 'invalid' as any
      }
    };

    const result = validateAgentPersona(invalidAgent);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Invalid communication style');
  });

  it('validates analytical approach', () => {
    const invalidAgent = {
      ...validAgent,
      personality: {
        ...validAgent.personality,
        approach: 'invalid' as any
      }
    };

    const result = validateAgentPersona(invalidAgent);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Invalid analytical approach');
  });

  it('requires backstory', () => {
    const invalidAgent = {
      ...validAgent,
      personality: {
        ...validAgent.personality,
        backstory: ''
      }
    };

    const result = validateAgentPersona(invalidAgent);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Backstory is required and must be a non-empty string');
  });

  it('requires key phrase', () => {
    const invalidAgent = {
      ...validAgent,
      personality: {
        ...validAgent.personality,
        keyPhrase: ''
      }
    };

    const result = validateAgentPersona(invalidAgent);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Key phrase is required and must be a non-empty string');
  });

  it('requires at least one strength area', () => {
    const invalidAgent = {
      ...validAgent,
      personality: {
        ...validAgent.personality,
        strengthAreas: []
      }
    };

    const result = validateAgentPersona(invalidAgent);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('At least one strength area is required');
  });

  it('requires performance metrics', () => {
    const invalidAgent = { ...validAgent };
    delete (invalidAgent as any).performance;

    const result = validateAgentPersona(invalidAgent);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Performance metrics are required');
  });

  it('validates confidence score range', () => {
    const invalidAgent = {
      ...validAgent,
      performance: {
        ...validAgent.performance,
        avgConfidenceScore: 1.5
      }
    };

    const result = validateAgentPersona(invalidAgent);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Average confidence score must be between 0 and 1');
  });

  it('validates success rate range', () => {
    const invalidAgent = {
      ...validAgent,
      performance: {
        ...validAgent.performance,
        successRate: 1.1
      }
    };

    const result = validateAgentPersona(invalidAgent);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Success rate must be between 0 and 1');
  });

  it('validates client satisfaction score range when provided', () => {
    const invalidAgent = {
      ...validAgent,
      performance: {
        ...validAgent.performance,
        clientSatisfactionScore: 6
      }
    };

    const result = validateAgentPersona(invalidAgent);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Client satisfaction score must be between 0 and 5');
  });

  it('validates agent status', () => {
    const invalidAgent = {
      ...validAgent,
      status: 'invalid' as any
    };

    const result = validateAgentPersona(invalidAgent);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Invalid agent status');
  });
});

describe('validateAgentPersonaId', () => {
  it('validates correct agent ID format', () => {
    expect(validateAgentPersonaId('strategic-alignment')).toBe(true);
    expect(validateAgentPersonaId('financial-management')).toBe(true);
    expect(validateAgentPersonaId('test123')).toBe(true);
  });

  it('rejects invalid agent ID formats', () => {
    expect(validateAgentPersonaId('')).toBe(false);
    expect(validateAgentPersonaId('Strategic Alignment')).toBe(false);
    expect(validateAgentPersonaId('strategic_alignment')).toBe(false);
    expect(validateAgentPersonaId('strategic@alignment')).toBe(false);
  });
});

describe('validateAgentPersonaStatus', () => {
  it('validates correct status values', () => {
    expect(validateAgentPersonaStatus('available')).toBe(true);
    expect(validateAgentPersonaStatus('analyzing')).toBe(true);
    expect(validateAgentPersonaStatus('completed')).toBe(true);
    expect(validateAgentPersonaStatus('offline')).toBe(true);
    expect(validateAgentPersonaStatus('maintenance')).toBe(true);
  });

  it('rejects invalid status values', () => {
    expect(validateAgentPersonaStatus('invalid')).toBe(false);
    expect(validateAgentPersonaStatus('running')).toBe(false);
    expect(validateAgentPersonaStatus('')).toBe(false);
  });
});

describe('sanitizeAgentPersonaInput', () => {
  it('sanitizes agent ID to valid format', () => {
    const result = sanitizeAgentPersonaInput({
      id: 'Strategic Alignment @#$',
      name: 'Dr. Alexandra Chen',
      title: 'Strategic Consultant'
    });

    expect(result.id).toBe('strategic-alignment----');
  });

  it('trims whitespace from name and title', () => {
    const result = sanitizeAgentPersonaInput({
      id: 'test',
      name: '  Dr. Alexandra Chen  ',
      title: '  Strategic Consultant  '
    });

    expect(result.name).toBe('Dr. Alexandra Chen');
    expect(result.title).toBe('Strategic Consultant');
  });

  it('filters and validates domain expertise arrays', () => {
    const result = sanitizeAgentPersonaInput({
      domainExpertise: {
        primaryDomains: ['valid-domain', '', 'another-domain'],
        industrySpecializations: ['tech', '', 'finance'],
        regulatoryExpertise: ['GDPR', '', 'SOX'],
        yearsExperience: 15.7
      }
    });

    expect(result.domainExpertise?.primaryDomains).toEqual(['valid-domain', 'another-domain']);
    expect(result.domainExpertise?.industrySpecializations).toEqual(['tech', 'finance']);
    expect(result.domainExpertise?.regulatoryExpertise).toEqual(['GDPR', 'SOX']);
    expect(result.domainExpertise?.yearsExperience).toBe(15);
  });

  it('handles negative years of experience', () => {
    const result = sanitizeAgentPersonaInput({
      domainExpertise: {
        yearsExperience: -5
      }
    });

    expect(result.domainExpertise?.yearsExperience).toBe(0);
  });

  it('filters out empty certification and specialization strings', () => {
    const result = sanitizeAgentPersonaInput({
      domainExpertise: {
        certifications: ['CPA', '', 'MBA'],
        specializations: ['Financial planning', '', 'Risk management']
      }
    });

    expect(result.domainExpertise?.certifications).toEqual(['CPA', 'MBA']);
    expect(result.domainExpertise?.specializations).toEqual(['Financial planning', 'Risk management']);
  });
});