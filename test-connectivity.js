// Simple connectivity test for live services
const OpenAI = require('openai');
const { DynamoDBClient, ListTablesCommand } = require('@aws-sdk/client-dynamodb');
const { S3Client, ListBucketsCommand } = require('@aws-sdk/client-s3');
const { SESClient, GetSendStatisticsCommand } = require('@aws-sdk/client-ses');

async function testServices() {
  console.log('🔄 Testing live service connectivity...\n');

  // Test OpenAI
  console.log('1. Testing OpenAI API...');
  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      organization: process.env.OPENAI_ORGANIZATION_ID,
    });

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Hello! Just testing connectivity.' }],
      max_tokens: 10
    });

    console.log('✅ OpenAI: Connected successfully');
    console.log('   Model:', response.model);
    console.log('   Usage:', response.usage);
  } catch (error) {
    console.log('❌ OpenAI: Failed -', error.message);
  }

  // Test DynamoDB
  console.log('\n2. Testing DynamoDB...');
  try {
    const dynamoClient = new DynamoDBClient({
      region: process.env.AWS_REGION || 'eu-west-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });

    const result = await dynamoClient.send(new ListTablesCommand({}));
    console.log('✅ DynamoDB: Connected successfully');
    console.log('   Region:', process.env.AWS_REGION);
    console.log('   Tables:', result.TableNames);
  } catch (error) {
    console.log('❌ DynamoDB: Failed -', error.message);
  }

  // Test S3
  console.log('\n3. Testing S3...');
  try {
    const s3Client = new S3Client({
      region: process.env.AWS_REGION || 'eu-west-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });

    const result = await s3Client.send(new ListBucketsCommand({}));
    console.log('✅ S3: Connected successfully');
    console.log('   Bucket count:', result.Buckets.length);
    console.log('   Target bucket:', process.env.S3_BUCKET_NAME);
  } catch (error) {
    console.log('❌ S3: Failed -', error.message);
  }

  // Test SES
  console.log('\n4. Testing SES...');
  try {
    const sesClient = new SESClient({
      region: process.env.AWS_REGION || 'eu-west-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });

    const result = await sesClient.send(new GetSendStatisticsCommand({}));
    console.log('✅ SES: Connected successfully');
    console.log('   From email:', process.env.SES_FROM_EMAIL);
    console.log('   Stats points:', result.SendDataPoints?.length || 0);
  } catch (error) {
    console.log('❌ SES: Failed -', error.message);
  }

  console.log('\n🎯 Connectivity test completed!');
}

testServices().catch(console.error);