import { DynamoDBClient, QueryCommand, PutItemCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb'

import { ServiceError } from '../shared/middleware/error-handler'

export interface SupportTicket {
  ticketId: string
  name: string
  email: string
  company?: string
  subject: string
  message: string
  type: 'sales' | 'support' | 'partnership' | 'demo' | 'other'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  createdAt: string
  updatedAt: string
  assignedTo?: string
  resolutionNotes?: string
}

export interface TicketComment {
  commentId: string
  ticketId: string
  author: string
  authorType: 'user' | 'support'
  message: string
  createdAt: string
  isInternal: boolean
}

class SupportService {
  private dynamoClient: DynamoDBClient
  private tableName: string

  constructor() {
    this.dynamoClient = new DynamoDBClient({
      region: process.env.AWS_REGION || 'us-east-1'
    })
    this.tableName = process.env.DYNAMODB_TABLE_NAME || 'scalemap-main'
  }

  async getTicketsByEmail(email: string): Promise<SupportTicket[]> {
    try {
      const command = new QueryCommand({
        TableName: this.tableName,
        IndexName: 'GSI2',
        KeyConditionExpression: 'GSI2PK = :pk',
        ExpressionAttributeValues: {
          ':pk': { S: `USER_EMAIL#${email}` }
        }
      })

      const response = await this.dynamoClient.send(command)
      return response.Items?.map(this.mapDynamoItemToTicket) || []
    } catch (error) {
      throw new ServiceError(`Failed to retrieve tickets: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async getTicketById(ticketId: string): Promise<SupportTicket | null> {
    try {
      const command = new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: {
          ':pk': { S: `SUPPORT_TICKET#${ticketId}` }
        },
        Limit: 1
      })

      const response = await this.dynamoClient.send(command)
      const item = response.Items?.[0]
      return item ? this.mapDynamoItemToTicket(item) : null
    } catch (error) {
      throw new ServiceError(`Failed to retrieve ticket: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async updateTicketStatus(
    ticketId: string,
    status: SupportTicket['status'],
    assignedTo?: string,
    resolutionNotes?: string
  ): Promise<void> {
    try {
      let updateExpression = 'SET #status = :status, updatedAt = :updatedAt'
      const expressionAttributeNames: Record<string, string> = {
        '#status': 'status'
      }
      const expressionAttributeValues: Record<string, any> = {
        ':status': { S: status },
        ':updatedAt': { S: new Date().toISOString() }
      }

      if (assignedTo) {
        updateExpression += ', assignedTo = :assignedTo'
        expressionAttributeValues[':assignedTo'] = { S: assignedTo }
      }

      if (resolutionNotes) {
        updateExpression += ', resolutionNotes = :resolutionNotes'
        expressionAttributeValues[':resolutionNotes'] = { S: resolutionNotes }
      }

      const command = new UpdateItemCommand({
        TableName: this.tableName,
        Key: {
          PK: { S: `SUPPORT_TICKET#${ticketId}` },
          SK: { S: `TICKET#${new Date().toISOString()}` }
        },
        UpdateExpression: updateExpression,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues
      })

      await this.dynamoClient.send(command)
    } catch (error) {
      throw new ServiceError(`Failed to update ticket status: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async addCommentToTicket(
    ticketId: string,
    author: string,
    authorType: 'user' | 'support',
    message: string,
    isInternal: boolean = false
  ): Promise<string> {
    try {
      const commentId = `COMMENT-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`
      const timestamp = new Date().toISOString()

      const command = new PutItemCommand({
        TableName: this.tableName,
        Item: {
          PK: { S: `SUPPORT_TICKET#${ticketId}` },
          SK: { S: `COMMENT#${timestamp}#${commentId}` },
          GSI1PK: { S: `TICKET_COMMENTS#${ticketId}` },
          GSI1SK: { S: `CREATED#${timestamp}` },
          commentId: { S: commentId },
          ticketId: { S: ticketId },
          author: { S: author },
          authorType: { S: authorType },
          message: { S: message },
          isInternal: { BOOL: isInternal },
          createdAt: { S: timestamp },
          TTL: { N: (Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60)).toString() }
        }
      })

      await this.dynamoClient.send(command)
      return commentId
    } catch (error) {
      throw new ServiceError(`Failed to add comment: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async getTicketComments(ticketId: string, includeInternal: boolean = false): Promise<TicketComment[]> {
    try {
      const command = new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': { S: `SUPPORT_TICKET#${ticketId}` },
          ':sk': { S: 'COMMENT#' }
        },
        ScanIndexForward: true
      })

      const response = await this.dynamoClient.send(command)
      const comments = response.Items?.map(this.mapDynamoItemToComment) || []

      return includeInternal ? comments : comments.filter(comment => !comment.isInternal)
    } catch (error) {
      throw new ServiceError(`Failed to retrieve comments: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private mapDynamoItemToTicket(item: any): SupportTicket {
    return {
      ticketId: item.ticketId?.S || '',
      name: item.name?.S || '',
      email: item.email?.S || '',
      company: item.company?.S || undefined,
      subject: item.subject?.S || '',
      message: item.message?.S || '',
      type: item.type?.S || 'other',
      priority: item.priority?.S || 'medium',
      status: item.status?.S || 'open',
      createdAt: item.createdAt?.S || '',
      updatedAt: item.updatedAt?.S || '',
      assignedTo: item.assignedTo?.S || undefined,
      resolutionNotes: item.resolutionNotes?.S || undefined
    }
  }

  private mapDynamoItemToComment(item: any): TicketComment {
    return {
      commentId: item.commentId?.S || '',
      ticketId: item.ticketId?.S || '',
      author: item.author?.S || '',
      authorType: item.authorType?.S || 'user',
      message: item.message?.S || '',
      createdAt: item.createdAt?.S || '',
      isInternal: item.isInternal?.BOOL || false
    }
  }
}

export const supportService = new SupportService()