import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, ScanCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';

import { logger } from '../utils/logger';
import { Monitoring, withTiming } from '../utils/monitoring';

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'eu-west-1',
  ...(process.env.AWS_ACCESS_KEY_ID && {
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  }),
  ...(process.env.DYNAMODB_ENDPOINT && {
    endpoint: process.env.DYNAMODB_ENDPOINT,
  }),
});

const docClient = DynamoDBDocumentClient.from(client);

export class DatabaseService {
  private tableName: string;

  constructor(tableName?: string) {
    this.tableName = tableName || process.env.DYNAMODB_TABLE_NAME || 'scalemap-prod';
  }

  async put(item: Record<string, unknown>): Promise<void> {
    return withTiming(
      async () => {
        const command = new PutCommand({
          TableName: this.tableName,
          Item: {
            ...item,
            createdAt: item.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        });

        await docClient.send(command);
        logger.info('Item created', { tableName: this.tableName, pk: item.PK });
        Monitoring.incrementCounter('DatabaseWrites', { table: this.tableName });
      },
      'DatabasePutLatency',
      { table: this.tableName }
    );
  }

  async get(pk: string, sk: string): Promise<Record<string, unknown> | null> {
    return withTiming(
      async () => {
        const command = new GetCommand({
          TableName: this.tableName,
          Key: { PK: pk, SK: sk },
        });

        const result = await docClient.send(command);
        Monitoring.incrementCounter('DatabaseReads', { table: this.tableName });

        return result.Item || null;
      },
      'DatabaseGetLatency',
      { table: this.tableName }
    );
  }

  async query(
    keyConditionExpression: string,
    expressionAttributeValues: Record<string, unknown>,
    options: {
      indexName?: string;
      limit?: number;
      scanIndexForward?: boolean;
      filterExpression?: string;
      expressionAttributeNames?: Record<string, string>;
    } = {}
  ): Promise<Record<string, unknown>[]> {
    return withTiming(
      async () => {
        const command = new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: keyConditionExpression,
          ExpressionAttributeValues: expressionAttributeValues,
          IndexName: options.indexName,
          Limit: options.limit,
          ScanIndexForward: options.scanIndexForward,
          FilterExpression: options.filterExpression,
          ExpressionAttributeNames: options.expressionAttributeNames,
        });

        const result = await docClient.send(command);
        logger.info('Query executed', {
          tableName: this.tableName,
          indexName: options.indexName,
          itemCount: result.Items?.length || 0,
        });
        Monitoring.incrementCounter('DatabaseQueries', {
          table: this.tableName,
          index: options.indexName || 'primary'
        });

        return result.Items || [];
      },
      'DatabaseQueryLatency',
      { table: this.tableName, index: options.indexName || 'primary' }
    );
  }

  async update(
    pk: string,
    sk: string,
    updateExpression: string,
    expressionAttributeValues: Record<string, unknown>,
    expressionAttributeNames?: Record<string, string>
  ): Promise<Record<string, unknown> | null> {
    return withTiming(
      async () => {
        const command = new UpdateCommand({
          TableName: this.tableName,
          Key: { PK: pk, SK: sk },
          UpdateExpression: updateExpression,
          ExpressionAttributeValues: {
            ...expressionAttributeValues,
            ':updatedAt': new Date().toISOString(),
          },
          ExpressionAttributeNames: expressionAttributeNames,
          ReturnValues: 'ALL_NEW',
        });

        const result = await docClient.send(command);
        logger.info('Item updated', { tableName: this.tableName, pk, sk });
        Monitoring.incrementCounter('DatabaseUpdates', { table: this.tableName });

        return result.Attributes || null;
      },
      'DatabaseUpdateLatency',
      { table: this.tableName }
    );
  }

  async delete(pk: string, sk: string): Promise<void> {
    return withTiming(
      async () => {
        const command = new DeleteCommand({
          TableName: this.tableName,
          Key: { PK: pk, SK: sk },
        });

        await docClient.send(command);
        logger.info('Item deleted', { tableName: this.tableName, pk, sk });
        Monitoring.incrementCounter('DatabaseDeletes', { table: this.tableName });
      },
      'DatabaseDeleteLatency',
      { table: this.tableName }
    );
  }

  async scan(options: {
    limit?: number;
    filterExpression?: string;
    expressionAttributeValues?: Record<string, unknown>;
  } = {}): Promise<Record<string, unknown>[]> {
    return withTiming(
      async () => {
        const command = new ScanCommand({
          TableName: this.tableName,
          Limit: options.limit,
          FilterExpression: options.filterExpression,
          ExpressionAttributeValues: options.expressionAttributeValues,
        });

        const result = await docClient.send(command);
        logger.info('Scan executed', {
          tableName: this.tableName,
          itemCount: result.Items?.length || 0,
        });
        Monitoring.incrementCounter('DatabaseScans', { table: this.tableName });

        return result.Items || [];
      },
      'DatabaseScanLatency',
      { table: this.tableName }
    );
  }
}

// Default database service instance
export const db = new DatabaseService();