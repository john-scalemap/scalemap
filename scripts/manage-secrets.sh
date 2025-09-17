#!/bin/bash

# ScaleMap Secrets Management Script
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
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

echo_error() {
  echo -e "${RED}❌ $1${NC}"
}

show_usage() {
  echo "Usage: $0 [COMMAND]"
  echo ""
  echo "Commands:"
  echo "  setup     Setup development environment variables"
  echo "  validate  Validate environment variables"
  echo "  generate  Generate secure secrets for development"
  echo "  check     Check for missing environment variables"
  echo "  help      Show this help message"
  echo ""
  echo "Examples:"
  echo "  $0 setup"
  echo "  $0 validate"
  echo "  $0 generate"
}

setup_env() {
  echo_info "Setting up development environment variables..."

  cd "$PROJECT_ROOT"

  # Copy .env.example to .env.local if it doesn't exist
  if [[ ! -f ".env.local" ]]; then
    cp ".env.example" ".env.local"
    echo_success "Created .env.local from .env.example"
  else
    echo_warning ".env.local already exists, skipping copy"
  fi

  # Generate secure secrets
  generate_secrets

  echo_success "Environment setup complete!"
  echo_info "Please edit .env.local with your actual API keys and secrets"
}

generate_secrets() {
  echo_info "Generating secure secrets..."

  # Generate JWT secret
  JWT_SECRET=$(openssl rand -base64 32 2>/dev/null || head -c 32 /dev/urandom | base64)

  # Generate NextAuth secret
  NEXTAUTH_SECRET=$(openssl rand -base64 32 2>/dev/null || head -c 32 /dev/urandom | base64)

  # Generate encryption key
  ENCRYPTION_KEY=$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | hexdump -v -e '1/1 "%02x"')

  echo ""
  echo_info "Generated secrets (add these to your .env.local):"
  echo ""
  echo "JWT_SECRET=$JWT_SECRET"
  echo "NEXTAUTH_SECRET=$NEXTAUTH_SECRET"
  echo "ENCRYPTION_KEY=$ENCRYPTION_KEY"
  echo ""
}

validate_env() {
  echo_info "Validating environment variables..."

  cd "$PROJECT_ROOT"

  if [[ ! -f ".env.local" ]]; then
    echo_error ".env.local file not found. Run '$0 setup' first."
    exit 1
  fi

  # Source the environment file
  source .env.local

  # Required variables for development
  REQUIRED_VARS=(
    "NODE_ENV"
    "AWS_REGION"
    "TABLE_NAME"
    "NEXT_PUBLIC_API_URL"
  )

  # Optional but recommended variables
  RECOMMENDED_VARS=(
    "OPENAI_API_KEY"
    "STRIPE_SECRET_KEY"
    "NEXTAUTH_SECRET"
    "JWT_SECRET"
    "ENCRYPTION_KEY"
  )

  echo_info "Checking required variables..."
  for var in "${REQUIRED_VARS[@]}"; do
    if [[ -z "${!var}" ]]; then
      echo_error "Required variable $var is not set"
      exit 1
    else
      echo_success "$var is set"
    fi
  done

  echo_info "Checking recommended variables..."
  for var in "${RECOMMENDED_VARS[@]}"; do
    if [[ -z "${!var}" || "${!var}" == *"your_"* ]]; then
      echo_warning "Recommended variable $var is not set or uses placeholder value"
    else
      echo_success "$var is properly configured"
    fi
  done

  echo_success "Environment validation complete!"
}

check_missing() {
  echo_info "Checking for missing environment variables..."

  cd "$PROJECT_ROOT"

  if [[ ! -f ".env.local" ]]; then
    echo_error ".env.local file not found. Run '$0 setup' first."
    exit 1
  fi

  # Compare .env.example with .env.local
  while IFS= read -r line; do
    # Skip comments and empty lines
    [[ "$line" =~ ^#.*$ ]] && continue
    [[ -z "$line" ]] && continue

    # Extract variable name
    var_name=$(echo "$line" | cut -d'=' -f1)

    # Check if variable exists in .env.local
    if ! grep -q "^$var_name=" ".env.local" 2>/dev/null; then
      echo_warning "Missing variable: $var_name"
    fi
  done < ".env.example"

  echo_success "Missing variable check complete!"
}

# Main script logic
case "${1:-help}" in
  "setup")
    setup_env
    ;;
  "validate")
    validate_env
    ;;
  "generate")
    generate_secrets
    ;;
  "check")
    check_missing
    ;;
  "help")
    show_usage
    ;;
  *)
    echo_error "Unknown command: $1"
    echo ""
    show_usage
    exit 1
    ;;
esac