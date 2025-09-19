import { randomUUID } from 'crypto';

import { logger } from '../utils/logger';
import { Monitoring } from '../utils/monitoring';

import { db } from './database';

export interface AuditEvent {
  eventId: string;
  eventType: string;
  category: 'AUTHENTICATION' | 'AUTHORIZATION' | 'SESSION' | 'USER_ACTION' | 'SECURITY' | 'DATA_ACCESS' | 'SYSTEM';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  actor: {
    userId?: string;
    sessionId?: string;
    ipAddress?: string;
    userAgent?: string;
    email?: string;
    role?: string;
  };
  target?: {
    type: string;
    id: string;
    name?: string;
  };
  action: string;
  outcome: 'SUCCESS' | 'FAILURE' | 'PARTIAL';
  details: Record<string, any>;
  context: {
    requestId?: string;
    timestamp: string;
    source: string;
    correlationId?: string;
  };
  metadata?: {
    riskScore?: number;
    complianceFlags?: string[];
    retention?: number; // Days to retain this event
  };
}

export interface AuditSearchOptions {
  userId?: string;
  eventType?: string;
  category?: string;
  severity?: string;
  outcome?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  lastEvaluatedKey?: any;
}

export interface SecurityAnalytics {
  suspiciousActivity: Array<{
    type: string;
    count: number;
    firstSeen: string;
    lastSeen: string;
    severity: string;
  }>;
  loginPatterns: {
    successRate: number;
    uniqueIPs: number;
    uniqueDevices: number;
    timeRange: string;
  };
  riskMetrics: {
    highRiskEvents: number;
    securityViolations: number;
    complianceIssues: number;
  };
}

export class AuditLogger {
  private readonly CORRELATION_ID_HEADER = 'x-correlation-id';
  private readonly DEFAULT_RETENTION_DAYS = 2555; // 7 years for compliance

  /**
   * Log an audit event
   */
  async logEvent(eventData: Partial<AuditEvent>): Promise<string> {
    const eventId = randomUUID();
    const timestamp = new Date().toISOString();

    const auditEvent: AuditEvent = {
      eventId,
      eventType: eventData.eventType || 'UNKNOWN',
      category: eventData.category || 'SYSTEM',
      severity: eventData.severity || 'LOW',
      actor: eventData.actor || {},
      target: eventData.target,
      action: eventData.action || 'UNKNOWN',
      outcome: eventData.outcome || 'SUCCESS',
      details: eventData.details || {},
      context: {
        timestamp,
        source: eventData.context?.source || 'api',
        requestId: eventData.context?.requestId,
        correlationId: eventData.context?.correlationId || this.generateCorrelationId()
      },
      metadata: {
        retention: this.DEFAULT_RETENTION_DAYS,
        riskScore: this.calculateRiskScore(eventData),
        complianceFlags: this.getComplianceFlags(eventData),
        ...eventData.metadata
      }
    };

    try {
      // Store in DynamoDB
      await this.storeAuditEvent(auditEvent);

      // Log to application logger for immediate monitoring
      this.logToAppLogger(auditEvent);

      // Trigger real-time security monitoring if high severity
      if (auditEvent.severity === 'HIGH' || auditEvent.severity === 'CRITICAL') {
        await this.triggerSecurityAlert(auditEvent);
      }

      // Update metrics
      Monitoring.incrementCounter('AuditEventsLogged', {
        category: auditEvent.category,
        severity: auditEvent.severity,
        outcome: auditEvent.outcome
      });

      return eventId;

    } catch (error) {
      logger.error('Failed to log audit event', {
        eventId,
        error: (error as Error).message,
        eventType: auditEvent.eventType
      });

      Monitoring.recordError('audit-logger', 'LogEventError', error as Error);
      throw error;
    }
  }

