# Developer Guardrails & Quality Standards

## Overview

This document establishes non-negotiable quality standards and development practices to ensure we maintain the highest level of code quality while preventing technical debt accumulation during our UI flow implementation phase.

## Core Development Philosophy

### Gold Standard Mindset
- **No Compromises**: We build production-ready code from the start, not prototypes that "need fixing later"
- **Quality First**: Every line of code should meet production standards before commit
- **Technical Debt Prevention**: Address root causes, not symptoms
- **Future-Proof**: Write code that scales with business growth

### Working Approach Expectations
1. **Understand Before Implementing**: Read existing code patterns and architecture before starting
2. **Follow Established Patterns**: Use existing components, utilities, and conventions
3. **Test-Driven Development**: Write tests first to clarify requirements and prevent regressions
4. **Incremental Excellence**: Each commit should improve overall code quality

## Mandatory Quality Gates

### Before Starting Any Task
- [ ] Read and understand the existing codebase structure for the area you're modifying
- [ ] Review related components to understand established patterns
- [ ] Check existing utilities and services before creating new ones
- [ ] Verify the requirement against acceptance criteria and design specifications

### During Development
- [ ] Write unit tests that cover your implementation (minimum 80% coverage)
- [ ] Follow TypeScript strict mode - no `any` types allowed
- [ ] Use existing UI components from the design system
- [ ] Implement proper error handling with user-friendly messages
- [ ] Add appropriate logging with correlation IDs for debugging

### Before Commit
- [ ] All ESLint rules pass with zero errors (warnings require justification)
- [ ] TypeScript compilation succeeds with no errors
- [ ] All tests pass including new tests for your changes
- [ ] Manual testing completed for the happy path and edge cases
- [ ] Code review self-checklist completed

## Technical Standards

### TypeScript Excellence
```typescript
// ❌ NEVER DO THIS
const handleSubmit = (data: any) => {
  // @ts-ignore
  return processData(data.someField);
};

// ✅ ALWAYS DO THIS
interface SubmitData {
  someField: string;
  otherField?: number;
}

const handleSubmit = (data: SubmitData): Promise<ProcessResult> => {
  return processData(data.someField);
};
```

### Error Handling Standards
```typescript
// ❌ NEVER DO THIS - Silent failures or generic errors
const fetchData = async () => {
  try {
    return await api.getData();
  } catch {
    return null; // Silent failure
  }
};

// ✅ ALWAYS DO THIS - Proper error handling with context
const fetchData = async (): Promise<ApiResult<Data>> => {
  try {
    const result = await api.getData();
    return { success: true, data: result };
  } catch (error) {
    logger.error('Failed to fetch data', { error, context: 'fetchData' });
    return {
      success: false,
      error: {
        message: 'Unable to retrieve data. Please try again.',
        type: 'FETCH_ERROR',
        retryable: true
      }
    };
  }
};
```

### Component Architecture
```typescript
// ❌ AVOID - Monolithic components with mixed concerns
const AssessmentPage = () => {
  // 200+ lines of mixed UI logic, API calls, state management
};

// ✅ PREFER - Composed architecture with clear separation
const AssessmentPage = () => {
  return (
    <AssessmentLayout>
      <AssessmentHeader />
      <AssessmentForm />
      <AssessmentProgress />
    </AssessmentLayout>
  );
};
```

## Anti-Patterns to Avoid

### 🚫 Workarounds and Quick Fixes
- **No TODO comments** without GitHub issues and timeline for resolution
- **No setTimeout/setInterval** for race condition "fixes"
- **No catch-all error handlers** that mask underlying issues
- **No inline styles** when Tailwind classes or design system components exist
- **No duplicate code** - extract to utilities or components

### 🚫 State Management Violations
```typescript
// ❌ NEVER - Direct state mutation
const updateAssessment = (assessment: Assessment) => {
  assessment.status = 'completed'; // Mutating props
  setAssessments([...assessments]); // Stale closure
};

// ✅ ALWAYS - Immutable updates with proper state management
const updateAssessment = useCallback((assessmentId: string, updates: Partial<Assessment>) => {
  setAssessments(prev => prev.map(assessment =>
    assessment.id === assessmentId
      ? { ...assessment, ...updates }
      : assessment
  ));
}, []);
```

### 🚫 API Integration Shortcuts
```typescript
// ❌ NEVER - Hardcoded values, no error handling
const submitAssessment = async (data) => {
  const response = await fetch('/api/assessments', {
    method: 'POST',
    body: JSON.stringify(data)
  });
  return response.json();
};

// ✅ ALWAYS - Proper service layer with error handling
const submitAssessment = async (data: AssessmentData): Promise<ApiResult<Assessment>> => {
  return await apiClient.post('/assessments', data, {
    timeout: API_TIMEOUT,
    retries: 2,
    validateStatus: (status) => status < 500
  });
};
```

