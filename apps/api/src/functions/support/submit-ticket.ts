import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb'
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { v4 as uuidv4 } from 'uuid'

import { errorHandler, ValidationError, ServiceError } from '../../shared/middleware/error-handler'

interface SupportTicketRequest {
  name: string
  email: string
  company?: string
  subject: string
  message: string
  type: 'sales' | 'support' | 'partnership' | 'demo' | 'other'
  priority?: 'low' | 'medium' | 'high' | 'urgent'
}

const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1'
})

const sesClient = new SESClient({
  region: process.env.AWS_REGION || 'us-east-1'
})

const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'support@scalemap.ai'
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@scalemap.ai'
const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'scalemap-main'

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    if (!event.body) {
      throw new ValidationError('Request body is required')
    }

    const ticketData: SupportTicketRequest = JSON.parse(event.body)

    // Validate required fields
    const { name, email, subject, message, type } = ticketData
    if (!name || !email || !subject || !message || !type) {
      throw new ValidationError('Missing required fields: name, email, subject, message, type')
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      throw new ValidationError('Invalid email format')
    }

    // Generate ticket ID
    const ticketId = `TICKET-${Date.now()}-${uuidv4().slice(0, 8).toUpperCase()}`
    const timestamp = new Date().toISOString()

    // Store ticket in DynamoDB
    const putCommand = new PutItemCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: { S: `SUPPORT_TICKET#${ticketId}` },
        SK: { S: `TICKET#${timestamp}` },
        GSI1PK: { S: `SUPPORT#${type.toUpperCase()}` },
        GSI1SK: { S: `CREATED#${timestamp}` },
        ticketId: { S: ticketId },
        name: { S: name },
        email: { S: email },
        company: { S: ticketData.company || '' },
        subject: { S: subject },
        message: { S: message },
        type: { S: type },
        priority: { S: ticketData.priority || 'medium' },
        status: { S: 'open' },
        createdAt: { S: timestamp },
        updatedAt: { S: timestamp },
        TTL: { N: (Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60)).toString() } // 1 year TTL
      }
    })

    await dynamoClient.send(putCommand)

    // Send email notification to support team
    const emailContent = `
New Support Ticket: ${ticketId}

From: ${name} (${email})
${ticketData.company ? `Company: ${ticketData.company}` : ''}
Type: ${type.toUpperCase()}
Priority: ${ticketData.priority || 'medium'}
Subject: ${subject}

Message:
${message}

---
Submitted: ${timestamp}
Ticket ID: ${ticketId}
    `.trim()

    const sendEmailCommand = new SendEmailCommand({
      Source: FROM_EMAIL,
      Destination: {
        ToAddresses: [SUPPORT_EMAIL]
      },
      Message: {
        Subject: {
          Data: `[ScaleMap Support] New ${type} ticket: ${subject}`,
          Charset: 'UTF-8'
        },
        Body: {
          Text: {
            Data: emailContent,
            Charset: 'UTF-8'
          }
        }
      }
    })

    await sesClient.send(sendEmailCommand)

    // Send confirmation email to user
    const confirmationEmailCommand = new SendEmailCommand({
      Source: FROM_EMAIL,
      Destination: {
        ToAddresses: [email]
      },
      Message: {
        Subject: {
          Data: `Support Ticket Received - ${ticketId}`,
          Charset: 'UTF-8'
        },
        Body: {
          Text: {
            Data: `Hi ${name},

Thank you for contacting ScaleMap! We've received your ${type} inquiry.

Ticket ID: ${ticketId}
Subject: ${subject}

Our team will review your message and respond within 24 hours for support requests, or within 48 hours for sales inquiries.

If you need immediate assistance, please call our support line during business hours (Monday-Friday, 9 AM - 6 PM PST).

Best regards,
The ScaleMap Team

---
This is an automated message. Please do not reply to this email.`,
            Charset: 'UTF-8'
          }
        }
      }
    })

    await sesClient.send(confirmationEmailCommand)

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify({
        success: true,
        ticketId,
        message: 'Support ticket submitted successfully'
      })
    }
  } catch (error) {
    console.error('Error submitting support ticket:', error)
    return errorHandler(error)
  }
}