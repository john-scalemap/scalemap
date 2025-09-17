import { AgentPersona, AgentPersonaStatus, AGENT_PERSONAS } from '@scalemap/shared';

import { logger } from '../utils/logger';
import { Monitoring, withTiming } from '../utils/monitoring';

import { DatabaseService } from './database';

export class AgentService {
  private db: DatabaseService;

  constructor(tableName?: string) {
    this.db = new DatabaseService(tableName);
  }

  /**
   * Get all agent personas
   */
  async getAllAgents(): Promise<AgentPersona[]> {
    return withTiming(
      async () => {
        try {
          // For now, return the static agent personas
          // In the future, this could be enhanced to fetch from DynamoDB for dynamic updates
          logger.info('Retrieving all agent personas');
          Monitoring.incrementCounter('AgentPersonasRetrieved');

          return AGENT_PERSONAS.map(agent => ({
            ...agent,
            // Ensure we have fresh timestamps if needed
            updatedAt: agent.updatedAt || new Date().toISOString()
          }));
        } catch (error) {
          logger.error('Failed to retrieve agent personas', { error: (error as Error).message });
          Monitoring.recordError('agent-service', 'GetAllAgentsError', error as Error);
          throw new Error('Failed to retrieve agent personas');
        }
      },
      'AgentServiceGetAllLatency'
    );
  }

  /**
   * Get a specific agent persona by ID
   */
  async getAgentById(agentId: string): Promise<AgentPersona | null> {
    return withTiming(
      async () => {
        try {
          logger.info('Retrieving agent persona', { agentId });

          const agent = AGENT_PERSONAS.find(a => a.id === agentId);

          if (agent) {
            Monitoring.incrementCounter('AgentPersonaRetrieved', { agentId });
          } else {
            Monitoring.incrementCounter('AgentPersonaNotFound', { agentId });
          }

          return agent || null;
        } catch (error) {
          logger.error('Failed to retrieve agent persona', { agentId, error: (error as Error).message });
          Monitoring.recordError('agent-service', 'GetAgentByIdError', error as Error);
          throw new Error(`Failed to retrieve agent persona: ${agentId}`);
        }
      },
      'AgentServiceGetByIdLatency',
      { agentId }
    );
  }

  /**
   * Get agents by domain
   */
  async getAgentsByDomain(domain: string): Promise<AgentPersona[]> {
    return withTiming(
      async () => {
        try {
          logger.info('Retrieving agents by domain', { domain });

          const agents = AGENT_PERSONAS.filter(agent =>
            agent.domainExpertise.primaryDomains.includes(domain)
          );

          Monitoring.incrementCounter('AgentsByDomainRetrieved', { domain, count: agents.length.toString() });

          return agents;
        } catch (error) {
          logger.error('Failed to retrieve agents by domain', { domain, error: (error as Error).message });
          Monitoring.recordError('agent-service', 'GetAgentsByDomainError', error as Error);
          throw new Error(`Failed to retrieve agents for domain: ${domain}`);
        }
      },
      'AgentServiceGetByDomainLatency',
      { domain }
    );
  }

  /**
   * Get agents by industry specialization
   */
  async getAgentsByIndustry(industry: string): Promise<AgentPersona[]> {
    return withTiming(
      async () => {
        try {
          logger.info('Retrieving agents by industry', { industry });

          const agents = AGENT_PERSONAS.filter(agent =>
            agent.domainExpertise.industrySpecializations.includes(industry)
          );

          Monitoring.incrementCounter('AgentsByIndustryRetrieved', { industry, count: agents.length.toString() });

          return agents;
        } catch (error) {
          logger.error('Failed to retrieve agents by industry', { industry, error: (error as Error).message });
          Monitoring.recordError('agent-service', 'GetAgentsByIndustryError', error as Error);
          throw new Error(`Failed to retrieve agents for industry: ${industry}`);
        }
      },
      'AgentServiceGetByIndustryLatency',
      { industry }
    );
  }

