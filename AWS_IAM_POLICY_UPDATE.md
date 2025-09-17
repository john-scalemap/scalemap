# AWS IAM Policy Update Required

## Issue
The `scalemap-service` user needs additional permissions to access AWS services.

## Current Status
✅ **OpenAI API**: Working perfectly
❌ **AWS Services**: Permissions needed

## Required IAM Policy Updates

Go to AWS IAM Console → Users → scalemap-service → Permissions → Add permissions

Replace the existing `ScaleMapServicePolicy` with this updated policy:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "DynamoDBAccess",
            "Effect": "Allow",
            "Action": [
                "dynamodb:PutItem",
                "dynamodb:GetItem",
                "dynamodb:UpdateItem",
                "dynamodb:DeleteItem",
                "dynamodb:Query",
                "dynamodb:Scan",
                "dynamodb:BatchGetItem",
                "dynamodb:BatchWriteItem",
                "dynamodb:ListTables",
                "dynamodb:DescribeTable"
            ],
            "Resource": [
                "arn:aws:dynamodb:eu-west-1:*:table/scalemap-*",
                "arn:aws:dynamodb:eu-west-1:*:table/scalemap-*/index/*"
            ]
        },
        {
            "Sid": "S3Access",
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:PutObject",
                "s3:DeleteObject",
                "s3:ListBucket",
                "s3:GetObjectAttributes",
                "s3:PutObjectAcl"
            ],
            "Resource": [
                "arn:aws:s3:::scalemap-documents-*",
                "arn:aws:s3:::scalemap-documents-*/*"
            ]
        },
        {
            "Sid": "S3ListBuckets",
            "Effect": "Allow",
            "Action": [
                "s3:ListAllMyBuckets",
                "s3:GetBucketLocation"
            ],
            "Resource": "*"
        },
        {
            "Sid": "SESAccess",
            "Effect": "Allow",
            "Action": [
                "ses:SendEmail",
                "ses:SendRawEmail",
                "ses:SendTemplatedEmail",
                "ses:GetSendStatistics",
                "ses:GetSendQuota",
                "ses:ListIdentities",
                "ses:GetIdentityVerificationAttributes"
            ],
            "Resource": "*"
        },
        {
            "Sid": "TextractAccess",
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
            "Sid": "CloudWatchLogsAccess",
            "Effect": "Allow",
            "Action": [
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:PutLogEvents",
                "logs:DescribeLogStreams",
                "logs:DescribeLogGroups"
            ],
            "Resource": "arn:aws:logs:eu-west-1:*:*"
        }
    ]
}
```

## Steps to Update

1. Go to **AWS IAM Console**
2. Navigate to **Users** → **scalemap-service**
3. Click **Permissions** tab
4. Find **ScaleMapServicePolicy** and click **Edit**
5. Replace the JSON policy with the updated version above
6. Click **Review policy** → **Save changes**

## Test After Update

Run the connectivity test again:
```bash
node test-connectivity.js
```

All services should show ✅ after the policy update.

## Security Notes

- This policy follows least-privilege principles
- Only grants access to scalemap-* resources where possible
- Uses specific resource ARNs to limit scope
- Regional restrictions to eu-west-1 where applicable