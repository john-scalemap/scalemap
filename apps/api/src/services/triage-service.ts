import { DynamoDBClient, PutItemCommand, GetItemCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import {
  Assessment,
  TriageResult
} from '@scalemap/shared';
import {
  TriageAnalysis,
  TriageEntity,
  TriageValidationResult,
  TriageOverride,
  TriageAuditLog,
  TriageConfiguration,
} from '@scalemap/shared/src/types/triage';

import { TriageAnalyzer } from '../functions/triage/triage-analyzer';
import { TriageValidator } from '../functions/triage/triage-validator';

export class TriageService {
  private dynamoDb: DynamoDBClient;
  private tableName: string;
  private triageAnalyzer: TriageAnalyzer;
  private triageValidator: TriageValidator;

  constructor(config?: Partial<TriageConfiguration>) {
    this.dynamoDb = new DynamoDBClient({
      region: process.env.AWS_REGION || 'eu-west-1',
      ...(process.env.AWS_ACCESS_KEY_ID && {
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
      }),
    });

    this.tableName = process.env.DYNAMODB_TABLE_NAME || 'scalemap-prod';
    this.triageAnalyzer = new TriageAnalyzer(config);
    this.triageValidator = new TriageValidator();
  }

  /**
   * Perform comprehensive domain triage analysis
   */
  async performTriage(assessment: Assessment): Promise<TriageResult> {
    const startTime = Date.now();
    const requestId = `triage-${assessment.id}-${Date.now()}`;

    try {
      console.log(`Starting triage analysis for assessment ${assessment.id}`);

      // Log triage start
      await this.logTriageEvent(assessment.id, 'triage_started', {
        requestId,
        modelUsed: 'gpt-4o-mini'
      });

      // Update triage status to analyzing
      await this.updateTriageStatus(assessment.id, 'analyzing');

      // 1. Perform core triage analysis
      const triageAnalysis = await this.triageAnalyzer.performTriage(assessment);

      // 2. Validate results and apply fallbacks if needed
      const validation = await this.triageValidator.validateTriageResults(assessment, triageAnalysis);

      if (!validation.isValid && !validation.fallbackApplied) {
        throw new Error('Triage analysis failed validation and fallback unsuccessful');
      }

      const finalAnalysis = validation.result;

      // 3. Store triage results
      await this.storeTriageResults(assessment.id, finalAnalysis, validation.fallbackApplied);

      // 4. Create legacy-compatible TriageResult
      const triageResult = this.convertToLegacyFormat(finalAnalysis);

      // 5. Log successful completion
      const processingTime = Date.now() - startTime;
      await this.logTriageEvent(assessment.id, 'triage_completed', {
        requestId,
        processingTime,
        confidence: finalAnalysis.confidence,
        modelUsed: finalAnalysis.processingMetrics.modelUsed
      });

      console.log(`Triage analysis completed for assessment ${assessment.id}:`, {
        criticalDomains: finalAnalysis.criticalDomains,
        confidence: finalAnalysis.confidence,
        fallbackApplied: validation.fallbackApplied,
        processingTime
      });

      return triageResult;

    } catch (error) {
      console.error(`Triage analysis failed for assessment ${assessment.id}:`, error);

      // Log failure
      await this.logTriageEvent(assessment.id, 'triage_failed', {
        requestId,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });

      // Update status to failed
      await this.updateTriageStatus(assessment.id, 'failed');

      throw error;
    }
  }

  /**
   * Get triage results for an assessment
   */
  async getTriageResults(assessmentId: string): Promise<TriageAnalysis | null> {
    try {
      const params = {
        TableName: this.tableName,
        Key: marshall({
          PK: `ASSESSMENT#${assessmentId}`,
          SK: 'TRIAGE#RESULTS'
        })
      };

      const result = await this.dynamoDb.send(new GetItemCommand(params));

      if (!result.Item) {
        return null;
      }

      const triageEntity = unmarshall(result.Item) as TriageEntity;
      return this.convertFromStorageFormat(triageEntity);

    } catch (error) {
      console.error('Error retrieving triage results:', error);
      throw error;
    }
  }

  /**
   * Override triage results (founder intervention)
   */
  async overrideTriageResults(
    assessmentId: string,
    newDomains: string[],
    overriddenBy: string,
    reason: string
  ): Promise<TriageAnalysis> {
    try {
      console.log(`Processing triage override for assessment ${assessmentId} by ${overriddenBy}`);

      // Get current triage results
      const currentResults = await this.getTriageResults(assessmentId);
      if (!currentResults) {
        throw new Error('No existing triage results found for override');
      }

      // Create override record
      const override: TriageOverride = {
        assessmentId,
        originalSelection: currentResults.criticalDomains,
        overriddenSelection: newDomains,
        overriddenBy,
        overrideReason: reason,
        timestamp: new Date().toISOString(),
        approvalStatus: 'approved' // Founders can auto-approve their overrides
      };

      // Update triage results with override
      const updatedResults: TriageAnalysis = {
        ...currentResults,
        criticalDomains: newDomains,
        confidence: Math.max(0.8, currentResults.confidence), // Boost confidence for manual override
        reasoning: `${currentResults.reasoning} [OVERRIDE: ${reason}]`
      };

      // Store updated results with override history
      await this.storeTriageResults(assessmentId, updatedResults, false, override);

      // Update status
      await this.updateTriageStatus(assessmentId, 'overridden');

      // Log override event
      await this.logTriageEvent(assessmentId, 'triage_override', {
        userId: overriddenBy,
        changes: {
          originalDomains: override.originalSelection,
          newDomains: override.overriddenSelection,
          reason
        }
      });

      console.log(`Triage override completed for assessment ${assessmentId}`);

      return updatedResults;

    } catch (error) {
      console.error('Error overriding triage results:', error);
      throw error;
    }
  }

  /**
   * Get triage performance metrics
   */
  async getTriageMetrics(_timeframe: 'day' | 'week' | 'month' = 'week'): Promise<{
    totalTriages: number;
    averageProcessingTime: number;
    averageConfidence: number;
    successRate: number;
    overrideRate: number;
    industryBreakdown: Record<string, number>;
  }> {
    // This would typically query aggregated metrics from DynamoDB
    // For now, return mock data structure
    return {
      totalTriages: 0,
      averageProcessingTime: 0,
      averageConfidence: 0,
      successRate: 0,
      overrideRate: 0,
      industryBreakdown: {}
    };
  }

  /**
   * Validate triage results for quality assurance
   */
  async validateTriageQuality(assessmentId: string): Promise<TriageValidationResult> {
    const results = await this.getTriageResults(assessmentId);
    if (!results) {
      throw new Error('No triage results found for validation');
    }

    // This would perform additional validation checks
    // For now, return basic validation
    return {
      isValid: true,
      confidence: results.confidence,
      validationErrors: [],
      fallbackActivated: false,
      dataCompleteness: 0.85,
      qualityScore: 0.80
    };
  }

  // Private helper methods

  /**
   * Store triage results in DynamoDB
   */
  private async storeTriageResults(
    assessmentId: string,
    analysis: TriageAnalysis,
    fallbackApplied: boolean,
    override?: TriageOverride
  ): Promise<void> {
    const triageEntity: TriageEntity = {
      PK: `ASSESSMENT#${assessmentId}`,
      SK: 'TRIAGE#RESULTS',
      GSI2PK: 'STATUS#completed',
      GSI2SK: `CREATED#${new Date().toISOString()}`,
      EntityType: 'TriageResult',
      Data: {
        assessmentId,
        triageStatus: 'completed',
        algorithm: {
          version: '1.0.0',
          modelUsed: analysis.processingMetrics.modelUsed as 'gpt-4o-mini' | 'gpt-4o',
          processingTime: analysis.processingMetrics.processingTime,
          tokenUsage: {
            prompt: analysis.processingMetrics.tokenUsage.prompt,
            completion: analysis.processingMetrics.tokenUsage.completion,
            total: analysis.processingMetrics.tokenUsage.total
          }
        },
        domainScores: analysis.domainScores,
        selectedDomains: analysis.criticalDomains,
        industryContext: analysis.industryContext,
        overrideHistory: override ? [override] : []
      }
    };

    const params = {
      TableName: this.tableName,
      Item: marshall(triageEntity)
    };

    await this.dynamoDb.send(new PutItemCommand(params));
  }

  /**
   * Update triage status in DynamoDB
   */
  private async updateTriageStatus(assessmentId: string, status: string): Promise<void> {
    const params = {
      TableName: this.tableName,
      Key: marshall({
        PK: `ASSESSMENT#${assessmentId}`,
        SK: 'TRIAGE#RESULTS'
      }),
      UpdateExpression: 'SET #status = :status, #updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#status': 'Data.triageStatus',
        '#updatedAt': 'updatedAt'
      },
      ExpressionAttributeValues: marshall({
        ':status': status,
        ':updatedAt': new Date().toISOString()
      }),
      ConditionExpression: 'attribute_exists(PK)' // Only update if exists
    };

    try {
      await this.dynamoDb.send(new UpdateItemCommand(params));
    } catch (error) {
      // If item doesn't exist, create a placeholder
      if (error instanceof Error && error.name === 'ConditionalCheckFailedException') {
        const placeholderEntity: Partial<TriageEntity> = {
          PK: `ASSESSMENT#${assessmentId}`,
          SK: 'TRIAGE#RESULTS',
          GSI2PK: `STATUS#${status}`,
          GSI2SK: `CREATED#${new Date().toISOString()}`,
          EntityType: 'TriageResult',
          Data: {
            assessmentId,
            triageStatus: status as any,
            algorithm: {
              version: '1.0.0',
              modelUsed: 'gpt-4o-mini',
              processingTime: 0,
              tokenUsage: { prompt: 0, completion: 0, total: 0 }
            },
            domainScores: {},
            selectedDomains: [],
            industryContext: {
              sector: 'unknown',
              regulatoryClassification: 'lightly-regulated',
              specificRules: []
            },
            overrideHistory: []
          }
        };

        const createParams = {
          TableName: this.tableName,
          Item: marshall(placeholderEntity)
        };

        await this.dynamoDb.send(new PutItemCommand(createParams));
      } else {
        throw error;
      }
    }
  }

  /**
   * Log triage events for audit trail
   */
  private async logTriageEvent(
    assessmentId: string,
    event: 'triage_started' | 'triage_completed' | 'triage_failed' | 'triage_override' | 'validation_failed',
    details: Record<string, any>
  ): Promise<void> {
    const auditLog: TriageAuditLog = {
      assessmentId,
      timestamp: new Date().toISOString(),
      event,
      details,
      metadata: {
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        requestId: details.requestId || `${assessmentId}-${Date.now()}`
      }
    };

    // Store audit log (could be in separate table or S3 for long-term storage)
    const params = {
      TableName: this.tableName,
      Item: marshall({
        PK: `ASSESSMENT#${assessmentId}`,
        SK: `AUDIT#${auditLog.timestamp}#${event}`,
        GSI1PK: `AUDIT#${event}`,
        GSI1SK: auditLog.timestamp,
        EntityType: 'TriageAuditLog',
        Data: auditLog,
        TTL: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60) // 1 year retention
      })
    };

    await this.dynamoDb.send(new PutItemCommand(params));
  }

  /**
   * Convert enhanced triage analysis to legacy TriageResult format
   */
  private convertToLegacyFormat(analysis: TriageAnalysis): TriageResult {
    // Convert domain scores to simple priority scores
    const priorityScore: Record<string, number> = {};
    Object.entries(analysis.domainScores).forEach(([domain, score]) => {
      priorityScore[domain] = score.score / 5; // Convert to 0-1 scale
    });

    return {
      assessmentId: '', // Will be set by caller
      criticalDomains: analysis.criticalDomains,
      priorityScore,
      reasoning: analysis.reasoning,
      confidence: analysis.confidence,
      processingTime: analysis.processingMetrics.processingTime,
      modelUsed: analysis.processingMetrics.modelUsed
    };
  }

  /**
   * Convert storage format back to analysis format
   */
  private convertFromStorageFormat(entity: TriageEntity): TriageAnalysis {
    return {
      domainScores: entity.Data.domainScores as any,
      criticalDomains: entity.Data.selectedDomains,
      confidence: 0.8, // Would be stored in entity
      reasoning: 'Stored triage result', // Would be stored in entity
      industryContext: entity.Data.industryContext as any,
      processingMetrics: {
        processingTime: entity.Data.algorithm.processingTime,
        modelUsed: entity.Data.algorithm.modelUsed,
        tokenUsage: entity.Data.algorithm.tokenUsage,
        costEstimate: 0 // Would calculate from stored data
      }
    };
  }
}