## Required Practices

### Testing Requirements
Every feature must include:
1. **Unit Tests**: Test individual functions and components in isolation
2. **Integration Tests**: Test API endpoints and service interactions
3. **User Journey Tests**: Test complete workflows end-to-end
4. **Error Scenario Tests**: Test failure modes and edge cases

### Code Organization
```
src/
├── components/           # Reusable UI components
│   ├── ui/              # Base design system components
│   └── features/        # Feature-specific components
├── services/            # API clients and external service integrations
├── hooks/               # Custom React hooks for reusable logic
├── utils/               # Pure utility functions
├── types/               # TypeScript type definitions
└── __tests__/           # Test files co-located with source
```

### Documentation Standards
- **JSDoc comments** for all public interfaces
- **README updates** for new features or architectural changes
- **API documentation** for new endpoints
- **Component stories** for complex UI components

## Performance Standards

### Frontend Performance
- **Bundle Size**: Monitor and prevent unnecessary bundle bloat
- **Core Web Vitals**: Maintain green scores in PageSpeed Insights
- **State Updates**: Minimize re-renders with proper memoization
- **Image Optimization**: Use Next.js Image component with appropriate sizing

### Backend Performance
- **Response Times**: API endpoints must respond within 200ms (95th percentile)
- **Database Queries**: Use appropriate indexes and query optimization
- **Memory Usage**: Monitor Lambda memory consumption and optimize
- **Cost Efficiency**: Maintain OpenAI usage within £1-2 per assessment

## Security Requirements

### Authentication & Authorization
- **JWT Validation**: Proper token verification on every protected route
- **Session Management**: Secure token storage and refresh patterns
- **Input Validation**: Server-side validation for all user inputs
- **Rate Limiting**: Implement and test rate limiting on all endpoints

### Data Protection
- **Sensitive Data**: Never log or expose sensitive information
- **CORS Configuration**: Proper cross-origin request handling
- **Error Messages**: Avoid information disclosure in error responses
- **File Uploads**: Validate and sanitize all uploaded content

## Deployment Requirements

### Pre-Deployment Checklist
- [ ] All automated tests pass in CI/CD pipeline
- [ ] Code coverage meets or exceeds existing baseline
- [ ] Performance tests validate no regressions
- [ ] Security scans complete without critical issues
- [ ] Database migrations (if any) tested in staging
- [ ] Feature flags configured for safe rollout

### Monitoring Requirements
- [ ] Application metrics configured for new features
- [ ] Error tracking setup with appropriate alerting
- [ ] Performance monitoring for critical user paths
- [ ] Cost tracking for any new AI/AWS service usage

## Code Review Standards

### Reviewer Expectations
As a reviewer, ensure:
- **Architectural Consistency**: Changes align with established patterns
- **Test Coverage**: Adequate testing for new functionality
- **Performance Impact**: No negative performance implications
- **Security Considerations**: Proper handling of user data and authentication
- **Documentation**: Appropriate documentation for complex logic

### Author Responsibilities
Before requesting review:
1. Self-review your changes with a critical eye
2. Run the full test suite locally
3. Verify the feature works end-to-end in development
4. Update relevant documentation
5. Consider the long-term maintainability of your solution

## Escalation Process

### When to Escalate
- **Architectural Decisions**: Any changes that affect system design
- **Performance Concerns**: When standard approaches may impact performance
- **Security Questions**: Any uncertainty about security implications
- **Technical Debt**: When shortcuts might be tempting due to timeline pressure

### How to Escalate
1. **Document the Issue**: Clearly describe the problem and constraints
2. **Present Options**: Research and present multiple solution approaches
3. **Include Trade-offs**: Explain the pros/cons of each option
4. **Recommend Approach**: State your preferred solution with reasoning

## Success Metrics

### Code Quality Metrics
- **Test Coverage**: Maintain >80% coverage with trending toward 90%
- **ESLint Compliance**: Zero errors, minimal justified warnings
- **TypeScript Strict**: 100% compliance with strict mode
- **Performance Budget**: No regressions in Core Web Vitals

### Development Velocity
- **First-Time Pass Rate**: >90% of PRs pass all checks on first submission
- **Review Cycle Time**: <24 hours from submission to approval
- **Bug Escape Rate**: <5% of stories require post-deployment fixes
- **Technical Debt Ratio**: Maintain or improve current ratio

## Remember: Quality is Non-Negotiable

- **No shortcuts under time pressure** - proper planning prevents poor performance
- **No "we'll fix it later"** - later often becomes never
- **No accumulating technical debt** - address issues as they arise
- **No compromising user experience** for development convenience

Your role is to be a craftsperson who takes pride in building robust, maintainable, and scalable solutions. Every commit should make the codebase better, not just add functionality.

The goal is sustainable development velocity through high-quality code, not short-term speed at the cost of long-term maintainability.