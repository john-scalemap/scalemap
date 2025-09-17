# Development Workflow

ScaleMap's development workflow is optimized for the monorepo architecture, enabling efficient team collaboration while maintaining code quality and rapid deployment cycles.

## Local Development Setup

### Prerequisites and Environment Setup
```bash
# System requirements
Node.js >= 18.0.0
npm >= 9.0.0
AWS CLI >= 2.0.0
Docker >= 20.0.0 (for local DynamoDB)

# Clone repository
git clone https://github.com/scalemap/scalemap.git
cd scalemap

# Install dependencies (installs all workspace packages)
npm install

# Copy environment configuration
cp .env.example .env
# Edit .env with your local development values
```

### Local Services Setup
```bash
# Start local DynamoDB (using Docker)
docker run -p 8000:8000 amazon/dynamodb-local

# Create local DynamoDB tables
npm run setup:local-db

# Start development servers
npm run dev
# This starts:
# - Frontend (Next.js) on http://localhost:3000
# - Backend (Lambda simulation) on http://localhost:3001
# - WebSocket server on ws://localhost:3001
```

### Development Server Architecture
```typescript
// Local development setup
// scripts/dev/start-local.sh
#!/bin/bash
echo "Starting ScaleMap local development environment..."

# Start DynamoDB Local
docker run -d -p 8000:8000 --name scalemap-dynamodb amazon/dynamodb-local

# Wait for DynamoDB to be ready
until curl -s http://localhost:8000 > /dev/null; do
  echo "Waiting for DynamoDB Local..."
  sleep 2
done

# Create tables
npm run setup:local-db

# Start development servers concurrently
npx concurrently \
  "npm run dev --workspace=@scalemap/web" \
  "npm run dev --workspace=@scalemap/api" \
  --names "WEB,API" \
  --prefix-colors "blue,green"
```

## Development Workflow Patterns

### Feature Development Cycle
```bash
# 1. Create feature branch
git checkout -b feature/agent-personality-system
git push -u origin feature/agent-personality-system

# 2. Develop with live reloading
npm run dev
# Make changes to frontend/backend simultaneously
# Shared types ensure consistency between layers

# 3. Run tests during development
npm run test:watch  # Run tests in watch mode
npm run lint:fix    # Auto-fix linting issues

# 4. Type checking
npm run type-check  # Verify TypeScript across all packages

# 5. Commit changes
git add .
git commit -m "feat(agents): add personality system for financial agent"
```

### Code Quality Gates
```typescript
// Pre-commit hooks (using husky)
// .husky/pre-commit
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

echo "Running pre-commit checks..."

# Run linting
npm run lint

# Run type checking
npm run type-check

# Run unit tests
npm run test:unit

# Check for security vulnerabilities
npm audit

echo "Pre-commit checks passed ✅"
```

### Continuous Integration Workflow
```yaml
# .github/workflows/ci.yml
name: Continuous Integration

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  quality-checks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Lint code
        run: npm run lint
        
      - name: Type check
        run: npm run type-check
        
      - name: Run unit tests
        run: npm run test:unit
        
      - name: Build applications
        run: npm run build

  integration-tests:
    needs: quality-checks
    runs-on: ubuntu-latest
    services:
      dynamodb:
        image: amazon/dynamodb-local
        ports:
          - 8000:8000
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Setup test database
        run: npm run setup:test-db
        
      - name: Run integration tests
        run: npm run test:integration
        env:
          DYNAMODB_ENDPOINT: http://localhost:8000
          
      - name: Run E2E tests
        run: npm run test:e2e
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY_TEST }}

  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Run Snyk security scan
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
```

## Testing Workflow

