# PROMPT: Fix Unit Tests for Canton DeFi Services

## Context
You are working on Phase 1: Week 4 - Testing & Integration of the Canton DeFi project. Unit tests have been written for 5 services, but there are issues that need to be resolved.

## Current Status

### Test Results Summary
```
Test Files: 4 failed | 0 passed (5)
Tests: 11 failed | 147 passed (195)
Duration: 3.95s
```

### Test Files Status

1. **treasuryBillsService.test.ts** - (0 test)
   - Problem: Tests are not being detected or run
   - File exists but shows 0 tests

2. **complianceService.test.ts** - 48 tests | 5 failed
   - Failed tests:
     - `should return audit log for transaction ID` (172ms)
     - `should handle underage user correctly` (6ms)
     - `should handle high-risk jurisdiction correctly` (2ms)
     - `should handle rejected documents correctly` (1ms)
     - `should emit kyc_completed event` (1ms)

3. **authService.test.ts** - 43 tests | 5 failed
   - Failed tests:
     - `should register successfully` (111ms)
     - `should emit user_registered event` (2ms)
     - `should request password reset successfully` (1ms)
     - `should return error on failed request` (3ms)
     - `should emit password_reset_requested event` (1ms)

4. **oracleService.test.ts** - 66 tests | 1 failed
   - Failed test:
     - `should handle provider errors gracefully` (15ms)

5. **damlIntegrationService.test.ts** - 1/38
   - Problem: Tests appear to be incomplete or not running properly

## Task Instructions

### Step 1: Investigate and Fix treasuryBillsService.test.ts
1. Read the test file at `src/lib/canton/services/__tests__/treasuryBillsService.test.ts`
2. Check if tests are properly structured and exported
3. Verify that the test file follows the same pattern as other test files
4. Fix any issues preventing tests from being detected
5. Ensure all tests run successfully

### Step 2: Fix ComplianceService Test Failures
1. Read the failing test file: `src/lib/canton/services/__tests__/complianceService.test.ts`
2. Read the source service file: `src/lib/canton/services/complianceService.ts`
3. For each failing test:
   - Analyze why it's failing
   - Check if the test expectations match the actual service behavior
   - Fix the test implementation OR fix the service implementation if needed
   - Ensure proper mocking of dependencies
4. Verify all 48 tests pass

### Step 3: Fix AuthService Test Failures
1. Read the failing test file: `src/lib/canton/services/__tests__/authService.test.ts`
2. Read the source service file: `src/lib/canton/services/authService.ts`
3. For each failing test:
   - Analyze why it's failing
   - Check Supabase client mocks
   - Verify event emission logic
   - Fix test expectations or service implementation
4. Ensure all 43 tests pass

### Step 4: Fix OracleService Test Failure
1. Read the failing test file: `src/lib/canton/services/__tests__/oracleService.test.ts`
2. Read the source service file: `src/lib/canton/services/oracleService.ts`
3. Fix the "should handle provider errors gracefully" test
4. Ensure proper error handling and mocking
5. Verify all 66 tests pass

### Step 5: Fix DamlIntegrationService Tests
1. Read the test file: `src/lib/canton/services/__tests__/damlIntegrationService.test.ts`
2. Read the source service file: `src/lib/canton/services/damlIntegrationService.ts`
3. Ensure all 38 tests are properly defined and run
4. Fix any issues preventing tests from completing
5. Verify all tests pass

### Step 6: Verify Code Coverage
1. Run `pnpm test:run --coverage`
2. Check coverage report for each service
3. Ensure minimum 85% code coverage for each service
4. If coverage is below 85%, add additional tests to cover uncovered code paths
5. Document coverage percentages for each service

### Step 7: Final Verification
1. Run all tests: `pnpm test:run`
2. Ensure all 195 tests pass (0 failures)
3. Run coverage: `pnpm test:run --coverage`
4. Verify coverage meets 85% threshold for all services
5. Document final results

## Requirements

### Technical Requirements
- Use Vitest for testing
- Use vi.mock() for external dependencies
- Ensure all tests pass (0 failures)
- Achieve minimum 85% code coverage for each service
- Test all public methods
- Test edge cases and error scenarios
- Test event emissions

### Test Structure
Each test file should follow this structure:
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ServiceName } from '../serviceName';

describe('ServiceName', () => {
  beforeEach(() => {
    // Setup mocks
  });

  afterEach(() => {
    // Cleanup mocks
  });

  describe('methodName', () => {
    it('should return expected result on success', async () => {
      // Test implementation
    });

    it('should handle errors correctly', async () => {
      // Test implementation
    });
  });
});
```

## Deliverables

After completing all fixes, provide a completion report with:

1. **Test Files Created/Fixed**
   - List all test files
   - Number of tests in each file
   - Status (all passing)

2. **Code Coverage**
   - Coverage percentage for each service
   - Total coverage percentage
   - Confirmation that all services meet 85% threshold

3. **Test Statistics**
   - Total number of tests written
   - Number of tests passing
   - Number of tests failing (should be 0)

4. **Issues Fixed**
   - List of issues encountered
   - How each issue was resolved
   - Any changes made to service implementations

5. **Final Verification**
   - Command used to run tests
   - Command used to check coverage
   - Final test output
   - Final coverage report

## Important Notes

- **DO NOT** proceed to other tasks (F4.2, F4.3, etc.) until this task is complete
- Focus ONLY on fixing the unit tests
- After completion, use `attempt_completion` to provide the final report
- Be thorough and systematic in your approach
- Test each fix individually before moving to the next
- Document all changes made

## Configuration Files

- Vitest config: `vitest.config.ts`
- Test setup: `src/lib/canton/services/__tests__/setup.ts`
- Package scripts: `test`, `test:ui`, `test:run`, `test:coverage`

## Services to Test

1. **DamlIntegrationService** - `src/lib/canton/services/damlIntegrationService.ts`
2. **ComplianceService** - `src/lib/canton/services/complianceService.ts`
3. **OracleService** - `src/lib/canton/services/oracleService.ts`
4. **TreasuryBillsService** - `src/lib/canton/services/treasuryBillsService.ts`
5. **AuthService** - `src/lib/canton/services/authService.ts`

## Success Criteria

✅ All 195 tests pass (0 failures)
✅ All 5 test files run successfully
✅ Code coverage ≥ 85% for each service
✅ All public methods tested
✅ All edge cases covered
✅ All error scenarios tested
✅ Event emissions verified
✅ Completion report provided

---

**Start by reading the test files and source files to understand the current state, then systematically fix each issue.**
