# AWS Account Setup Guide for ScaleMap

## Overview
This guide will help you create an AWS account and set up the services needed for ScaleMap production deployment. Total estimated cost: £10-50/month for initial usage.

## Step 1: Create AWS Account

1. **Go to AWS**: Visit https://aws.amazon.com/
2. **Create Account**: Click "Create an AWS Account"
3. **Account Details**:
   - Email: Use your business email
   - Account name: "ScaleMap Production" (or similar)
   - Contact type: Business
   - Business/Company name: Your company name
4. **Payment Method**: Add credit/debit card (required even for free tier)
5. **Identity Verification**: Phone verification required
6. **Support Plan**: Select "Basic support" (free)

## Step 2: Secure Your Root Account

⚠️ **CRITICAL SECURITY STEP**

1. **Enable MFA on Root Account**:
   - Go to AWS Console → Your Name → Security Credentials
   - Click "Assign MFA device"
   - Use phone app (Google Authenticator, Authy, etc.)

2. **Create IAM Admin User** (Don't use root account for daily use):
   - Go to IAM service in AWS Console
   - Click "Users" → "Add User"
   - Username: `scalemap-admin`
   - Access type: ☑️ Programmatic access ☑️ AWS Management Console access
   - Set console password (choose strong password)
   - Attach existing policy: `AdministratorAccess`
   - **SAVE THE ACCESS KEYS** - you'll need these!

## Step 3: Choose Your AWS Region

**Recommended**: `eu-west-1` (Europe - Ireland)
- Good performance for UK/EU users
- All services available
- GDPR compliant data location

Set this as your default region in the AWS Console (top right).

## Step 4: Enable Required AWS Services

### 4.1 DynamoDB (Database)
- Go to DynamoDB service
- Click "Create table"
- Table name: `scalemap-prod`
- Partition key: `PK` (String)
- Sort key: `SK` (String)
- Settings: Use default settings → Create table
- **Note**: We'll configure this properly via code later

### 4.2 S3 (File Storage)
- Go to S3 service
- Click "Create bucket"
- Bucket name: `scalemap-documents-prod-[your-unique-suffix]` (must be globally unique)
- Region: eu-west-1
- Keep all default settings → Create bucket

### 4.3 SES (Email Service)
- Go to Simple Email Service (SES)
- Click "Create identity"
- Identity type: Email address
- Email: Your business email (e.g., noreply@yourdomain.com)
- Click "Create identity"
- **Verify email**: Check your inbox and click verification link
- **Note**: Initially in "sandbox mode" - can only send to verified emails

### 4.4 Textract (Document Processing)
- No setup required - service is available by default in eu-west-1

## Step 5: Create ScaleMap Service User

Create a dedicated user for ScaleMap application (not for human use):

1. **Go to IAM → Users → Add User**:
   - Username: `scalemap-service`
   - Access type: ☑️ Programmatic access only (no console)
   - No password needed

2. **Create Custom Policy**:
   - Click "Create Policy"
   - JSON tab, paste this policy:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "dynamodb:PutItem",
                "dynamodb:GetItem",
                "dynamodb:UpdateItem",
                "dynamodb:DeleteItem",
                "dynamodb:Query",
                "dynamodb:Scan",
                "dynamodb:BatchGetItem",
                "dynamodb:BatchWriteItem"
            ],
            "Resource": "arn:aws:dynamodb:eu-west-1:*:table/scalemap-*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:PutObject",
                "s3:DeleteObject",
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::scalemap-documents-*",
                "arn:aws:s3:::scalemap-documents-*/*"
            ]
        },
        {
            "Effect": "Allow",
            "Action": [
                "ses:SendEmail",
                "ses:SendRawEmail",
                "ses:SendTemplatedEmail"
            ],
            "Resource": "*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "textract:AnalyzeDocument",
                "textract:DetectDocumentText",
                "textract:GetDocumentAnalysis",
                "textract:StartDocumentAnalysis"
            ],
            "Resource": "*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:PutLogEvents"
            ],
            "Resource": "*"
        }
    ]
}
```

3. **Policy Details**:
   - Name: `ScaleMapServicePolicy`
   - Description: "Service permissions for ScaleMap application"
   - Click "Create Policy"

4. **Attach Policy to User**:
   - Back to user creation
   - Select "Attach existing policies directly"
   - Search for `ScaleMapServicePolicy` and select it
   - Click "Next" → "Create User"

5. **⚠️ SAVE THE CREDENTIALS**:
   - Access Key ID: `AKIA...`
   - Secret Access Key: (shown once - copy immediately!)

## Step 6: Your Environment Variables

After completing the AWS setup, you'll have these credentials:

```bash
# OpenAI (you already provided these)
OPENAI_API_KEY=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
OPENAI_ORGANIZATION_ID=org-2eECvyR0SrbIqwwa9PgtaIXS

# AWS (from Step 5)
AWS_ACCESS_KEY_ID=AKIA... # Your scalemap-service user access key
AWS_SECRET_ACCESS_KEY=... # Your scalemap-service user secret key
AWS_REGION=eu-west-1

# Service Configuration (update with your actual names)
DYNAMODB_TABLE_NAME=scalemap-prod
S3_BUCKET_NAME=scalemap-documents-prod-[your-suffix]
SES_FROM_EMAIL=your-verified-email@yourdomain.com
```

## Step 7: Verify Setup

You can test your setup using the AWS CLI:

1. Install AWS CLI: `brew install awscli` (on Mac)
2. Configure: `aws configure` (enter your access keys)
3. Test DynamoDB: `aws dynamodb list-tables`
4. Test S3: `aws s3 ls`

## Cost Estimation

**Free Tier Eligible Services** (first 12 months):
- DynamoDB: 25GB storage + 25 read/write capacity units
- S3: 5GB storage + 20,000 GET requests
- SES: 200 emails/day
- Lambda: 1M free requests/month

**Expected Monthly Costs** (after free tier):
- DynamoDB: £2-10 (pay-per-request)
- S3: £1-5 (document storage)
- SES: £0-2 (email sending)
- Textract: £2-10 (document processing)
- **Total: £5-30/month** for moderate usage

## Security Best Practices

✅ **Completed**:
- Root account MFA enabled
- Dedicated service user with minimal permissions
- Programmatic access only for service account

📋 **Ongoing**:
- Regularly rotate access keys (quarterly)
- Monitor usage in AWS CloudWatch
- Set up billing alerts for cost control

## Troubleshooting

**Common Issues**:
- **Region mismatch**: Ensure all services are in `eu-west-1`
- **SES sandbox**: Initially can only send to verified emails
- **S3 bucket names**: Must be globally unique, try different suffix

## Next Steps

Once you complete this setup:
1. Provide me with the AWS access keys from Step 5
2. I'll configure the ScaleMap application to use these services
3. We'll test the integration with live services

**Questions or stuck on any step?** Let me know which part needs clarification!