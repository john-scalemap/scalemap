#!/bin/bash

# ScaleMap Development Environment Setup Script
set -e

echo "🛠️  Setting up ScaleMap development environment..."

# Colors for output
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

echo_info() {
  echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check Node.js version
echo_info "Checking Node.js version..."
if ! command -v node &> /dev/null; then
  echo_warning "Node.js is not installed. Please install Node.js 18+ first."
  exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//')
REQUIRED_VERSION="18.0.0"

if ! npx semver -r ">=$REQUIRED_VERSION" "$NODE_VERSION" &> /dev/null; then
  echo_warning "Node.js version $NODE_VERSION is below required version $REQUIRED_VERSION"
  exit 1
fi

echo_success "Node.js version $NODE_VERSION is compatible"

# Check npm version
echo_info "Checking npm version..."
NPM_VERSION=$(npm -v)
echo_success "npm version $NPM_VERSION"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build packages
echo "🔨 Building packages..."
npm run build

# Run tests to verify setup
echo "🧪 Running tests to verify setup..."
npm run test

# Copy environment variables if they don't exist
if [[ ! -f ".env.local" ]]; then
  echo "📝 Creating .env.local from .env.example..."
  cp .env.example .env.local
  echo_warning "Please update .env.local with your actual environment variables"
fi

# Create development database (if using local DynamoDB)
echo "🗄️  Setting up local development database..."
echo_info "Make sure to install and run DynamoDB Local for development"

echo_success "🎉 Development environment setup completed!"
echo ""
echo_info "Next steps:"
echo_info "1. Update .env.local with your API keys and configuration"
echo_info "2. Start the development server: npm run dev"
echo_info "3. Visit http://localhost:3000 to see the application"
echo ""
echo_info "Available commands:"
echo_info "  npm run dev      - Start development servers"
echo_info "  npm run build    - Build all packages"
echo_info "  npm run test     - Run tests"
echo_info "  npm run lint     - Run linting"
echo_info "  npm run format   - Format code"