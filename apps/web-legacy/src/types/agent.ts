export interface Agent {
  id: string;
  name: string;
  type: AgentType;
  capabilities: string[];
  status: AgentStatus;
  configuration: AgentConfiguration;
  createdAt: string;
  updatedAt: string;
}

export interface AgentPersona {
  id: string;
  name: string;
  title: string;
  domainExpertise: DomainExpertise;
  personality: PersonalityProfile;
  performance: PerformanceMetrics;
  avatar?: string;
  status: AgentPersonaStatus;
  createdAt: string;
  updatedAt: string;
}

export interface DomainExpertise {
  primaryDomains: string[];
  industrySpecializations: string[];
  regulatoryExpertise: string[];
  yearsExperience: number;
  certifications?: string[];
  specializations?: string[];
}

export interface PersonalityProfile {
  communicationStyle: CommunicationStyle;
  approach: AnalyticalApproach;
  backstory: string;
  keyPhrase: string;
  professionalBackground: string;
  strengthAreas: string[];
}

export interface PerformanceMetrics {
  assessmentsCompleted: number;
  avgConfidenceScore: number;
  avgProcessingTimeMs: number;
  successRate: number;
  clientSatisfactionScore?: number;
}

export type CommunicationStyle =
  | 'analytical'
  | 'collaborative'
  | 'direct'
  | 'consultative'
  | 'technical'
  | 'strategic';

export type AnalyticalApproach =
  | 'data-driven'
  | 'systems-thinking'
  | 'process-focused'
  | 'customer-centric'
  | 'risk-aware'
  | 'innovation-focused';

export type AgentPersonaStatus =
  | 'available'
  | 'analyzing'
  | 'completed'
  | 'offline'
  | 'maintenance';

export type DomainType =
  | 'strategic-alignment'
  | 'financial-management'
  | 'revenue-engine'
  | 'operational-excellence'
  | 'people-organization'
  | 'technology-data'
  | 'customer-experience'
  | 'supply-chain'
  | 'risk-compliance'
  | 'partnerships'
  | 'customer-success'
  | 'change-management';

export type AgentType =
  | 'assessment'
  | 'analysis'
  | 'recommendation'
  | 'monitoring'
  | 'domain-expert';

export type AgentStatus =
  | 'active'
  | 'inactive'
  | 'training'
  | 'error';

export interface AgentConfiguration {
  model: string;
  parameters: Record<string, unknown>;
  prompts: AgentPrompt[];
  tools: string[];
}

export interface AgentPrompt {
  id: string;
  name: string;
  content: string;
  variables: string[];
}

export interface AgentExecution {
  id: string;
  agentId: string;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  status: ExecutionStatus;
  startTime: string;
  endTime?: string;
  error?: string;
}

export type ExecutionStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed';

export interface AgentAttribution {
  agentId: string;
  agentName: string;
  analysisType: string;
  contributionLevel: 'primary' | 'supporting' | 'collaborative';
  timestamp: string;
  confidence: number;
}

export interface AgentActivityTimeline {
  agentId: string;
  activity: string;
  status: AgentPersonaStatus;
  timestamp: string;
  metadata?: Record<string, unknown>;
}