### Test Structure and Strategy
```typescript
// Unit tests for shared utilities
// packages/shared/src/utils/__tests__/validation.test.ts
import { validateAssessment } from '../validation';
import { mockAssessment } from '../../__mocks__/assessment';

describe('Assessment Validation', () => {
  it('should validate correct assessment data', () => {
    const result = validateAssessment(mockAssessment);
    expect(result.isValid).toBe(true);
  });

  it('should reject assessment without required fields', () => {
    const invalidAssessment = { ...mockAssessment };
    delete invalidAssessment.companyId;
    
    const result = validateAssessment(invalidAssessment);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('companyId is required');
  });
});

// Integration tests for API endpoints
// apps/api/src/functions/__tests__/create-assessment.integration.test.ts
import { handler } from '../assessment/create-assessment';
import { mockAPIGatewayEvent } from '../../__mocks__/api-gateway';
import { setupTestDatabase, cleanupTestDatabase } from '../../__utils__/test-setup';

describe('Create Assessment Integration', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  it('should create assessment with valid data', async () => {
    const event = mockAPIGatewayEvent({
      body: JSON.stringify({
        companyId: 'test-company-123',
        domainResponses: {
          'financial-management': { cashFlowHealth: 'good' }
        }
      })
    });

    const result = await handler(event);
    
    expect(result.statusCode).toBe(201);
    
    const body = JSON.parse(result.body);
    expect(body.assessment).toHaveProperty('assessmentId');
    expect(body.paymentIntent).toHaveProperty('clientSecret');
  });
});

// E2E tests for complete workflows
// tests/e2e/assessment-flow.spec.ts
import { test, expect } from '@playwright/test';

test('Complete assessment workflow', async ({ page }) => {
  // Login
  await page.goto('/login');
  await page.fill('[data-testid=email]', 'test@example.com');
  await page.fill('[data-testid=password]', 'password123');
  await page.click('[data-testid=login-button]');

  // Create company profile
  await page.goto('/settings');
  await page.fill('[data-testid=company-name]', 'Test Company Ltd');
  await page.selectOption('[data-testid=industry-sector]', 'technology');
  await page.click('[data-testid=save-company]');

  // Start assessment
  await page.goto('/assessment/new');
  await page.fill('[data-testid=financial-revenue]', '1000000');
  await page.selectOption('[data-testid=growth-stage]', 'scale-up');
  await page.click('[data-testid=submit-assessment]');

  // Payment flow
  await expect(page.locator('[data-testid=payment-form]')).toBeVisible();
  await page.fill('[data-testid=card-number]', '4242424242424242');
  await page.fill('[data-testid=card-expiry]', '12/25');
  await page.fill('[data-testid=card-cvc]', '123');
  await page.click('[data-testid=pay-button]');

  // Verify assessment started
  await expect(page.locator('[data-testid=analysis-started]')).toBeVisible();
  await expect(page.locator('[data-testid=progress-tracker]')).toBeVisible();
});
```

### Testing Commands and Scripts
```json
// package.json scripts for testing
{
  "scripts": {
    "test": "turbo run test",
    "test:unit": "turbo run test:unit",
    "test:integration": "turbo run test:integration",
    "test:e2e": "playwright test",
    "test:watch": "turbo run test:watch",
    "test:coverage": "turbo run test:coverage",
    "setup:test-db": "node scripts/setup-test-database.js",
    "cleanup:test-db": "node scripts/cleanup-test-database.js"
  }
}

// Individual package test scripts
// apps/api/package.json
{
  "scripts": {
    "test": "jest",
    "test:unit": "jest --testPathPattern=__tests__ --testNamePattern='unit'",
    "test:integration": "jest --testPathPattern=__tests__ --testNamePattern='integration'",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

## Code Review and Collaboration

### Pull Request Workflow
```markdown
<!-- .github/pull_request_template.md -->
# Pull Request Template

## Description
Brief description of what this PR does

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## How Has This Been Tested?
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] E2E tests pass
- [ ] Manual testing completed

## Checklist:
- [ ] My code follows the style guidelines of this project
- [ ] I have performed a self-review of my own code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] New and existing unit tests pass locally with my changes
- [ ] Any dependent changes have been merged and published in downstream modules

