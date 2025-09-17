import { ApiResponse, CompanySize, BusinessModel } from '@scalemap/shared';
import { APIGatewayProxyResult } from 'aws-lambda';

import { db } from '../../services/database';
import { withAuth, AuthenticatedEvent } from '../../shared/middleware/auth-middleware';
import { logger } from '../../utils/logger';
import { Monitoring } from '../../utils/monitoring';

interface UpdateCompanyRequest {
  name?: string;
  industry?: {
    sector?: string;
    subSector?: string;
    regulatoryClassification?: 'highly-regulated' | 'moderately-regulated' | 'lightly-regulated';
    specificRegulations?: string[];
  };
  businessModel?: BusinessModel;
  size?: CompanySize;
  description?: string;
  website?: string;
  headquarters?: {
    country?: string;
    city?: string;
  };
}

const updateCompanyHandler = async (
  event: AuthenticatedEvent
): Promise<APIGatewayProxyResult> => {
  const requestId = event.requestContext?.requestId || 'unknown';
  const requestLogger = logger.child({ requestId, function: 'update-company' });

  try {
    requestLogger.info('Company update requested', {
      userId: event.user.sub,
      companyId: event.user.companyId
    });
    Monitoring.incrementCounter('CompanyUpdateRequests');

    if (!event.body) {
      return createErrorResponse(400, 'INVALID_REQUEST', 'Request body is required', requestId);
    }

    const updateData: UpdateCompanyRequest = JSON.parse(event.body);

    // Validate the update data
    const validationError = validateUpdateData(updateData);
    if (validationError) {
      return createErrorResponse(400, validationError.code, validationError.message, requestId);
    }

    // Check if user has permission to update company (admin only)
    if (event.user.role !== 'admin') {
      return createErrorResponse(403, 'INSUFFICIENT_PERMISSIONS', 'Only company admins can update company details', requestId);
    }

    const companyId = event.user.companyId;

    // Get current company data
    const currentCompany = await db.get(`COMPANY#${companyId}`, 'METADATA');
    if (!currentCompany) {
      return createErrorResponse(404, 'COMPANY_NOT_FOUND', 'Company not found', requestId);
    }

    // Build update expression dynamically
    const updateExpression: string[] = [];
    const expressionAttributeValues: Record<string, any> = {
      ':updatedAt': new Date().toISOString()
    };

    // Handle basic company fields
    if (updateData.name !== undefined) {
      updateExpression.push('#companyName = :name');
      expressionAttributeValues[':name'] = updateData.name.trim();
    }

    if (updateData.businessModel !== undefined) {
      updateExpression.push('businessModel = :businessModel');
      expressionAttributeValues[':businessModel'] = updateData.businessModel;
    }

    if (updateData.size !== undefined) {
      updateExpression.push('#size = :size');
      expressionAttributeValues[':size'] = updateData.size;
    }

    if (updateData.description !== undefined) {
      updateExpression.push('description = :description');
      expressionAttributeValues[':description'] = updateData.description.trim();
    }

    if (updateData.website !== undefined) {
      updateExpression.push('website = :website');
      expressionAttributeValues[':website'] = updateData.website.trim();
    }

    // Handle nested industry object
    if (updateData.industry) {
      const currentIndustry = (currentCompany.industry as any) || {};
      const updatedIndustry = {
        ...currentIndustry,
        ...updateData.industry
      };

      updateExpression.push('industry = :industry');
      expressionAttributeValues[':industry'] = updatedIndustry;
    }

    // Handle nested headquarters object
    if (updateData.headquarters) {
      const currentHeadquarters = (currentCompany.headquarters as any) || {};
      const updatedHeadquarters = {
        ...currentHeadquarters,
        ...updateData.headquarters
      };

      updateExpression.push('headquarters = :headquarters');
      expressionAttributeValues[':headquarters'] = updatedHeadquarters;
    }

    updateExpression.push('updatedAt = :updatedAt');

    const expressionAttributeNames: Record<string, string> = {};
    if (updateData.name !== undefined) {
      expressionAttributeNames['#companyName'] = 'name';
    }
    if (updateData.size !== undefined) {
      expressionAttributeNames['#size'] = 'size';
    }

    // Perform the update
    const updatedCompany = await db.update(
      `COMPANY#${companyId}`,
      'METADATA',
      `SET ${updateExpression.join(', ')}`,
      expressionAttributeValues,
      Object.keys(expressionAttributeNames).length > 0 ? expressionAttributeNames : undefined
    );

    if (!updatedCompany) {
      return createErrorResponse(500, 'UPDATE_FAILED', 'Failed to update company', requestId);
    }

    requestLogger.info('Company updated successfully', {
      companyId,
      userId: event.user.sub,
      updatedFields: Object.keys(updateData)
    });

    Monitoring.incrementCounter('CompanyUpdateSuccess');

    // Prepare response data
    const responseData = {
      id: updatedCompany.id,
      name: updatedCompany.name,
      industry: updatedCompany.industry,
      businessModel: updatedCompany.businessModel,
      size: updatedCompany.size,
      description: updatedCompany.description,
      website: updatedCompany.website,
      headquarters: updatedCompany.headquarters,
      updatedAt: updatedCompany.updatedAt
    };

    const response: ApiResponse = {
      success: true,
      data: responseData,
      meta: {
        timestamp: new Date().toISOString(),
        requestId
      }
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'PUT,OPTIONS',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block'
      },
      body: JSON.stringify(response),
    };

  } catch (error) {
    Monitoring.recordError('update-company', 'UnexpectedError', error as Error);
    requestLogger.error('Company update failed', {
      error: (error as Error).message,
      userId: event.user.sub,
      companyId: event.user.companyId
    });

    return createErrorResponse(500, 'INTERNAL_ERROR', 'Internal server error', requestId);
  }
};

