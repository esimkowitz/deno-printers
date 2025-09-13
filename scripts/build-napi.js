#!/usr/bin/env node

import { execSync } from "child_process";
import { arch, platform } from "process";
import { existsSync, writeFileSync, readFileSync } from "fs";

// Platform mapping from Node.js to NAPI-RS target names
function getPlatformTarget() {
  // Map to NAPI-RS standard target names that match package.json targets
  switch (platform) {
    case "darwin":
      switch (arch) {
        case "x64":
          return "x86_64-apple-darwin";
        case "arm64":
          return "aarch64-apple-darwin";
        default:
          throw new Error(`Unsupported architecture for Darwin: ${arch}`);
      }
    case "win32":
      switch (arch) {
        case "x64":
          return "x86_64-pc-windows-msvc";
        case "arm64":
          return "aarch64-pc-windows-msvc";
        default:
          throw new Error(`Unsupported architecture for Windows: ${arch}`);
      }
    case "linux":
      switch (arch) {
        case "x64":
          return "x86_64-unknown-linux-gnu";
        case "arm64":
          return "aarch64-unknown-linux-gnu";
        default:
          throw new Error(`Unsupported architecture for Linux: ${arch}`);
      }
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

function main() {
  const args = process.argv.slice(2);
  const isRelease = args.includes("--release") || args.includes("-r");
  const platformTarget = getPlatformTarget();

  console.log(`Building for platform: ${platformTarget}`);
  console.log(`Node platform: ${platform}, arch: ${arch}`);
  console.log(`Environment check:`);
  console.log(`- NODE_VERSION: ${process.version}`);
  console.log(`- PATH includes: ${process.env.PATH?.split(platform === "win32" ? ";" : ":").slice(0, 5).join(", ")}...`);

  // Diagnostic: Check what tools are available
  console.log("Checking available build tools...");
  const toolsToCheck = ["node", "npm", "npx", "cargo", "rustc"];
  for (const tool of toolsToCheck) {
    try {
      const versionCommand = platform === "win32" ? `where ${tool}` : `which ${tool}`;
      execSync(versionCommand, { stdio: "pipe" });
      console.log(`✓ ${tool} is available`);
    } catch {
      console.log(`✗ ${tool} is NOT available`);
    }
  }

  // Try the direct cargo build approach first on Windows
  if (platform === "win32") {
    console.log("Windows detected - trying direct cargo build...");
    try {
      const cargoArgs = ["cargo", "build"];
      if (isRelease) cargoArgs.push("--release");
      cargoArgs.push("--features", "napi");
      
      const cargoCommand = cargoArgs.join(" ");
      console.log(`Executing: ${cargoCommand}`);
      
      execSync(cargoCommand, {
        stdio: "inherit",
        env: process.env,
        shell: true,
      });
      
      console.log(`✅ Cargo build completed for Windows`);
      return; // Skip the rest if cargo build succeeds
    } catch (cargoError) {
      console.error("Direct cargo build failed on Windows:", cargoError.message);
      console.log("Falling back to NAPI build...");
    }
  }

  // Try NAPI build approach
  console.log("Building with NAPI CLI...");
  
  try {
    // First, create npm directories
    console.log("Creating npm directory structure...");
    execSync("npx napi create-npm-dirs", {
      stdio: "inherit",
      env: process.env,
      shell: platform === "win32" ? true : false,
    });

    // Use basic napi build command
    const buildArgs = ["napi", "build"];
    if (isRelease) buildArgs.push("--release");
    
    const buildCommand = buildArgs.join(" ");
    console.log(`Executing: npx ${buildCommand}`);
    
    execSync(`npx ${buildCommand}`, {
      stdio: "inherit",
      env: process.env,
      shell: platform === "win32" ? true : false,
    });

    console.log(`✅ NAPI build completed`);

  } catch (error) {
    console.error("NAPI build failed:", error);
    console.error("Error message:", error.message);
    console.error("Platform:", platform, "Arch:", arch);
    console.error("Target:", platformTarget);
    process.exit(1);
  }

  // Try to run post-build cleanup if output directory exists
  const outputDir = `npm/${platformTarget}`;
  console.log(`Checking for output directory: ${outputDir}`);
  
  if (existsSync(outputDir)) {
    try {
      const removeEnvCommand = `node scripts/remove-env-check.js --dir ${outputDir}`;
      console.log(`Running post-build script: ${removeEnvCommand}`);
      execSync(removeEnvCommand, {
        stdio: "inherit",
        env: process.env,
        shell: platform === "win32" ? true : false,
      });
    } catch (error) {
      console.warn("Post-build script failed (non-fatal):", error.message);
    }
  } else {
    console.log(`Output directory ${outputDir} not found, skipping post-build script`);
  }

  console.log(`✅ Build process completed for ${platformTarget}`);
}

// Run main function if this script is executed directly
main();
