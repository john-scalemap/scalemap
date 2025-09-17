# Unified Project Structure

ScaleMap uses a **monorepo architecture** with Turborepo orchestration, enabling shared code, consistent tooling, and efficient development across frontend, backend, and infrastructure components.

## Complete Repository Structure

```
scalemap/
├── apps/                            # Applications
│   ├── web/                         # Next.js frontend application
│   │   ├── src/
│   │   │   ├── app/                 # Next.js App Router
│   │   │   ├── components/          # React components
│   │   │   ├── hooks/               # Custom React hooks
│   │   │   ├── lib/                 # Frontend utilities
│   │   │   ├── stores/              # Zustand state management
│   │   │   └── types/               # Frontend-specific types
│   │   ├── public/                  # Static assets
│   │   ├── package.json
│   │   ├── next.config.js
│   │   ├── tailwind.config.js
│   │   └── tsconfig.json
│   └── api/                         # Backend Lambda functions
│       ├── src/
│       │   ├── functions/           # Lambda function handlers
│       │   ├── shared/              # Shared backend utilities
│       │   ├── infrastructure/      # AWS CDK stacks
│       │   └── types/               # Backend-specific types
│       ├── package.json
│       ├── tsconfig.json
│       ├── cdk.json                 # AWS CDK configuration
│       └── jest.config.js
├── packages/                        # Shared packages
│   ├── shared/                      # Shared types and utilities
│   │   ├── src/
│   │   │   ├── types/               # Shared TypeScript types
│   │   │   │   ├── assessment.ts    # Assessment types
│   │   │   │   ├── agent.ts         # Agent types
│   │   │   │   ├── company.ts       # Company types
│   │   │   │   └── api.ts           # API contract types
│   │   │   ├── utils/               # Shared utility functions
│   │   │   │   ├── validation.ts    # Validation schemas
│   │   │   │   ├── date-utils.ts    # Date/time utilities
│   │   │   │   └── constants.ts     # Shared constants
│   │   │   └── schemas/             # Validation schemas
│   │   │       ├── assessment.json  # Assessment validation
│   │   │       ├── company.json     # Company validation
│   │   │       └── agent.json       # Agent validation
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── ui/                          # Shared UI components
│   │   ├── src/
│   │   │   ├── components/          # Reusable React components
│   │   │   │   ├── Button/          # Button component
│   │   │   │   ├── Card/            # Card component
│   │   │   │   ├── ProgressBar/     # Progress bar component
│   │   │   │   └── index.ts         # Component exports
│   │   │   ├── hooks/               # Shared React hooks
│   │   │   ├── utils/               # UI utility functions
│   │   │   └── styles/              # Shared styles and tokens
│   │   │       ├── globals.css      # Global CSS
│   │   │       └── tokens.js        # Design tokens
│   │   ├── package.json
│   │   ├── tailwind.config.js       # Shared Tailwind config
│   │   └── tsconfig.json
│   ├── eslint-config/               # Shared ESLint configuration
│   │   ├── base.js                  # Base ESLint rules
│   │   ├── next.js                  # Next.js specific rules
│   │   ├── node.js                  # Node.js specific rules
│   │   └── package.json
│   └── typescript-config/           # Shared TypeScript configuration
│       ├── base.json                # Base TypeScript config
│       ├── next.json                # Next.js TypeScript config
│       ├── node.json                # Node.js TypeScript config
│       └── package.json
├── docs/                            # Documentation
│   ├── architecture.md              # This architecture document
│   ├── api/                         # API documentation
│   │   ├── endpoints.md             # API endpoint documentation
│   │   └── schemas.md               # Data schema documentation
│   ├── deployment/                  # Deployment guides
│   │   ├── aws-setup.md             # AWS account setup
│   │   ├── local-development.md     # Local development setup
│   │   └── production-deploy.md     # Production deployment
│   ├── development/                 # Development guides
│   │   ├── getting-started.md       # Quick start guide
│   │   ├── coding-standards.md      # Code style guide
│   │   └── testing.md               # Testing guidelines
│   └── business/                    # Business documentation
│       ├── agent-personalities.md   # Agent persona definitions
│       ├── assessment-questions.md  # Question templates
│       └── business-rules.md        # Business logic rules
├── scripts/                         # Development and deployment scripts
│   ├── dev/                         # Development scripts
│   │   ├── setup.sh                 # Initial project setup
│   │   ├── start-local.sh           # Start local development
│   │   └── seed-data.sh             # Seed development data
│   ├── deploy/                      # Deployment scripts
│   │   ├── deploy-staging.sh        # Deploy to staging
│   │   ├── deploy-production.sh     # Deploy to production
│   │   └── rollback.sh              # Rollback deployment
│   └── maintenance/                 # Maintenance scripts
│       ├── backup-database.sh       # Database backup
│       ├── cleanup-logs.sh          # Log cleanup
│       └── health-check.sh          # System health check
├── tests/                           # Integration and E2E tests
│   ├── e2e/                         # End-to-end tests
│   │   ├── assessment-flow.spec.ts  # Complete assessment flow
│   │   ├── payment-flow.spec.ts     # Payment processing flow
│   │   └── agent-workflow.spec.ts   # Agent analysis workflow
│   ├── integration/                 # Integration tests
│   │   ├── api/                     # API integration tests
│   │   └── database/                # Database integration tests
│   └── fixtures/                    # Test data and fixtures
│       ├── companies.json           # Sample company data
│       ├── assessments.json         # Sample assessment data
│       └── agents.json              # Sample agent data
├── .github/                         # GitHub configuration
│   ├── workflows/                   # GitHub Actions workflows
│   │   ├── ci.yml                   # Continuous integration
│   │   ├── deploy-staging.yml       # Staging deployment
│   │   ├── deploy-production.yml    # Production deployment
│   │   └── security-scan.yml        # Security scanning
│   ├── ISSUE_TEMPLATE/              # Issue templates
│   └── pull_request_template.md     # PR template
├── .vscode/                         # VS Code configuration
│   ├── settings.json                # Workspace settings
│   ├── extensions.json              # Recommended extensions
│   └── launch.json                  # Debug configuration
├── package.json                     # Root package configuration
├── turbo.json                       # Turborepo configuration
├── .gitignore                       # Git ignore rules
├── .env.example                     # Environment variables template
├── README.md                        # Project README
└── CONTRIBUTING.md                  # Contribution guidelines
```

