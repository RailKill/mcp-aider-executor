#!/usr/bin/env node
import { McpServer, StdioServerTransport } from "@modelcontextprotocol/server";
import { cac } from "cac";
import { registerMessageTool } from "./tools/message.js";
import { registerConfigTools } from "./tools/configuration.js";
import { registerGitTools } from "./tools/git.js";
import { registerProgressTool } from "./tools/progress.js";
import { toPosixPath } from "./utils/filesystem.js";

// Define console arguments.
const APPLICATION_NAME = "mcp-aider-executor";
const cli = cac(APPLICATION_NAME);
cli.usage(`[options]`);
cli.help();
cli.option(
  "--model <model>",
  "Default LLM main model override (i.e. always use this model no matter what)"
);
cli.option(
  "--edit-format <format>",
  "Main model edit format override, regardless of config or LLM inference"
);
cli.option(
  "--architect",
  "Always run in architect mode (--no-architect for never)"
);
cli.option(
  "--editor-model <model>",
  "Default secondary editor model override for architect mode"
);
cli.option(
  "--editor-edit-format <format>",
  "Editor model's edit format override"
);
cli.option(
  "--no-add-message-notes",
  "Disables the adding of aider-specific notes to message prompts"
);
cli.option("--whitelist <path>", "Only allow operations within the glob path");

// Read console arguments into variables.
const parsed = cli.parse();
const defaultModel: string | null = parsed.options.model ?? null;
const defaultMainFormat: string | null = parsed.options.editFormat ?? null;
const defaultEditorModel: string | null = parsed.options.editorModel ?? null;
const defaultEditorFormat: string | null =
  parsed.options.editorEditFormat ?? null;
const isAppendMessage: boolean = parsed.options.addMessageNotes;
const whitelist: string[] = [parsed.options.whitelist]
  .flat()
  .filter(Boolean)
  .map(toPosixPath);

let forcedArchitect: boolean | null = null;
if (parsed.options.architect === true) {
  forcedArchitect = true;
} else if (
  parsed.options.architect === false ||
  parsed.options.noArchitect === true
) {
  forcedArchitect = false;
}

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
    defaultMainFormat,
    forcedArchitect,
    defaultEditorModel,
    defaultEditorFormat,
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
