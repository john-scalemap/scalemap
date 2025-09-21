#!/usr/bin/env node

/**
 * Comprehensive test runner for ScaleMap Frontend
 * Runs unit tests, integration tests, and generates coverage reports
 */

const { execSync } = require('child_process');
const path = require('path');

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = COLORS.reset) {
  console.log(`${color}${message}${COLORS.reset}`);
}

function runCommand(command, description) {
  log(`\n${COLORS.cyan}${COLORS.bright}Running: ${description}${COLORS.reset}`);
  log(`${COLORS.yellow}Command: ${command}${COLORS.reset}`);

  try {
    const output = execSync(command, {
      stdio: 'inherit',
      encoding: 'utf8',
      cwd: process.cwd()
    });
    log(`${COLORS.green}✅ ${description} completed successfully${COLORS.reset}`);
    return true;
  } catch (error) {
    log(`${COLORS.red}❌ ${description} failed${COLORS.reset}`);
    log(`${COLORS.red}Error: ${error.message}${COLORS.reset}`);
    return false;
  }
}

function main() {
  log(`${COLORS.magenta}${COLORS.bright}🧪 ScaleMap Frontend Test Suite${COLORS.reset}`);
  log(`${COLORS.cyan}Running comprehensive tests for authentication, assessment, and validation systems${COLORS.reset}\n`);

  const testSuites = [
    {
      name: 'Type Checking',
      command: 'npx tsc --noEmit',
      description: 'TypeScript type checking'
    },
    {
      name: 'Linting',
      command: 'npx eslint src --ext .ts,.tsx --max-warnings 0',
      description: 'ESLint code quality checks'
    },
    {
      name: 'Unit Tests - Validation',
      command: 'npx jest src/__tests__/validation --coverage --verbose',
      description: 'Unit tests for validation logic'
    },
    {
      name: 'Unit Tests - Stores',
      command: 'npx jest src/__tests__/stores --coverage --verbose',
      description: 'Unit tests for state management'
    },
    {
      name: 'Unit Tests - Hooks',
      command: 'npx jest src/__tests__/hooks --coverage --verbose',
      description: 'Unit tests for custom hooks'
    },
    {
      name: 'Integration Tests',
      command: 'npx jest src/__tests__/integration --coverage --verbose',
      description: 'Integration tests for component interactions'
    },
    {
      name: 'Full Test Suite',
      command: 'npx jest --coverage --passWithNoTests',
      description: 'Complete test suite with coverage report'
    }
  ];

  const results = [];
  let allPassed = true;

  for (const suite of testSuites) {
    const passed = runCommand(suite.command, suite.description);
    results.push({ name: suite.name, passed });
    if (!passed) {
      allPassed = false;
    }
  }

  // Summary
  log(`\n${COLORS.bright}${COLORS.magenta}📊 Test Results Summary${COLORS.reset}`);
  log('='.repeat(50));

  results.forEach(({ name, passed }) => {
    const status = passed ? `${COLORS.green}✅ PASSED` : `${COLORS.red}❌ FAILED`;
    log(`${status} ${name}${COLORS.reset}`);
  });

  log('='.repeat(50));

  if (allPassed) {
    log(`${COLORS.green}${COLORS.bright}🎉 All tests passed! Frontend is ready for QA.${COLORS.reset}`);
    process.exit(0);
  } else {
    log(`${COLORS.red}${COLORS.bright}💥 Some tests failed. Please review and fix issues.${COLORS.reset}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { runCommand, log, COLORS };