## Screenshots (if applicable):
[Add screenshots here]

## Additional Notes:
[Any additional information, concerns, or context]
```

### Code Review Standards
```typescript
// Example of well-structured code following standards
// apps/api/src/functions/agents/financial-agent.ts

/**
 * Financial Management Agent
 * 
 * Analyzes company financial health and provides actionable recommendations.
 * Specializes in cash flow management, financial planning, and cost optimization.
 * 
 * @version 1.2.0
 * @author ScaleMap Team
 */

import { SQSEvent } from 'aws-lambda';
import { logger } from '../../shared/utils/logger';
import { AgentAnalysisRequest, AgentAnalysisResult } from '../../shared/types/agent';
import { openaiService } from '../../shared/services/openai-service';
import { FINANCIAL_AGENT_CONFIG } from '../../shared/constants/agent-configs';

/**
 * Handles financial analysis requests from the agent orchestrator
 * 
 * @param event - SQS event containing analysis request
 * @returns Promise<void>
 */
export const handler = async (event: SQSEvent): Promise<void> => {
  const startTime = Date.now();
  
  try {
    // Process each message in the batch
    for (const record of event.Records) {
      await processAnalysisRequest(record, startTime);
    }
  } catch (error) {
    logger.error('Financial agent batch processing failed', {
      error: error.message,
      eventRecords: event.Records.length,
      duration: Date.now() - startTime
    });
    throw error;
  }
};

/**
 * Processes individual analysis request
 * 
 * @private
 * @param record - SQS record containing analysis request
 * @param batchStartTime - Batch processing start time for metrics
 */
async function processAnalysisRequest(
  record: SQSRecord, 
  batchStartTime: number
): Promise<void> {
  // Implementation with proper error handling, logging, and metrics
  // ... detailed implementation
}
```

## Environment Management

### Development, Staging, and Production Environments
```typescript
// Environment configuration management
// apps/api/src/shared/config/environments.ts

interface EnvironmentConfig {
  stage: 'development' | 'staging' | 'production';
  aws: {
    region: string;
    dynamodbTableName: string;
    s3BucketName: string;
  };
  external: {
    openaiApiKey: string;
    stripeSecretKey: string;
  };
  features: {
    enableAnalytics: boolean;
    enableDebugLogging: boolean;
    maxConcurrentAgents: number;
  };
}

export const getEnvironmentConfig = (): EnvironmentConfig => {
  const stage = (process.env.STAGE || 'development') as EnvironmentConfig['stage'];
  
  const configs: Record<EnvironmentConfig['stage'], EnvironmentConfig> = {
    development: {
      stage: 'development',
      aws: {
        region: 'us-east-1',
        dynamodbTableName: 'scalemap-dev',
        s3BucketName: 'scalemap-dev-documents',
      },
      external: {
        openaiApiKey: process.env.OPENAI_API_KEY!,
        stripeSecretKey: process.env.STRIPE_SECRET_KEY_TEST!,
      },
      features: {
        enableAnalytics: false,
        enableDebugLogging: true,
        maxConcurrentAgents: 3,
      },
    },
    staging: {
      stage: 'staging',
      aws: {
        region: 'us-east-1',
        dynamodbTableName: 'scalemap-staging',
        s3BucketName: 'scalemap-staging-documents',
      },
      external: {
        openaiApiKey: process.env.OPENAI_API_KEY!,
        stripeSecretKey: process.env.STRIPE_SECRET_KEY_TEST!,
      },
      features: {
        enableAnalytics: true,
        enableDebugLogging: true,
        maxConcurrentAgents: 5,
      },
    },
    production: {
      stage: 'production',
      aws: {
        region: 'us-east-1',
        dynamodbTableName: 'scalemap-prod',
        s3BucketName: 'scalemap-prod-documents',
      },
      external: {
        openaiApiKey: process.env.OPENAI_API_KEY!,
        stripeSecretKey: process.env.STRIPE_SECRET_KEY!,
      },
      features: {
        enableAnalytics: true,
        enableDebugLogging: false,
        maxConcurrentAgents: 12,
      },
    },
  };

  return configs[stage];
};
```

## Database Migration and Schema Evolution

### Schema Version Management
```typescript
// Database migration system
// apps/api/src/shared/migrations/migration-runner.ts

