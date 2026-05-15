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

export const PROMPT_MESSAGE_FILENAME = ".aider.mcp.prompt.txt";

export function registerMessageTool(
  server: McpServer,
  whitelist: string[],
  defaultModel: string | null,
  defaultMainFormat: string | null,
  forcedArchitect: boolean | null,
  defaultEditorModel: string | null,
  defaultEditorFormat: string | null,
  isAppendMessage: boolean,
) {
  server.registerTool(
    "aider_message_prompt",
    {
      description:
        "Executes the `aider` CLI tool to perform automated code edits, planning, and git commits. " +
        "Use this for complex, multi-file refactors or feature implementations. " +
        "You must always check the progress or status of the previous Aider run in your intended directory. " +
        "Do not use this tool if Aider is currently running, or if you don't know Aider's status. " +
        "Do not use this tool to check file contents.",
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
              "or filesystem management.",
          ),
        model: z
          .string()
          .optional()
          .describe(
            "The specific model string for Aider to use. " +
              "Only provide if the user explicitly requests a non-default model. " +
              "This is because the user may specify a default override via the MCP server configuration.",
          ),
        editFormat: z
          .enum(["whole", "diff", "diff-fenced", "udiff"])
          .optional()
          .describe(
            "The edit format the LLM should use for the main model. " +
              "Only provide if the user explicitly requests for edits in a specific format.",
          ),
        architectMode: z
          .boolean()
          .default(false)
          .describe(
            "Set this to true if the user explicitly requests for architect mode. " +
              "Architect Mode is a two-stage workflow that separates code reasoning from code editing. " +
              "It uses the main 'model' for high-level planning capabilities and advanced reasoning, " +
              "then delegates the precise file modifications to a specialized 'editorModel'.",
          ),
        editorModel: z
          .string()
          .optional()
          .describe(
            "Secondary editor model for Aider's architect mode. " +
              "Only provide if the user explicitly requests a non-default editor model and " +
              "if running in architect mode.",
          ),
        editorEditFormat: z
          .enum(["editor-whole", "editor-diff", "diff-fenced", "udiff"])
          .optional()
          .describe(
            "The edit format the LLM should use for the editor model in architect mode. " +
              "Only provide if the user explicitly wants the **editor model** to edit in a specific format.",
          ),
        files: z
          .array(z.string())
          .optional()
          .describe(
            "An array of relative file paths to include in the edit session. Omit if unknown. " +
              "Only list files that currently exist; for new files, describe them in the 'message' instead.",
          ),
      }),
    },

    async ({
      directory,
      message,
      model,
      editFormat,
      architectMode,
      editorModel,
      editorEditFormat,
      files,
    }) => {
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
          isAppendMessage ? appendedMessage : message,
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

        const primaryModel = model || defaultModel;
        if (primaryModel) {
          args.push("--model", primaryModel);
        }

        const primaryEditFormat = editFormat || defaultMainFormat;
        if (primaryEditFormat) {
          args.push("--edit-format", primaryEditFormat);
        }

        if (forcedArchitect !== false) {
          if (forcedArchitect === true || architectMode) {
            args.push("--architect");
            const secondaryModel =
              editorModel || defaultEditorModel || primaryModel;
            if (secondaryModel) {
              args.push("--editor-model", secondaryModel);
            }

            const secondaryEditFormat = editorEditFormat || defaultEditorFormat;
            if (secondaryEditFormat) {
              args.push("--editor-edit-format", secondaryEditFormat);
            }
          }
        }

        if (files) {
          for (const filePath of files) {
            const fullPath = joinPaths(workingDir, filePath);
            if (!isAllowed(fullPath, whitelist)) {
              return getDeniedOutput(fullPath);
            }
          }
          args.push(...files.flatMap((filePath) => ["--file", filePath]));
        }

        // create run details json
        const pid = startBackgroundTask("aider", args, workingDir);
        const runDetailsPath = getRunDetailsPath(workingDir);
        const runDetails: RunDetails = {
          processId: pid ?? null,
          startedOn: new Date(),
        };
        await createNewFile(runDetailsPath, JSON.stringify(runDetails));

        return getTextOutput(
          false,
          `Aider detached process successfully started in ${workingDir} (pid: ${pid})`,
          "Aider is running. Do not run anymore Aider commands in this directory for now.",
          "Tell the user you've started the background process.",
          "Do not check the progress again unless explicitly requested.",
        );
      } catch (error) {
        return getErrorOutput(error, "Failed to run Aider");
      }
    },
  );
}
