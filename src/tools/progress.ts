import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import {
  getErrorOutput,
  getTextOutput,
  hasCompletionSignal,
  isProcessAlive,
} from "../utils/executor.js";
import {
  DirectoryError,
  getFileTail,
  getJSONFile,
  getValidDirectory,
  joinPaths,
} from "../utils/filesystem.js";

export const RunDetailsSchema = z.object({
  processId: z.number().nullable().default(null),
  startedOn: z.coerce.date().nullable().default(null),
  originalPrompt: z.string().default(""),
});
export type RunDetails = z.infer<typeof RunDetailsSchema>;

export const PROGRESS_LOG_FILENAME = ".aider.mcp.progress.txt";
export const RUN_DETAILS_FILENAME = ".aider.mcp.details.json";

export function getProgressLogPath(directory: string): string {
  return joinPaths(directory, PROGRESS_LOG_FILENAME);
}

export function getRunDetailsPath(directory: string): string {
  return joinPaths(directory, RUN_DETAILS_FILENAME);
}

export function registerProgressTool(server: McpServer) {
  server.registerTool(
    "aider_check_progress",
    {
      description:
        `Reads the last X lines from '${PROGRESS_LOG_FILENAME}' in the given directory to see if ` +
        "the previous Aider run is still in progress.",
      inputSchema: z.object({
        directory: z
          .string()
          .describe("The absolute path to the project's git repository."),
        lines: z
          .number()
          .default(12)
          .describe(
            "Number of lines to read from the progress file starting from the end."
          ),
      }),
    },

    async ({ directory, lines }) => {
      try {
        // read the progress log file
        const workingDir = await getValidDirectory(directory);
        const progressFilePath = getProgressLogPath(workingDir);
        const progressLines = await getFileTail(progressFilePath, lines);
        const isOver = hasCompletionSignal(progressLines);

        // read the run details json
        const detailsFilePath = getRunDetailsPath(workingDir);
        const detailsData: RunDetails = RunDetailsSchema.parse(
          getJSONFile(detailsFilePath)
        );

        // determine process status if processId is present
        let processStatus: string = detailsData.startedOn
          ? "unknown"
          : "never started";
        if (detailsData.processId !== null) {
          processStatus = isProcessAlive(detailsData.processId)
            ? "alive"
            : "terminated";
        }
        const isDead =
          processStatus === "terminated" || processStatus === "never started";
        const isFinished = isOver || isDead;

        // report status data
        const statusData = JSON.stringify({
          runStatus: isFinished ? "finished" : "running",
          processStatus,
          ...detailsData,
          lastLinesAmount: lines,
          lastLinesText: progressLines,
        });

        const statusMessage = isFinished
          ? "has finished"
          : "is still in progress";

        return getTextOutput(
          !isFinished,
          `The last Aider run ${statusMessage}.`,
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
          // case when the progress or status files do not exist, isError is set to false
          return getTextOutput(
            false,
            "Progress file does not exist. Aider is clear to run in the directory."
          );
        } else {
          // other error scenarios
          return getErrorOutput(error, "Failed to read the status file.");
        }
      }
    }
  );
}
