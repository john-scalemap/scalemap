# ScaleMap

Strategic Enterprise Assessment and Agent Framework

## Overview

ScaleMap is a comprehensive platform that enables organizations to assess their strategic capabilities, identify improvement opportunities, and leverage AI agents to drive operational excellence.

## Project Structure

This is a monorepo built with Turborepo containing:

### Apps
- **web** - Next.js frontend application
- **api** - AWS Lambda backend services

### Packages
- **shared** - Shared TypeScript types and utilities
- **ui** - Reusable React UI components
- **eslint-config** - Shared ESLint configuration
- **typescript-config** - Shared TypeScript configuration

## Development

### Prerequisites

- Node.js 18+ and npm 8+
- AWS CLI configured
- AWS CDK CLI installed

### Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy environment variables:
   ```bash
   cp .env.example .env.local
   ```

4. Start development servers:
   ```bash
   npm run dev
   ```

### Scripts

- `npm run build` - Build all apps and packages
- `npm run dev` - Start development servers
- `npm run lint` - Lint all code
- `npm run format` - Format code with Prettier
- `npm run test` - Run all tests
- `npm run type-check` - Type check all TypeScript

### Deployment

#### Staging
```bash
npm run deploy:staging
```

#### Production
```bash
npm run deploy:production
```

## Architecture

- **Frontend**: Next.js 14 with App Router, Tailwind CSS, Zustand for state management
- **Backend**: AWS Lambda functions with DynamoDB
- **Infrastructure**: AWS CDK for Infrastructure as Code
- **CI/CD**: GitHub Actions

## License

UNLICENSED - Private Repository