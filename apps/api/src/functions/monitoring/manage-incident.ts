import { DynamoDBClient, UpdateItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb'
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'

import { monitoringService } from '../../services/monitoring-service'
import { errorHandler, ValidationError } from '../../shared/middleware/error-handler'

const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1'
})

interface UpdateIncidentRequest {
  incidentId: string
  status?: 'open' | 'acknowledged' | 'resolved'
  assignedTo?: string
  notes?: string
  escalate?: boolean
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const method = event.httpMethod

    if (method === 'GET') {
      return await getIncidents(event)
    } else if (method === 'PATCH') {
      return await updateIncident(event)
    } else if (method === 'POST') {
      return await createManualIncident(event)
    } else {
      throw new ValidationError(`Method ${method} not allowed`)
    }

  } catch (error) {
    console.error('Incident management API error:', error)
    return errorHandler(error)
  }
}

async function getIncidents(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const status = event.queryStringParameters?.status
  const severity = event.queryStringParameters?.severity
  const limit = parseInt(event.queryStringParameters?.limit || '50')

  try {
    let keyConditionExpression = 'begins_with(GSI1PK, :pk)'
    const expressionAttributeValues: any = {
      ':pk': { S: 'INCIDENTS#' }
    }

    if (severity) {
      keyConditionExpression = 'GSI1PK = :pk'
      expressionAttributeValues[':pk'] = { S: `INCIDENTS#${severity.toUpperCase()}` }
    }

    let filterExpression = ''
    if (status) {
      filterExpression = '#status = :status'
      expressionAttributeValues[':status'] = { S: status }
    }

    const command = new QueryCommand({
      TableName: process.env.DYNAMODB_TABLE_NAME || 'scalemap-main',
      IndexName: 'GSI1',
      KeyConditionExpression: keyConditionExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      ExpressionAttributeNames: status ? { '#status': 'status' } : undefined,
      FilterExpression: filterExpression || undefined,
      ScanIndexForward: false, // Most recent first
      Limit: limit
    })

    const response = await dynamoClient.send(command)

    const incidents = response.Items?.map(item => ({
      incidentId: item.incidentId?.S || '',
      alertName: item.alertName?.S || '',
      severity: item.severity?.S || '',
      status: item.status?.S || '',
      description: item.description?.S || '',
      affectedComponents: item.affectedComponents?.SS || [],
      createdAt: item.createdAt?.S || '',
      updatedAt: item.updatedAt?.S || '',
      resolvedAt: item.resolvedAt?.S,
      assignedTo: item.assignedTo?.S,
      escalatedTo: item.escalatedTo?.S
    })) || []

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify({
        incidents,
        count: incidents.length,
        hasMore: response.LastEvaluatedKey !== undefined
      })
    }

  } catch (error) {
    console.error('Failed to get incidents:', error)
    throw error
  }
}

async function updateIncident(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  if (!event.body) {
    throw new ValidationError('Request body is required')
  }

  const updateRequest: UpdateIncidentRequest = JSON.parse(event.body)
  const { incidentId, status, assignedTo, notes, escalate } = updateRequest

  if (!incidentId) {
    throw new ValidationError('incidentId is required')
  }

  try {
    const timestamp = new Date().toISOString()
    let updateExpression = 'SET updatedAt = :updatedAt'
    const expressionAttributeValues: any = {
      ':updatedAt': { S: timestamp }
    }

    if (status) {
      updateExpression += ', #status = :status'
      expressionAttributeValues[':status'] = { S: status }

      if (status === 'resolved') {
        updateExpression += ', resolvedAt = :resolvedAt'
        expressionAttributeValues[':resolvedAt'] = { S: timestamp }
      }
    }

    if (assignedTo) {
      updateExpression += ', assignedTo = :assignedTo'
      expressionAttributeValues[':assignedTo'] = { S: assignedTo }
    }

    if (escalate) {
      // Escalate to higher tier (this would integrate with your escalation system)
      const escalationTarget = getEscalationTarget(assignedTo)
      updateExpression += ', escalatedTo = :escalatedTo'
      expressionAttributeValues[':escalatedTo'] = { S: escalationTarget }

      // Send escalation notification
      await monitoringService.sendAlert({
        incidentId,
        alertName: `ESCALATED: Incident ${incidentId}`,
        severity: 'high' as const,
        status: 'open' as const,
        description: `Incident ${incidentId} has been escalated to ${escalationTarget}`,
        affectedComponents: [],
        createdAt: timestamp,
        updatedAt: timestamp,
        escalatedTo: escalationTarget
      })
    }

    const command = new UpdateItemCommand({
      TableName: process.env.DYNAMODB_TABLE_NAME || 'scalemap-main',
      Key: {
        PK: { S: `INCIDENT#${incidentId}` },
        SK: { S: `CREATED#${timestamp}` } // This might need to be the original creation timestamp
      },
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: status ? { '#status': 'status' } : undefined,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW'
    })

    const response = await dynamoClient.send(command)

    // Add notes if provided
    if (notes) {
      // This would typically add to an incident notes/comments table
      console.log(`Adding notes to incident ${incidentId}: ${notes}`)
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify({
        success: true,
        incidentId,
        message: 'Incident updated successfully',
        updatedAttributes: response.Attributes
      })
    }

  } catch (error) {
    console.error('Failed to update incident:', error)
    throw error
  }
}

async function createManualIncident(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  if (!event.body) {
    throw new ValidationError('Request body is required')
  }

  const incidentData = JSON.parse(event.body)
  const { alertName, severity, description, affectedComponents } = incidentData

  if (!alertName || !severity || !description || !affectedComponents) {
    throw new ValidationError('alertName, severity, description, and affectedComponents are required')
  }

  try {
    const incidentId = await monitoringService.createIncident({
      alertName,
      severity,
      status: 'open',
      description,
      affectedComponents
    })

    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify({
        success: true,
        incidentId,
        message: 'Incident created successfully'
      })
    }

  } catch (error) {
    console.error('Failed to create manual incident:', error)
    throw error
  }
}

function getEscalationTarget(currentAssignee?: string): string {
  // Simple escalation logic - in a real system this would be more sophisticated
  const escalationChain: { [key: string]: string } = {
    'tier1': 'tier2-manager',
    'tier2': 'engineering-lead',
    'tier2-manager': 'engineering-director',
    'engineering-lead': 'cto',
    'default': 'on-call-engineer'
  }

  return escalationChain[currentAssignee || 'default'] || escalationChain['default'] || 'on-call-engineer'
}