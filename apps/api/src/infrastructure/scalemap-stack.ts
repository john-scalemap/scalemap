import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejsLambda from 'aws-cdk-lib/aws-lambda-nodejs';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
// import * as ses from 'aws-cdk-lib/aws-ses'; // TODO: Add SES monitoring
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';

interface ScaleMapStackProps extends cdk.StackProps {
  stage: string;
}

export class ScaleMapStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ScaleMapStackProps) {
    super(scope, id, props);

    const { stage } = props;

    // DynamoDB Table with Single Table Design
    const table = new dynamodb.Table(this, 'ScaleMapTable', {
      tableName: `scalemap-${stage}`,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      timeToLiveAttribute: 'TTL',
      removalPolicy: stage === 'production' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
    });

    // GSI1 for user and company lookups
    table.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },
    });

    // GSI2 for status and time-based queries
    table.addGlobalSecondaryIndex({
      indexName: 'GSI2',
      partitionKey: { name: 'GSI2PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI2SK', type: dynamodb.AttributeType.STRING },
    });

    // S3 Bucket for document storage
    const documentsBucket = new s3.Bucket(this, 'DocumentsBucket', {
      bucketName: `scalemap-documents-${stage}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.POST, s3.HttpMethods.PUT],
          allowedOrigins: stage === 'production' ? ['https://scalemap.ai'] : ['*'],
          allowedHeaders: ['*'],
          maxAge: 300,
        },
      ],
      lifecycleRules: [
        {
          id: 'cost-optimization',
          enabled: true,
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(30),
            },
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(90),
            },
          ],
        },
      ],
      removalPolicy: stage === 'production' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Dead Letter Queue for failed Lambda invocations
    const dlq = new sqs.Queue(this, 'DeadLetterQueue', {
      queueName: `scalemap-dlq-${stage}`,
      retentionPeriod: cdk.Duration.days(14),
    });

    // JWT Secrets (generate secure random secrets for production)
    const jwtAccessSecret =
      stage === 'production'
        ? '-q_OFZbpI0M24rNKHUYibzGmyL_-Jkfhj7HnMhEZZy_I_a2KW0zEZ-u5n5EC2v4z'
        : 'dev-access-secret-change-in-production';

    const jwtRefreshSecret =
      stage === 'production'
        ? 'WX-E-NG6bddW3mQhrSTPR_Hyxz0CJrzKG_WtpvgzMK-i3Mlzgh7BTMhrk8zDxPWc'
        : 'dev-refresh-secret-change-in-production';

    // Common Lambda environment variables
    const commonEnvVars = {
      TABLE_NAME: table.tableName,
      DYNAMODB_TABLE_NAME: table.tableName,
      DOCUMENTS_BUCKET: documentsBucket.bucketName,
      S3_BUCKET_NAME: documentsBucket.bucketName,
      STAGE: stage,
      SES_REGION: 'eu-west-1',
      REGION: this.region,
      DLQ_URL: dlq.queueUrl,
      SES_FROM_ADDRESS: 'john@scalemap.uk',
      SES_FROM_EMAIL: 'john@scalemap.uk',
      FRONTEND_BASE_URL:
        stage === 'production'
          ? 'https://scalemap.vercel.app' // Generic URL - actual CORS handled dynamically
          : 'http://localhost:3000',
      JWT_ACCESS_SECRET: jwtAccessSecret,
      JWT_REFRESH_SECRET: jwtRefreshSecret,
      JWT_ACCESS_TTL: '900', // 15 minutes
      JWT_REFRESH_TTL: '604800', // 7 days
      JWT_ISSUER: 'scalemap.com',
      NODE_ENV: stage === 'production' ? 'production' : 'development',
    };

    // Common Lambda bundling configuration
    const bundlingConfig = {
      minify: true,
      sourceMap: true,
      target: 'es2022',
      define: {
        'process.env.NODE_ENV': JSON.stringify(
          stage === 'production' ? 'production' : 'development'
        ),
      },
      external: [
        '@aws-sdk/*', // AWS SDK v3 is available in Lambda runtime
      ],
      format: nodejsLambda.OutputFormat.CJS, // Use CommonJS for compatibility
      mainFields: ['main', 'module'],
    };

    // Common Lambda configuration
    const lambdaProps = {
      runtime: lambda.Runtime.NODEJS_18_X,
      environment: commonEnvVars,
      deadLetterQueue: dlq,
      logRetention: logs.RetentionDays.ONE_MONTH,
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
      bundling: bundlingConfig,
    };

    // Authentication Lambda Functions
    const loginFunction = new nodejsLambda.NodejsFunction(this, 'LoginFunction', {
      ...lambdaProps,
      functionName: `scalemap-login-${stage}`,
      entry: 'src/functions/auth/login.ts',
      handler: 'handler',
    });

    const refreshTokenFunction = new nodejsLambda.NodejsFunction(this, 'RefreshTokenFunction', {
      ...lambdaProps,
      functionName: `scalemap-refresh-token-${stage}`,
      entry: 'src/functions/auth/refresh-token.ts',
      handler: 'handler',
    });

    const registerFunction = new nodejsLambda.NodejsFunction(this, 'RegisterFunction', {
      ...lambdaProps,
      functionName: `scalemap-register-${stage}`,
      entry: 'src/functions/auth/register.ts',
      handler: 'handler',
    });

    const verifyEmailFunction = new nodejsLambda.NodejsFunction(this, 'VerifyEmailFunction', {
      ...lambdaProps,
      functionName: `scalemap-verify-email-${stage}`,
      entry: 'src/functions/auth/verify-email.ts',
      handler: 'handler',
    });

    const jwtAuthorizerFunction = new nodejsLambda.NodejsFunction(this, 'JwtAuthorizerFunction', {
      ...lambdaProps,
      functionName: `scalemap-jwt-authorizer-${stage}`,
      entry: 'src/functions/auth/jwt-authorizer.ts',
      handler: 'handler',
    });

    // Company Management Functions
    const createCompanyFunction = new nodejsLambda.NodejsFunction(this, 'CreateCompanyFunction', {
      ...lambdaProps,
      functionName: `scalemap-create-company-${stage}`,
      entry: 'src/functions/company/create-company.ts',
      handler: 'handler',
    });

    const getCompanyFunction = new nodejsLambda.NodejsFunction(this, 'GetCompanyFunction', {
      ...lambdaProps,
      functionName: `scalemap-get-company-${stage}`,
      entry: 'src/functions/company/get-company.ts',
      handler: 'handler',
    });

    // Assessment Functions
    const createAssessmentFunction = new nodejsLambda.NodejsFunction(
      this,
      'CreateAssessmentFunction',
      {
        ...lambdaProps,
        functionName: `scalemap-create-assessment-${stage}`,
        entry: 'src/functions/assessment/create-assessment.ts',
        handler: 'handler',
      }
    );

    const getAssessmentFunction = new nodejsLambda.NodejsFunction(this, 'GetAssessmentFunction', {
      ...lambdaProps,
      functionName: `scalemap-get-assessment-${stage}`,
      entry: 'src/functions/assessment/get-assessment.ts',
      handler: 'handler',
    });

    const listAssessmentsFunction = new nodejsLambda.NodejsFunction(
      this,
      'ListAssessmentsFunction',
      {
        ...lambdaProps,
        functionName: `scalemap-list-assessments-${stage}`,
        entry: 'src/functions/assessment/list-assessments.ts',
        handler: 'handler',
      }
    );

    const updateResponsesFunction = new nodejsLambda.NodejsFunction(
      this,
      'UpdateResponsesFunction',
      {
        ...lambdaProps,
        functionName: `scalemap-update-responses-${stage}`,
        entry: 'src/functions/assessment/update-responses.ts',
        handler: 'handler',
      }
    );

    const startAssessmentFunction = new nodejsLambda.NodejsFunction(
      this,
      'StartAssessmentFunction',
      {
        ...lambdaProps,
        functionName: `scalemap-start-assessment-${stage}`,
        entry: 'src/functions/assessment/start-assessment.ts',
        handler: 'handler',
      }
    );

    const updateAssessmentFunction = new nodejsLambda.NodejsFunction(
      this,
      'UpdateAssessmentFunction',
      {
        ...lambdaProps,
        functionName: `scalemap-update-assessment-${stage}`,
        entry: 'src/functions/assessment/update-assessment.ts',
        handler: 'handler',
      }
    );

    // Document Processing Functions
    const uploadHandlerFunction = new nodejsLambda.NodejsFunction(this, 'UploadHandlerFunction', {
      ...lambdaProps,
      functionName: `scalemap-upload-handler-${stage}`,
      entry: 'src/functions/documents/upload-handler.ts',
      handler: 'handler',
      memorySize: 1024,
      timeout: cdk.Duration.minutes(5),
    });

    const processDocumentFunction = new nodejsLambda.NodejsFunction(
      this,
      'ProcessDocumentFunction',
      {
        ...lambdaProps,
        functionName: `scalemap-process-document-${stage}`,
        entry: 'src/functions/documents/process-document.ts',
        handler: 'handler',
        memorySize: 2048,
        timeout: cdk.Duration.minutes(15),
      }
    );

    // Health Check Function
    const healthFunction = new nodejsLambda.NodejsFunction(this, 'HealthFunction', {
      ...lambdaProps,
      functionName: `scalemap-health-${stage}`,
      entry: 'src/functions/health.ts',
      handler: 'handler',
    });

    // Grant DynamoDB permissions to all functions
    const lambdaFunctions = [
      loginFunction,
      refreshTokenFunction,
      registerFunction,
      verifyEmailFunction,
      jwtAuthorizerFunction,
      createCompanyFunction,
      getCompanyFunction,
      createAssessmentFunction,
      getAssessmentFunction,
      listAssessmentsFunction,
      updateResponsesFunction,
      startAssessmentFunction,
      updateAssessmentFunction,
      uploadHandlerFunction,
      processDocumentFunction,
      healthFunction,
    ];

    lambdaFunctions.forEach((fn) => {
      table.grantReadWriteData(fn);
      documentsBucket.grantReadWrite(fn);
    });

    // Grant Textract permissions for document processing
    processDocumentFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'textract:AnalyzeDocument',
          'textract:StartDocumentAnalysis',
          'textract:GetDocumentAnalysis',
        ],
        resources: ['*'],
      })
    );

    // Grant SES permissions for email notifications
    const sesPermissions = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['ses:SendEmail', 'ses:SendRawEmail'],
      resources: ['*'],
    });

    lambdaFunctions.forEach((fn) => {
      fn.addToRolePolicy(sesPermissions);
    });

    // S3 Event Trigger for document processing
    documentsBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(processDocumentFunction),
      { prefix: 'uploads/' }
    );

    // JWT Authorizer for API Gateway
    const jwtAuthorizer = new apigateway.TokenAuthorizer(this, 'JwtAuthorizer', {
      handler: jwtAuthorizerFunction,
      identitySource: 'method.request.header.Authorization',
      authorizerName: `scalemap-jwt-authorizer-${stage}`,
      resultsCacheTtl: cdk.Duration.minutes(5),
    });

    // API Gateway without default CORS - handled by Lambda functions
    const api = new apigateway.RestApi(this, 'ScaleMapApi', {
      restApiName: `ScaleMap API - ${stage}`,
      description: `ScaleMap API for ${stage} environment`,
      // No default CORS - each Lambda handles CORS dynamically via cors-policy.ts
    });

    // Add CORS headers to error responses

    api.addGatewayResponse('UnauthorizedResponse', {
      type: apigateway.ResponseType.UNAUTHORIZED,
      responseHeaders: {
        'Access-Control-Allow-Origin': `'*'`,
        'Access-Control-Allow-Headers':
          "'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token'",
        'Access-Control-Allow-Methods': "'GET,POST,PUT,DELETE,OPTIONS'",
        'Access-Control-Allow-Credentials': "'true'",
      },
    });

    api.addGatewayResponse('ForbiddenResponse', {
      type: apigateway.ResponseType.ACCESS_DENIED,
      responseHeaders: {
        'Access-Control-Allow-Origin': `'*'`,
        'Access-Control-Allow-Headers':
          "'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token'",
        'Access-Control-Allow-Methods': "'GET,POST,PUT,DELETE,OPTIONS'",
        'Access-Control-Allow-Credentials': "'true'",
      },
    });

    // Public endpoints (no authentication)
    const healthIntegration = new apigateway.LambdaIntegration(healthFunction);
    api.root.addResource('health').addMethod('GET', healthIntegration);

    // Auth endpoints
    const authResource = api.root.addResource('auth');
    authResource
      .addResource('login')
      .addMethod('POST', new apigateway.LambdaIntegration(loginFunction));
    authResource
      .addResource('register')
      .addMethod('POST', new apigateway.LambdaIntegration(registerFunction));
    authResource
      .addResource('refresh')
      .addMethod('POST', new apigateway.LambdaIntegration(refreshTokenFunction));
    authResource
      .addResource('verify-email')
      .addMethod('GET', new apigateway.LambdaIntegration(verifyEmailFunction));

    // Protected endpoints (require authentication)
    const protectedMethodOptions = {
      authorizer: jwtAuthorizer,
      authorizationType: apigateway.AuthorizationType.CUSTOM,
    };

    // Company endpoints
    const companyResource = api.root.addResource('company');
    companyResource.addMethod(
      'POST',
      new apigateway.LambdaIntegration(createCompanyFunction),
      protectedMethodOptions
    );

    // Company by ID endpoint: /company/{id}
    const companyByIdResource = companyResource.addResource('{id}');
    companyByIdResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(getCompanyFunction),
      protectedMethodOptions
    );

    // Assessment endpoints
    const assessmentResource = api.root.addResource('assessments');
    assessmentResource.addMethod(
      'POST',
      new apigateway.LambdaIntegration(createAssessmentFunction),
      protectedMethodOptions
    );
    assessmentResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(listAssessmentsFunction),
      protectedMethodOptions
    );
    assessmentResource
      .addResource('responses')
      .addMethod(
        'PUT',
        new apigateway.LambdaIntegration(updateResponsesFunction),
        protectedMethodOptions
      );

    // Individual assessment endpoints: /assessments/{id}
    const assessmentByIdResource = assessmentResource.addResource('{id}');
    assessmentByIdResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(getAssessmentFunction),
      protectedMethodOptions
    );
    assessmentByIdResource.addMethod(
      'PATCH',
      new apigateway.LambdaIntegration(updateAssessmentFunction),
      protectedMethodOptions
    );

    // Assessment action endpoints: /assessments/{id}/start
    const assessmentStartResource = assessmentByIdResource.addResource('start');
    assessmentStartResource.addMethod(
      'POST',
      new apigateway.LambdaIntegration(startAssessmentFunction),
      protectedMethodOptions
    );

    // Document endpoints
    const documentsResource = api.root.addResource('documents');
    documentsResource
      .addResource('upload')
      .addMethod(
        'POST',
        new apigateway.LambdaIntegration(uploadHandlerFunction),
        protectedMethodOptions
      );

    // CloudWatch Alarms for monitoring
    // TODO: Connect alarms to SNS topics for notifications
    new cdk.aws_cloudwatch.Alarm(this, 'ApiErrorAlarm', {
      alarmName: `scalemap-api-errors-${stage}`,
      metric: api.metricServerError(),
      threshold: 10,
      evaluationPeriods: 2,
      treatMissingData: cdk.aws_cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    new cdk.aws_cloudwatch.Alarm(this, 'LambdaErrorAlarm', {
      alarmName: `scalemap-lambda-errors-${stage}`,
      metric: healthFunction.metricErrors(),
      threshold: 5,
      evaluationPeriods: 2,
      treatMissingData: cdk.aws_cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // Cost monitoring alarm
    new cdk.aws_cloudwatch.Alarm(this, 'CostAlarm', {
      alarmName: `scalemap-cost-${stage}`,
      metric: new cdk.aws_cloudwatch.Metric({
        namespace: 'AWS/Billing',
        metricName: 'EstimatedCharges',
        dimensionsMap: {
          Currency: 'USD',
        },
        statistic: 'Maximum',
      }),
      threshold: stage === 'production' ? 200 : 50,
      evaluationPeriods: 1,
      treatMissingData: cdk.aws_cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // Outputs
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: `API Gateway URL for ${stage}`,
      exportName: `ScaleMap-ApiUrl-${stage}`,
    });

    new cdk.CfnOutput(this, 'TableName', {
      value: table.tableName,
      description: `DynamoDB table name for ${stage}`,
      exportName: `ScaleMap-TableName-${stage}`,
    });

    new cdk.CfnOutput(this, 'DocumentsBucketName', {
      value: documentsBucket.bucketName,
      description: `S3 bucket name for documents in ${stage}`,
      exportName: `ScaleMap-DocumentsBucket-${stage}`,
    });

    new cdk.CfnOutput(this, 'DlqUrl', {
      value: dlq.queueUrl,
      description: `Dead letter queue URL for ${stage}`,
      exportName: `ScaleMap-DlqUrl-${stage}`,
    });
  }
}
