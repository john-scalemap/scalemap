import { APIGatewayProxyEvent } from 'aws-lambda';

interface CorsConfig {
  allowedOrigins: string[];
  allowedMethods: string[];
  allowedHeaders: string[];
  allowCredentials: boolean;
  maxAge: number;
}

const CORS_CONFIGS: Record<string, CorsConfig> = {
  development: {
    allowedOrigins: [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
    ],
    allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Amz-Date',
      'X-Api-Key',
      'X-Amz-Security-Token',
      'X-Amz-User-Agent',
      'Cache-Control',
    ],
    allowCredentials: true,
    maxAge: 86400, // 24 hours
  },

  staging: {
    allowedOrigins: ['https://scalemap-staging.vercel.app', 'https://staging.scalemap.ai'],
    allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Amz-Date',
      'X-Api-Key',
      'X-Amz-Security-Token',
    ],
    allowCredentials: true,
    maxAge: 3600, // 1 hour
  },

  production: {
    allowedOrigins: [], // Rely on Vercel pattern matching in isOriginAllowed()
    allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Amz-Date',
      'X-Api-Key',
      'X-Amz-Security-Token',
    ],
    allowCredentials: true,
    maxAge: 3600, // 1 hour
  },
};

export class CorsPolicy {
  private static instance: CorsPolicy;
  private config: CorsConfig;

  private constructor() {
    const environment = process.env.NODE_ENV || process.env.STAGE || 'development';
    this.config = CORS_CONFIGS[environment] ?? CORS_CONFIGS.development!;
  }

  public static getInstance(): CorsPolicy {
    if (!CorsPolicy.instance) {
      CorsPolicy.instance = new CorsPolicy();
    }
    return CorsPolicy.instance;
  }

  /**
   * Get CORS headers for a given request
   */
  public getCorsHeaders(event?: APIGatewayProxyEvent): Record<string, string> {
    const origin = event?.headers?.origin || event?.headers?.Origin;
    const allowedOrigin = this.getAllowedOrigin(origin);

    const corsHeaders: Record<string, string> = {
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Methods': this.config.allowedMethods.join(', '),
      'Access-Control-Allow-Headers': this.config.allowedHeaders.join(', '),
      'Access-Control-Max-Age': this.config.maxAge.toString(),
    };

    if (this.config.allowCredentials) {
      corsHeaders['Access-Control-Allow-Credentials'] = 'true';
    }

    return corsHeaders;
  }

  /**
   * Get security headers
   */
  public getSecurityHeaders(): Record<string, string> {
    return {
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none';",
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
    };
  }

  /**
   * Get all headers (CORS + Security)
   */
  public getAllHeaders(event?: APIGatewayProxyEvent): Record<string, string> {
    return {
      ...this.getCorsHeaders(event),
      ...this.getSecurityHeaders(),
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    };
  }

  /**
   * Check if origin is allowed
   */
  public isOriginAllowed(origin?: string): boolean {
    if (!origin) return false;

    // In development, allow any localhost
    const environment = process.env.NODE_ENV || process.env.STAGE || 'development';
    if (environment === 'development' && origin.includes('localhost')) {
      return true;
    }

    // Allow Vercel preview deployments in production for authorized domains
    if (environment === 'production' && origin.endsWith('.vercel.app')) {
      // Only allow scale-map Vercel deployments (pattern: web-*-scale-map.vercel.app)
      if (origin.includes('-scale-map.vercel.app')) {
        return true;
      }
    }

    return this.config.allowedOrigins.includes(origin);
  }

  /**
   * Get the allowed origin for the request
   */
  private getAllowedOrigin(requestOrigin?: string): string {
    // If no origin in request, return first allowed origin or reject
    if (!requestOrigin) {
      return this.config.allowedOrigins[0] || 'null';
    }

    // Check if request origin is allowed
    if (this.isOriginAllowed(requestOrigin)) {
      return requestOrigin;
    }

    // In development, be more permissive with localhost
    const environment = process.env.NODE_ENV || process.env.STAGE || 'development';
    if (environment === 'development' && requestOrigin.includes('localhost')) {
      return requestOrigin;
    }

    // In production, allow Vercel preview deployments for authorized domains
    if (environment === 'production' && requestOrigin.endsWith('.vercel.app')) {
      // Only allow scale-map Vercel deployments (pattern: web-*-scale-map.vercel.app)
      if (requestOrigin.includes('-scale-map.vercel.app')) {
        return requestOrigin;
      }
    }

    // For production with empty allowedOrigins, reject unknown origins
    return this.config.allowedOrigins[0] || 'null';
  }

  /**
   * Handle preflight OPTIONS request
   */
  public handlePreflightRequest(event: APIGatewayProxyEvent) {
    const headers = this.getAllHeaders(event);

    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  /**
   * Validate CORS request
   */
  public validateRequest(event: APIGatewayProxyEvent): {
    isValid: boolean;
    reason?: string;
  } {
    const origin = event.headers?.origin || event.headers?.Origin;
    const method = event.httpMethod;

    // Check if origin is allowed
    if (origin && !this.isOriginAllowed(origin)) {
      return {
        isValid: false,
        reason: `Origin '${origin}' not allowed`,
      };
    }

    // Check if method is allowed
    if (!this.config.allowedMethods.includes(method)) {
      return {
        isValid: false,
        reason: `Method '${method}' not allowed`,
      };
    }

    return { isValid: true };
  }

  /**
   * Get current configuration (for debugging)
   */
  public getConfig(): CorsConfig {
    return { ...this.config };
  }
}

// Export singleton instance
export const corsPolicy = CorsPolicy.getInstance();
