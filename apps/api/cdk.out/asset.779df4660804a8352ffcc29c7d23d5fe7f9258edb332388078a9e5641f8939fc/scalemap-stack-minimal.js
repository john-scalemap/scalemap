"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScaleMapStackMinimal = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const apigateway = __importStar(require("aws-cdk-lib/aws-apigateway"));
const dynamodb = __importStar(require("aws-cdk-lib/aws-dynamodb"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
const s3 = __importStar(require("aws-cdk-lib/aws-s3"));
const sqs = __importStar(require("aws-cdk-lib/aws-sqs"));
class ScaleMapStackMinimal extends cdk.Stack {
    constructor(scope, id, props) {
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
        // Health Check Function (minimal working function)
        const healthFunction = new lambda.Function(this, 'HealthFunction', {
            functionName: `scalemap-health-${stage}`,
            runtime: lambda.Runtime.NODEJS_18_X,
            handler: 'functions/health.handler',
            code: lambda.Code.fromAsset('dist'),
            environment: commonEnvVars,
            memorySize: 512,
            timeout: cdk.Duration.seconds(30),
            deadLetterQueue: dlq,
            logRetention: logs.RetentionDays.ONE_MONTH,
        });
        // Grant DynamoDB permissions
        table.grantReadWriteData(healthFunction);
        documentsBucket.grantReadWrite(healthFunction);
        // Grant SES permissions for email notifications
        const sesPermissions = new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'ses:SendEmail',
                'ses:SendRawEmail'
            ],
            resources: ['*'],
        });
        healthFunction.addToRolePolicy(sesPermissions);
        // API Gateway with basic configuration
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
        // Health endpoint
        const healthIntegration = new apigateway.LambdaIntegration(healthFunction);
        api.root.addResource('health').addMethod('GET', healthIntegration);
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
exports.ScaleMapStackMinimal = ScaleMapStackMinimal;