function validateUpdateData(data: UpdateCompanyRequest): { code: string; message: string } | null {
  // Validate company name
  if (data.name !== undefined && (!data.name || data.name.trim().length === 0)) {
    return { code: 'INVALID_COMPANY_NAME', message: 'Company name cannot be empty' };
  }

  // Validate business model
  if (data.businessModel !== undefined) {
    const validModels: BusinessModel[] = [
      'b2b-saas', 'b2c-saas', 'marketplace', 'ecommerce', 'consulting',
      'manufacturing', 'retail', 'healthcare', 'fintech', 'other'
    ];
    if (!validModels.includes(data.businessModel)) {
      return { code: 'INVALID_BUSINESS_MODEL', message: 'Invalid business model' };
    }
  }

  // Validate company size
  if (data.size !== undefined) {
    const validSizes: CompanySize[] = ['micro', 'small', 'medium', 'large', 'enterprise'];
    if (!validSizes.includes(data.size)) {
      return { code: 'INVALID_COMPANY_SIZE', message: 'Invalid company size' };
    }
  }

  // Validate website URL
  if (data.website !== undefined && data.website.trim() !== '') {
    try {
      new URL(data.website);
    } catch {
      return { code: 'INVALID_WEBSITE_URL', message: 'Invalid website URL format' };
    }
  }

  // Validate industry data
  if (data.industry) {
    if (data.industry.regulatoryClassification !== undefined) {
      const validClassifications = ['highly-regulated', 'moderately-regulated', 'lightly-regulated'];
      if (!validClassifications.includes(data.industry.regulatoryClassification)) {
        return { code: 'INVALID_REGULATORY_CLASSIFICATION', message: 'Invalid regulatory classification' };
      }
    }

    if (data.industry.specificRegulations !== undefined && !Array.isArray(data.industry.specificRegulations)) {
      return { code: 'INVALID_REGULATIONS_FORMAT', message: 'Specific regulations must be an array' };
    }
  }

  return null;
}

function createErrorResponse(
  statusCode: number,
  code: string,
  message: string,
  requestId: string
): APIGatewayProxyResult {
  const response: ApiResponse = {
    success: false,
    error: { code, message },
    meta: {
      timestamp: new Date().toISOString(),
      requestId
    }
  };

  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'PUT,OPTIONS',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block'
    },
    body: JSON.stringify(response),
  };
}

// Export the handler wrapped with authentication middleware
export const handler = withAuth(updateCompanyHandler, {
  requireEmailVerification: true,
  allowedRoles: ['admin'] // Only admins can update company details
});