## Package Dependencies and Relationships

```json
// Root package.json
{
  "name": "scalemap",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "type-check": "turbo run type-check",
    "deploy:staging": "turbo run deploy --filter=api --env=staging",
    "deploy:production": "turbo run deploy --filter=api --env=production"
  },
  "devDependencies": {
    "turbo": "^1.10.0",
    "@scalemap/eslint-config": "*",
    "@scalemap/typescript-config": "*",
    "prettier": "^3.0.0"
  }
}
```

```json
// apps/web/package.json
{
  "name": "@scalemap/web",
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "@scalemap/shared": "*",
    "@scalemap/ui": "*",
    "zustand": "^4.4.0",
    "@tanstack/react-query": "^5.0.0",
    "tailwindcss": "^3.3.0"
  },
  "devDependencies": {
    "@scalemap/eslint-config": "*",
    "@scalemap/typescript-config": "*",
    "@types/react": "^18.0.0",
    "@types/react-dom": "^18.0.0"
  }
}
```

```json
// apps/api/package.json
{
  "name": "@scalemap/api",
  "dependencies": {
    "@aws-sdk/client-dynamodb": "^3.400.0",
    "@aws-sdk/client-s3": "^3.400.0",
    "@aws-sdk/client-sqs": "^3.400.0",
    "@scalemap/shared": "*",
    "aws-cdk-lib": "^2.100.0",
    "constructs": "^10.3.0",
    "openai": "^4.0.0",
    "stripe": "^14.0.0"
  },
  "devDependencies": {
    "@scalemap/eslint-config": "*",
    "@scalemap/typescript-config": "*",
    "@types/aws-lambda": "^8.10.0",
    "aws-cdk": "^2.100.0"
  }
}
```

## Turborepo Configuration

```json
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [
        ".next/**",
        "!.next/cache/**",
        "dist/**",
        "cdk.out/**"
      ]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"]
    },
    "lint": {
      "outputs": []
    },
    "type-check": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "deploy": {
      "dependsOn": ["build", "test", "lint"],
      "cache": false
    }
  }
}
```

## Shared Type System

The monorepo enables **complete type safety** across frontend and backend:

