// Fusion Studio Docs Consistency Checker
// Generated from: .desloppify/templates/scripts/docs-check.js.template
// Run: node scripts/docs-check.js

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

// ============================================================================
// UNIVERSAL VALIDATORS (from desloppify submodule)
// ============================================================================

// Core validators - always imported
import { validateFunctionCalls } from '../.desloppify/scripts/core/function-call-validator.mjs';

// Bug pattern detectors - always imported
import { 
  checkNullAccess, 
  generateReport as generateNullReport,
  detectFrameworksNeedingPrompt,
  detectExpressUsage,
  getAffectedFiles 
} from '../.desloppify/scripts/bug-patterns/bug-pattern-null-access.mjs';
import { checkDataShapes, generateReport as generateDataShapeReport } from '../.desloppify/scripts/bug-patterns/bug-pattern-data-shape.mjs';
import checkSecurityRisks from '../.desloppify/scripts/bug-patterns/bug-pattern-security.mjs';
import { checkMemoryLeaks } from '../.desloppify/scripts/bug-patterns/bug-pattern-memory-leaks.mjs';

// Contract enforcers - always imported
import { checkReturnTypes, generateReturnTypesReport } from '../.desloppify/scripts/contracts/enforce-return-types.mjs';
import { checkErrorContracts, generateErrorContractsReport } from '../.desloppify/scripts/contracts/enforce-error-contracts.mjs';
import { checkNullability, generateNullabilityReport } from '../.desloppify/scripts/contracts/enforce-nullability.mjs';
import { checkAsyncBoundaries, generateAsyncBoundariesReport } from '../.desloppify/scripts/contracts/enforce-async-boundaries.mjs';
import { checkDependencies, generateDependenciesReport } from '../.desloppify/scripts/contracts/enforce-dependencies.mjs';
import { checkStateMutations, generateStateMutationsReport } from '../.desloppify/scripts/contracts/enforce-state-mutations.mjs';
import { checkSideEffects, generateSideEffectsReport } from '../.desloppify/scripts/contracts/enforce-side-effects.mjs';

// Whitelist manager
import whitelistManager from '../.desloppify/scripts/whitelist-manager.mjs';

// ============================================================================
// PROJECT-SPECIFIC GENERATORS (from desloppify-local)
// ============================================================================
// These auto-generate cursor rules based on your codebase

// No generators needed for vanilla project

// ============================================================================
// PROJECT-SPECIFIC VALIDATORS (from desloppify-local)
// ============================================================================

// No custom validators yet

// ============================================================================
// CONFIGURATION
// ============================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.join(__dirname, '..');

