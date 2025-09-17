# Technical Debt: Save/Resume Functionality Gap

**Priority**: CRITICAL
**Story Affected**: 2.1 - 12-Domain Assessment Questionnaire System
**Date Identified**: 2025-09-16
**Identified By**: John (Product Manager)

## Issue Summary

**Critical implementation gap** in Story 2.1 that violates Acceptance Criteria #2: "Smart form validation and progress tracking with **ability to save and resume assessment**"

While auto-save functionality is fully implemented on the backend, users cannot discover or resume draft assessments from the dashboard, breaking the core user experience.

## Current State Analysis

### ✅ What's Working
- **Auto-save Backend**: Fully functional with 1-second debounced saves
- **Save API**: `PUT /api/assessment/{id}` working (update-responses.ts)
- **Load API**: `GET /api/assessment/{id}` working (get-assessment.ts)
- **Store Persistence**: Zustand store with localStorage persistence
- **Progress Tracking**: Complete progress tracking implemented

### ❌ What's Missing
- **Dashboard Draft List**: No interface to show draft/in-progress assessments
- **List Assessments API**: Missing `GET /api/assessments` endpoint
- **Resume Assessment Flow**: No navigation path from dashboard to resume drafts

## User Experience Impact

### Current Broken Flow
1. ✅ User starts assessment → auto-save working
2. ✅ User progresses through questionnaire → progress tracked
3. ❌ **BROKEN**: User leaves and returns to dashboard → no way to find draft
4. ❌ **BROKEN**: User must remember assessment ID to manually resume

### Expected Flow
1. User returns to dashboard
2. Dashboard shows "My Assessments" section with draft assessments
3. User clicks "Resume Assessment" to continue where they left off

## Technical Requirements

### 1. Backend API Endpoint
**File**: `apps/api/src/functions/assessment/list-assessments.ts`
**Route**: `GET /api/assessments?status=draft,in-progress`
**Functionality**:
- Query DynamoDB using GSI1PK (COMPANY#{companyId})
- Filter by assessment status (draft, in-progress)
- Return array of Assessment objects with basic metadata

### 2. Frontend Dashboard Enhancement
**File**: `apps/web/src/app/dashboard/page.tsx`
**Changes Needed**:
- Replace static "Recent Activity" section with dynamic "My Assessments"
- Add assessment list component showing draft/in-progress assessments
- Add "Resume Assessment" buttons linking to `/assessment/{id}/questionnaire`
- Show assessment progress percentage and last updated timestamp

### 3. Assessment Service Extension
**File**: `apps/web/src/hooks/useAssessment.ts`
**New Function**: `listAssessments(status?: string[])`
- Fetch assessments from new list endpoint
- Handle loading states and error conditions
- Cache results for dashboard performance

## Implementation Details

### Database Query Pattern
```typescript
// DynamoDB query using existing GSI1
GSI1PK = "COMPANY#{companyId}"
GSI1SK begins_with "ASSESSMENT#"
FilterExpression: #status IN (:draft, :in-progress)
```

### Frontend Component Structure
```typescript
// Dashboard Assessment Section
<div className="bg-white rounded-lg shadow p-6">
  <h2>My Assessments</h2>
  {assessments.map(assessment => (
    <AssessmentCard
      key={assessment.id}
      assessment={assessment}
      onResume={() => router.push(`/assessment/${assessment.id}/questionnaire`)}
    />
  ))}
</div>
```

## Testing Requirements

### Backend Tests
- **Unit**: List assessments function with various status filters
- **Integration**: End-to-end API call with authentication
- **Error Scenarios**: Invalid company access, empty results

### Frontend Tests
- **Component**: Dashboard assessment list rendering
- **Integration**: Resume assessment navigation flow
- **User Experience**: Loading states and error handling

## Implementation Estimate

- **Backend API**: 2-3 hours (DynamoDB query + Lambda function)
- **Frontend Dashboard**: 3-4 hours (component creation + integration)
- **Testing Coverage**: 2 hours (API + UI tests)
- **Total Effort**: **7-9 hours**

## Risk Assessment

- **Functional Risk**: HIGH - Core user experience broken
- **Technical Risk**: LOW - All infrastructure exists
- **Timeline Risk**: LOW - Straightforward implementation using existing patterns
- **Business Risk**: HIGH - Cannot demonstrate basic functionality in demos

## QA Impact

### Story 2.1 Status Recommendation
**Current**: DONE (with CONCERNS gate)
**Recommended**: NEEDS WORK - AC #2 not fully satisfied

### Acceptance Criteria Validation
**AC #2**: "ability to save and resume assessment"
- ✅ Save: Working
- ❌ Resume: Missing dashboard discovery mechanism

## Next Steps

1. **Dev Team**: Implement missing list-assessments API endpoint
2. **Dev Team**: Enhance dashboard with assessment list component
3. **QA Team**: Test complete save/resume user flow
4. **Product**: Validate user experience meets AC #2 requirements

## Related Files

**Backend**:
- `apps/api/src/functions/assessment/update-responses.ts` (save working)
- `apps/api/src/functions/assessment/get-assessment.ts` (load working)
- `apps/api/src/functions/assessment/list-assessments.ts` (**missing**)

**Frontend**:
- `apps/web/src/app/dashboard/page.tsx` (needs assessment list)
- `apps/web/src/hooks/useAssessment.ts` (needs listAssessments function)
- `apps/web/src/stores/assessment-store.ts` (working)

**Tests**:
- `apps/api/src/functions/assessment/__tests__/list-assessments.test.ts` (**missing**)
- `apps/web/src/app/dashboard/__tests__/page.test.tsx` (needs assessment list tests)