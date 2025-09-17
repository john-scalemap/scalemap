import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface S3Config {
  bucketName: string;
  region: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}

export interface UploadResult {
  key: string;
  url: string;
  size: number;
  contentType: string;
  etag: string;
}

export interface DocumentMetadata {
  originalName: string;
  size: number;
  contentType: string;
  uploadedAt: string;
  assessmentId: string;
  domain?: string;
}

export class S3Service {
  private client: S3Client;
  private bucketName: string;

  constructor(config?: Partial<S3Config>) {
    const finalConfig = {
      bucketName: process.env.S3_BUCKET_NAME || 'scalemap-documents-prod-mvpdev',
      region: process.env.S3_REGION || process.env.AWS_REGION || 'eu-west-1',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      ...config
    };

    this.bucketName = finalConfig.bucketName;

    const clientConfig: any = {
      region: finalConfig.region,
    };

    if (finalConfig.accessKeyId && finalConfig.secretAccessKey) {
      clientConfig.credentials = {
        accessKeyId: finalConfig.accessKeyId,
        secretAccessKey: finalConfig.secretAccessKey,
      };
    }

    this.client = new S3Client(clientConfig);
  }

  /**
   * Upload document to S3
   */
  async uploadDocument(
    key: string,
    buffer: Buffer,
    metadata: DocumentMetadata
  ): Promise<UploadResult> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: metadata.contentType,
        Metadata: {
          originalName: metadata.originalName,
          assessmentId: metadata.assessmentId,
          domain: metadata.domain || '',
          uploadedAt: metadata.uploadedAt,
          size: metadata.size.toString()
        },
        // Enable server-side encryption
        ServerSideEncryption: 'AES256'
      });

      const result = await this.client.send(command);

      return {
        key,
        url: `https://${this.bucketName}.s3.${process.env.S3_REGION || 'eu-west-1'}.amazonaws.com/${key}`,
        size: metadata.size,
        contentType: metadata.contentType,
        etag: result.ETag || ''
      };

    } catch (error) {
      console.error('S3 upload error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to upload document: ${errorMessage}`);
    }
  }

  /**
   * Generate presigned URL for file upload (frontend uploads)
   */
  async getPresignedUploadUrl(
    key: string,
    contentType: string,
    expiresIn: number = 300 // 5 minutes
  ): Promise<string> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        ContentType: contentType,
        ServerSideEncryption: 'AES256'
      });

      return await getSignedUrl(this.client, command, { expiresIn });
    } catch (error) {
      console.error('S3 presigned URL error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to generate upload URL: ${errorMessage}`);
    }
  }

  /**
   * Generate presigned URL for file download
   */
  async getPresignedDownloadUrl(
    key: string,
    expiresIn: number = 3600 // 1 hour
  ): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key
      });

      return await getSignedUrl(this.client, command, { expiresIn });
    } catch (error) {
      console.error('S3 download URL error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to generate download URL: ${errorMessage}`);
    }
  }

  /**
   * Download document content
   */
  async downloadDocument(key: string): Promise<Buffer> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key
      });

      const response = await this.client.send(command);

      if (!response.Body) {
        throw new Error('Document not found');
      }

      // Convert stream to buffer
      const chunks: Uint8Array[] = [];

      // Handle different stream types
      if ('getReader' in response.Body) {
        // Web stream
        const reader = response.Body.getReader();
        let done = false;
        while (!done) {
          const result = await reader.read();
          done = result.done;
          if (result.value) {
            chunks.push(result.value);
          }
        }
      } else {
        // Node.js stream - convert to buffer
        const buffer = await this.streamToBuffer(response.Body);
        chunks.push(new Uint8Array(buffer));
      }

      return Buffer.concat(chunks);

    } catch (error) {
      console.error('S3 download error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to download document: ${errorMessage}`);
    }
  }

  /**
   * Delete document
   */
  async deleteDocument(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key
      });

      await this.client.send(command);
    } catch (error) {
      console.error('S3 delete error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to delete document: ${errorMessage}`);
    }
  }

  /**
   * Check if document exists
   */
  async documentExists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key
      });

      await this.client.send(command);
      return true;
    } catch (error) {
      if (error instanceof Error && error.name === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  /**
   * List documents for an assessment
   */
  async listDocuments(assessmentId: string): Promise<Array<{
    key: string;
    size: number;
    lastModified: Date;
    metadata?: Record<string, string>;
  }>> {
    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: `assessments/${assessmentId}/`,
        MaxKeys: 100
      });

      const response = await this.client.send(command);

      if (!response.Contents) {
        return [];
      }

      return response.Contents.map(obj => ({
        key: obj.Key!,
        size: obj.Size || 0,
        lastModified: obj.LastModified || new Date()
      }));

    } catch (error) {
      console.error('S3 list error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to list documents: ${errorMessage}`);
    }
  }

  /**
   * Convert Node.js stream to buffer
   */
  private async streamToBuffer(stream: any): Promise<Buffer> {
    const chunks: Uint8Array[] = [];
    return new Promise((resolve, reject) => {
      stream.on('data', (chunk: Uint8Array) => chunks.push(chunk));
      stream.on('error', reject);
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }

  /**
   * Generate document key for consistent naming
   */
  generateDocumentKey(assessmentId: string, filename: string, domain?: string): string {
    const timestamp = Date.now();
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');

    if (domain) {
      return `assessments/${assessmentId}/domains/${domain}/${timestamp}_${sanitizedFilename}`;
    }

    return `assessments/${assessmentId}/documents/${timestamp}_${sanitizedFilename}`;
  }

  /**
   * Get document metadata
   */
  async getDocumentMetadata(key: string): Promise<DocumentMetadata | null> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key
      });

      const response = await this.client.send(command);

      if (!response.Metadata) {
        return null;
      }

      return {
        originalName: response.Metadata.originalname || '',
        size: parseInt(response.Metadata.size || '0'),
        contentType: response.ContentType || 'application/octet-stream',
        uploadedAt: response.Metadata.uploadedat || '',
        assessmentId: response.Metadata.assessmentid || '',
        domain: response.Metadata.domain
      };

    } catch (error) {
      console.error('S3 metadata error:', error);
      return null;
    }
  }
}