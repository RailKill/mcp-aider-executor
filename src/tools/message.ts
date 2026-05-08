import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { executeCommand, getTextOutput } from "../utils/executor.js";
import { getValidDirectory } from "../utils/filesystem.js";

export function registerMessageTool(
  server: McpServer,
  config: { defaultModel?: string; defaultDir?: string }
) {
  server.registerTool(
    "message_aider",
    {
      description:
        "Executes the `aider` CLI tool to perform automated code edits, planning, and git commits. " +
        "Use this for complex, multi-file refactors or feature implementations.",
      inputSchema: z.object({
        message: z
          .string()
          .describe(
            "The comprehensive instruction for aider " +
              "(e.g. 'Refactor the auth middleware to use JWT instead of sessions'). " +
              "Include specific requirements or context needed for the code change to ensure " +
              "the edit is accurate on the first try."
          ),
        model: z
          .string()
          .optional()
          .describe(
            "The specific model string for aider to use (e.g. 'openai/gemma-4-E4B-it-IQ4_XS'). " +
              "Only provide if the user explicitly requests a non-default model."
          ),
        files: z
          .array(z.string())
          .optional()
          .describe(
            "An array of relative file paths to include in the edit session. Omit if unknown. " +
              "Only list files that currently exist; for new files, describe them in the 'message' instead."
          ),
        directory: z
          .string()
          .optional()
          .describe(
            "The absolute path to the project's git repository. " +
              "Only provide if the user explicitly specifies a working directory."
          ),
      }),
    },

    async ({ message, model, files, directory }) => {
      try {
        const workingDir = await getValidDirectory(
          directory,
          config.defaultDir
        );

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

        if (files) {
          args.push(...files.flatMap((filePath) => ["--file", filePath]));
        }

        const { code, stdout, stderr } = await executeCommand(
          "aider",
          args,
          workingDir
        );
        if (code === 0) {
          return getTextOutput(false, stdout);
        } else {
          return getTextOutput(true, `Aider exited with code ${code}`, stderr);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        return getTextOutput(true, `Failed to run Aider`, errorMsg);
      }
    }
  );
}
