import type { McpServer } from "@modelcontextprotocol/server";
import { spawn } from "child_process";
import { z } from "zod";
import fs from "fs";
import path from "path";

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
      const rawDir = directory || config.defaultDir || process.cwd();
      const workingDir = path.resolve(rawDir);

      if (!fs.existsSync(workingDir)) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error: The configured project directory ${workingDir} does not exist.`,
            },
          ],
        };
      }

      const stats = fs.statSync(workingDir);
      if (!stats.isDirectory()) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error: The configured project path ${workingDir} is not a directory.`,
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
          "--no-check-update",
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
}