  /**
   * Update agent status (for real-time status tracking)
   */
  async updateAgentStatus(agentId: string, status: AgentPersonaStatus, metadata?: Record<string, unknown>): Promise<void> {
    return withTiming(
      async () => {
        try {
          logger.info('Updating agent status', { agentId, status });

          // Store agent status in DynamoDB for real-time tracking
          const statusRecord = {
            PK: `AGENT#${agentId}`,
            SK: 'STATUS',
            agentId,
            status,
            timestamp: new Date().toISOString(),
            metadata: metadata || {},
            ttl: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hour TTL
          };

          await this.db.put(statusRecord);

          Monitoring.incrementCounter('AgentStatusUpdated', { agentId, status });
          logger.info('Agent status updated successfully', { agentId, status });
        } catch (error) {
          logger.error('Failed to update agent status', { agentId, status, error: (error as Error).message });
          Monitoring.recordError('agent-service', 'UpdateAgentStatusError', error as Error);
          throw new Error(`Failed to update agent status: ${agentId}`);
        }
      },
      'AgentServiceUpdateStatusLatency',
      { agentId, status }
    );
  }

  /**
   * Get current agent status from DynamoDB
   */
  async getAgentStatus(agentId: string): Promise<{ status: AgentPersonaStatus; timestamp: string; metadata?: Record<string, unknown> } | null> {
    return withTiming(
      async () => {
        try {
          logger.info('Retrieving agent status', { agentId });

          const statusRecord = await this.db.get(`AGENT#${agentId}`, 'STATUS');

          if (statusRecord) {
            Monitoring.incrementCounter('AgentStatusRetrieved', { agentId });
            return {
              status: statusRecord.status as AgentPersonaStatus,
              timestamp: statusRecord.timestamp as string,
              metadata: statusRecord.metadata as Record<string, unknown>
            };
          } else {
            Monitoring.incrementCounter('AgentStatusNotFound', { agentId });
            return null;
          }
        } catch (error) {
          logger.error('Failed to retrieve agent status', { agentId, error: (error as Error).message });
          Monitoring.recordError('agent-service', 'GetAgentStatusError', error as Error);
          throw new Error(`Failed to retrieve agent status: ${agentId}`);
        }
      },
      'AgentServiceGetStatusLatency',
      { agentId }
    );
  }

  /**
   * Store agent assignment for an assessment
   */
  async assignAgentToAssessment(assessmentId: string, agentId: string, role: 'primary' | 'supporting' | 'collaborative'): Promise<void> {
    return withTiming(
      async () => {
        try {
          logger.info('Assigning agent to assessment', { assessmentId, agentId, role });

          const assignmentRecord = {
            PK: `ASSESSMENT#${assessmentId}`,
            SK: `AGENT#${agentId}`,
            GSI1PK: `AGENT#${agentId}`,
            GSI1SK: `ASSESSMENT#${assessmentId}`,
            assessmentId,
            agentId,
            role,
            assignedAt: new Date().toISOString(),
            status: 'assigned'
          };

          await this.db.put(assignmentRecord);

          Monitoring.incrementCounter('AgentAssignedToAssessment', { agentId, role });
          logger.info('Agent assigned to assessment successfully', { assessmentId, agentId, role });
        } catch (error) {
          logger.error('Failed to assign agent to assessment', { assessmentId, agentId, role, error: (error as Error).message });
          Monitoring.recordError('agent-service', 'AssignAgentError', error as Error);
          throw new Error(`Failed to assign agent to assessment: ${agentId}`);
        }
      },
      'AgentServiceAssignLatency',
      { agentId, role }
    );
  }

  /**
   * Get agent assignments for an assessment
   */
  async getAssessmentAgents(assessmentId: string): Promise<Array<{ agentId: string; role: string; assignedAt: string; status: string }>> {
    return withTiming(
      async () => {
        try {
          logger.info('Retrieving assessment agents', { assessmentId });

          const items = await this.db.query(
            'PK = :pk AND begins_with(SK, :sk)',
            {
              ':pk': `ASSESSMENT#${assessmentId}`,
              ':sk': 'AGENT#'
            }
          );

          const assignments = items.map(item => ({
            agentId: item.agentId as string,
            role: item.role as string,
            assignedAt: item.assignedAt as string,
            status: item.status as string
          }));

          Monitoring.incrementCounter('AssessmentAgentsRetrieved', { assessmentId, count: assignments.length.toString() });

          return assignments;
        } catch (error) {
          logger.error('Failed to retrieve assessment agents', { assessmentId, error: (error as Error).message });
          Monitoring.recordError('agent-service', 'GetAssessmentAgentsError', error as Error);
          throw new Error(`Failed to retrieve assessment agents: ${assessmentId}`);
        }
      },
      'AgentServiceGetAssessmentAgentsLatency',
      { assessmentId }
    );
  }
}