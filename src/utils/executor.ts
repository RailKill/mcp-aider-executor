import type { CallToolResult } from "@modelcontextprotocol/server";
import { spawn } from "child_process";

export async function executeCommand(
  command: string,
  args: string[],
  cwd: string,
) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>(
    (resolve, reject) => {
      const child = spawn(command, args, {
        shell: true,
        cwd,
        env: {
          ...process.env,
          PYTHONIOENCODING: "utf-8",
          PYTHONUNBUFFERED: "1",
          TERM: "dumb",
        },
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (data) => (stdout += data.toString()));
      child.stderr.on("data", (data) => (stderr += data.toString()));

      child.on("close", (code) => resolve({ code, stdout, stderr }));
      child.on("error", (error) => reject(error));
    },
  );
}

export function getErrorOutput(
  error: unknown,
  primary_text: string,
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
  defaultSuccessMessage: string = "",
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
) {
  const child = spawn(command, args, {
    cwd,
    detached: true,
    shell: true,
    env: {
      ...process.env,
      PYTHONIOENCODING: "utf-8",
      PYTHONUNBUFFERED: "1",
      TERM: "dumb",
    },
  });

  child.unref();
  return child.pid;
}
