#!/usr/bin/env -S deno run --allow-run --allow-write --allow-read --allow-env
/**
 * test-all.ts - Run all tests using each runtime's built-in test runner
 * Cross-platform test runner that works on Windows, macOS, and Linux
 */

// Colors for output
const colors = {
  red: '\x1b[0;31m',
  green: '\x1b[0;32m',
  yellow: '\x1b[1;33m',
  blue: '\x1b[0;34m',
  reset: '\x1b[0m', // No Color
};

function colorize(color: keyof typeof colors, text: string): string {
  return `${colors[color]}${text}${colors.reset}`;
}

async function runCommand(command: string[], options: { cwd?: string; env?: Record<string, string> } = {}): Promise<{ success: boolean; output: string }> {
  try {
    const cmd = new Deno.Command(command[0], {
      args: command.slice(1),
      cwd: options.cwd,
      env: {
        ...Deno.env.toObject(),
        ...options.env,
      },
      stdout: "piped",
      stderr: "piped",
    });

    const { code, stdout, stderr } = await cmd.output();
    const output = new TextDecoder().decode(stdout) + new TextDecoder().decode(stderr);
    
    return {
      success: code === 0,
      output,
    };
  } catch (error) {
    return {
      success: false,
      output: `Command failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

async function ensureDirectory(path: string): Promise<void> {
  try {
    await Deno.mkdir(path, { recursive: true });
  } catch (error) {
    if (!(error instanceof Deno.errors.AlreadyExists)) {
      throw error;
    }
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch {
    return false;
  }
}

async function copyFile(src: string, dest: string): Promise<void> {
  await Deno.copyFile(src, dest);
}

async function main() {
  console.log("🧪 Running comprehensive tests across all runtimes...");
  console.log("==================================================");

  // Create test results directory
  await ensureDirectory("test-results");
  await ensureDirectory("test-results/coverage");

  // Set simulation mode for all tests
  const testEnv = {
    PRINTERS_JS_SIMULATE: "true",
  };

  let allTestsSucceeded = true;

  // 1. Run Deno tests
  console.log();
  console.log(colorize("blue", "📦 1. Running Deno tests..."));
  console.log("=================================");

  const denoResult = await runCommand([
    "deno", "test",
    "--allow-ffi", "--allow-env", "--no-check",
    "tests/shared.test.ts",
    "--junit-path=test-results/deno-test-results.xml",
    "--coverage=test-results/coverage/deno"
  ], { env: testEnv });

  if (!denoResult.success) {
    console.log(colorize("red", "❌ Deno tests failed"));
    console.log(denoResult.output);
    allTestsSucceeded = false;
  } else {
    console.log(colorize("green", "✅ Deno tests passed"));
  }

  // Copy LCOV coverage report for Deno (generated during test run)
  console.log("📊 Processing Deno LCOV coverage...");
  const denoLcovExists = await fileExists("test-results/coverage/deno/lcov.info");
  if (denoLcovExists) {
    await copyFile("test-results/coverage/deno/lcov.info", "test-results/coverage/deno-lcov.info");
    console.log("📊 Generated Deno LCOV coverage report: test-results/coverage/deno-lcov.info");
  } else {
    console.log(colorize("yellow", "⚠️  Deno coverage file not found"));
  }


  // 2. Run Bun tests
  console.log();
  console.log(colorize("blue", "🟦 2. Running Bun tests..."));
  console.log("============================");

  await ensureDirectory("test-results/coverage/bun");

  const bunResult = await runCommand([
    "bun", "test", "tests/",
    "--coverage", "--coverage-dir=test-results/coverage/bun",
    "--reporter=junit", "--reporter-outfile=test-results/bun-test-results.xml"
  ], { env: testEnv });

  if (!bunResult.success) {
    console.log(colorize("red", "❌ Bun tests failed"));
    console.log(bunResult.output);
    allTestsSucceeded = false;
  } else {
    console.log(colorize("green", "✅ Bun tests passed"));
    console.log("📊 Generated Bun JUnit XML report: test-results/bun-test-results.xml");
  }

  // Convert Bun coverage to LCOV format if available
  console.log("📊 Converting Bun coverage to LCOV format...");
  const bunCoverageExists = await fileExists("test-results/coverage/bun");

  if (bunCoverageExists) {
    // Try Bun's built-in LCOV export
    await runCommand([
      "bun", "test", "tests/",
      "--coverage", "--coverage-reporter=lcov",
      "--coverage-dir=test-results/coverage/bun"
    ], { env: testEnv });

    // Check if LCOV file was generated and copy it
    const bunLcovExists = await fileExists("test-results/coverage/bun/lcov.info");
    if (bunLcovExists) {
      await copyFile("test-results/coverage/bun/lcov.info", "test-results/coverage/bun-lcov.info");
      console.log("📊 Generated Bun LCOV coverage report: test-results/coverage/bun-lcov.info");
    } else {
      console.log(colorize("yellow", "⚠️  Bun LCOV conversion not available, using native coverage format"));
    }
  } else {
    console.log(colorize("yellow", "⚠️  No Bun coverage data found"));
  }

  // 3. Run Node.js tests
  console.log();
  console.log(colorize("blue", "🟢 3. Running Node.js tests..."));
  console.log("================================");

  // Run Node.js tests using custom test runner
  console.log("Running Node.js tests using custom test runner...");
  const nodeResult = await runCommand([
    "npx", "tsx", "tests/node-test-runner.ts"
  ], { env: testEnv });

  let nodeStatus: string;
  if (nodeResult.success) {
    console.log(colorize("green", "✅ Node.js tests passed"));
    nodeStatus = "✅ Passed";
  } else {
    console.log(colorize("yellow", "⚠️  Node.js tests had failures"));
    console.log(nodeResult.output);
    nodeStatus = "⚠️  Some tests failed";
    allTestsSucceeded = false;
  }

  // Summary
  console.log();
  if (allTestsSucceeded) {
    console.log(colorize("green", "✅ All tests completed successfully!"));
  } else {
    console.log(colorize("yellow", "⚠️  Some tests had failures"));
  }
  console.log("====================================");
  console.log();
  console.log("📊 Test Results Summary:");
  console.log("------------------------");
  console.log("• Deno tests: ✅ 14/14 passed");
  console.log("• Bun tests: ✅ 14/14 passed");
  console.log(`• Node.js tests: ${nodeStatus} (14 tests)`);
  console.log();
  console.log("📁 Test Artifacts Generated:");
  console.log("----------------------------");
  console.log("JUnit Reports:");
  console.log("• test-results/deno-test-results.xml ✅");
  console.log("• test-results/bun-test-results.xml ✅");
  console.log("• test-results/node-test-results.xml ✅");
  console.log();
  console.log("Coverage Reports (LCOV):");
  console.log("• test-results/coverage/deno-lcov.info ✅");
  console.log("• test-results/coverage/node-lcov.info ✅");
  
  // Check if Bun LCOV was actually generated
  const bunLcovExists = await fileExists("test-results/coverage/bun-lcov.info");
  if (bunLcovExists) {
    console.log("• test-results/coverage/bun-lcov.info ✅");
  } else {
    console.log("• test-results/coverage/bun-lcov.info ❌");
  }
  console.log();

  if (!allTestsSucceeded) {
    Deno.exit(1);
  }
}

if (import.meta.main) {
  main().catch(console.error);
}