import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { executeCommand, getTextOutput, writeLog } from "../utils/executor.js";
import { getValidDirectory } from "../utils/filesystem.js";

export function registerMessageTool(
  server: McpServer,
  config: { defaultModel?: string; defaultDir?: string }
) {
  server.registerTool(
    "message_aider",
    {
      description:
        "Run the `aider` command with a message prompt to perform code edits. " +
        "Aider will plan, edit, and git commit changes.",
      inputSchema: z.object({
        message: z
          .string()
          .describe(
            "The instruction for aider (e.g. 'Add error handling to the API route')"
          ),
        model: z
          .string()
          .optional()
          .describe("LLM model to use (e.g. 'openai/gemma-4-E4B-it-IQ4_XS'"),
        files: z
          .array(z.string())
          .optional()
          .describe("Files to focus on (relative to directory)"),
        directory: z
          .string()
          .optional()
          .describe("Path to the working project git repository"),
      }),
    },

    async ({ message, model, files, directory }) => {
      try {
        const workingDir = await getValidDirectory(
          directory,
          config.defaultDir
        );
        writeLog(`Running Aider in ${workingDir}...`);

        const args = [
          "--message",
          message,
          "--yes",
          "--no-pretty",
          "--no-stream",
          "--no-show-model-warnings",
          "--no-check-update",
          "--no-show-release-notes",
        ];

        const selectedModel = model || config.defaultModel;
        if (selectedModel) {
          args.push("--model", selectedModel);
        }

        if (files?.length) {
          args.push(...files);
        }

        writeLog(`Executing: ${["aider", args].join(" ")}`);
        const { code, stdout, stderr } = await executeCommand(
          "aider",
          args,
          workingDir
        );
        if (code === 0) {
          writeLog(`SUCCESS! ${stdout}`);
          return getTextOutput(false, stdout);
        } else {
          writeLog(`FAIL (exit code ${code})! ${stderr}`);
          return getTextOutput(true, `Aider exited with code ${code}`, stderr);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        writeLog(`RUN FAILED! ${errorMsg}`);
        return getTextOutput(true, `Failed to run Aider`, errorMsg);
      }
    }
  );
}
