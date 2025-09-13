#!/usr/bin/env node
/**
 * Compiles TypeScript source files to JavaScript with declaration files
 * This generates the dist/ directory with compiled outputs that serve as
 * the primary entrypoints for both npm and JSR packages.
 */

import {
  existsSync,
  mkdirSync,
  rmSync,
  readFileSync,
  writeFileSync,
  readdirSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");
const DIST_DIR = join(PROJECT_ROOT, "dist");

function ensureDir(dir) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function removeDir(dir) {
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true });
  }
}

function runCommand(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const isWindows = process.platform === "win32";
    const childProcess = spawn(command, args, {
      cwd,
      stdio: ["inherit", "pipe", "pipe"],
      shell: isWindows, // Use shell on Windows to handle npx properly
    });

    let stdout = "";
    let stderr = "";

    childProcess.stdout?.on("data", data => {
      stdout += data.toString();
    });

    childProcess.stderr?.on("data", data => {
      stderr += data.toString();
    });

    childProcess.on("close", code => {
      if (code === 0) {
        resolve({ code, stdout, stderr });
      } else {
        reject({ code, stdout, stderr });
      }
    });
  });
}

console.log("🔨 Compiling TypeScript to JavaScript...");

// Clean dist directory
removeDir(DIST_DIR);
ensureDir(DIST_DIR);

try {
  // Run TypeScript compiler for build
  await runCommand(
    "npx",
    ["tsc", "--project", "tsconfig.build.json"],
    PROJECT_ROOT
  );
  console.log("✅ TypeScript compilation successful");
} catch (error) {
  console.error("❌ TypeScript compilation failed:");
  console.error("Error code:", error.code);
  if (error.stderr) {
    console.error("STDERR:", error.stderr);
  }
  if (error.stdout) {
    console.error("STDOUT:", error.stdout);
  }
  if (error.message) {
    console.error("Error message:", error.message);
  }
  console.error("Full error:", error);
  process.exit(1);
}

// Post-process compiled files to fix import paths
const filesToProcess = ["index.js"];

for (const file of filesToProcess) {
  const filePath = join(DIST_DIR, file);
  if (existsSync(filePath)) {
    try {
      let content = readFileSync(filePath, "utf8");

      // Fix .ts imports to .js imports for runtime compatibility
      content = content.replace(
        /from\s+["']\.\/([^"']+)\.ts["']/g,
        'from "./$1.js"'
      );
      content = content.replace(
        /import\s+["']\.\/([^"']+)\.ts["']/g,
        'import "./$1.js"'
      );
      // Fix dynamic imports too
      content = content.replace(
        /import\s*\(\s*["']\.\/([^"']+)\.ts["']\s*\)/g,
        'import("./$1.js")'
      );
      content = content.replace(
        /await\s+import\s*\(\s*["']\.\/([^"']+)\.ts["']\s*\)/g,
        'await import("./$1.js")'
      );

      // Fix export var to export const for ESLint compliance
      content = content.replace(/export var/g, "export const");

      writeFileSync(filePath, content, "utf8");
      console.log(`🔧 Fixed import paths in ${file}`);
    } catch (error) {
      console.warn(`⚠️  Could not process ${file}: ${error.message}`);
    }
  }
}

console.log("📁 Generated files:");
try {
  const entries = readdirSync(DIST_DIR, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile()) {
      console.log(`   - dist/${entry.name}`);
    }
  }
} catch {
  // Directory might not exist or be readable
}

console.log("🎉 Compilation complete!");
