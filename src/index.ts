import { McpServer, StdioServerTransport } from "@modelcontextprotocol/server";
import { spawn } from "child_process";
import { z } from "zod";
import fs from "fs";
import path from "path";

const server = new McpServer({
  name: "aider-executor",
  version: "1.0.0",
});

server.registerTool(
  "run_aider",
  {
    description:
      "Run the `aider` to perform code edits. Aider will plan, edit, and git commit changes. " +
      "Provide a clear natural language message and the directory of the git repo.",
    inputSchema: z.object({
      message: z
        .string()
        .describe(
          "The instruction for aider (e.g. 'Add error handling to the API route')"
        ),
      model: z.string().optional().default("gpt-4o"),
      files: z
        .array(z.string())
        .optional()
        .describe("Files to focus on (relative to directory)"),
      directory: z.string().optional().describe("Path to the git repository"),
    }),
  },

  async ({ message, model, files, directory }) => {
    const workingDir = directory ? path.resolve(directory) : process.cwd();

    if (directory && !fs.existsSync(workingDir)) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Error: The provided project directory ${workingDir} does not exist.`,
          },
        ],
      };
    }

    return new Promise((resolve) => {
      const args = [
        "--model",
        model,
        "--message",
        message,
        "--yes",
        "--no-pretty",
        "--no-stream",
        "--no-show-model-warnings",
        "--no-check-updates",
        "--no-show-release-notes",
      ];

      if (files) {
        args.push(...files);
      }

      const child = spawn("aider", args, {
        shell: true,
        env: { ...process.env, PYTHONIOENCODING: "utf-8" },
        cwd: workingDir,
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      child.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      child.on("close", (code) => {
        if (code === 0) {
          resolve({
            content: [{ type: "text", text: stdout }],
          });
        } else {
          resolve({
            isError: true,
            content: [
              { type: "text", text: `Aider exited with code ${code}` },
              { type: "text", text: stderr },
            ],
          });
        }
      });

      child.on("error", (error) => {
        resolve({
          isError: true,
          content: [
            { type: "text", text: `Failed to run Aider: ${error.message}` },
          ],
        });
      });
    });
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  const errorMessage =
    error instanceof Error ? error.stack || error.message : String(error);
  process.stderr.write(
    `Failed to start aider-executor MCP server:\n${errorMessage}\n`
  );
  process.exit(1);
});
