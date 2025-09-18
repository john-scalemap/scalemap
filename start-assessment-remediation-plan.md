# Start Assessment Authentication Error - Remediation Plan

## Problem Summary

The "Start Assessment" button gives authentication errors instead of taking
logged-in users to the assessment form. Root cause identified as authentication
context mismatch between two parallel auth systems.

## Root Cause Analysis

- **Dashboard** uses: `useAuth` from `@/stores/auth` (Zustand store)
- **Assessment Hook** uses: `useAuth` from `@/lib/auth/auth-context` (React
  Context)
- Missing AuthProvider wrapper in app layout
- Inconsistent user/company data structures between systems

## Remediation Phases

### Phase 1: Immediate Fix (HIGH PRIORITY) ⏳

**Goal**: Get "Start Assessment" button working immediately **Estimated Time**:
30-45 minutes

- [x] **1.1** Update Dashboard to use React Context auth
      (`@/lib/auth/auth-context`)
- [x] **1.2** Remove Zustand auth dependency from Dashboard
- [x] **1.3** Add AuthProvider wrapper to app layout (already configured)
- [x] **1.4** Fix useAssessment hook auth import (already correct)
- [x] **1.5** Test basic authentication flow

**Files to Modify**:

- `apps/web/src/app/dashboard/page.tsx`
- `apps/web/src/app/layout.tsx` (or appropriate layout file)
- `apps/web/src/hooks/useAssessment.ts`

### Phase 2: Data Structure Alignment (MEDIUM PRIORITY)

**Goal**: Ensure consistent data structures across auth systems **Estimated
Time**: 20-30 minutes

- [ ] **2.1** Align user data structure (user.company vs separate company)
- [ ] **2.2** Update Context auth to provide compatible data format
- [ ] **2.3** Fix company data access patterns
- [ ] **2.4** Ensure TokenManager integration works consistently

**Files to Modify**:

- `apps/web/src/lib/auth/auth-context.tsx`
- `apps/web/src/app/dashboard/page.tsx` (if needed)

### Phase 3: Testing & Validation (MEDIUM PRIORITY)

**Goal**: Comprehensive testing of authentication flows **Estimated Time**:
20-30 minutes

- [ ] **3.1** Test login → dashboard → Start Assessment flow
- [ ] **3.2** Test token refresh scenarios
- [ ] **3.3** Validate error handling and user feedback
- [ ] **3.4** Test assessment creation end-to-end
- [ ] **3.5** Manual testing on different browser states

### Phase 4: Code Quality & Cleanup (LOW PRIORITY)

**Goal**: Clean up and consolidate authentication code **Estimated Time**: 15-20
minutes

- [ ] **4.1** Remove unused Zustand auth store (if applicable)
- [ ] **4.2** Consolidate authentication utilities
- [ ] **4.3** Update TypeScript types for consistency
- [ ] **4.4** Add JSDoc documentation for auth functions
- [ ] **4.5** Run linting and type checking

## Implementation Notes

### Key Technical Decisions

1. **Standardizing on React Context**: More suitable for app-wide auth state
2. **Maintaining TokenManager**: Centralized token management is good practice
3. **Backward Compatibility**: Ensure existing auth flows continue to work

### Testing Strategy

- Test both new user registration and existing user login
- Verify assessment creation with proper authentication
- Test edge cases (expired tokens, network errors)

### Risk Mitigation

- Make changes incrementally
- Test each phase before proceeding
- Keep backup of original auth implementation approach

## Progress Tracking

**Started**: [TIMESTAMP_TO_BE_FILLED] **Phase 1 Started**: 2025-09-18 14:05:00
**Phase 1 Completed**: 2025-09-18 14:06:30 **Phase 2 Started**: [PENDING]
**Phase 2 Completed**: [PENDING] **Phase 3 Started**: [PENDING] **Phase 3
Completed**: [PENDING] **Phase 4 Started**: [PENDING] **Phase 4 Completed**:
[PENDING] **Final Validation**: [PENDING]

## Success Criteria

- [ ] "Start Assessment" button navigates to assessment form without
      authentication errors
- [ ] User can create assessments successfully
- [ ] Dashboard shows proper user information
- [ ] All authentication flows work as expected
- [ ] No regression in existing functionality
- [ ] Code passes linting and type checking
- [ ] All tests pass

---

**Developer**: James (Claude Code Developer) **Created**: 2025-09-18
**Priority**: HIGH - User-blocking authentication issue