```typescript
// packages/shared/src/types/assessment.ts
export interface Assessment {
  assessmentId: string;
  companyId: string;
  status: AssessmentStatus;
  domainResponses: Record<OperationalDomain, any>;
  assessmentContext: AssessmentContext;
  activatedAgents: string[];
  deliverySchedule: DeliverySchedule;
  clarificationPolicy: ClarificationPolicy;
  createdAt: string;
  updatedAt: string;
}

export type AssessmentStatus = 
  | 'payment-pending'
  | 'document-processing' 
  | 'triaging'
  | 'analyzing'
  | 'synthesizing'
  | 'validating'
  | 'completed'
  | 'failed';

// This type is used by:
// - Frontend: React components, API calls, state management
// - Backend: Lambda functions, database operations, API responses
// - Infrastructure: CDK stack definitions, monitoring alerts
```

## Development Workflow Integration

```typescript
// Shared validation schemas
// packages/shared/src/schemas/assessment.json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "companyId": {
      "type": "string",
      "format": "uuid"
    },
    "domainResponses": {
      "type": "object",
      "additionalProperties": {
        "type": "object"
      }
    },
    "assessmentContext": {
      "$ref": "#/definitions/AssessmentContext"
    }
  },
  "required": ["companyId", "domainResponses"],
  "definitions": {
    "AssessmentContext": {
      "type": "object",
      "properties": {
        "primaryBusinessChallenges": {
          "type": "array",
          "items": {
            "type": "string"
          }
        }
      }
    }
  }
}

// Used by both frontend and backend for validation:
// Frontend: Form validation, TypeScript types
// Backend: Request validation, database schema validation
```

## Cross-Package Communication

```typescript
// Frontend using shared types and utilities
// apps/web/src/services/assessment-service.ts
import { Assessment, CreateAssessmentRequest } from '@scalemap/shared/types';
import { validateAssessment } from '@scalemap/shared/utils';
import { apiClient } from '../lib/api-client';

export class AssessmentService {
  async createAssessment(request: CreateAssessmentRequest): Promise<Assessment> {
    // Shared validation
    const validationResult = validateAssessment(request);
    if (!validationResult.isValid) {
      throw new ValidationError(validationResult.errors);
    }

    // API call with shared types
    return apiClient.post<Assessment>('/assessments', request);
  }
}

// Backend using same shared types and utilities  
// apps/api/src/functions/assessment/create-assessment.ts
import { Assessment, CreateAssessmentRequest } from '@scalemap/shared/types';
import { validateAssessment } from '@scalemap/shared/utils';

export const handler = async (event: APIGatewayProxyEvent) => {
  const request: CreateAssessmentRequest = JSON.parse(event.body || '{}');
  
  // Same shared validation logic
  const validationResult = validateAssessment(request);
  if (!validationResult.isValid) {
    return errorResponse(400, validationResult.errors);
  }

  // Create assessment with shared types
  const assessment: Assessment = {
    // ... implementation
  };
};
```

## Build and Deployment Orchestration

```bash
# Development workflow
npm run dev                    # Starts both frontend and backend in development
npm run build                 # Builds all packages and applications
npm run test                  # Runs tests across all packages
npm run lint                  # Lints all code with shared configuration
npm run type-check            # Type checks with shared TypeScript config

# Deployment workflow
npm run deploy:staging        # Deploys API to staging, frontend to Vercel staging
npm run deploy:production     # Deploys to production with all safety checks
```

## Environment Configuration

```bash
# .env.example - Shared across frontend and backend
# AWS Configuration
AWS_REGION=us-east-1
AWS_PROFILE=scalemap-dev

# Database
DYNAMODB_TABLE_NAME=scalemap-dev
DYNAMODB_ENDPOINT=http://localhost:8000  # For local development

# External APIs
OPENAI_API_KEY=sk-...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLIC_KEY=pk_test_...

# Frontend URLs
NEXT_PUBLIC_API_URL=http://localhost:3001  # Local API
NEXT_PUBLIC_WS_URL=ws://localhost:3001     # Local WebSocket

# Email
SES_FROM_EMAIL=noreply@scalemap.ai
SES_REGION=us-east-1
```

This unified project structure provides:

✅ **Complete Type Safety** - Shared types prevent frontend/backend mismatches  
✅ **Efficient Development** - Turborepo orchestration with intelligent caching  
✅ **Consistent Tooling** - Shared ESLint, TypeScript, and Prettier configuration  
✅ **Simplified Deployment** - Single command deploys both frontend and backend  
✅ **Code Reusability** - Shared utilities, components, and validation logic  
✅ **Developer Experience** - VS Code integration, debugging, and testing setup  

The monorepo architecture ensures that ScaleMap maintains consistency and efficiency as the team grows while enabling rapid feature development across the entire stack.
