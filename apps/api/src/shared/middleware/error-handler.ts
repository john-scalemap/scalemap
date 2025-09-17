import { APIGatewayProxyResult } from 'aws-lambda'

export interface ApiError extends Error {
  statusCode?: number
  code?: string
}

export class BusinessError extends Error {
  statusCode: number
  code: string

  constructor(message: string, statusCode: number = 400, code: string = 'BUSINESS_ERROR') {
    super(message)
    this.name = 'BusinessError'
    this.statusCode = statusCode
    this.code = code
  }
}

export class ValidationError extends BusinessError {
  constructor(message: string) {
    super(message, 400, 'VALIDATION_ERROR')
    this.name = 'ValidationError'
  }
}

export class ServiceError extends BusinessError {
  constructor(message: string) {
    super(message, 503, 'SERVICE_ERROR')
    this.name = 'ServiceError'
  }
}

export const errorHandler = (error: unknown): APIGatewayProxyResult => {
  console.error('Error caught by error handler:', error)

  if (error instanceof BusinessError) {
    return {
      statusCode: error.statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify({
        error: {
          code: error.code,
          message: error.message
        }
      })
    }
  }

  if (error instanceof Error) {
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An internal error occurred'
        }
      })
    }
  }

  return {
    statusCode: 500,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type'
    },
    body: JSON.stringify({
      error: {
        code: 'UNKNOWN_ERROR',
        message: 'An unknown error occurred'
      }
    })
  }
}