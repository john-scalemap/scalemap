import { AgentPersona, AgentPersonaStatus, CommunicationStyle, AnalyticalApproach } from '../types/agent';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export const validateAgentPersona = (persona: Partial<AgentPersona>): ValidationResult => {
  const errors: string[] = [];

  // Required fields validation
  if (!persona.id || typeof persona.id !== 'string' || persona.id.trim() === '') {
    errors.push('Agent ID is required and must be a non-empty string');
  }

  if (!persona.name || typeof persona.name !== 'string' || persona.name.trim() === '') {
    errors.push('Agent name is required and must be a non-empty string');
  }

  if (!persona.title || typeof persona.title !== 'string' || persona.title.trim() === '') {
    errors.push('Agent title is required and must be a non-empty string');
  }

  // Domain expertise validation
  if (!persona.domainExpertise) {
    errors.push('Domain expertise is required');
  } else {
    if (!Array.isArray(persona.domainExpertise.primaryDomains) || persona.domainExpertise.primaryDomains.length === 0) {
      errors.push('At least one primary domain is required');
    }

    if (!Array.isArray(persona.domainExpertise.industrySpecializations)) {
      errors.push('Industry specializations must be an array');
    }

    if (!Array.isArray(persona.domainExpertise.regulatoryExpertise)) {
      errors.push('Regulatory expertise must be an array');
    }

    if (typeof persona.domainExpertise.yearsExperience !== 'number' || persona.domainExpertise.yearsExperience < 0) {
      errors.push('Years of experience must be a non-negative number');
    }
  }

  // Personality validation
  if (!persona.personality) {
    errors.push('Personality profile is required');
  } else {
    const validCommunicationStyles: CommunicationStyle[] = ['analytical', 'collaborative', 'direct', 'consultative', 'technical', 'strategic'];
    if (!validCommunicationStyles.includes(persona.personality.communicationStyle as CommunicationStyle)) {
      errors.push('Invalid communication style');
    }

    const validApproaches: AnalyticalApproach[] = ['data-driven', 'systems-thinking', 'process-focused', 'customer-centric', 'risk-aware', 'innovation-focused'];
    if (!validApproaches.includes(persona.personality.approach as AnalyticalApproach)) {
      errors.push('Invalid analytical approach');
    }

    if (!persona.personality.backstory || typeof persona.personality.backstory !== 'string' || persona.personality.backstory.trim() === '') {
      errors.push('Backstory is required and must be a non-empty string');
    }

    if (!persona.personality.keyPhrase || typeof persona.personality.keyPhrase !== 'string' || persona.personality.keyPhrase.trim() === '') {
      errors.push('Key phrase is required and must be a non-empty string');
    }

    if (!Array.isArray(persona.personality.strengthAreas) || persona.personality.strengthAreas.length === 0) {
      errors.push('At least one strength area is required');
    }
  }

  // Performance validation
  if (!persona.performance) {
    errors.push('Performance metrics are required');
  } else {
    if (typeof persona.performance.assessmentsCompleted !== 'number' || persona.performance.assessmentsCompleted < 0) {
      errors.push('Assessments completed must be a non-negative number');
    }

    if (typeof persona.performance.avgConfidenceScore !== 'number' ||
        persona.performance.avgConfidenceScore < 0 ||
        persona.performance.avgConfidenceScore > 1) {
      errors.push('Average confidence score must be between 0 and 1');
    }

    if (typeof persona.performance.avgProcessingTimeMs !== 'number' || persona.performance.avgProcessingTimeMs < 0) {
      errors.push('Average processing time must be a non-negative number');
    }

    if (typeof persona.performance.successRate !== 'number' ||
        persona.performance.successRate < 0 ||
        persona.performance.successRate > 1) {
      errors.push('Success rate must be between 0 and 1');
    }

    if (persona.performance.clientSatisfactionScore !== undefined &&
        (typeof persona.performance.clientSatisfactionScore !== 'number' ||
         persona.performance.clientSatisfactionScore < 0 ||
         persona.performance.clientSatisfactionScore > 5)) {
      errors.push('Client satisfaction score must be between 0 and 5');
    }
  }

  // Status validation
  const validStatuses: AgentPersonaStatus[] = ['available', 'analyzing', 'completed', 'offline', 'maintenance'];
  if (!validStatuses.includes(persona.status as AgentPersonaStatus)) {
    errors.push('Invalid agent status');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

export const validateAgentPersonaId = (id: string): boolean => {
  return typeof id === 'string' && id.trim() !== '' && /^[a-z0-9-]+$/.test(id);
};

export const validateAgentPersonaStatus = (status: string): status is AgentPersonaStatus => {
  const validStatuses: AgentPersonaStatus[] = ['available', 'analyzing', 'completed', 'offline', 'maintenance'];
  return validStatuses.includes(status as AgentPersonaStatus);
};

export const sanitizeAgentPersonaInput = (input: any): Partial<AgentPersona> => {
  const sanitized: Partial<AgentPersona> = {};

  if (typeof input.id === 'string') {
    sanitized.id = input.id.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
  }

  if (typeof input.name === 'string') {
    sanitized.name = input.name.trim();
  }

  if (typeof input.title === 'string') {
    sanitized.title = input.title.trim();
  }

  if (input.domainExpertise && typeof input.domainExpertise === 'object') {
    sanitized.domainExpertise = {
      primaryDomains: Array.isArray(input.domainExpertise.primaryDomains) ?
        input.domainExpertise.primaryDomains.filter((d: any) => typeof d === 'string' && d.trim() !== '') : [],
      industrySpecializations: Array.isArray(input.domainExpertise.industrySpecializations) ?
        input.domainExpertise.industrySpecializations.filter((i: any) => typeof i === 'string' && i.trim() !== '') : [],
      regulatoryExpertise: Array.isArray(input.domainExpertise.regulatoryExpertise) ?
        input.domainExpertise.regulatoryExpertise.filter((r: any) => typeof r === 'string' && r.trim() !== '') : [],
      yearsExperience: typeof input.domainExpertise.yearsExperience === 'number' ?
        Math.max(0, Math.floor(input.domainExpertise.yearsExperience)) : 0,
      certifications: Array.isArray(input.domainExpertise.certifications) ?
        input.domainExpertise.certifications.filter((c: any) => typeof c === 'string' && c.trim() !== '') : undefined,
      specializations: Array.isArray(input.domainExpertise.specializations) ?
        input.domainExpertise.specializations.filter((s: any) => typeof s === 'string' && s.trim() !== '') : undefined
    };
  }

  return sanitized;
};