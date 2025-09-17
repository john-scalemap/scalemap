# Technical Debt: Questionnaire Functionality Issues

**Priority**: CRITICAL
**Story Affected**: 2.1 - 12-Domain Assessment Questionnaire System
**Date Identified**: 2025-09-16
**Identified By**: John (Product Manager)

## Issue Summary

Multiple **CRITICAL functionality issues** identified in the questionnaire system that block user progress:

1. **Dropdown Selection Failure**: Multiple-choice dropdown selections not populating/persisting
2. **Progress Blocking**: Users cannot advance to next questions due to validation issues
3. **Missing Questions API**: No backend endpoint to serve questions to the frontend
4. **Component Integration Issues**: Disconnect between question service and UI components

## Critical Issues Identified

### 🚨 Issue 1: Dropdown Selection Not Working
**Component**: `QuestionCard.tsx` (lines 111-126)
**Problem**: Select component using incorrect API pattern for value change handling

#### Current Broken Implementation:
```typescript
<Select
  value={value}
  onValueChange={handleValueChange}  // ❌ This prop doesn't exist on native <select>
  disabled={disabled}
  className="w-full"
>
```

#### Root Cause:
- `Select.tsx` is a native HTML select wrapper
- Native `<select>` uses `onChange`, not `onValueChange`
- Value change handler never triggers → responses never saved → progress blocked

### 🚨 Issue 2: Missing Questions API Endpoint
**Problem**: No backend API to serve questions to frontend

#### Missing Endpoint:
- **Expected**: `GET /api/assessment/questions`
- **Current**: Returns 404 - endpoint doesn't exist
- **Impact**: Question service falls back to limited hardcoded questions

#### Fallback Questions Analysis:
- **Strategic Alignment**: 7 real questions (good)
- **All Other Domains**: 1 generic scale question each (BROKEN)
- **Result**: Only 1 domain has proper questionnaire

### 🚨 Issue 3: Navigation Logic Issues
**Component**: `DomainSection.tsx` (lines 130-141)
**Problem**: Progress validation prevents advancement even with valid responses

#### Current Logic:
```typescript
const canNavigateNext = () => {
  const currentQuestion = visibleQuestions[currentQuestionIndex];
  if (currentQuestion.required) {
    const hasResponse = currentQuestion.id in responses;  // ❌ Never true due to Issue 1
    const hasValidationError = currentQuestion.id in validationErrors;
    return hasResponse && !hasValidationError;
  }
  return true;
};
```

### 🚨 Issue 4: Component Lifecycle Issues
**Problem**: Response handling and state management inconsistencies

#### Issues Found:
- Validation errors prevent responses from being saved (QuestionCard.tsx:94)
- Auto-save triggers but with empty/invalid data
- Progress calculation based on missing response data

## User Experience Impact

### Current Broken User Flow:
1. ✅ User starts assessment → loads questionnaire
2. ❌ **BROKEN**: User selects dropdown option → selection disappears
3. ❌ **BROKEN**: User tries to navigate → blocked by validation
4. ❌ **BROKEN**: Only domain with real questions is Strategic Alignment
5. ❌ **BROKEN**: 11 domains have only 1 generic question each

### Expected Working Flow:
1. User selects dropdown option → selection persists
2. User navigates between questions → progress saves
3. All 12 domains have proper question sets (15-25 questions each)
4. Progress tracking works correctly

## Technical Requirements

### 1. Fix Select Component Integration
**File**: `apps/web/src/components/assessment/questionnaire/QuestionCard.tsx`
**Changes**:
```typescript
// CURRENT (BROKEN):
<Select
  value={value}
  onValueChange={handleValueChange}  // ❌ Wrong prop
>

// REQUIRED FIX:
<Select
  value={value}
  onChange={(e) => handleValueChange(e.target.value)}  // ✅ Correct
>
```

### 2. Create Questions API Endpoint
**File**: `apps/api/src/functions/assessment/get-questions.ts` (NEW)
**Route**: `GET /api/assessment/questions`
**Function**: Return complete question database for all 12 domains