// Load project-specific config
async function loadConfig() {
  const cfgPath = path.join(repoRoot, 'desloppify-local', 'scripts', 'docs-check.config.json');
  try {
    const raw = await fs.readFile(cfgPath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    // Return defaults if config doesn't exist
    return {
      htmlFiles: ['index.html'],
      jsFiles: ['app.js'],
      cssFiles: ['style.css']
    };
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function ok(msg) {
  console.log(`✔️  ${msg}`);
}

function warn(msg) {
  console.warn(`⚠️  ${msg}`);
}

function fail(msg) {
  console.error(`❌ ${msg}`);
}

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

// Helper to run CLI-based validators
function runCLIValidator(scriptPath) {
  return new Promise((resolve) => {
    const proc = spawn('node', [scriptPath], {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        DESLOPPIFY_ORCHESTRATED: 'true'  // Tell validators they're being orchestrated
      }
    });
    
    let stdout = '';
    let stderr = '';
    
    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    proc.on('close', (code) => {
      resolve({
        passed: code === 0,
        stdout,
        stderr,
        exitCode: code
      });
    });
  });
}

// ============================================================================
// PRE-FLIGHT CHECK: Detect Interactive Code
// ============================================================================
// CRITICAL: Validators must run non-interactively for CI/CD compatibility
// Interactive prompts (readline, stdin) will hang automated environments

async function checkForInteractiveCode() {
  const results = { passed: true, messages: [], violations: [] };
  
  // Patterns that indicate interactive code
  const bannedPatterns = [
    {
      pattern: /readline\.createInterface/g,
      name: 'readline.createInterface',
      severity: 'CRITICAL'
    },
    {
      pattern: /process\.stdin\./g,
      name: 'process.stdin access',
      severity: 'CRITICAL'
    },
    {
      pattern: /prompt\(['"]/g,
      name: 'prompt() call',
      severity: 'CRITICAL'
    },
    {
      pattern: /confirm\(['"]/g,
      name: 'confirm() call',
      severity: 'HIGH'
    }
  ];
  
  // Scan all validator files
  const validatorFiles = [
    path.join(repoRoot, 'scripts', 'docs-check.js'),
    path.join(repoRoot, '.desloppify', 'scripts', 'core', 'function-call-validator.mjs'),
  ];
  
  for (const file of validatorFiles) {
    if (!await exists(file)) {
      continue;
    }
    
    const content = await fs.readFile(file, 'utf8');
    
    for (const { pattern, name, severity } of bannedPatterns) {
      const matches = content.matchAll(pattern);
      const matchArray = [...matches];
      
      if (matchArray.length > 0) {
        const lines = content.split('\n');
        const violations = [];
        
        for (const match of matchArray) {
          const beforeMatch = content.substring(0, match.index);
          const lineNum = beforeMatch.split('\n').length;
          const lineContent = lines[lineNum - 1].trim();
          
          // Skip if in a comment, meta-code, or documentation
          if (
            lineContent.startsWith('//') ||
            lineContent.startsWith('*') ||
            lineContent.startsWith('/*') ||
            lineContent.includes('pattern:') ||
            lineContent.includes('name:') ||
            lineContent.includes('DON\'T:') ||
            lineContent.includes('NEVER DO THIS')
          ) {
            continue;
          }
          
          violations.push({ line: lineNum, content: lineContent });
        }
        
        if (violations.length > 0) {
          results.passed = false;
          results.violations.push({
            file,
            pattern: name,
            severity,
            count: violations.length,
            locations: violations
          });
        }
      }
    }
  }
  
  if (!results.passed) {
    results.messages.push('');
    results.messages.push('━'.repeat(80));
    results.messages.push('🚨 INTERACTIVE CODE DETECTED - VALIDATION ABORTED');
    results.messages.push('━'.repeat(80));
    results.messages.push('');
    results.messages.push('Validators must run non-interactively for CI/CD compatibility.');
    results.messages.push('');
    
    for (const violation of results.violations) {
      results.messages.push(`❌ ${violation.file}`);
      results.messages.push(`   Pattern: ${violation.pattern} (${violation.severity})`);
      results.messages.push(`   Found ${violation.count} violation(s):`);
      
      for (const loc of violation.locations.slice(0, 3)) {
        results.messages.push(`   - Line ${loc.line}: ${loc.content}`);
      }
      
      if (violation.locations.length > 3) {
        results.messages.push(`   ... and ${violation.locations.length - 3} more`);
      }
      
      results.messages.push('');
    }
    
    results.messages.push('Fix: Remove interactive code. Use auto-flagging with JSON whitelist pattern.');
    results.messages.push('');
    results.messages.push('━'.repeat(80));
  }
  
  return results;
}

// ============================================================================
// UNIVERSAL VALIDATORS (Wrappers)
// ============================================================================
// These wrap desloppify validators for consistent reporting

async function checkFunctionCalls(config) {
  const results = { passed: true, messages: [] };
  
  try {
    const jsFiles = config.jsFiles || ['app.js'];
    const htmlFile = path.join(repoRoot, config.htmlFiles?.[0] || 'index.html');
    const issues = await validateFunctionCalls({
      projectRoot: repoRoot,
      htmlFile: await exists(htmlFile) ? htmlFile : null,
      quiet: true
    });
    
    if (issues.length > 0) {
      results.passed = false;
      results.messages = issues;
    } else {
      results.details = `checked ${jsFiles.length} JS file(s), 0 issues`;
    }
  } catch (err) {
    results.passed = false;
    results.messages.push(`Function call validation error: ${err.message}`);
  }
  
  return results;
}

async function checkNullUndefinedAccess(config) {
  const results = { passed: true, messages: [] };
  
  try {
    const jsFiles = (config.jsFiles || ['app.js']).map(f => path.join(repoRoot, f));
    
    const issues = await checkNullAccess(jsFiles, {
      frameworkDetection: null, // Auto-flag frameworks instead of prompting
      quiet: true
    });
    
    if (issues.length > 0) {
      results.passed = false;
      const report = generateNullReport(issues);
      results.messages.push(report);
    } else {
      results.details = `checked ${config.jsFiles?.length || 1} file(s), 0 null access issues`;
    }
  } catch (err) {
    results.passed = false;
    results.messages.push(`Null access check error: ${err.message}`);
  }
  
  return results;
}

async function checkDataShapeValidation(config) {
  const results = { passed: true, messages: [] };
  
  try {
    const jsFiles = (config.jsFiles || ['app.js']).map(f => path.join(repoRoot, f));
    
    const issues = await checkDataShapes(jsFiles, { quiet: true });
    
    if (issues.length > 0) {
      results.passed = false;
      const report = generateDataShapeReport(issues);
      results.messages.push(report);
    } else {
      results.details = `checked ${config.jsFiles?.length || 1} file(s), 0 data shape issues`;
    }
  } catch (err) {
    results.passed = false;
    results.messages.push(`Data shape check error: ${err.message}`);
  }
  
  return results;
}

async function checkSecurityValidation(config) {
  const results = { passed: true, messages: [] };
  
  try {
    const jsFiles = (config.jsFiles || ['app.js']).map(f => path.join(repoRoot, f));
    
    const issues = await checkSecurityRisks(jsFiles, { quiet: true });
    
    if (issues.length > 0) {
      results.passed = false;
      results.messages = issues;
    } else {
      results.details = `checked ${config.jsFiles?.length || 1} file(s), 0 security risks`;
    }
  } catch (err) {
    results.passed = false;
    results.messages.push(`Security check error: ${err.message}`);
  }
  
  return results;
}

async function checkMemoryLeakRisks(config) {
  const results = { passed: true, messages: [] };
  
  try {
    const jsFiles = (config.jsFiles || ['app.js']).map(f => path.join(repoRoot, f));
    
    const issues = await checkMemoryLeaks(jsFiles, { quiet: true });
    
    if (issues.length > 0) {
      results.passed = false;
      results.messages = issues;
    } else {
      results.details = `checked ${config.jsFiles?.length || 1} file(s), 0 memory leak risks`;
    }
  } catch (err) {
    results.passed = false;
    results.messages.push(`Memory leak check error: ${err.message}`);
  }
  
  return results;
}

// CLI-based validators
async function checkAsyncWithoutAwait() {
  const results = { passed: true, messages: [] };
  
  try {
    const scriptPath = path.join(repoRoot, '.desloppify', 'scripts', 'core', 'check-async-without-await.mjs');
    const result = await runCLIValidator(scriptPath);
    
    if (!result.passed) {
      results.passed = false;
      // Combine stdout and stderr for full output
      const output = (result.stderr + result.stdout).trim();
      if (output) {
        results.messages.push(output);
      }
    } else {
      results.details = `checked JS files, 0 async functions without await`;
    }
  } catch (err) {
    results.passed = false;
    results.messages.push(`Async without await check error: ${err.message}`);
  }
  
  return results;
}

async function checkDuplicateIds() {
  const results = { passed: true, messages: [] };
  
  try {
    const scriptPath = path.join(repoRoot, '.desloppify', 'scripts', 'core', 'lint-duplicate-ids.mjs');
    const result = await runCLIValidator(scriptPath);
    
    if (!result.passed) {
      results.passed = false;
      const output = (result.stderr + result.stdout).trim();
      if (output) {
        results.messages.push(output);
      }
    } else {
      results.details = `checked HTML files, 0 duplicate IDs`;
    }
  } catch (err) {
    results.passed = false;
    results.messages.push(`Duplicate IDs check error: ${err.message}`);
  }
  
  return results;
}

async function checkInlineStyles() {
  const results = { passed: true, messages: [] };
  
  try {
    const scriptPath = path.join(repoRoot, '.desloppify', 'scripts', 'core', 'lint-styles.cjs');
    const result = await runCLIValidator(scriptPath);
    
    if (!result.passed) {
      results.passed = false;
      const output = (result.stderr + result.stdout).trim();
      if (output) {
        results.messages.push(output);
      }
    } else {
      results.details = `checked HTML files, 0 inline styles`;
    }
  } catch (err) {
    results.passed = false;
    results.messages.push(`Inline styles check error: ${err.message}`);
  }
  
  return results;
}

async function checkHardcodedColors() {
  const results = { passed: true, messages: [] };
  
  try {
    // Check if css/ directory exists (validator requires this structure)
    const cssDir = path.join(repoRoot, 'css');
    const hasCssDir = await exists(cssDir);
    
    if (!hasCssDir) {
      // Skip for vanilla projects without css/ folder
      results.passed = true;
      results.skipped = true;
      results.reason = 'no css/ directory found, validator expects css/ structure';
      return results;
    }
    
    const scriptPath = path.join(repoRoot, '.desloppify', 'scripts', 'core', 'validate-hardcoded-colors.mjs');
    const result = await runCLIValidator(scriptPath);
    
    if (!result.passed) {
      results.passed = false;
      const output = (result.stderr + result.stdout).trim();
      if (output) {
        results.messages.push(output);
      }
    }
  } catch (err) {
    results.passed = false;
    results.messages.push(`Hardcoded colors check error: ${err.message}`);
  }
  
  return results;
}

// Contract enforcers
async function checkReturnTypeAnnotations(config) {
  const results = { passed: true, messages: [] };
  
  try {
    const jsFiles = config.jsFiles || ['app.js'];
    
    const result = await checkReturnTypes(jsFiles);
    
    if (result.issues && result.issues.length > 0) {
      results.passed = false;
      const report = generateReturnTypesReport(result.issues);
      results.messages.push(report);
    } else {
      results.details = `checked ${jsFiles.length} file(s), ${result.stats?.total || 0} functions scanned, 0 missing`;
    }
  } catch (err) {
    results.passed = false;
    results.messages.push(`Return type check error: ${err.message}`);
  }
  
  return results;
}

async function checkErrorContractAnnotations(config) {
  const results = { passed: true, messages: [] };
  
  try {
    const jsFiles = config.jsFiles || ['app.js'];
    
    const result = await checkErrorContracts(jsFiles);
    
    if (result.issues && result.issues.length > 0) {
      results.passed = false;
      const report = generateErrorContractsReport(result.issues);
      results.messages.push(report);
    } else {
      results.details = `checked ${jsFiles.length} file(s), 0 missing @throws`;
    }
  } catch (err) {
    results.passed = false;
    results.messages.push(`Error contract check error: ${err.message}`);
  }
  
  return results;
}

async function checkNullabilityAnnotations(config) {
  const results = { passed: true, messages: [] };
  
  try {
    const jsFiles = config.jsFiles || ['app.js'];
    
    const result = await checkNullability(jsFiles);
    
    if (result.issues && result.issues.length > 0) {
      results.passed = false;
      const report = generateNullabilityReport(result.issues);
      results.messages.push(report);
    } else {
      results.details = `checked ${jsFiles.length} file(s), 0 missing nullability markers`;
    }
  } catch (err) {
    results.passed = false;
    results.messages.push(`Nullability check error: ${err.message}`);
  }
  
  return results;
}

async function checkAsyncBoundaryAnnotations(config) {
  const results = { passed: true, messages: [] };
  
  try {
    const jsFiles = config.jsFiles || ['app.js'];
    
    const result = await checkAsyncBoundaries(jsFiles);
    
    if (result.issues && result.issues.length > 0) {
      results.passed = false;
      const report = generateAsyncBoundariesReport(result.issues);
      results.messages.push(report);
    } else {
      results.details = `checked ${jsFiles.length} file(s), 0 missing @async-boundary`;
    }
  } catch (err) {
    results.passed = false;
    results.messages.push(`Async boundary check error: ${err.message}`);
  }
  
  return results;
}

async function checkDependencyAnnotations(config) {
  const results = { passed: true, messages: [] };
  
  try {
    const jsFiles = config.jsFiles || ['app.js'];
    
    const result = await checkDependencies(jsFiles);
    
    if (result.issues && result.issues.length > 0) {
      results.passed = false;
      const report = generateDependenciesReport(result.issues);
      results.messages.push(report);
    } else {
      results.details = `checked ${jsFiles.length} file(s), 0 missing dependencies`;
    }
  } catch (err) {
    results.passed = false;
    results.messages.push(`Dependency check error: ${err.message}`);
  }
  
  return results;
}

async function checkStateMutationAnnotations(config) {
  const results = { passed: true, messages: [] };
  
  try {
    const jsFiles = config.jsFiles || ['app.js'];
    
    const result = await checkStateMutations(jsFiles);
    
    if (result.issues && result.issues.length > 0) {
      results.passed = false;
      const report = generateStateMutationsReport(result.issues);
      results.messages.push(report);
    } else {
      results.details = `checked ${jsFiles.length} file(s), 0 missing @mutates-state`;
    }
  } catch (err) {
    results.passed = false;
    results.messages.push(`State mutation check error: ${err.message}`);
  }
  
  return results;
}

async function checkSideEffectsAnnotations(config) {
  const results = { passed: true, messages: [] };
  
  try {
    const jsFiles = config.jsFiles || ['app.js'];
    
    const result = await checkSideEffects(jsFiles);
    
    if (result.issues && result.issues.length > 0) {
      results.passed = false;
      const report = generateSideEffectsReport(result.issues);
      results.messages.push(report);
    } else {
      results.details = `checked ${jsFiles.length} file(s), 0 missing @side-effects`;
    }
  } catch (err) {
    results.passed = false;
    results.messages.push(`Side effects check error: ${err.message}`);
  }
  
  return results;
}

// ============================================================================
// PROJECT-SPECIFIC VALIDATORS (Placeholders)
// ============================================================================
// Add your custom validators here

// ============================================================================
// MAIN ORCHESTRATOR
// ============================================================================

async function main() {
  console.log('🔎 Fusion Studio Docs Check\n');
  
  // Load project config
  const config = await loadConfig();
  
  // PRE-FLIGHT: Check for interactive code BEFORE running any validators
  const preFlight = await checkForInteractiveCode();
  if (!preFlight.passed) {
    preFlight.messages.forEach(msg => console.log(msg));
    process.exit(1);
  }
  
  console.log('✅ Pre-flight: No interactive code detected\n');
  
  // Define validation pipeline
  const checks = [
    // Core validators (CLI-based)
    ['Async without await', checkAsyncWithoutAwait],
    ['Duplicate HTML IDs', checkDuplicateIds],
    ['Inline styles', checkInlineStyles],
    ['Hardcoded colors', checkHardcodedColors],
    
    // Universal validators (library-based)
    ['Function calls validation', () => checkFunctionCalls(config)],
    ['Null/undefined access', () => checkNullUndefinedAccess(config)],
    ['Data shape validation', () => checkDataShapeValidation(config)],
    ['Security risks', () => checkSecurityValidation(config)],
    ['Memory leak risks', () => checkMemoryLeakRisks(config)],
    
    // Contract enforcers
    ['Return type annotations', () => checkReturnTypeAnnotations(config)],
    ['Error contract annotations', () => checkErrorContractAnnotations(config)],
    ['Nullability annotations', () => checkNullabilityAnnotations(config)],
    ['Async boundary annotations', () => checkAsyncBoundaryAnnotations(config)],
    ['Side effects annotations', () => checkSideEffectsAnnotations(config)],
    ['State mutation annotations', () => checkStateMutationAnnotations(config)],
    ['Dependency annotations', () => checkDependencyAnnotations(config)],
  ];
  
  let allPassed = true;
  const completionTracker = [];
  
  // Run all checks with tracking
  for (const [name, fn] of checks) {
    const startTime = Date.now();
    let status = 'COMPLETED';
    let duration = 0;
    
    try {
      const res = await fn();
      duration = Date.now() - startTime;
      
      if (!res.passed) {
        allPassed = false;
        status = 'FAILED';
        fail(name + ' check failed');
        res.messages.forEach((msg) => warn(msg));
      } else {
        status = 'PASSED';
        // Show what was actually checked
        if (res.skipped) {
          ok(name + ' (SKIPPED - ' + (res.reason || 'not applicable') + ')');
        } else if (res.details) {
          ok(name + ' (' + res.details + ')');
        } else {
          ok(name);
        }
      }
    } catch (err) {
      duration = Date.now() - startTime;
      allPassed = false;
      status = 'CRASHED';
      fail(name + ' check crashed: ' + err.message);
      console.error(err);
    }
    
    completionTracker.push({ name, status, duration });
    console.log('');
  }
  
  // Print completion summary
  console.log('━'.repeat(80));
  console.log('📊 VALIDATION COMPLETION REPORT\n');
  
  const statusCounts = { PASSED: 0, FAILED: 0, CRASHED: 0 };
  const maxNameLength = Math.max(...completionTracker.map(c => c.name.length));
  
  for (const check of completionTracker) {
    const statusIcon = check.status === 'PASSED' ? '✅' : check.status === 'FAILED' ? '❌' : '💥';
    const paddedName = check.name.padEnd(maxNameLength);
    const timeStr = `${(check.duration / 1000).toFixed(2)}s`;
    console.log(`  ${statusIcon} ${paddedName}  ${check.status.padEnd(8)}  ${timeStr}`);
    statusCounts[check.status]++;
  }
  
  console.log('');
  console.log(`Total: ${completionTracker.length} validators`);
  console.log(`  ✅ Passed: ${statusCounts.PASSED}`);
  if (statusCounts.FAILED > 0) {
    console.log(`  ❌ Failed: ${statusCounts.FAILED}`);
  }
  if (statusCounts.CRASHED > 0) {
    console.log(`  💥 Crashed: ${statusCounts.CRASHED}`);
  }
  console.log('━'.repeat(80));
  console.log('');
  
  if (!allPassed) {
    fail('Docs check found issues. See warnings above.');
    process.exitCode = 1;
  } else {
    ok('All docs checks passed.');
  }
}

main();

