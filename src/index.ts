/**
 * Universal cross-runtime printer library
 *
 * This library provides printer functionality for JavaScript runtimes
 * through Node-API bindings, compatible with Node.js, Deno, and Bun.
 *
 * Usage:
 * - Node.js: import { getPrinters } from "@printers/printers"
 * - Deno: import { getPrinters } from "npm:@printers/printers"
 * - Bun: import { getPrinters } from "@printers/printers"
 */

// Type definitions
export enum PrintError {
  InvalidParams = 1,
  InvalidPrinterName = 2,
  InvalidFilePath = 3,
  InvalidJson = 4,
  InvalidJsonEncoding = 5,
  PrinterNotFound = 6,
  FileNotFound = 7,
  SimulatedFailure = 8,
}

export interface JobStatus {
  id: number;
  printer_name: string;
  file_path: string;
  status: "queued" | "printing" | "completed" | "failed";
  error_message?: string;
  age_seconds: number;
}

export type PrinterState = "idle" | "processing" | "stopped" | "unknown";

export interface Printer {
  name: string;
  systemName?: string;
  driverName?: string;
  uri?: string;
  portName?: string;
  processor?: string;
  dataType?: string;
  description?: string;
  location?: string;
  isDefault?: boolean;
  isShared?: boolean;
  state?: PrinterState;
  stateReasons?: string[];
  exists(): boolean;
  toString(): string;
  equals(other: Printer): boolean;
  dispose?(): void;
  getName(): string;
  printFile(
    filePath: string,
    jobProperties?: Record<string, string>
  ): Promise<void>;
}

export interface PrinterClass {
  fromName(name: string): Printer | null;
  new (): never;
}

export interface RuntimeInfo {
  name: "deno" | "node" | "bun" | "unknown";
  isDeno: boolean;
  isNode: boolean;
  isBun: boolean;
  version: string;
}

// Runtime detection
interface GlobalWithProcess {
  process?: {
    versions?: { node?: string };
    version?: string;
    env?: { PRINTERS_JS_SIMULATE?: string };
  };
}

interface GlobalWithBun {
  Bun?: { version: string };
}

const isNode =
  typeof (globalThis as GlobalWithProcess).process !== "undefined" &&
  !!(globalThis as GlobalWithProcess).process?.versions?.node;
const isBun = typeof (globalThis as GlobalWithBun).Bun !== "undefined";
// @ts-expect-error: Deno namespace exists
const isDeno = typeof Deno !== "undefined";

// Simulation mode detection
export const isSimulationMode: boolean =
  // @ts-expect-error: Deno namespace exists
  (isDeno && Deno?.env?.get?.("PRINTERS_JS_SIMULATE") === "true") ||
  (isNode &&
    (globalThis as GlobalWithProcess).process?.env?.PRINTERS_JS_SIMULATE ===
      "true") ||
  (isBun &&
    (globalThis as GlobalWithProcess).process?.env?.PRINTERS_JS_SIMULATE ===
      "true");

// Runtime information
export const runtimeInfo: RuntimeInfo = {
  name: isDeno ? "deno" : isBun ? "bun" : isNode ? "node" : "unknown",
  isDeno,
  isNode,
  isBun,
  version: isDeno
    ? // @ts-expect-error: Deno namespace exists
      Deno.version.deno
    : isBun
      ? ((globalThis as GlobalWithBun).Bun?.version ?? "unknown")
      : isNode
        ? ((globalThis as GlobalWithProcess).process?.version ?? "unknown")
        : "unknown",
};

// N-API module loading
let nativeModule: any;

