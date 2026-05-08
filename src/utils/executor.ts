import type { CallToolResult } from "@modelcontextprotocol/server";
import { spawn } from "child_process";
import { APPLICATION_NAME } from "../index.js";

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
        env: { ...process.env, PYTHONIOENCODING: "utf-8" },
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

export function getTextOutput(
  isError: boolean = true,
  primary_text: string = "FATAL ERROR: An unknown error has occurred.",
  ...more_texts: string[]
) {
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

export function writeLog(message: string) {
  process.stderr.write(`[${APPLICATION_NAME}] ${message}\n`);
}
