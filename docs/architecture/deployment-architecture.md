# Deployment Architecture

## Infrastructure as Code (AWS CDK)

```typescript
// infrastructure/stacks/scalemap-stack.ts
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';

export class ScaleMapStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // DynamoDB Table
    const mainTable = new dynamodb.Table(this, 'ScaleMapTable', {
      tableName: 'scalemap-main',
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Global Secondary Indexes
    mainTable.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },
    });

    // SQS Queues
    const assessmentQueue = new sqs.Queue(this, 'AssessmentQueue', {
      queueName: 'scalemap-assessments',
      visibilityTimeout: cdk.Duration.minutes(15),
      retentionPeriod: cdk.Duration.days(14),
    });

    const agentQueue = new sqs.Queue(this, 'AgentQueue', {
      queueName: 'scalemap-agents',
      visibilityTimeout: cdk.Duration.minutes(10),
      retentionPeriod: cdk.Duration.days(14),
    });

    // Lambda Functions
    const apiFunction = new lambda.Function(this, 'ApiFunction', {
      functionName: 'scalemap-api',
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromAsset('dist/backend'),
      handler: 'api/index.handler',
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: {
        TABLE_NAME: mainTable.tableName,
        ASSESSMENT_QUEUE_URL: assessmentQueue.queueUrl,
        AGENT_QUEUE_URL: agentQueue.queueUrl,
      },
    });

    const orchestratorFunction = new lambda.Function(this, 'OrchestratorFunction', {
      functionName: 'scalemap-orchestrator',
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromAsset('dist/backend'),
      handler: 'orchestrator/index.handler',
      timeout: cdk.Duration.minutes(15),
      memorySize: 1024,
    });

    const agentFunction = new lambda.Function(this, 'AgentFunction', {
      functionName: 'scalemap-agent',
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromAsset('dist/backend'),
      handler: 'agents/index.handler',
      timeout: cdk.Duration.minutes(10),
      memorySize: 2048,
    });

    // Permissions
    mainTable.grantReadWriteData(apiFunction);
    mainTable.grantReadWriteData(orchestratorFunction);
    mainTable.grantReadWriteData(agentFunction);
    
    assessmentQueue.grantSendMessages(apiFunction);
    assessmentQueue.grantConsumeMessages(orchestratorFunction);
    agentQueue.grantSendMessages(orchestratorFunction);
    agentQueue.grantConsumeMessages(agentFunction);

    // API Gateway
    const api = new apigateway.RestApi(this, 'ScaleMapApi', {
      restApiName: 'ScaleMap API',
      description: 'Growth Bottleneck Intelligence API',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key'],
      },
    });

    const integration = new apigateway.LambdaIntegration(apiFunction);
    api.root.addProxy({
      defaultIntegration: integration,
    });

    // S3 Bucket for static assets
    const assetsBucket = new s3.Bucket(this, 'AssetsBucket', {
      bucketName: 'scalemap-assets',
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });

    // CloudFront Distribution for Frontend
    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: new origins.S3Origin(assetsBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
    });
  }
}
```

## Environment Configuration

```yaml
# environments/dev.yaml
environment: dev
region: us-east-1
domain: dev.scalemap.com
resources:
  dynamodb:
    billingMode: PAY_PER_REQUEST
  lambda:
    memorySize: 512
    timeout: 30
  sqs:
    visibilityTimeout: 900

# environments/staging.yaml
environment: staging
region: us-east-1
domain: staging.scalemap.com
resources:
  dynamodb:
    billingMode: PAY_PER_REQUEST
  lambda:
    memorySize: 1024
    timeout: 60
  sqs:
    visibilityTimeout: 900

# environments/production.yaml
environment: production
region: us-east-1
domain: scalemap.com
resources:
  dynamodb:
    billingMode: PROVISIONED
    readCapacity: 10
    writeCapacity: 10
  lambda:
    memorySize: 2048
    timeout: 120
  sqs:
    visibilityTimeout: 900
```

## CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy ScaleMap

on:
  push:
    branches: [main, staging, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm run test:ci
      
      - name: Build backend
        run: npm run build:backend
      
      - name: Build frontend
        run: npm run build:frontend

  deploy-dev:
    if: github.ref == 'refs/heads/develop'
    needs: test
    runs-on: ubuntu-latest
    environment: development
    steps:
      - uses: actions/checkout@v3
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      
      - name: Deploy infrastructure
        run: npx cdk deploy --require-approval never --context env=dev
      
      - name: Deploy backend
        run: npm run deploy:backend:dev
      
      - name: Deploy frontend
        run: npm run deploy:frontend:dev

  deploy-production:
    if: github.ref == 'refs/heads/main'
    needs: test
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v3
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      
      - name: Deploy with blue-green strategy
        run: npm run deploy:production:blue-green
      
      - name: Run smoke tests
        run: npm run test:smoke:production
```

## Blue-Green Deployment

```typescript
// scripts/deploy-blue-green.ts
import { LambdaClient, UpdateAliasCommand, GetAliasCommand } from '@aws-sdk/client-lambda';

export class BlueGreenDeployment {
  private lambda = new LambdaClient({});

  async deployNewVersion(functionName: string, version: string) {
    const greenAlias = await this.lambda.send(new UpdateAliasCommand({
      FunctionName: functionName,
      Name: 'green',
      FunctionVersion: version,
    }));

    const healthCheck = await this.runHealthChecks(`${functionName}:green`);
    if (!healthCheck.passed) {
      throw new Error('Health checks failed for green deployment');
    }

    return greenAlias;
  }

  async switchTraffic(functionName: string) {
    const greenAlias = await this.lambda.send(new GetAliasCommand({
      FunctionName: functionName,
      Name: 'green',
    }));

    await this.lambda.send(new UpdateAliasCommand({
      FunctionName: functionName,
      Name: 'blue',
      FunctionVersion: greenAlias.FunctionVersion,
    }));
  }

  private async runHealthChecks(functionArn: string): Promise<{ passed: boolean }> {
    return { passed: true };
  }
}
```
