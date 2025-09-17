import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as ses from 'aws-cdk-lib/aws-ses';
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
      cors: [{
        allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.POST, s3.HttpMethods.PUT],
        allowedOrigins: stage === 'production' ? ['https://scalemap.ai'] : ['*'],
        allowedHeaders: ['*'],
        maxAge: 300,
      }],
      lifecycleRules: [{
        id: 'cost-optimization',
        enabled: true,
        transitions: [{
          storageClass: s3.StorageClass.INFREQUENT_ACCESS,
          transitionAfter: cdk.Duration.days(30),
        }, {
          storageClass: s3.StorageClass.GLACIER,
          transitionAfter: cdk.Duration.days(90),
        }],
      }],
      removalPolicy: stage === 'production' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Dead Letter Queue for failed Lambda invocations
    const dlq = new sqs.Queue(this, 'DeadLetterQueue', {
      queueName: `scalemap-dlq-${stage}`,
      retentionPeriod: cdk.Duration.days(14),
    });

    // Common Lambda environment variables
    const commonEnvVars = {
      TABLE_NAME: table.tableName,
      DOCUMENTS_BUCKET: documentsBucket.bucketName,
      STAGE: stage,
      REGION: this.region,
      DLQ_URL: dlq.queueUrl,
    };

    // Common Lambda configuration
    const lambdaProps = {
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromAsset('dist'),
      environment: commonEnvVars,
      deadLetterQueue: dlq,
      logRetention: logs.RetentionDays.ONE_MONTH,
    };

    // Authentication Lambda Functions
    const loginFunction = new lambda.Function(this, 'LoginFunction', {
      ...lambdaProps,
      functionName: `scalemap-login-${stage}`,
      handler: 'functions/auth/login.handler',
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
    });

    const refreshTokenFunction = new lambda.Function(this, 'RefreshTokenFunction', {
      ...lambdaProps,
      functionName: `scalemap-refresh-token-${stage}`,
      handler: 'functions/auth/refresh-token.handler',
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
    });

    const registerFunction = new lambda.Function(this, 'RegisterFunction', {
      ...lambdaProps,
      functionName: `scalemap-register-${stage}`,
      handler: 'functions/auth/register.handler',
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
    });

    // Company Management Functions
    const createCompanyFunction = new lambda.Function(this, 'CreateCompanyFunction', {
      ...lambdaProps,
      functionName: `scalemap-create-company-${stage}`,
      handler: 'functions/company/create-company.handler',
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
    });

    const getCompanyFunction = new lambda.Function(this, 'GetCompanyFunction', {
      ...lambdaProps,
      functionName: `scalemap-get-company-${stage}`,
      handler: 'functions/company/get-company.handler',
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
    });

    // Assessment Functions
    const createAssessmentFunction = new lambda.Function(this, 'CreateAssessmentFunction', {
      ...lambdaProps,
      functionName: `scalemap-create-assessment-${stage}`,
      handler: 'functions/assessment/create-assessment.handler',
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
    });

    const getAssessmentFunction = new lambda.Function(this, 'GetAssessmentFunction', {
      ...lambdaProps,
      functionName: `scalemap-get-assessment-${stage}`,
      handler: 'functions/assessment/get-assessment.handler',
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
    });

    const updateResponsesFunction = new lambda.Function(this, 'UpdateResponsesFunction', {
      ...lambdaProps,
      functionName: `scalemap-update-responses-${stage}`,
      handler: 'functions/assessment/update-responses.handler',
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
    });

    // Document Processing Functions
    const uploadHandlerFunction = new lambda.Function(this, 'UploadHandlerFunction', {
      ...lambdaProps,
      functionName: `scalemap-upload-handler-${stage}`,
      handler: 'functions/documents/upload-handler.handler',
      memorySize: 1024,
      timeout: cdk.Duration.minutes(5),
    });

    const processDocumentFunction = new lambda.Function(this, 'ProcessDocumentFunction', {
      ...lambdaProps,
      functionName: `scalemap-process-document-${stage}`,
      handler: 'functions/documents/process-document.handler',
      memorySize: 2048,
      timeout: cdk.Duration.minutes(15),
    });

    // Health Check Function
    const healthFunction = new lambda.Function(this, 'HealthFunction', {
      ...lambdaProps,
      functionName: `scalemap-health-${stage}`,
      handler: 'functions/health.handler',
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
    });

    // Grant DynamoDB permissions to all functions
    const lambdaFunctions = [
      loginFunction, refreshTokenFunction, registerFunction,
      createCompanyFunction, getCompanyFunction,
      createAssessmentFunction, getAssessmentFunction, updateResponsesFunction,
      uploadHandlerFunction, processDocumentFunction,
      healthFunction
    ];

    lambdaFunctions.forEach(fn => {
      table.grantReadWriteData(fn);
      documentsBucket.grantReadWrite(fn);
    });

    // Grant Textract permissions for document processing
    processDocumentFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'textract:AnalyzeDocument',
        'textract:StartDocumentAnalysis',
        'textract:GetDocumentAnalysis'
      ],
      resources: ['*'],
    }));

    // Grant SES permissions for email notifications
    const sesPermissions = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'ses:SendEmail',
        'ses:SendRawEmail'
      ],
      resources: ['*'],
    });

    lambdaFunctions.forEach(fn => {
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
      handler: refreshTokenFunction, // Use refresh token function for JWT validation
      identitySource: 'method.request.header.Authorization',
      authorizerName: `scalemap-jwt-authorizer-${stage}`,
      resultsCacheTtl: cdk.Duration.minutes(5),
    });

    // API Gateway with proper CORS and rate limiting
    const api = new apigateway.RestApi(this, 'ScaleMapApi', {
      restApiName: `ScaleMap API - ${stage}`,
      description: `ScaleMap API for ${stage} environment`,
      defaultCorsPreflightOptions: {
        allowOrigins: stage === 'production' ? ['https://scalemap.ai'] : apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization', 'X-Amz-Date', 'X-Api-Key', 'X-Amz-Security-Token'],
        allowCredentials: true,
      },
    });

    // Public endpoints (no authentication)
    const healthIntegration = new apigateway.LambdaIntegration(healthFunction);
    api.root.addResource('health').addMethod('GET', healthIntegration);

    // Auth endpoints
    const authResource = api.root.addResource('auth');
    authResource.addResource('login').addMethod('POST', new apigateway.LambdaIntegration(loginFunction));
    authResource.addResource('register').addMethod('POST', new apigateway.LambdaIntegration(registerFunction));
    authResource.addResource('refresh').addMethod('POST', new apigateway.LambdaIntegration(refreshTokenFunction));

    // Protected endpoints (require authentication)
    const protectedMethodOptions = {
      authorizer: jwtAuthorizer,
      authorizationType: apigateway.AuthorizationType.CUSTOM,
    };

    // Company endpoints
    const companyResource = api.root.addResource('company');
    companyResource.addMethod('POST', new apigateway.LambdaIntegration(createCompanyFunction), protectedMethodOptions);
    companyResource.addMethod('GET', new apigateway.LambdaIntegration(getCompanyFunction), protectedMethodOptions);

    // Assessment endpoints
    const assessmentResource = api.root.addResource('assessment');
    assessmentResource.addMethod('POST', new apigateway.LambdaIntegration(createAssessmentFunction), protectedMethodOptions);
    assessmentResource.addMethod('GET', new apigateway.LambdaIntegration(getAssessmentFunction), protectedMethodOptions);
    assessmentResource.addResource('responses').addMethod('PUT', new apigateway.LambdaIntegration(updateResponsesFunction), protectedMethodOptions);

    // Document endpoints
    const documentsResource = api.root.addResource('documents');
    documentsResource.addResource('upload').addMethod('POST', new apigateway.LambdaIntegration(uploadHandlerFunction), protectedMethodOptions);

    // CloudWatch Alarms for monitoring
    const apiErrorAlarm = new cdk.aws_cloudwatch.Alarm(this, 'ApiErrorAlarm', {
      alarmName: `scalemap-api-errors-${stage}`,
      metric: api.metricServerError(),
      threshold: 10,
      evaluationPeriods: 2,
      treatMissingData: cdk.aws_cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    const lambdaErrorAlarm = new cdk.aws_cloudwatch.Alarm(this, 'LambdaErrorAlarm', {
      alarmName: `scalemap-lambda-errors-${stage}`,
      metric: healthFunction.metricErrors(),
      threshold: 5,
      evaluationPeriods: 2,
      treatMissingData: cdk.aws_cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // Cost monitoring alarm
    const costAlarm = new cdk.aws_cloudwatch.Alarm(this, 'CostAlarm', {
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