  /**
   * Log authentication event
   */
  async logAuthEvent(options: {
    eventType: 'LOGIN' | 'LOGOUT' | 'LOGIN_FAILED' | 'TOKEN_REFRESH' | 'PASSWORD_RESET';
    userId?: string;
    email?: string;
    sessionId?: string;
    ipAddress?: string;
    userAgent?: string;
    outcome: 'SUCCESS' | 'FAILURE';
    details?: Record<string, any>;
    requestId?: string;
  }): Promise<string> {
    return this.logEvent({
      eventType: options.eventType,
      category: 'AUTHENTICATION',
      severity: options.outcome === 'FAILURE' ? 'MEDIUM' : 'LOW',
      actor: {
        userId: options.userId,
        email: options.email,
        sessionId: options.sessionId,
        ipAddress: options.ipAddress,
        userAgent: options.userAgent
      },
      action: options.eventType.toLowerCase(),
      outcome: options.outcome,
      details: options.details || {},
      context: {
        requestId: options.requestId,
        source: 'auth-service',
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Log session event
   */
  async logSessionEvent(options: {
    eventType: 'SESSION_CREATED' | 'SESSION_VALIDATED' | 'SESSION_REVOKED' | 'SESSION_EXPIRED';
    userId: string;
    sessionId: string;
    ipAddress?: string;
    userAgent?: string;
    outcome: 'SUCCESS' | 'FAILURE';
    details?: Record<string, any>;
    requestId?: string;
  }): Promise<string> {
    return this.logEvent({
      eventType: options.eventType,
      category: 'SESSION',
      severity: options.outcome === 'FAILURE' ? 'MEDIUM' : 'LOW',
      actor: {
        userId: options.userId,
        sessionId: options.sessionId,
        ipAddress: options.ipAddress,
        userAgent: options.userAgent
      },
      action: options.eventType.toLowerCase(),
      outcome: options.outcome,
      details: options.details || {},
      context: {
        requestId: options.requestId,
        source: 'session-service',
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Log security event
   */
  async logSecurityEvent(options: {
    eventType: 'RATE_LIMIT_EXCEEDED' | 'BRUTE_FORCE_ATTEMPT' | 'SUSPICIOUS_ACTIVITY' | 'SECURITY_VIOLATION';
    userId?: string;
    sessionId?: string;
    ipAddress?: string;
    userAgent?: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    details: Record<string, any>;
    requestId?: string;
  }): Promise<string> {
    return this.logEvent({
      eventType: options.eventType,
      category: 'SECURITY',
      severity: options.severity,
      actor: {
        userId: options.userId,
        sessionId: options.sessionId,
        ipAddress: options.ipAddress,
        userAgent: options.userAgent
      },
      action: 'security_monitor',
      outcome: 'FAILURE', // Security events typically indicate issues
      details: options.details,
      context: {
        requestId: options.requestId,
        source: 'security-monitor',
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Log data access event
   */
  async logDataAccessEvent(options: {
    eventType: 'DATA_READ' | 'DATA_WRITE' | 'DATA_DELETE' | 'DATA_EXPORT';
    userId: string;
    target: {
      type: string;
      id: string;
      name?: string;
    };
    outcome: 'SUCCESS' | 'FAILURE';
    details?: Record<string, any>;
    requestId?: string;
  }): Promise<string> {
    return this.logEvent({
      eventType: options.eventType,
      category: 'DATA_ACCESS',
      severity: options.eventType === 'DATA_DELETE' || options.eventType === 'DATA_EXPORT' ? 'MEDIUM' : 'LOW',
      actor: {
        userId: options.userId
      },
      target: options.target,
      action: options.eventType.toLowerCase(),
      outcome: options.outcome,
      details: options.details || {},
      context: {
        requestId: options.requestId,
        source: 'data-service',
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Search audit events
   */
  async searchEvents(options: AuditSearchOptions): Promise<{
    events: AuditEvent[];
    lastEvaluatedKey?: any;
    totalCount?: number;
  }> {
    try {
      const limit = Math.min(options.limit || 50, 1000);

      // Build query conditions
      let filterExpression = '';
      const expressionAttributeValues: Record<string, any> = {};
      const conditions: string[] = [];

      if (options.category) {
        conditions.push('category = :category');
        expressionAttributeValues[':category'] = options.category;
      }

      if (options.severity) {
        conditions.push('severity = :severity');
        expressionAttributeValues[':severity'] = options.severity;
      }

      if (options.outcome) {
        conditions.push('outcome = :outcome');
        expressionAttributeValues[':outcome'] = options.outcome;
      }

      if (options.startDate) {
        conditions.push('#timestamp >= :startDate');
        expressionAttributeValues[':startDate'] = options.startDate.toISOString();
      }

      if (options.endDate) {
        conditions.push('#timestamp <= :endDate');
        expressionAttributeValues[':endDate'] = options.endDate.toISOString();
      }

      if (conditions.length > 0) {
        filterExpression = conditions.join(' AND ');
      }

      const queryOptions: any = {
        limit,
        scanIndexForward: false // Most recent first
      };

      if (filterExpression) {
        queryOptions.filterExpression = filterExpression;
        queryOptions.expressionAttributeValues = expressionAttributeValues;
      }

      if (filterExpression.includes('#timestamp')) {
        queryOptions.expressionAttributeNames = { '#timestamp': 'timestamp' };
      }

      if (options.lastEvaluatedKey) {
        queryOptions.exclusiveStartKey = options.lastEvaluatedKey;
      }

      let events: AuditEvent[] = [];

      if (options.userId) {
        // Query by user ID using GSI
        const queryResults = await db.query(
          'GSI1PK = :userKey',
          { ':userKey': `USER#${options.userId}` },
          { ...queryOptions, indexName: 'GSI1' }
        );
        events = queryResults as unknown as AuditEvent[];
      } else {
        // For now, return empty array for non-user queries
        // TODO: Implement global event querying if needed
        events = [];
      }

      return {
        events,
        lastEvaluatedKey: queryOptions.lastEvaluatedKey
      };

    } catch (error) {
      logger.error('Failed to search audit events', {
        error: (error as Error).message,
        options
      });
      throw error;
    }
  }

  /**
   * Get security analytics
   */
  async getSecurityAnalytics(userId?: string, timeRange: string = '24h'): Promise<SecurityAnalytics> {
    try {
      const endDate = new Date();
      const startDate = new Date();

      // Calculate start date based on time range
      switch (timeRange) {
        case '1h':
          startDate.setHours(startDate.getHours() - 1);
          break;
        case '24h':
          startDate.setDate(startDate.getDate() - 1);
          break;
        case '7d':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(startDate.getDate() - 30);
          break;
        default:
          startDate.setDate(startDate.getDate() - 1);
      }

      const searchOptions: AuditSearchOptions = {
        startDate,
        endDate,
        limit: 1000
      };

      if (userId) {
        searchOptions.userId = userId;
      }

      const { events } = await this.searchEvents(searchOptions);

      // Analyze events
      const suspiciousActivity = this.analyzeSuspiciousActivity(events);
      const loginPatterns = this.analyzeLoginPatterns(events);
      const riskMetrics = this.calculateRiskMetrics(events);

      return {
        suspiciousActivity,
        loginPatterns,
        riskMetrics
      };

    } catch (error) {
      logger.error('Failed to get security analytics', {
        error: (error as Error).message,
        userId,
        timeRange
      });
      throw error;
    }
  }

  /**
   * Store audit event in DynamoDB
   */
  private async storeAuditEvent(event: AuditEvent): Promise<void> {
    const ttl = Math.floor(Date.now() / 1000) + (event.metadata!.retention! * 24 * 60 * 60);

    const record = {
      PK: `AUDIT#${event.eventId}`,
      SK: 'EVENT',
      GSI1PK: event.actor.userId ? `USER#${event.actor.userId}` : 'SYSTEM',
      GSI1SK: `EVENT#${event.context.timestamp}`,
      GSI2PK: `CATEGORY#${event.category}`,
      GSI2SK: `SEVERITY#${event.severity}#${event.context.timestamp}`,
      ...event,
      TTL: ttl
    };

    await db.put(record);
  }

  /**
   * Log to application logger for immediate monitoring
   */
  private logToAppLogger(event: AuditEvent): void {
    const logLevel = this.getLogLevel(event.severity);
    const logData = {
      auditEventId: event.eventId,
      eventType: event.eventType,
      category: event.category,
      severity: event.severity,
      actor: event.actor,
      action: event.action,
      outcome: event.outcome,
      correlationId: event.context.correlationId,
      requestId: event.context.requestId
    };

    switch (logLevel) {
      case 'error':
        logger.error(`Audit: ${event.eventType}`, logData);
        break;
      case 'warn':
        logger.warn(`Audit: ${event.eventType}`, logData);
        break;
      case 'info':
        logger.info(`Audit: ${event.eventType}`, logData);
        break;
      default:
        logger.debug(`Audit: ${event.eventType}`, logData);
    }
  }

  /**
   * Trigger security alert for high-severity events
   */
  private async triggerSecurityAlert(event: AuditEvent): Promise<void> {
    try {
      // Log critical security event
      logger.error('SECURITY ALERT', {
        eventId: event.eventId,
        eventType: event.eventType,
        severity: event.severity,
        actor: event.actor,
        details: event.details
      });

      // Send monitoring alert
      Monitoring.incrementCounter('SecurityAlerts', {
        eventType: event.eventType,
        severity: event.severity
      });

      // TODO: Integrate with alerting system (SNS, PagerDuty, etc.)

    } catch (error) {
      logger.error('Failed to trigger security alert', {
        eventId: event.eventId,
        error: (error as Error).message
      });
    }
  }

  private calculateRiskScore(eventData: Partial<AuditEvent>): number {
    let score = 0;

    // Base score by category
    const categoryScores = {
      'SECURITY': 80,
      'AUTHENTICATION': 40,
      'SESSION': 30,
      'DATA_ACCESS': 50,
      'AUTHORIZATION': 60,
      'USER_ACTION': 20,
      'SYSTEM': 10
    };

    score += categoryScores[eventData.category || 'SYSTEM'] || 0;

    // Severity multiplier
    const severityMultipliers = {
      'CRITICAL': 2.0,
      'HIGH': 1.5,
      'MEDIUM': 1.0,
      'LOW': 0.5
    };

    score *= severityMultipliers[eventData.severity || 'LOW'] || 1.0;

    // Outcome modifier
    if (eventData.outcome === 'FAILURE') {
      score *= 1.3;
    }

    return Math.min(Math.round(score), 100);
  }

  private getComplianceFlags(eventData: Partial<AuditEvent>): string[] {
    const flags: string[] = [];

    // GDPR compliance
    if (eventData.category === 'DATA_ACCESS' || eventData.eventType?.includes('EXPORT')) {
      flags.push('GDPR');
    }

    // SOX compliance for financial data
    if (eventData.target?.type === 'financial_data') {
      flags.push('SOX');
    }

    // HIPAA compliance for health data
    if (eventData.target?.type === 'health_data') {
      flags.push('HIPAA');
    }

    return flags;
  }

  private generateCorrelationId(): string {
    return randomUUID().substring(0, 8);
  }

  private getLogLevel(severity: string): string {
    switch (severity) {
      case 'CRITICAL':
      case 'HIGH':
        return 'error';
      case 'MEDIUM':
        return 'warn';
      case 'LOW':
        return 'info';
      default:
        return 'debug';
    }
  }

  private analyzeSuspiciousActivity(events: AuditEvent[]): Array<{
    type: string;
    count: number;
    firstSeen: string;
    lastSeen: string;
    severity: string;
  }> {
    const suspiciousTypes = events
      .filter(e => e.category === 'SECURITY' || e.outcome === 'FAILURE')
      .reduce((acc, event) => {
        const key = event.eventType;
        if (!acc[key]) {
          acc[key] = {
            count: 0,
            firstSeen: event.context.timestamp,
            lastSeen: event.context.timestamp,
            severity: event.severity
          };
        }
        acc[key].count++;
        if (event.context.timestamp > acc[key].lastSeen) {
          acc[key].lastSeen = event.context.timestamp;
        }
        if (event.context.timestamp < acc[key].firstSeen) {
          acc[key].firstSeen = event.context.timestamp;
        }
        return acc;
      }, {} as Record<string, any>);

    return Object.entries(suspiciousTypes).map(([type, data]) => ({
      type,
      ...data
    }));
  }

  private analyzeLoginPatterns(events: AuditEvent[]): {
    successRate: number;
    uniqueIPs: number;
    uniqueDevices: number;
    timeRange: string;
  } {
    const loginEvents = events.filter(e =>
      e.eventType === 'LOGIN' || e.eventType === 'LOGIN_FAILED'
    );

    const successful = loginEvents.filter(e => e.outcome === 'SUCCESS').length;
    const total = loginEvents.length;
    const successRate = total > 0 ? (successful / total) * 100 : 0;

    const uniqueIPs = new Set(loginEvents.map(e => e.actor.ipAddress)).size;
    const uniqueDevices = new Set(loginEvents.map(e => e.actor.userAgent)).size;

    return {
      successRate: Math.round(successRate * 100) / 100,
      uniqueIPs,
      uniqueDevices,
      timeRange: '24h'
    };
  }

  private calculateRiskMetrics(events: AuditEvent[]): {
    highRiskEvents: number;
    securityViolations: number;
    complianceIssues: number;
  } {
    const highRiskEvents = events.filter(e =>
      e.severity === 'HIGH' || e.severity === 'CRITICAL'
    ).length;

    const securityViolations = events.filter(e =>
      e.category === 'SECURITY' && e.outcome === 'FAILURE'
    ).length;

    const complianceIssues = events.filter(e =>
      e.metadata?.complianceFlags && e.metadata.complianceFlags.length > 0
    ).length;

    return {
      highRiskEvents,
      securityViolations,
      complianceIssues
    };
  }
}

// Default audit logger instance
export const auditLogger = new AuditLogger();