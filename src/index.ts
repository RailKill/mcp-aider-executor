import { McpServer, StdioServerTransport } from "@modelcontextprotocol/server";
import { cac } from "cac";
import { spawn } from "child_process";
import { z } from "zod";
import fs from "fs";
import path from "path";

// npx console arguments
const APPLICATION_NAME = "aider-executor";
const cli = cac(APPLICATION_NAME);
cli
  .option("--model <model>", "LLM model to use")
  .option("--dir <path>", "Working project directory");
const parsed = cli.parse();
const config = {
  defaultModel: parsed.options.model,
  defaultDir: parsed.options.dir,
};

// mcp server logic
const server = new McpServer({
  name: APPLICATION_NAME,
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
      model: z
        .string()
        .optional()
        .describe("LLM model to use (e.g. 'openai/gemma-4-E4B-it-IQ4_XS'"),
      files: z
        .array(z.string())
        .optional()
        .describe("Files to focus on (relative to directory)"),
      directory: z.string().optional().describe("Path to the git repository"),
    }),
  },

  async ({ message, model, files, directory }) => {
    const rawDir = directory || config.defaultDir || process.cwd();
    const workingDir = path.resolve(rawDir);

    if (!fs.existsSync(workingDir)) {
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
        "--message",
        message,
        "--yes",
        "--no-pretty",
        "--no-stream",
        "--no-show-model-warnings",
        "--no-check-updates",
        "--no-show-release-notes",
      ];

      const selectedModel = model || config.defaultModel;
      if (selectedModel) {
        args.push("--model", selectedModel);
      }

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
    `Failed to start ${APPLICATION_NAME} MCP server:\n${errorMessage}\n`
  );
  process.exit(1);
});
