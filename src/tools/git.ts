import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import {
  getErrorOutput,
  runCommandWithStandardizedOutput,
} from "../utils/executor.js";
import { getValidDirectory } from "../utils/filesystem.js";
import { getDeniedOutput, isAllowed } from "../utils/whitelist.js";

export function registerGitTools(server: McpServer, whitelist: string[]) {
  server.registerTool(
    "aider_check_git_status",
    {
      description:
        "Shows the git repository's working tree status. Use this to see which files are modified or staged.",
      inputSchema: z.object({
        directory: z
          .string()
          .describe("The absolute path to the git repository."),
      }),
    },
    async ({ directory }) => {
      if (!isAllowed(directory, whitelist)) {
        return getDeniedOutput(directory);
      }

      try {
        const workingDir = await getValidDirectory(directory);
        return await runCommandWithStandardizedOutput(
          "git",
          ["status", "--short"],
          workingDir,
          "git status command exited with error",
          "Working tree clean."
        );
      } catch (error) {
        return getErrorOutput(error, "Failed to retrieve git status");
      }
    }
  );

  server.registerTool(
    "aider_checkout_git_branch",
    {
      description:
        "Switches branches or creates a new branch. Before running this tool, you must ensure that " +
        "Aider is not currently running in the current directory with the 'aider_check_progress' tool.",
      inputSchema: z.object({
        directory: z
          .string()
          .describe("The absolute path to the git repository."),
        branch: z.string().describe("The name of the branch to switch to."),
        create: z
          .boolean()
          .optional()
          .describe("If true, creates a new branch (git checkout -b)."),
      }),
    },
    async ({ directory, branch, create }) => {
      if (!isAllowed(directory, whitelist)) {
        return getDeniedOutput(directory);
      }

      try {
        const workingDir = await getValidDirectory(directory);
        const args = ["checkout"];
        if (create) {
          args.push("-b");
        }
        args.push(branch);

        return await runCommandWithStandardizedOutput(
          "git",
          args,
          workingDir,
          "git checkout command exited with error",
          `Successfully switched to ${branch}`
        );
      } catch (error) {
        return getErrorOutput(error, "Failed to execute git checkout");
      }
    }
  );

  server.registerTool(
    "aider_list_git_branches",
    {
      description: "Lists all local branches in the given repository path.",
      inputSchema: z.object({
        directory: z
          .string()
          .describe("The absolute path to the git repository."),
      }),
    },
    async ({ directory }) => {
      if (!isAllowed(directory, whitelist)) {
        return getDeniedOutput(directory);
      }

      try {
        const workingDir = await getValidDirectory(directory);
        return await runCommandWithStandardizedOutput(
          "git",
          ["branch", "--list"],
          workingDir,
          "git branch command exited with error"
        );
      } catch (error) {
        return getErrorOutput(error, "Failed to list branches");
      }
    }
  );

  server.registerTool(
    "aider_create_git_stash",
    {
      description:
        "Runs the `git stash -u` command to stash uncommitted files in the git repository. " +
        "Use this when the repository status is dirty and you need a clean working space for Aider to run. " +
        "Do not use this tool while Aider is running.",
      inputSchema: z.object({
        directory: z
          .string()
          .describe("The absolute path to the git repository."),
      }),
    },
    async ({ directory }) => {
      if (!isAllowed(directory, whitelist)) {
        return getDeniedOutput(directory);
      }

      try {
        const workingDir = await getValidDirectory(directory);
        return await runCommandWithStandardizedOutput(
          "git",
          ["stash", "-u"],
          workingDir,
          "git stash command exited with error"
        );
      } catch (error) {
        return getErrorOutput(error, "Failed to stash uncommitted changes");
      }
    }
  );

  server.registerTool(
    "aider_check_git_log",
    {
      description:
        "Retrieves the most recent commit history from the git repository.",
      inputSchema: z.object({
        directory: z
          .string()
          .describe("The absolute path to the git repository."),
        count: z
          .number()
          .default(5)
          .describe("Number of recent commits to return."),
      }),
    },
    async ({ directory, count }) => {
      if (!isAllowed(directory, whitelist)) {
        return getDeniedOutput(directory);
      }

      try {
        const workingDir = await getValidDirectory(directory);
        return await runCommandWithStandardizedOutput(
          "git",
          [
            "log",
            "-n",
            count.toString(),
            '--pretty=format:"%h - %an, %ar : %s"',
          ],
          workingDir,
          "git stash command exited with error"
        );
      } catch (error) {
        return getErrorOutput(error, "Failed to stash uncommitted changes");
      }
    }
  );
}
