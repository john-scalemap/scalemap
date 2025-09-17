# Story 2.3: Critical Remediation Requirements

**Story**: Intelligent Domain Triage Algorithm
**Current Gate Status**: **FAIL**
**Review Date**: 2025-09-16
**Reviewer**: Quinn (Test Architect)

## 🚨 DEPLOYMENT BLOCKED - CRITICAL ISSUES

**DO NOT DEPLOY** until all issues below are resolved and verified.

## Mandatory Fix Requirements

### 1. BUILD SYSTEM FAILURE ⚠️ CRITICAL
**Issue**: TypeScript compilation errors preventing builds
**Location**: `apps/api/src/functions/assessment/get-questions.ts:781`
**Action Required**:
- Fix syntax errors at line 781
- Run `npx tsc --noEmit` to identify all compilation errors
- **Verification**: `npm run build` must complete without errors

### 2. TEST FAILURES ⚠️ CRITICAL
**Issue**: 12/70 tests failing in core triage validation logic
**Primary Failures**:
- Quality score calculation producing 25+ instead of 0-1 range
- Fallback domain selection not maintaining 3-5 domain constraint
- Industry validation not enforcing required domains

**Action Required**:
```bash
npm test -- --testPathPattern=triage-validator.test.ts
npm test -- --testPathPattern=triage-analyzer.test.ts
npm test -- --testPathPattern=industry-rules.test.ts
```

**Specific Fixes Needed**:
- Fix quality scoring algorithm in `apps/api/src/functions/triage/triage-validator.ts:213-238`
- Ensure fallback logic maintains minimum 3 domains, maximum 5 domains
- Validate industry-specific domain requirements are enforced

**Verification**: All tests must pass (70/70)

### 3. CODE QUALITY VIOLATIONS ⚠️ CRITICAL
**Issue**: 50 ESLint errors, 214 warnings
**Primary Issues**:
- Unused imports: `ProcessingMetrics`, `IndustryRulesEngine` in `triage-service.ts:14,17`
- Type safety violations across multiple files

**Action Required**:
```bash
npx eslint --fix apps/api/src/services/triage-service.ts
npx eslint apps/api/src/functions/triage/ --fix
```

**Verification**: `npm run lint` must show 0 errors

## Detailed Fix Specifications

### Quality Score Algorithm Fix
**File**: `apps/api/src/functions/triage/triage-validator.ts`
**Lines**: 213-238
**Expected Behavior**:
- Quality scores must be in range 0.0 to 1.0
- Algorithm should normalize domain scores to this range
- Invalid scores (25+) indicate multiplication error or missing normalization

### Fallback Logic Requirements
**File**: `apps/api/src/functions/triage/triage-validator.ts`
**Requirements**:
- When confidence < threshold, fallback must select exactly 3-5 domains
- Default selection should prioritize: Strategy, People, Operations, Revenue
- Must maintain industry-specific requirements even in fallback

### Build Error Resolution
**File**: `apps/api/src/functions/assessment/get-questions.ts`
**Line**: 781
**Action**: Review syntax error (likely missing semicolon, bracket, or type annotation)

## Verification Checklist

Before marking story as complete, ALL of the following must pass:

- [ ] **Build Clean**: `npm run build` completes without errors
- [ ] **Tests Pass**: `npm test` shows 70/70 tests passing
- [ ] **Lint Clean**: `npm run lint` shows 0 errors (warnings acceptable)
- [ ] **Type Check**: `npm run type-check` passes without errors

## Expected Timeline

**Estimated Effort**: 1-2 days
**Priority**: P0 - Blocking all other work

## Quality Gate Requirements

After fixes are complete:
1. Run full test suite and verify all 70 tests pass
2. Validate triage algorithm with sample data produces scores in 0-1 range
3. Confirm build system produces deployable artifacts
4. Update gate status to PASS only after verification

## Dev Support

If you encounter issues during remediation:
1. Check debug logs for specific error details
2. Run tests in verbose mode: `npm test -- --verbose`
3. Use TypeScript compiler directly: `npx tsc --noEmit --pretty`

**This story cannot proceed to DONE until all verification checkboxes are completed.**