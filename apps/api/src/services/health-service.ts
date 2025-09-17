import { DynamoDBClient, DescribeTableCommand } from '@aws-sdk/client-dynamodb'
import { SESClient, GetSendQuotaCommand } from '@aws-sdk/client-ses'

import { ServiceError } from '../shared/middleware/error-handler'

interface ComponentHealth {
  name: string
  status: 'healthy' | 'unhealthy' | 'degraded'
  responseTime: number
  lastCheck: string
  details?: Record<string, any>
}

interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded'
  timestamp: string
  components?: ComponentHealth[]
  responseTime?: number
}

class HealthService {
  private dynamoClient: DynamoDBClient
  private sesClient: SESClient

  constructor() {
    this.dynamoClient = new DynamoDBClient({
      region: process.env.AWS_REGION || 'us-east-1'
    })
    this.sesClient = new SESClient({
      region: process.env.AWS_REGION || 'us-east-1'
    })
  }

  async getBasicHealth(): Promise<HealthStatus> {

    try {
      // Quick health check - just verify we can reach DynamoDB
      await this.checkDynamoDB()

      return {
        status: 'healthy',
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      console.error('Basic health check failed:', error)
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString()
      }
    }
  }

  async getDetailedHealth(): Promise<HealthStatus> {
    const startTime = Date.now()
    const components: ComponentHealth[] = []

    // Check DynamoDB
    components.push(await this.checkDynamoDBHealth())

    // Check SES
    components.push(await this.checkSESHealth())

    // Check OpenAI (mock for now)
    components.push(await this.checkOpenAIHealth())

    // Check Stripe (mock for now)
    components.push(await this.checkStripeHealth())

    const responseTime = Date.now() - startTime
    const overallStatus = this.determineOverallStatus(components)

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      components,
      responseTime
    }
  }

  private async checkDynamoDB(): Promise<void> {
    const tableName = process.env.DYNAMODB_TABLE_NAME || 'scalemap-main'

    try {
      await this.dynamoClient.send(new DescribeTableCommand({
        TableName: tableName
      }))
    } catch (error) {
      throw new ServiceError(`DynamoDB check failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private async checkDynamoDBHealth(): Promise<ComponentHealth> {
    const startTime = Date.now()
    const tableName = process.env.DYNAMODB_TABLE_NAME || 'scalemap-main'

    try {
      const response = await this.dynamoClient.send(new DescribeTableCommand({
        TableName: tableName
      }))

      const responseTime = Date.now() - startTime

      return {
        name: 'dynamodb',
        status: 'healthy',
        responseTime,
        lastCheck: new Date().toISOString(),
        details: {
          tableName,
          tableStatus: response.Table?.TableStatus
        }
      }
    } catch (error) {
      const responseTime = Date.now() - startTime

      return {
        name: 'dynamodb',
        status: 'unhealthy',
        responseTime,
        lastCheck: new Date().toISOString(),
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    }
  }

  private async checkSESHealth(): Promise<ComponentHealth> {
    const startTime = Date.now()

    try {
      await this.sesClient.send(new GetSendQuotaCommand({}))
      const responseTime = Date.now() - startTime

      return {
        name: 'ses',
        status: 'healthy',
        responseTime,
        lastCheck: new Date().toISOString()
      }
    } catch (error) {
      const responseTime = Date.now() - startTime

      return {
        name: 'ses',
        status: 'unhealthy',
        responseTime,
        lastCheck: new Date().toISOString(),
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    }
  }

  private async checkOpenAIHealth(): Promise<ComponentHealth> {
    const startTime = Date.now()

    try {
      // TODO: Implement actual OpenAI health check
      // For now, return healthy status as mock
      const responseTime = Date.now() - startTime

      return {
        name: 'openai',
        status: 'healthy',
        responseTime,
        lastCheck: new Date().toISOString(),
        details: {
          note: 'Mock implementation - replace with actual OpenAI API check'
        }
      }
    } catch (error) {
      const responseTime = Date.now() - startTime

      return {
        name: 'openai',
        status: 'unhealthy',
        responseTime,
        lastCheck: new Date().toISOString(),
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    }
  }

  private async checkStripeHealth(): Promise<ComponentHealth> {
    const startTime = Date.now()

    try {
      // TODO: Implement actual Stripe health check
      // For now, return healthy status as mock
      const responseTime = Date.now() - startTime

      return {
        name: 'stripe',
        status: 'healthy',
        responseTime,
        lastCheck: new Date().toISOString(),
        details: {
          note: 'Mock implementation - replace with actual Stripe API check'
        }
      }
    } catch (error) {
      const responseTime = Date.now() - startTime

      return {
        name: 'stripe',
        status: 'unhealthy',
        responseTime,
        lastCheck: new Date().toISOString(),
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    }
  }

  private determineOverallStatus(components: ComponentHealth[]): 'healthy' | 'unhealthy' | 'degraded' {
    const unhealthyComponents = components.filter(c => c.status === 'unhealthy')
    const degradedComponents = components.filter(c => c.status === 'degraded')

    if (unhealthyComponents.length > 0) {
      // If critical services (DynamoDB) are down, mark as unhealthy
      const criticalServices = ['dynamodb']
      const unhealthyCritical = unhealthyComponents.some(c => criticalServices.includes(c.name))

      if (unhealthyCritical) {
        return 'unhealthy'
      }

      // If only non-critical services are down, mark as degraded
      return 'degraded'
    }

    if (degradedComponents.length > 0) {
      return 'degraded'
    }

    return 'healthy'
  }
}

export const healthService = new HealthService()