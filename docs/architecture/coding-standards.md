# Coding Standards

## TypeScript Code Quality

### Type Safety
- **Strict TypeScript**: All code must use strict TypeScript configuration with no `any` types
- **Interface Definitions**: Use interfaces for object shapes, types for unions/primitives
- **Proper Typing**: All function parameters and return values must be explicitly typed
- **Null Safety**: Use optional chaining (`?.`) and nullish coalescing (`??`) operators

### Code Organization
- **Import Order**: Group imports by type (external libraries, internal modules, types)
- **File Structure**: Follow domain-driven organization within `src/` directories
- **Naming Conventions**:
  - camelCase for variables and functions
  - PascalCase for classes and interfaces
  - UPPER_SNAKE_CASE for constants

### ESLint Compliance
- **Zero Errors**: All ESLint errors must be fixed before commit
- **Minimal Warnings**: ESLint warnings should be addressed or explicitly suppressed with justification
- **Consistent Formatting**: Use Prettier for automatic code formatting

## API Development Standards

### Error Handling
- **Structured Errors**: Use consistent error response format with proper HTTP status codes
- **Circuit Breakers**: Implement circuit breaker patterns for external service calls
- **Logging**: Use structured logging with correlation IDs for request tracing

### Security Standards
- **Input Validation**: Validate all input data with proper sanitization
- **Authentication**: Use JWT tokens with proper validation (no temporary bypasses)
- **Rate Limiting**: Implement rate limiting on all public endpoints
- **Secret Management**: Store secrets in environment variables or AWS Parameter Store

### Performance Standards
- **Response Times**: API endpoints should respond within 200ms (95th percentile)
- **Caching**: Implement appropriate caching strategies for repeated data
- **Database Optimization**: Use proper indexes and query optimization for DynamoDB

## Testing Standards

### Test Coverage
- **Unit Tests**: Minimum 80% code coverage for critical business logic
- **Integration Tests**: Cover all external service interactions
- **Error Scenarios**: Test failure modes and edge cases

### Test Organization
- **Descriptive Names**: Test names should clearly describe the scenario being tested
- **Arrange-Act-Assert**: Follow AAA pattern for test structure
- **Test Data**: Use factories for consistent test data generation

## External Service Integration

### AWS Services
- **Error Handling**: Handle eventual consistency and service failures gracefully
- **Cost Optimization**: Use on-demand billing and right-sized resources
- **Monitoring**: Implement CloudWatch metrics and alerting

### OpenAI Integration
- **Cost Control**: Implement usage tracking and budget limits
- **Model Selection**: Use appropriate model for task complexity
- **Fallback Strategy**: Implement model fallback for availability and cost optimization

## Code Review Standards

### Review Requirements
- **Security Review**: All authentication and authorization changes require security review
- **Performance Review**: Database schema changes and API endpoints require performance review
- **Test Coverage**: New features must include comprehensive test coverage

### Review Process
- **Automated Checks**: All automated checks (linting, tests, build) must pass
- **Manual Review**: At least one team member must review code changes
- **Documentation**: Significant architectural changes require documentation updates
