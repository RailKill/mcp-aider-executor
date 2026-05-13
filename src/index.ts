#!/usr/bin/env node
import { McpServer, StdioServerTransport } from "@modelcontextprotocol/server";
import { cac } from "cac";
import { registerMessageTool } from "./tools/message.js";
import { registerConfigTools } from "./tools/configuration.js";
import { registerGitTools } from "./tools/git.js";
import { registerProgressTool } from "./tools/progress.js";
import { toPosixPath } from "./utils/filesystem.js";

// Define console arguments.
export const APPLICATION_NAME = "mcp-aider-executor";
const cli = cac(APPLICATION_NAME);
cli.usage(`[options]`);
cli.help();
cli.option("--model <model>", "Default LLM main model override");
cli.option(
  "--editor-model <model>",
  "Default secondary editor model override for architect mode"
);
cli.option(
  "--add-message-notes",
  "Appends aider-specific notes to message prompts",
  { default: true }
);
cli.option("--whitelist <path>", "Only allow operations within the glob path");
const parsed = cli.parse();
const whitelist: string[] = [parsed.options.whitelist]
  .flat()
  .filter(Boolean)
  .map(toPosixPath);
const defaultModel: string | null = parsed.options.model ?? null;
const defaultEditorModel: string | null = parsed.options.editorModel ?? null;
const isAppendMessage: boolean = parsed.options.addMessageNotes;

if (!parsed.options.help && !parsed.options.h) {
  // Create the MCP server instance.
  const server = new McpServer({
    name: APPLICATION_NAME,
    version: "1.0.0",
  });

  // Register the tools available for LLMs to use.
  registerMessageTool(
    server,
    whitelist,
    defaultModel,
    defaultEditorModel,
    isAppendMessage
  );
  registerConfigTools(server, whitelist);
  registerGitTools(server, whitelist);
  registerProgressTool(server, whitelist);

  // Main function to start the server application.
  async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
  }

  main();
}
