import { APIGatewayTokenAuthorizerHandler, APIGatewayAuthorizerResult } from 'aws-lambda';

import { jwtService } from '../../services/jwt';

export const handler: APIGatewayTokenAuthorizerHandler = async (
  event
): Promise<APIGatewayAuthorizerResult> => {
  try {
    console.log('JWT Authorizer invoked with token:', event.authorizationToken?.substring(0, 20) + '...');

    // Extract token from authorization header
    const token = jwtService.extractTokenFromHeader(event.authorizationToken);
    if (!token) {
      console.log('No token found in authorization header');
      throw new Error('Unauthorized');
    }

    // Validate the access token
    const payload = await jwtService.validateAccessToken(token);
    console.log('Token validated successfully for user:', payload.sub);

    // Generate policy for the user
    const policy = generatePolicy(payload.sub, 'Allow', event.methodArn, {
      userId: payload.sub,
      email: payload.email,
      companyId: payload.companyId,
      role: payload.role,
      permissions: payload.permissions?.join(',') || '',
      emailVerified: payload.emailVerified ? 'true' : 'false'
    });

    console.log('Generated policy for user:', payload.sub);
    return policy;

  } catch (error) {
    console.error('JWT Authorization failed:', error);

    // Return explicit deny policy
    const policy = generatePolicy('user', 'Deny', event.methodArn, {});
    return policy;
  }
};

function generatePolicy(
  principalId: string,
  effect: 'Allow' | 'Deny',
  resource: string,
  context: Record<string, string>
): APIGatewayAuthorizerResult {
  // For Allow policies, use wildcard to grant access to all API methods
  // For Deny policies, use specific resource for security
  let policyResource = resource;
  if (effect === 'Allow') {
    // Convert specific ARN to wildcard pattern: arn:aws:execute-api:region:account:api-id/stage/*/*
    const arnParts = resource.split('/');
    if (arnParts.length >= 3) {
      policyResource = arnParts.slice(0, -2).join('/') + '/*/*';
    }
  }

  console.log(`Generated ${effect} policy with resource: ${policyResource}`);

  return {
    principalId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: effect,
          Resource: policyResource
        }
      ]
    },
    context
  };
}