interface Migration {
  version: string;
  description: string;
  up: () => Promise<void>;
  down: () => Promise<void>;
}

export class MigrationRunner {
  private migrations: Migration[] = [
    {
      version: '2024.01.001',
      description: 'Add clarification tracking fields to Assessment table',
      up: async () => {
        // Add new GSI for clarification queries
        await this.addGlobalSecondaryIndex('GSI3', {
          partitionKey: 'GSI3PK',
          sortKey: 'GSI3SK',
          projectionType: 'ALL'
        });
      },
      down: async () => {
        await this.removeGlobalSecondaryIndex('GSI3');
      }
    },
    // Additional migrations...
  ];

  async runPendingMigrations(): Promise<void> {
    const currentVersion = await this.getCurrentVersion();
    const pendingMigrations = this.migrations.filter(
      migration => migration.version > currentVersion
    );

    for (const migration of pendingMigrations) {
      logger.info(`Running migration: ${migration.version} - ${migration.description}`);
      await migration.up();
      await this.updateVersion(migration.version);
      logger.info(`Migration completed: ${migration.version}`);
    }
  }

  async rollbackToVersion(targetVersion: string): Promise<void> {
    const currentVersion = await this.getCurrentVersion();
    const rollbackMigrations = this.migrations
      .filter(migration => migration.version > targetVersion && migration.version <= currentVersion)
      .reverse();

    for (const migration of rollbackMigrations) {
      logger.info(`Rolling back migration: ${migration.version}`);
      await migration.down();
      await this.updateVersion(targetVersion);
    }
  }
}
```

## Performance Monitoring and Debugging

### Development Performance Tools
```typescript
// Performance monitoring during development
// apps/web/src/lib/performance/dev-tools.ts

interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

export class DevPerformanceMonitor {
  private metrics: PerformanceMetric[] = [];

  trackApiCall(endpoint: string, duration: number, metadata?: any): void {
    if (process.env.NODE_ENV === 'development') {
      this.metrics.push({
        name: `api.${endpoint}`,
        value: duration,
        timestamp: Date.now(),
        metadata
      });

      // Log slow API calls
      if (duration > 1000) {
        console.warn(`Slow API call detected: ${endpoint} took ${duration}ms`, metadata);
      }
    }
  }

  trackAgentProcessing(agentId: string, duration: number, tokenUsage?: any): void {
    if (process.env.NODE_ENV === 'development') {
      this.metrics.push({
        name: `agent.${agentId}.processing`,
        value: duration,
        timestamp: Date.now(),
        metadata: { tokenUsage }
      });

      console.log(`Agent ${agentId} completed in ${duration}ms`, { tokenUsage });
    }
  }

  getPerformanceReport(): PerformanceMetric[] {
    return this.metrics.slice(-100); // Last 100 metrics
  }
}

export const devPerformanceMonitor = new DevPerformanceMonitor();

// React hook for performance monitoring
export function usePerformanceTracking() {
  const trackComponentRender = (componentName: string) => {
    if (process.env.NODE_ENV === 'development') {
      const startTime = performance.now();
      
      return () => {
        const duration = performance.now() - startTime;
        devPerformanceMonitor.trackComponentRender(componentName, duration);
      };
    }
    
    return () => {}; // No-op in production
  };

  return { trackComponentRender };
}
```

This development workflow provides a **comprehensive foundation** for efficient team collaboration, code quality maintenance, and rapid iteration cycles while ensuring production-ready code quality at every step.
