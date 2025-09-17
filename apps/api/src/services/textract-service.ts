import {
  TextractClient,
  AnalyzeDocumentCommand,
  StartDocumentAnalysisCommand,
  GetDocumentAnalysisCommand,
  FeatureType,
  Block
} from '@aws-sdk/client-textract';
import { ProcessedDocument } from '@scalemap/shared';

export interface TextractConfig {
  region: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}

export interface DocumentAnalysisResult {
  text: string;
  tables: TableData[];
  forms: FormData[];
  confidence: number;
  processingTime: number;
  pageCount: number;
}

export interface TableData {
  rows: string[][];
  confidence: number;
}

export interface FormData {
  key: string;
  value: string;
  confidence: number;
}

export interface DocumentProcessingJob {
  jobId: string;
  status: 'IN_PROGRESS' | 'SUCCEEDED' | 'FAILED' | 'PARTIAL_SUCCESS';
  statusMessage?: string;
  pages?: number;
}

export class TextractService {
  private client: TextractClient;

  constructor(config?: Partial<TextractConfig>) {
    const finalConfig = {
      region: process.env.AWS_REGION || 'eu-west-1',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      ...config
    };

    const clientConfig: any = {
      region: finalConfig.region,
    };

    if (finalConfig.accessKeyId && finalConfig.secretAccessKey) {
      clientConfig.credentials = {
        accessKeyId: finalConfig.accessKeyId,
        secretAccessKey: finalConfig.secretAccessKey,
      };
    }

    this.client = new TextractClient(clientConfig);
  }

