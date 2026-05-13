import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import {
  getErrorOutput,
  getTextOutput,
  isProcessAlive,
} from "../utils/executor.js";
import {
  DirectoryError,
  getFileTail,
  getJSONFile,
  getValidDirectory,
  joinPaths,
} from "../utils/filesystem.js";
import { getDeniedOutput, isAllowed } from "../utils/whitelist.js";

export const RunDetailsSchema = z.object({
  processId: z.number().nullable().default(null),
  startedOn: z.coerce.date().nullable().default(null),
  originalPrompt: z.string().default(""),
});
export type RunDetails = z.infer<typeof RunDetailsSchema>;

export const DEFAULT_CHAT_HISTORY_FILENAME = ".aider.chat.history.md";
export const RUN_DETAILS_FILENAME = ".aider.mcp.details.json";

export function getRunDetailsPath(directory: string): string {
  return joinPaths(directory, RUN_DETAILS_FILENAME);
}

export function registerProgressTool(server: McpServer, whitelist: string[]) {
  server.registerTool(
    "aider_check_progress",
    {
      description:
        "Reads the last X lines from the Aider chat history file and checks if " +
        "the previous Aider run is still in progress.",
      inputSchema: z.object({
        directory: z
          .string()
          .describe(
            "The directory containing the chat history file (usually the same directory as " +
              "the project's git repository root)."
          ),
        chatHistoryFilename: z
          .string()
          .default(DEFAULT_CHAT_HISTORY_FILENAME)
          .describe(
            "The name of the Aider chat history file. If unknown, use the default value " +
              "or try looking up the Aider configuration YAML for the custom chat history filename."
          ),
        lines: z
          .number()
          .min(5)
          .max(100)
          .default(12)
          .describe(
            "Number of lines to read from the file starting from the end."
          ),
      }),
    },

    async ({ directory, chatHistoryFilename, lines }) => {
      if (!isAllowed(directory, whitelist)) {
        return getDeniedOutput(directory);
      }

      try {
        // read the progress log file
        const workingDir = await getValidDirectory(directory);
        const chatHistoryFilePath = joinPaths(workingDir, chatHistoryFilename);
        if (!isAllowed(chatHistoryFilePath, whitelist)) {
          return getDeniedOutput(chatHistoryFilePath);
        }
        const chatLines = await getFileTail(chatHistoryFilePath, lines);

        // read the run details json
        const detailsFilePath = getRunDetailsPath(workingDir);
        const detailsData: RunDetails = RunDetailsSchema.parse(
          getJSONFile(detailsFilePath)
        );

        // determine process status if processId is present
        let processStatus: string = detailsData.startedOn
          ? "unknown"
          : "not started";
        if (detailsData.processId !== null) {
          processStatus = isProcessAlive(detailsData.processId)
            ? "alive"
            : "terminated";
        }

        // report status data
        const statusData = JSON.stringify({
          processStatus,
          ...detailsData,
          lastLinesCount: lines,
          lastLinesText: chatLines,
        });

        const isTerminated = processStatus === "terminated";
        const statusMessage = isTerminated
          ? "has finished"
          : "is still pending or in progress";

        return getTextOutput(
          true,
          `The last Aider process ${statusMessage}.`,
          statusData
        );
      } catch (error) {
        if (error instanceof DirectoryError) {
          // case when there's an error reading the directory
          return getTextOutput(true, `Directory error.`, error.message);
        } else if (
          error instanceof Error &&
          "code" in error &&
          error.code == "ENOENT"
        ) {
          // case when the run details file do not exist, isError is set to false
          return getTextOutput(
            false,
            "Run details file does not exist. Aider is clear to run in the directory."
          );
        } else {
          // other error scenarios
          return getErrorOutput(error, "Failed to read the run details file.");
        }
      }
    }
  );
}