if (isSimulationMode) {
  // Simulation mode - provide mock implementations
  console.log(
    `[SIMULATION] ${runtimeInfo.name} running in simulation mode - no actual printing will occur`
  );

  nativeModule = {
    getAllPrinterNames: () => ["Simulated Printer"],
    getAllPrinters: () => [
      {
        name: "Simulated Printer",
        systemName: "SIM001",
        driverName: "Simulated Driver",
        isDefault: true,
        state: "READY",
      },
    ],
    findPrinterByName: (name: string) =>
      name === "Simulated Printer"
        ? {
            name: "Simulated Printer",
            systemName: "SIM001",
            driverName: "Simulated Driver",
            isDefault: true,
            state: "READY",
          }
        : null,
    printerExists: (name: string) => name === "Simulated Printer",
    getJobStatus: (jobId: number) =>
      jobId === 1 ? { id: jobId, status: "completed" } : null,
    cleanupOldJobs: () => 0,
    shutdown: () => {},
    printFile: async (
      printerName: string,
      filePath: string,
      jobProperties?: Record<string, string>
    ) => {
      console.log(`[SIMULATION] Would print file: ${filePath}`);
      if (jobProperties && Object.keys(jobProperties).length > 0) {
        console.log(`[SIMULATION] Job properties:`, jobProperties);
      }
      return Promise.resolve();
    },
    PrintErrorCode: {},

    // Printer class mock
    Printer: {
      fromName: (name: string) =>
        name === "Simulated Printer"
          ? {
              name: "Simulated Printer",
              systemName: "SIM001",
              driverName: "Simulated Driver",
              isDefault: true,
              state: "READY",
              exists: () => true,
              getName: () => "Simulated Printer",
              toString: () => "Simulated Printer",
              equals: (other: any) => other.name === "Simulated Printer",
              printFile: async (
                filePath: string,
                jobProperties?: Record<string, string>
              ) => {
                console.log(`[SIMULATION] Would print file: ${filePath}`);
                if (jobProperties) {
                  console.log(`[SIMULATION] Job properties:`, jobProperties);
                }
                return Promise.resolve();
              },
            }
          : null,
    },
  };
} else {
  // Load real N-API module
  try {
    // Platform detection for N-API module loading using NAPI-RS target names
    let platformString: string;

    // Map to NAPI-RS standard target names that match build output
    if (process.platform === "darwin") {
      if (process.arch === "x64") {
        platformString = "x86_64-apple-darwin";
      } else if (process.arch === "arm64") {
        platformString = "aarch64-apple-darwin";
      } else {
        throw new Error(`Unsupported architecture for Darwin: ${process.arch}`);
      }
    } else if (process.platform === "win32") {
      if (process.arch === "x64") {
        platformString = "x86_64-pc-windows-msvc";
      } else if (process.arch === "arm64") {
        platformString = "aarch64-pc-windows-msvc";
      } else {
        throw new Error(
          `Unsupported architecture for Windows: ${process.arch}`
        );
      }
    } else if (process.platform === "linux") {
      if (process.arch === "x64") {
        platformString = "x86_64-unknown-linux-gnu";
      } else if (process.arch === "arm64") {
        platformString = "aarch64-unknown-linux-gnu";
      } else {
        throw new Error(`Unsupported architecture for Linux: ${process.arch}`);
      }
    } else {
      throw new Error(`Unsupported platform: ${process.platform}`);
    }

    // Try to load the platform-specific N-API module
    try {
      nativeModule = require(`@printers/printers-${platformString}`);
    } catch (requireError) {
      // Fallback: try to load from npm directory structure
      try {
        nativeModule = require(`../npm/${platformString}/index.node`);
      } catch (fallbackError) {
        throw new Error(
          `Failed to load N-API module for platform ${platformString}. ` +
            `Make sure the platform-specific package is installed. ` +
            `Primary error: ${requireError}. Fallback error: ${fallbackError}`
        );
      }
    }
  } catch (error) {
    throw new Error(
      `Failed to initialize printer library: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Wrapper class for consistent API
class PrinterWrapper implements Printer {
  private nativePrinter: any;

  constructor(nativePrinter: any) {
    this.nativePrinter = nativePrinter;
  }

  get name(): string {
    return this.nativePrinter.name || "";
  }
  get systemName(): string {
    return this.nativePrinter.systemName || "";
  }
  get driverName(): string {
    return this.nativePrinter.driverName || "";
  }
  get uri(): string {
    return this.nativePrinter.uri || "";
  }
  get portName(): string {
    return this.nativePrinter.portName || "";
  }
  get processor(): string {
    return this.nativePrinter.processor || "";
  }
  get dataType(): string {
    return this.nativePrinter.dataType || "";
  }
  get description(): string {
    return this.nativePrinter.description || "";
  }
  get location(): string {
    return this.nativePrinter.location || "";
  }
  get isDefault(): boolean {
    return this.nativePrinter.isDefault || false;
  }
  get isShared(): boolean {
    return this.nativePrinter.isShared || false;
  }
  get state(): PrinterState {
    return this.nativePrinter.state || "unknown";
  }
  get stateReasons(): string[] {
    return this.nativePrinter.stateReasons || [];
  }

  exists(): boolean {
    return this.nativePrinter.exists ? this.nativePrinter.exists() : true;
  }

  toString(): string {
    return this.nativePrinter.toString
      ? this.nativePrinter.toString()
      : this.name;
  }

  equals(other: Printer): boolean {
    return this.name === other.name;
  }

  dispose(): void {
    if (this.nativePrinter.dispose) {
      this.nativePrinter.dispose();
    }
  }

  getName(): string {
    return this.name;
  }

  async printFile(
    filePath: string,
    jobProperties?: Record<string, string>
  ): Promise<void> {
    if (this.nativePrinter.printFile) {
      return this.nativePrinter.printFile(filePath, jobProperties);
    }
    throw new Error("Print functionality not available");
  }
}

// Public API functions
export function getAllPrinters(): Printer[] {
  try {
    const printers = nativeModule.getAllPrinters
      ? nativeModule.getAllPrinters()
      : [];
    return printers.map((p: any) => new PrinterWrapper(p));
  } catch (error) {
    console.error("Failed to get all printers:", error);
    return [];
  }
}

export function getAllPrinterNames(): string[] {
  try {
    return nativeModule.getAllPrinterNames
      ? nativeModule.getAllPrinterNames()
      : [];
  } catch (error) {
    console.error("Failed to get printer names:", error);
    return [];
  }
}

export function getPrinterByName(name: string): Printer | null {
  try {
    const nativePrinter = nativeModule.findPrinterByName
      ? nativeModule.findPrinterByName(name)
      : null;
    return nativePrinter ? new PrinterWrapper(nativePrinter) : null;
  } catch (error) {
    console.error(`Failed to get printer ${name}:`, error);
    return null;
  }
}

export function printerExists(name: string): boolean {
  try {
    return nativeModule.printerExists
      ? nativeModule.printerExists(name)
      : false;
  } catch (error) {
    console.error(`Failed to check if printer ${name} exists:`, error);
    return false;
  }
}

export function getJobStatus(jobId: number): JobStatus | null {
  try {
    return nativeModule.getJobStatus ? nativeModule.getJobStatus(jobId) : null;
  } catch (error) {
    console.error(`Failed to get job status for ${jobId}:`, error);
    return null;
  }
}

export function cleanupOldJobs(maxAgeMs: number = 30000): number {
  try {
    const maxAgeSeconds = Math.floor(maxAgeMs / 1000);
    return nativeModule.cleanupOldJobs
      ? nativeModule.cleanupOldJobs(maxAgeSeconds)
      : 0;
  } catch (error) {
    console.error("Failed to cleanup old jobs:", error);
    return 0;
  }
}

export async function shutdown(): Promise<void> {
  try {
    if (nativeModule.shutdown) {
      nativeModule.shutdown();
    }
  } catch (error) {
    console.error("Failed to shutdown:", error);
  }
}

// Printer class for static methods
export const PrinterConstructor: PrinterClass = {
  fromName: (name: string): Printer | null => getPrinterByName(name),
  // @ts-expect-error: Prevent direct construction
  new: () => {
    throw new Error("Use PrinterConstructor.fromName() instead");
  },
};

// Legacy exports for backward compatibility
export const findPrinter = getPrinterByName;
export const getDefaultPrinter = () =>
  getAllPrinters().find(p => p.isDefault) || null;
export const createPrintJob = async (
  printerName: string,
  filePath: string,
  options?: Record<string, string>
) => {
  const printer = getPrinterByName(printerName);
  if (!printer) {
    throw new Error(`Printer not found: ${printerName}`);
  }
  return printer.printFile(filePath, options);
};
