import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getDeniedOutput, isAllowed } from "../utils/whitelist.js";
import { getErrorOutput, getTextOutput } from "../utils/executor.js";
import {
  getRawFile,
  getValidDirectory,
  getValidFile,
  listFiles,
} from "../utils/filesystem.js";

export function registerFileTools(server: McpServer, whitelist: string[]) {
  server.registerTool(
    "aider_list_files",
    {
      description: "List all files in the given directory.",
      inputSchema: z.object({
        directory: z
          .string()
          .describe("The absolute path of the directory to check."),
      }),
    },

    async ({ directory }) => {
      if (!isAllowed(directory, whitelist)) {
        return getDeniedOutput(directory);
      }

      try {
        const workingDir = await getValidDirectory(directory);
        const fileList = await listFiles(workingDir);
        return getTextOutput(false, JSON.stringify(fileList));
      } catch (error) {
        return getErrorOutput(error, `Failed to list files in ${directory}`);
      }
    },
  );

  server.registerTool(
    "aider_read_file_contents",
    {
      description: "Reads the contents of a file.",
      inputSchema: z.object({
        filePath: z.string().describe("The absolute path of the file."),
      }),
    },

    async ({ filePath }) => {
      if (!isAllowed(filePath, whitelist)) {
        return getDeniedOutput(filePath);
      }

      try {
        const workingPath = await getValidFile(filePath);
        const fileContents = getRawFile(workingPath);
        return getTextOutput(false, fileContents);
      } catch (error) {
        return getErrorOutput(error, `Failed to read ${filePath}`);
      }
    },
  );
}
