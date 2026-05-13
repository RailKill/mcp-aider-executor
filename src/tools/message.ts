import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import {
  getErrorOutput,
  getTextOutput,
  startBackgroundTask,
} from "../utils/executor.js";
import {
  createNewFile,
  getValidDirectory,
  joinPaths,
} from "../utils/filesystem.js";
import { getRunDetailsPath, type RunDetails } from "./progress.js";
import { getDeniedOutput, isAllowed } from "../utils/whitelist.js";

const PROMPT_MESSAGE_FILENAME = ".aider.mcp.prompt.txt";

export function registerMessageTool(
  server: McpServer,
  whitelist: string[],
  defaultModel: string | null
) {
  server.registerTool(
    "aider_message_prompt",
    {
      description:
        "Executes the `aider` CLI tool to perform automated code edits, planning, and git commits. " +
        "Use this for complex, multi-file refactors or feature implementations. " +
        "You must always check the progress or status of the previous Aider run in your intended directory. " +
        "You can only use this tool if Aider is not currently running to prevent conflicts. " +
        "Do not use this tool to check file contents or progress status.",
      inputSchema: z.object({
        directory: z
          .string()
          .describe("The absolute path to the project's git repository."),
        message: z
          .string()
          .describe(
            "The programming or code-related instruction for Aider " +
              "(e.g. 'Refactor the auth middleware to use JWT instead of sessions'). " +
              "Include specific requirements or context needed for the code change to ensure " +
              "the edit is accurate on the first try. Do not include any other operating instructions for git " +
              "or filesystem management."
          ),
        model: z
          .string()
          .optional()
          .describe(
            "The specific model string for Aider to use (e.g. 'openai/gemma-4-E4B-it-IQ4_XS'). " +
              "Only provide if the user explicitly requests a non-default model. " +
              "This is because the user may specify a default override via the MCP server configuration."
          ),
        files: z
          .array(z.string())
          .optional()
          .describe(
            "An array of relative file paths to include in the edit session. Omit if unknown. " +
              "Only list files that currently exist; for new files, describe them in the 'message' instead."
          ),
      }),
    },

    async ({ directory, message, model, files }) => {
      if (!isAllowed(directory, whitelist)) {
        return getDeniedOutput(directory);
      }

      try {
        const workingDir = await getValidDirectory(directory);
        const appendedMessage =
          message +
          "\n\nNote: When generating Markdown file contents that contain code blocks, use tildes (~~~) for " +
          "the internal code blocks to avoid conflicting with the outer Aider action blocks.";
        await createNewFile(
          joinPaths(workingDir, PROMPT_MESSAGE_FILENAME),
          appendedMessage
        );

        const args = [
          "--message-file",
          PROMPT_MESSAGE_FILENAME,
          "--yes",
          "--no-pretty",
          "--stream",
          "--no-show-model-warnings",
          "--no-check-update",
          "--no-show-release-notes",
        ];

        const selectedModel = model || defaultModel;
        if (selectedModel) {
          args.push("--model", selectedModel);
        }

        if (files) {
          args.push(...files.flatMap((filePath) => ["--file", filePath]));
        }

        // create run details json
        const pid = startBackgroundTask("aider", args, workingDir);
        const runDetailsPath = getRunDetailsPath(workingDir);
        const runDetails: RunDetails = {
          processId: pid ?? null,
          startedOn: new Date(),
          originalPrompt: message,
        };
        await createNewFile(runDetailsPath, JSON.stringify(runDetails));

        return getTextOutput(
          false,
          `Aider detached process successfully started in ${workingDir} (pid: ${pid})`,
          "Aider is running. Do not run anymore Aider commands in this directory for now.",
          "Tell the user you've started the background process.",
          "Do not check the progress again unless explicitly requested."
        );
      } catch (error) {
        return getErrorOutput(error, "Failed to run Aider");
      }
    }
  );
}
