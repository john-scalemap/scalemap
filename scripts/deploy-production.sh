#!/bin/bash

# ScaleMap Production Deployment Script
set -e

echo "🚀 Starting ScaleMap production deployment..."

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
BLUE='\033[0;34m'
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

echo_info() {
  echo -e "${BLUE}ℹ️  $1${NC}"
}

# Confirmation prompt
echo_warning "You are about to deploy to PRODUCTION!"
read -p "Are you sure you want to continue? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Deployment cancelled."
  exit 0
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm ci

# Run full test suite
echo "🧪 Running full test suite..."
npm run test || {
  echo_error "Tests failed. Aborting deployment."
  exit 1
}

# Run linting
echo "🔍 Running linting..."
npm run lint || {
  echo_error "Linting failed. Aborting deployment."
  exit 1
}

# Type checking
echo "📝 Type checking..."
npm run type-check || {
  echo_error "Type checking failed. Aborting deployment."
  exit 1
}

# Build packages
echo "🔨 Building packages..."
npm run build || {
  echo_error "Build failed. Aborting deployment."
  exit 1
}

# Deploy API with blue-green strategy
echo "☁️  Deploying API to AWS (production - blue-green)..."
cd apps/api
npm install -g aws-cdk@latest

echo_info "Deploying to green environment..."
cdk deploy ScaleMapProd --profile "$AWS_PROFILE" --require-approval never || {
  echo_error "API deployment failed."
  exit 1
}

cd ../..
echo_success "API deployed successfully"

# Deploy Web App
echo "🌐 Deploying web app to Vercel (production)..."
cd apps/web
npx vercel --prod --token "$VERCEL_TOKEN" --scope "$VERCEL_ORG_ID" || {
  echo_error "Web app deployment failed."
  exit 1
}
cd ../..

echo_success "Web app deployed successfully"

# Extended health checks for production
echo "🔍 Running comprehensive health checks..."
sleep 60

# Check API health
if [[ -n "$PRODUCTION_API_URL" ]]; then
  for i in {1..5}; do
    if curl -f "$PRODUCTION_API_URL/health"; then
      echo_success "API health check passed (attempt $i)"
      break
    else
      echo_warning "API health check failed (attempt $i)"
      if [[ $i -eq 5 ]]; then
        echo_error "API health checks failed after 5 attempts"
        exit 1
      fi
      sleep 10
    fi
  done
fi

# Check web app
if [[ -n "$PRODUCTION_WEB_URL" ]]; then
  for i in {1..3}; do
    if curl -f "$PRODUCTION_WEB_URL"; then
      echo_success "Web app health check passed (attempt $i)"
      break
    else
      echo_warning "Web app health check failed (attempt $i)"
      if [[ $i -eq 3 ]]; then
        echo_error "Web app health checks failed after 3 attempts"
        exit 1
      fi
      sleep 10
    fi
  done
fi

echo_success "🎉 Production deployment completed successfully!"
echo_info "Monitor the application closely for the next 30 minutes."
echo_info "Rollback procedures are available if issues arise."