# Tech Stack

ScaleMap uses a modern, scalable technology stack designed for high performance, cost efficiency, and rapid development. All services are production-ready with comprehensive monitoring and error handling.

## Frontend Stack

### Core Framework
- **Next.js 14+** - React framework with App Router for optimal performance
- **React 18+** - Latest React with Suspense and concurrent features
- **TypeScript 5.0+** - Full type safety across the entire application

### State Management & Data
- **Zustand 4.4+** - Lightweight state management for assessment data
- **TanStack React Query 5.0+** - Server state management and caching
- **React Hook Form** - Performant form handling for questionnaires

### UI & Styling
- **Tailwind CSS 3.3+** - Utility-first CSS framework
- **Headless UI** - Accessible UI components
- **React Icons** - Icon library for consistent iconography
- **Custom Design System** - Agent personality components and assessment UI

### Development Tools
- **ESLint** - Code linting with TypeScript support
- **Prettier** - Code formatting
- **Husky** - Git hooks for quality enforcement

## Backend Stack

### Runtime & Framework
- **Node.js 18.x** - JavaScript runtime for AWS Lambda
- **AWS Lambda** - Serverless functions with auto-scaling
- **API Gateway** - RESTful API endpoints with rate limiting

### Database & Storage
- **Amazon DynamoDB** - NoSQL database with single-table design
  - Primary table: `scalemap-prod`
  - GSI1: User/company lookups
  - GSI2: Status-based queries
  - Pay-per-request billing for cost optimization

### File Storage & Processing
- **Amazon S3** - Document storage with encryption
  - Bucket: `scalemap-documents-prod-mvpdev`
  - Server-side encryption (AES256)
  - Lifecycle policies for cost optimization
- **Amazon Textract** - OCR and document analysis
  - Synchronous analysis for small documents
  - Asynchronous processing for large documents

### Communication
- **Amazon SES** - Email delivery service
  - Assessment lifecycle emails
  - Progress notifications
  - Implementation kit delivery

## AI & Machine Learning

### Primary AI Service
- **OpenAI API** - GPT models for domain analysis
  - **GPT-4o** - Primary model for complex analysis
  - **GPT-4o-mini** - Cost-optimized for triage and simple tasks
  - **o1-preview** - Advanced reasoning for Perfect Prioritization
  - Latest API version (2024-12-17) with structured outputs

### AI Architecture
- **Domain Triage** - Intelligent identification of critical business areas
- **Multi-Agent Analysis** - 12 specialist domain agents
- **Perfect Prioritization** - Synthesis algorithm for maximum impact recommendations
- **Cost Optimization** - Intelligent model selection and token management

### AI Cost Management
- **Target Cost**: £1-2 OpenAI per £5-8K assessment
- **Circuit Breaker**: Automatic fallback on API failures
- **Usage Tracking**: Real-time token and cost monitoring
- **Model Fallback**: o1-preview → GPT-4o → GPT-4o-mini

## Development & Deployment

### Monorepo Architecture
- **Turborepo** - Monorepo orchestration and build optimization
- **Package Structure**:
  - `apps/web` - Next.js frontend application
  - `apps/api` - AWS Lambda backend services
  - `packages/shared` - Shared TypeScript types and utilities
  - `packages/ui` - Reusable React components

### Infrastructure as Code
- **AWS CDK v2** - Infrastructure deployment and management
- **Environment Management**: Dev, staging, production
- **Blue-Green Deployment** - Zero-downtime releases

### CI/CD Pipeline
- **GitHub Actions** - Automated testing and deployment
- **Automated Testing**: Unit, integration, and end-to-end tests
- **Quality Gates**: Linting, type checking, security scanning
- **Environment Promotion**: Automated staging → production

## Monitoring & Observability

### Application Monitoring
- **AWS CloudWatch** - Metrics, logs, and alerting
- **Custom Metrics** - Business KPIs and performance indicators
- **Distributed Tracing** - Request flow tracking across services

### Error Handling
- **Structured Logging** - JSON-formatted logs with correlation IDs
- **Error Boundaries** - React error boundaries for graceful failures
- **Circuit Breakers** - Automatic service degradation patterns

### Performance Monitoring
- **Real User Monitoring** - Frontend performance tracking
- **API Performance** - Latency and throughput monitoring
- **Database Performance** - DynamoDB metrics and optimization

## Security

### Authentication & Authorization
- **JWT Tokens** - Secure authentication with proper validation
- **Session Management** - Secure token handling and refresh
- **RBAC Framework** - Role-based access control (expandable)

### Data Protection
- **Encryption at Rest** - All data encrypted in DynamoDB and S3
- **Encryption in Transit** - TLS 1.3 for all API communications
- **GDPR Compliance** - Data retention policies and user consent

### API Security
- **Rate Limiting** - Protection against abuse and DoS
- **Input Validation** - Comprehensive sanitization and validation
- **CORS Configuration** - Proper cross-origin request handling

## Cost Optimization

### Monthly Cost Projections (Production)
| Service | 10 Assessments | 25 Assessments | 50 Assessments |
|---------|---------------|-----------------|-----------------|
| **OpenAI API** | £10-20 | £25-50 | £50-100 |
| **AWS DynamoDB** | £2-5 | £5-12 | £10-25 |
| **AWS S3** | £1-3 | £3-8 | £6-15 |
| **AWS Lambda** | £0-2 | £1-5 | £2-10 |
| **AWS SES** | £0 | £0-1 | £1-3 |
| **AWS Textract** | £2-5 | £5-12 | £10-25 |
| **Total Monthly** | £15-35 | £39-88 | £79-178 |

### Optimization Strategies
- **Pay-per-request** billing for all AWS services
- **Intelligent caching** for OpenAI responses
- **Automatic scaling** with Lambda and DynamoDB
- **Resource right-sizing** based on usage patterns

## Development Environment

### Local Development
- **Docker Compose** - Local service emulation
- **LocalStack** - AWS service mocking
- **Hot Reload** - Fast development cycles with Next.js
- **Environment Isolation** - Separate configs for dev/staging/prod

### Testing Stack
- **Jest** - Unit and integration testing
- **React Testing Library** - Component testing
- **Supertest** - API endpoint testing
- **AWS SDK Mocking** - Service integration testing

## Production Architecture

### High Availability
- **Multi-AZ Deployment** - AWS services across availability zones
- **Auto-scaling** - Lambda concurrency and DynamoDB throughput
- **Health Checks** - Automated monitoring and alerting

### Disaster Recovery
- **DynamoDB Backups** - Point-in-time recovery
- **S3 Versioning** - Document version control
- **Infrastructure Versioning** - CDK stack management

### Performance Targets
- **API Response Time**: < 200ms (95th percentile)
- **Page Load Time**: < 2s (First Contentful Paint)
- **Assessment Processing**: 72-hour delivery SLA
- **Uptime Target**: 99.9% availability

This technology stack provides a robust, scalable foundation that supports ScaleMap's growth from MVP to enterprise scale while maintaining cost efficiency and development velocity.
