#!/bin/bash

# ScaleMap Staging Deployment Script
set -e

echo "🚀 Starting ScaleMap staging deployment..."

# Check required environment variables
if [[ -z "$AWS_PROFILE" ]]; then
  echo "❌ AWS_PROFILE environment variable is required"
  exit 1
fi

if [[ -z "$VERCEL_TOKEN" ]]; then
  echo "❌ VERCEL_TOKEN environment variable is required"
  exit 1
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo_success() {
  echo -e "${GREEN}✅ $1${NC}"
}

echo_warning() {
  echo -e "${YELLOW}⚠️  $1${NC}"
}

echo_error() {
  echo -e "${RED}❌ $1${NC}"
}

# Install dependencies
echo "📦 Installing dependencies..."
npm ci

# Run tests
echo "🧪 Running tests..."
npm run test || {
  echo_error "Tests failed. Aborting deployment."
  exit 1
}

# Build packages
echo "🔨 Building packages..."
npm run build || {
  echo_error "Build failed. Aborting deployment."
  exit 1
}

# Deploy API
echo "☁️  Deploying API to AWS (staging)..."
cd apps/api
npm install -g aws-cdk@latest
cdk deploy ScaleMapStaging --profile "$AWS_PROFILE" --require-approval never || {
  echo_error "API deployment failed."
  exit 1
}
cd ../..

echo_success "API deployed successfully"

# Deploy Web App
echo "🌐 Deploying web app to Vercel (staging)..."
cd apps/web
npx vercel --token "$VERCEL_TOKEN" --scope "$VERCEL_ORG_ID" || {
  echo_error "Web app deployment failed."
  exit 1
}
cd ../..

echo_success "Web app deployed successfully"

# Health checks
echo "🔍 Running health checks..."
sleep 30

# Check API health
if [[ -n "$STAGING_API_URL" ]]; then
  curl -f "$STAGING_API_URL/health" || {
    echo_warning "API health check failed"
  }
  echo_success "API health check passed"
fi

# Check web app
if [[ -n "$STAGING_WEB_URL" ]]; then
  curl -f "$STAGING_WEB_URL" || {
    echo_warning "Web app health check failed"
  }
  echo_success "Web app health check passed"
fi

echo_success "🎉 Staging deployment completed successfully!"