#### Expected Response Format:
```json
{
  "strategic-alignment": [
    {
      "id": "1.1",
      "type": "multiple-choice",
      "question": "How clearly can your leadership team...",
      "options": ["Crystal clear", "Mostly clear", ...],
      "required": true
    }
  ],
  "financial-management": [...],
  // ... all 12 domains
}
```

### 3. Fix Response Validation Logic
**File**: `apps/web/src/components/assessment/questionnaire/QuestionCard.tsx`
**Problem**: Lines 94-96 prevent valid responses from being saved
```typescript
// CURRENT (BLOCKS VALID RESPONSES):
if (!showValidation || !validationError) {
  onAnswer(question.id, newValue);  // Only saves if NO validation error
}

// REQUIRED FIX:
onAnswer(question.id, newValue);  // Always save, handle validation separately
if (onValidationError) {
  onValidationError(question.id, validationError);
}
```

### 4. Complete Question Database
**Priority**: HIGH - Need complete question sets for all 12 domains
**Current State**: Only Strategic Alignment has real questions
**Required**: 15-25 questions per domain (180+ total questions)

## Testing Requirements

### Immediate Tests Needed:
1. **Dropdown Functionality**: Select option → verify value persists
2. **Question Navigation**: Answer required question → verify "Next" button enables
3. **Auto-save Integration**: Make selection → verify auto-save triggers with correct data
4. **Domain Progress**: Complete domain → verify progress tracking
5. **API Integration**: Test questions endpoint returns full question database

### Test Scenarios:
- **Happy Path**: Complete full questionnaire workflow
- **Validation Errors**: Test required field validation
- **Navigation Logic**: Test conditional question logic
- **Industry Filtering**: Test regulated vs non-regulated question filtering

## Implementation Estimate

### Development Effort:
- **Fix Select Component**: 1-2 hours
- **Questions API Endpoint**: 2-3 hours
- **Response Validation Fix**: 1-2 hours
- **Complete Question Database**: 8-12 hours (content creation)
- **Integration Testing**: 3-4 hours
- **Total Effort**: **15-23 hours**

### Content Creation:
- **Question Content**: Requires domain expertise to create 180+ quality questions
- **Industry Variations**: Regulated vs non-regulated variations
- **Conditional Logic**: Dependencies between questions

## Risk Assessment

### Business Risk: CRITICAL
- **Core Feature Broken**: Assessment questionnaire is primary user interaction
- **Demo Blocking**: Cannot demonstrate product functionality
- **User Frustration**: Users cannot complete assessments

### Technical Risk: MEDIUM
- **Component Integration**: HTML select vs custom component mismatch
- **API Architecture**: Missing backend endpoints
- **Data Consistency**: Response handling and validation conflicts

## Immediate Action Required

### 🔴 BLOCKER: Cannot Demo Product
This issue **completely blocks** the core user experience:
- Users cannot complete assessments
- Only 1 of 12 domains functional
- Dropdown selections don't work
- Progress tracking broken

### Recommended Priority Order:
1. **Fix Select Component** (2 hours) → Unblock dropdown functionality
2. **Create Questions API** (3 hours) → Enable proper question loading
3. **Fix Response Validation** (2 hours) → Enable progress tracking
4. **Basic Question Database** (8 hours) → Enable all 12 domains

## Related Files

### Frontend (Broken):
- `apps/web/src/components/assessment/questionnaire/QuestionCard.tsx` (select component fix)
- `apps/web/src/components/assessment/questionnaire/DomainSection.tsx` (navigation logic)
- `apps/web/src/components/ui/Select.tsx` (component interface)

### Backend (Missing):
- `apps/api/src/functions/assessment/get-questions.ts` (MISSING - needs creation)

### Services (Working):
- `apps/web/src/services/question-service.ts` (has fallback logic, needs API)

### Tests (Need Updates):
- All questionnaire component tests need validation after fixes