  /**
   * Analyze document synchronously (for small documents < 5MB)
   */
  async analyzeDocument(s3Bucket: string, s3Key: string): Promise<DocumentAnalysisResult> {
    const startTime = Date.now();

    try {
      const command = new AnalyzeDocumentCommand({
        Document: {
          S3Object: {
            Bucket: s3Bucket,
            Name: s3Key,
          },
        },
        FeatureTypes: [FeatureType.TABLES, FeatureType.FORMS],
      });

      const response = await this.client.send(command);

      if (!response.Blocks) {
        throw new Error('No blocks returned from Textract analysis');
      }

      const processingTime = Date.now() - startTime;

      return this.processBlocks(response.Blocks, processingTime);

    } catch (error) {
      console.error('Textract analysis error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Document analysis failed: ${errorMessage}`);
    }
  }

  /**
   * Start asynchronous document analysis (for large documents)
   */
  async startDocumentAnalysis(
    s3Bucket: string,
    s3Key: string,
    notificationChannel?: {
      snsTopicArn: string;
      roleArn: string;
    }
  ): Promise<DocumentProcessingJob> {
    try {
      const command = new StartDocumentAnalysisCommand({
        DocumentLocation: {
          S3Object: {
            Bucket: s3Bucket,
            Name: s3Key,
          },
        },
        FeatureTypes: [FeatureType.TABLES, FeatureType.FORMS],
        ...(notificationChannel && {
          NotificationChannel: {
            SNSTopicArn: notificationChannel.snsTopicArn,
            RoleArn: notificationChannel.roleArn,
          },
        }),
      });

      const response = await this.client.send(command);

      if (!response.JobId) {
        throw new Error('Failed to start document analysis job');
      }

      return {
        jobId: response.JobId,
        status: 'IN_PROGRESS',
      };

    } catch (error) {
      console.error('Textract job start error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to start document analysis: ${errorMessage}`);
    }
  }

  /**
   * Get results of asynchronous document analysis
   */
  async getDocumentAnalysis(jobId: string): Promise<DocumentAnalysisResult | DocumentProcessingJob> {
    const startTime = Date.now();

    try {
      const command = new GetDocumentAnalysisCommand({
        JobId: jobId,
      });

      const response = await this.client.send(command);

      if (!response.JobStatus) {
        throw new Error('Invalid job status response');
      }

      // If still processing, return job status
      if (response.JobStatus === 'IN_PROGRESS') {
        return {
          jobId,
          status: response.JobStatus,
          statusMessage: response.StatusMessage,
          pages: response.DocumentMetadata?.Pages,
        };
      }

      // If failed, return error status
      if (response.JobStatus === 'FAILED') {
        return {
          jobId,
          status: response.JobStatus,
          statusMessage: response.StatusMessage || 'Analysis failed',
        };
      }

      // If successful, process blocks
      if (!response.Blocks) {
        throw new Error('No blocks returned from completed analysis');
      }

      const processingTime = Date.now() - startTime;

      return this.processBlocks(response.Blocks, processingTime);

    } catch (error) {
      console.error('Textract get analysis error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to get analysis results: ${errorMessage}`);
    }
  }

  /**
   * Extract text content only (lightweight processing)
   */
  async extractTextOnly(s3Bucket: string, s3Key: string): Promise<string> {
    try {
      const command = new AnalyzeDocumentCommand({
        Document: {
          S3Object: {
            Bucket: s3Bucket,
            Name: s3Key,
          },
        },
        FeatureTypes: [], // Text detection only
      });

      const response = await this.client.send(command);

      if (!response.Blocks) {
        return '';
      }

      return response.Blocks
        .filter(block => block.BlockType === 'LINE')
        .map(block => block.Text || '')
        .join('\n');

    } catch (error) {
      console.error('Textract text extraction error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Text extraction failed: ${errorMessage}`);
    }
  }

  /**
   * Process document for domain-specific analysis
   */
  async processDocumentForDomain(
    s3Bucket: string,
    s3Key: string,
    domainName: string,
    originalFilename: string
  ): Promise<ProcessedDocument> {
    try {
      const analysisResult = await this.analyzeDocument(s3Bucket, s3Key);

      // Categorize content based on domain
      const relevanceScore = this.calculateDomainRelevance(analysisResult.text, domainName);

      return {
        id: `${s3Key}-processed`,
        name: originalFilename,
        content: analysisResult.text,
        type: this.detectDocumentType(analysisResult.text, originalFilename),
        size: analysisResult.text.length,
        relevanceScore,
        extractedData: {
          tables: analysisResult.tables,
          forms: analysisResult.forms,
          keyMetrics: this.extractKeyMetrics(analysisResult.text, domainName),
        },
        processingMetadata: {
          confidence: analysisResult.confidence,
          processingTime: analysisResult.processingTime,
          pageCount: analysisResult.pageCount,
          processingMethod: 'textract',
          extractedAt: new Date().toISOString(),
        },
      };

    } catch (error) {
      console.error('Document domain processing error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to process document for domain: ${errorMessage}`);
    }
  }

  /**
   * Process Textract blocks into structured data
   */
  private processBlocks(blocks: Block[], processingTime: number): DocumentAnalysisResult {
    const textBlocks = blocks.filter(block => block.BlockType === 'LINE');
    const tableBlocks = blocks.filter(block => block.BlockType === 'TABLE');
    const keyValueBlocks = blocks.filter(block =>
      block.BlockType === 'KEY_VALUE_SET' && block.EntityTypes?.includes('KEY')
    );

    // Extract text
    const text = textBlocks
      .map(block => block.Text || '')
      .join('\n');

    // Extract tables
    const tables = this.extractTables(blocks, tableBlocks);

    // Extract form data
    const forms = this.extractForms(blocks, keyValueBlocks);

    // Calculate overall confidence
    const confidenceScores = blocks
      .map(block => block.Confidence || 0)
      .filter(confidence => confidence > 0);

    const averageConfidence = confidenceScores.length > 0
      ? confidenceScores.reduce((sum, conf) => sum + conf, 0) / confidenceScores.length
      : 0;

    // Estimate page count from blocks
    const pageNumbers = blocks
      .map(block => block.Page || 1)
      .filter((page, index, arr) => arr.indexOf(page) === index);

    return {
      text,
      tables,
      forms,
      confidence: averageConfidence,
      processingTime,
      pageCount: pageNumbers.length,
    };
  }

  /**
   * Extract table data from blocks
   */
  private extractTables(allBlocks: Block[], tableBlocks: Block[]): TableData[] {
    const tables: TableData[] = [];

    tableBlocks.forEach(tableBlock => {
      if (!tableBlock.Relationships) return;

      const cellBlocks = tableBlock.Relationships
        .find(rel => rel.Type === 'CHILD')
        ?.Ids?.map(id => allBlocks.find(block => block.Id === id))
        .filter(block => block?.BlockType === 'CELL') || [];

      if (cellBlocks.length === 0) return;

      // Group cells by row and column
      const cellsByPosition: { [key: string]: Block } = {};
      cellBlocks.forEach(cell => {
        if (cell && cell.RowIndex !== undefined && cell.ColumnIndex !== undefined) {
          cellsByPosition[`${cell.RowIndex}-${cell.ColumnIndex}`] = cell;
        }
      });

      // Determine table dimensions
      const maxRow = Math.max(...cellBlocks.map(cell => cell?.RowIndex || 0));
      const maxCol = Math.max(...cellBlocks.map(cell => cell?.ColumnIndex || 0));

      // Build table rows
      const rows: string[][] = [];
      for (let row = 1; row <= maxRow; row++) {
        const rowData: string[] = [];
        for (let col = 1; col <= maxCol; col++) {
          const cell = cellsByPosition[`${row}-${col}`];
          rowData.push(cell?.Text || '');
        }
        rows.push(rowData);
      }

      tables.push({
        rows,
        confidence: tableBlock.Confidence || 0,
      });
    });

    return tables;
  }

  /**
   * Extract form data from key-value pairs
   */
  private extractForms(allBlocks: Block[], keyBlocks: Block[]): FormData[] {
    const forms: FormData[] = [];

    keyBlocks.forEach(keyBlock => {
      if (!keyBlock.Relationships) return;

      // Find the value block associated with this key
      const valueRelation = keyBlock.Relationships.find(rel => rel.Type === 'VALUE');
      if (!valueRelation?.Ids?.[0]) return;

      const valueBlock = allBlocks.find(block => block.Id === valueRelation.Ids?.[0]);
      if (!valueBlock) return;

      // Get child word blocks to construct full text
      const keyText = this.getBlockText(allBlocks, keyBlock);
      const valueText = this.getBlockText(allBlocks, valueBlock);

      if (keyText && valueText) {
        forms.push({
          key: keyText,
          value: valueText,
          confidence: Math.min(keyBlock.Confidence || 0, valueBlock.Confidence || 0),
        });
      }
    });

    return forms;
  }

  /**
   * Get complete text from a block including child words
   */
  private getBlockText(allBlocks: Block[], block: Block): string {
    if (block.Text) return block.Text;

    if (!block.Relationships) return '';

    const childIds = block.Relationships
      .find(rel => rel.Type === 'CHILD')
      ?.Ids || [];

    return childIds
      .map(id => allBlocks.find(b => b.Id === id)?.Text || '')
      .join(' ')
      .trim();
  }

  /**
   * Calculate document relevance to a specific domain
   */
  private calculateDomainRelevance(text: string, domain: string): number {
    const domainKeywords = {
      'financial-management': ['revenue', 'cost', 'profit', 'budget', 'cash', 'financial', 'accounting'],
      'operational-excellence': ['process', 'efficiency', 'operations', 'workflow', 'performance'],
      'people-organization': ['employee', 'team', 'staff', 'hiring', 'training', 'culture'],
      'technology-data': ['system', 'software', 'database', 'technology', 'digital', 'automation'],
      // Add more domain keywords as needed
    };

    const keywords = domainKeywords[domain as keyof typeof domainKeywords] || [];
    if (keywords.length === 0) return 0.5; // Default relevance

    const textLower = text.toLowerCase();
    const matches = keywords.filter((keyword: string) =>
      textLower.includes(keyword.toLowerCase())
    ).length;

    return Math.min(matches / keywords.length, 1.0);
  }

  /**
   * Detect document type from content and filename
   */
  private detectDocumentType(text: string, filename: string): string {
    const extension = filename.split('.').pop()?.toLowerCase();

    if (extension === 'pdf') return 'pdf';
    if (['doc', 'docx'].includes(extension || '')) return 'document';
    if (['xls', 'xlsx'].includes(extension || '')) return 'spreadsheet';

    // Content-based detection
    const textLower = text.toLowerCase();
    if (textLower.includes('org chart') || textLower.includes('organizational')) return 'org-chart';
    if (textLower.includes('financial') || textLower.includes('budget')) return 'financial';
    if (textLower.includes('process') || textLower.includes('procedure')) return 'process';

    return 'general';
  }

  /**
   * Extract key metrics from text for specific domains
   */
  private extractKeyMetrics(text: string, domain: string): Record<string, string | number> {
    const metrics: Record<string, string | number> = {};

    switch (domain) {
      case 'financial-management': {
        const revenueMatch = text.match(/revenue[:\s]+\$?([\d,]+)/i);
        if (revenueMatch?.[1]) metrics.revenue = revenueMatch[1];

        const profitMatch = text.match(/profit[:\s]+\$?([\d,]+)/i);
        if (profitMatch?.[1]) metrics.profit = profitMatch[1];
        break;
      }

      case 'people-organization': {
        const employeeMatch = text.match(/(\d+)\s+employees?/i);
        if (employeeMatch?.[1]) metrics.employeeCount = parseInt(employeeMatch[1]);
        break;
      }

      // Add more domain-specific extractions
    }

    return metrics;
  }
}