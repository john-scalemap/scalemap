import { AgentPersona, AgentAttribution, AgentActivityTimeline, DomainType } from '../types/agent';

export interface AgentCoordinationConfig {
  maxConcurrentAgents: number;
  collaborationThreshold: number;
  confidenceWeighting: Record<string, number>;
}

export const DEFAULT_COORDINATION_CONFIG: AgentCoordinationConfig = {
  maxConcurrentAgents: 5,
  collaborationThreshold: 0.7,
  confidenceWeighting: {
    primary: 1.0,
    supporting: 0.6,
    collaborative: 0.4
  }
};

export class AgentCoordinationManager {
  private config: AgentCoordinationConfig;

  constructor(config: AgentCoordinationConfig = DEFAULT_COORDINATION_CONFIG) {
    this.config = config;
  }

  /**
   * Determines which agents should be activated for a given assessment
   */
  selectAgentsForAssessment(
    availableAgents: AgentPersona[],
    requiredDomains: DomainType[],
    industryContext?: string
  ): AgentPersona[] {
    const selectedAgents: AgentPersona[] = [];
    const usedDomains = new Set<string>();

    // First pass: Select primary domain experts
    for (const domain of requiredDomains) {
      const domainExpert = availableAgents.find(agent =>
        agent.domainExpertise.primaryDomains.includes(domain) &&
        agent.status === 'available'
      );

      if (domainExpert && !selectedAgents.includes(domainExpert)) {
        selectedAgents.push(domainExpert);
        usedDomains.add(domain);
      }
    }

    // Second pass: Add industry specialists if relevant
    if (industryContext) {
      const industrySpecialists = availableAgents.filter(agent =>
        agent.domainExpertise.industrySpecializations.includes(industryContext) &&
        agent.status === 'available' &&
        !selectedAgents.includes(agent)
      );

      // Sort by performance metrics and add top performers
      industrySpecialists
        .sort((a, b) => b.performance.avgConfidenceScore - a.performance.avgConfidenceScore)
        .slice(0, Math.max(0, this.config.maxConcurrentAgents - selectedAgents.length))
        .forEach(agent => selectedAgents.push(agent));
    }

    // Third pass: Fill remaining slots with high-performing generalists
    if (selectedAgents.length < this.config.maxConcurrentAgents) {
      const remainingAgents = availableAgents.filter(agent =>
        agent.status === 'available' &&
        !selectedAgents.includes(agent)
      );

      remainingAgents
        .sort((a, b) => {
          const scoreA = a.performance.avgConfidenceScore * a.performance.successRate;
          const scoreB = b.performance.avgConfidenceScore * b.performance.successRate;
          return scoreB - scoreA;
        })
        .slice(0, this.config.maxConcurrentAgents - selectedAgents.length)
        .forEach(agent => selectedAgents.push(agent));
    }

    return selectedAgents.slice(0, this.config.maxConcurrentAgents);
  }

  /**
   * Creates attribution records for analysis results
   */
  createAttribution(
    agentId: string,
    agentName: string,
    analysisType: string,
    contributionLevel: 'primary' | 'supporting' | 'collaborative' = 'primary',
    confidence: number = 1.0
  ): AgentAttribution {
    return {
      agentId,
      agentName,
      analysisType,
      contributionLevel,
      timestamp: new Date().toISOString(),
      confidence: Math.max(0, Math.min(1, confidence))
    };
  }

  /**
   * Calculates collaboration scores between agents
   */
  calculateCollaborationScore(attributions: AgentAttribution[]): number {
    if (attributions.length <= 1) {
      return 0;
    }

    const totalWeight = attributions.reduce((sum, attr) => {
      return sum + (this.config.confidenceWeighting[attr.contributionLevel] || 0);
    }, 0);

    const avgWeight = totalWeight / attributions.length;
    return Math.min(1, avgWeight / this.config.collaborationThreshold);
  }

  /**
   * Determines if agents should collaborate based on domain overlap
   */
  shouldCollaborate(agent1: AgentPersona, agent2: AgentPersona): boolean {
    const domains1 = new Set(agent1.domainExpertise.primaryDomains);
    const domains2 = new Set(agent2.domainExpertise.primaryDomains);
    const industries1 = new Set(agent1.domainExpertise.industrySpecializations);
    const industries2 = new Set(agent2.domainExpertise.industrySpecializations);

    // Check for domain overlap
    const domainOverlap = [...domains1].some((domain: string) => domains2.has(domain));

    // Check for industry overlap
    const industryOverlap = [...industries1].some((industry: string) => industries2.has(industry));

    // Check for complementary domains (e.g., strategy + finance, operations + technology)
    const complementaryPairs = [
      ['strategic-alignment', 'financial-management'],
      ['revenue-engine', 'customer-experience'],
      ['operational-excellence', 'technology-data'],
      ['people-organization', 'change-management'],
      ['risk-compliance', 'financial-management'],
      ['partnerships', 'customer-success']
    ];

    const hasComplementaryDomains = complementaryPairs.some((pair) => {
      const [domain1, domain2] = pair;
      return (domain1 && domain2 &&
              ((domains1.has(domain1) && domains2.has(domain2)) ||
               (domains1.has(domain2) && domains2.has(domain1))));
    });

    return domainOverlap || industryOverlap || hasComplementaryDomains;
  }

  /**
   * Creates activity timeline entries
   */
  createActivityEntry(
    agentId: string,
    activity: string,
    status: AgentPersona['status'],
    metadata?: Record<string, unknown>
  ): AgentActivityTimeline {
    return {
      agentId,
      activity,
      status,
      timestamp: new Date().toISOString(),
      metadata
    };
  }

  /**
   * Groups attributions by analysis type
   */
  groupAttributionsByAnalysis(attributions: AgentAttribution[]): Record<string, AgentAttribution[]> {
    return attributions.reduce((groups, attribution) => {
      const key = attribution.analysisType;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(attribution);
      return groups;
    }, {} as Record<string, AgentAttribution[]>);
  }

  /**
   * Calculates the lead agent for a set of attributions
   */
  getLeadAgent(attributions: AgentAttribution[]): AgentAttribution | null {
    if (attributions.length === 0) {
      return null;
    }

    // Sort by contribution level priority, then by confidence
    const priorityOrder = { primary: 1, supporting: 2, collaborative: 3 };

    return attributions.sort((a, b) => {
      const priorityDiff = priorityOrder[a.contributionLevel] - priorityOrder[b.contributionLevel];
      if (priorityDiff !== 0) {
        return priorityDiff;
      }
      return b.confidence - a.confidence;
    })[0] || null;
  }

  /**
   * Validates attribution data
   */
  validateAttribution(attribution: Partial<AgentAttribution>): boolean {
    return !!(
      attribution.agentId &&
      attribution.agentName &&
      attribution.analysisType &&
      attribution.contributionLevel &&
      attribution.timestamp &&
      typeof attribution.confidence === 'number' &&
      attribution.confidence >= 0 &&
      attribution.confidence <= 1
    );
  }
}

export const agentCoordinationManager = new AgentCoordinationManager();