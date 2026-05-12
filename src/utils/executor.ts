import type { CallToolResult } from "@modelcontextprotocol/server";
import { spawn } from "child_process";
import fs from "fs";

export const TASK_STARTED_MESSAGE = "MCP_SIGNAL: TASK_STARTED";
export const TASK_SUCCESS_MESSAGE = "MCP_SIGNAL: TASK_FINISHED_SUCCESS";
export const TASK_FAILURE_MESSAGE = "MCP_SIGNAL: TASK_FINISHED_WITH_ERROR";

export async function executeCommand(
  command: string,
  args: string[],
  cwd: string
) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>(
    (resolve, reject) => {
      const child = spawn(command, args, {
        shell: true,
        cwd,
        env: { ...process.env, PYTHONIOENCODING: "utf-8", TERM: "dumb" },
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (data) => (stdout += data.toString()));
      child.stderr.on("data", (data) => (stderr += data.toString()));

      child.on("close", (code) => resolve({ code, stdout, stderr }));
      child.on("error", (error) => reject(error));
    }
  );
}

export function getErrorOutput(
  error: unknown,
  primary_text: string
): CallToolResult {
  const errorMessage = error instanceof Error ? error.message : String(error);
  return getTextOutput(true, primary_text, errorMessage);
}

export function getTextOutput(
  isError: boolean = true,
  primary_text: string = "FATAL ERROR: An unknown error has occurred.",
  ...more_texts: string[]
): CallToolResult {
  const texts = [primary_text, ...more_texts];
  const output: CallToolResult = {
    content: [],
  };

  if (isError) {
    output.isError = true;
  }

  texts.forEach((text) => {
    output.content.push({
      type: "text",
      text,
    });
  });
  return output;
}

export function hasCompletionSignal(texts: string[]): boolean {
  return texts.some(
    (text) =>
      text.includes(TASK_SUCCESS_MESSAGE) || text.includes(TASK_FAILURE_MESSAGE)
  );
}

export function isProcessAlive(pid: number): boolean {
  try {
    // signal 0 checks for existence, it doesn't kill the process
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error) {
      // 'EPERM' = alive but cannot signal, 'ESRCH' = dead
      return error.code === "EPERM";
    }
    return false;
  }
}

export async function runCommandWithStandardizedOutput(
  command: string,
  args: string[],
  cwd: string,
  errorMessage: string,
  defaultSuccessMessage: string = ""
): Promise<CallToolResult> {
  const { code, stdout, stderr } = await executeCommand(command, args, cwd);
  if (code === 0) {
    return getTextOutput(false, stdout || defaultSuccessMessage);
  } else {
    return getTextOutput(true, `${errorMessage} (code: ${code})`, stderr);
  }
}

export function startBackgroundTask(
  command: string,
  args: string[],
  cwd: string,
  logFilePath: string
) {
  const out = fs.openSync(logFilePath, "a");
  const child = spawn(command, args, {
    cwd,
    detached: true,
    stdio: [
      "ignore", // stdin: ignore (don't wait for user input)
      out, // stdout: pipe to log file
      out, // stderr: pipe to log file
    ],
    shell: true,
  });

  child.on("exit", (code) => {
    const statusMessage =
      code === 0
        ? `\n\n--- ${TASK_SUCCESS_MESSAGE} ---`
        : `\n\n--- ${TASK_FAILURE_MESSAGE} (code: ${code}) ---`;
    fs.appendFileSync(logFilePath, statusMessage);
  });

  child.unref();
  return child.pid;
}
