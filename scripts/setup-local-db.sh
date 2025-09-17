#!/bin/bash

# ScaleMap Local Database Setup Script
set -e

echo "🗄️  Setting up local DynamoDB for ScaleMap development..."

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

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
  echo_error "Docker is not running. Please start Docker first."
  exit 1
fi

# Start DynamoDB Local
echo_info "Starting local DynamoDB container..."
docker-compose up -d dynamodb-local dynamodb-admin

# Wait for DynamoDB to be ready
echo_info "Waiting for DynamoDB to be ready..."
sleep 10

# Check if DynamoDB is responding
max_attempts=30
attempt=1
while [ $attempt -le $max_attempts ]; do
  if curl -s http://localhost:8000/ >/dev/null; then
    break
  fi
  echo_info "Waiting for DynamoDB... (attempt $attempt/$max_attempts)"
  sleep 2
  ((attempt++))
done

if [ $attempt -gt $max_attempts ]; then
  echo_error "DynamoDB failed to start after $max_attempts attempts"
  exit 1
fi

echo_success "DynamoDB Local is running on http://localhost:8000"

# Create the main ScaleMap table
echo_info "Creating ScaleMap development table..."

aws dynamodb create-table \
    --endpoint-url http://localhost:8000 \
    --region us-east-1 \
    --table-name scalemap-dev \
    --attribute-definitions \
        AttributeName=PK,AttributeType=S \
        AttributeName=SK,AttributeType=S \
        AttributeName=GSI1PK,AttributeType=S \
        AttributeName=GSI1SK,AttributeType=S \
        AttributeName=GSI2PK,AttributeType=S \
        AttributeName=GSI2SK,AttributeType=S \
    --key-schema \
        AttributeName=PK,KeyType=HASH \
        AttributeName=SK,KeyType=RANGE \
    --global-secondary-indexes \
        IndexName=GSI1,KeySchema=[{AttributeName=GSI1PK,KeyType=HASH},{AttributeName=GSI1SK,KeyType=RANGE}],Projection={ProjectionType=ALL},BillingMode=PAY_PER_REQUEST \
        IndexName=GSI2,KeySchema=[{AttributeName=GSI2PK,KeyType=HASH},{AttributeName=GSI2SK,KeyType=RANGE}],Projection={ProjectionType=ALL},BillingMode=PAY_PER_REQUEST \
    --billing-mode PAY_PER_REQUEST \
    > /dev/null 2>&1 || echo_warning "Table may already exist"

echo_success "Database table created successfully"

# Seed some test data
echo_info "Seeding test data..."

# Create a test company
aws dynamodb put-item \
    --endpoint-url http://localhost:8000 \
    --region us-east-1 \
    --table-name scalemap-dev \
    --item '{
        "PK": {"S": "COMPANY#test-company-1"},
        "SK": {"S": "METADATA"},
        "GSI1PK": {"S": "COMPANY"},
        "GSI1SK": {"S": "test-company-1"},
        "id": {"S": "test-company-1"},
        "name": {"S": "Test Company Inc"},
        "industry": {"S": "Technology"},
        "size": {"S": "medium"},
        "createdAt": {"S": "'$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)'"},
        "updatedAt": {"S": "'$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)'"}
    }' > /dev/null

# Create a test assessment
aws dynamodb put-item \
    --endpoint-url http://localhost:8000 \
    --region us-east-1 \
    --table-name scalemap-dev \
    --item '{
        "PK": {"S": "COMPANY#test-company-1"},
        "SK": {"S": "ASSESSMENT#test-assessment-1"},
        "GSI1PK": {"S": "ASSESSMENT"},
        "GSI1SK": {"S": "test-assessment-1"},
        "GSI2PK": {"S": "STATUS#draft"},
        "GSI2SK": {"S": "'$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)'"},
        "id": {"S": "test-assessment-1"},
        "companyId": {"S": "test-company-1"},
        "title": {"S": "Initial Technology Assessment"},
        "description": {"S": "Comprehensive assessment of current technology stack and processes"},
        "status": {"S": "draft"},
        "createdAt": {"S": "'$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)'"},
        "updatedAt": {"S": "'$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)'"}
    }' > /dev/null

echo_success "Test data seeded successfully"

echo ""
echo_success "🎉 Local development database setup complete!"
echo ""
echo_info "Available services:"
echo_info "  • DynamoDB Local: http://localhost:8000"
echo_info "  • DynamoDB Admin: http://localhost:8001"
echo ""
echo_info "To stop the database:"
echo_info "  docker-compose down"
echo ""
echo_info "To view database contents:"
echo_info "  Visit http://localhost:8001 in your browser"
echo_info "  Or use AWS CLI: aws dynamodb scan --table-name scalemap-dev --endpoint-url http://localhost:8000"