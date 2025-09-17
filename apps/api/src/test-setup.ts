// Global test setup for @scalemap/api package

// Mock AWS SDK
jest.mock('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/lib-dynamodb');
jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/client-sqs');

// Set test environment variables
process.env.TABLE_NAME = 'test-table';
process.env.STAGE = 'test';
process.env.AWS_REGION = 'us-east-1';