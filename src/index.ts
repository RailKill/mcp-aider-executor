#!/usr/bin/env node
import { McpServer, StdioServerTransport } from "@modelcontextprotocol/server";
import { cac } from "cac";
import { registerMessageTool } from "./tools/message.js";
import { registerConfigTools } from "./tools/configuration.js";
import { registerGitTools } from "./tools/git.js";
import { registerProgressTool } from "./tools/progress.js";

// Define console arguments.
const APPLICATION_NAME = "aider-executor";
const cli = cac(APPLICATION_NAME);
cli.option("--model <model>", "Default LLM model to use");
const parsed = cli.parse();

// Create the MCP server instance.
const server = new McpServer({
  name: APPLICATION_NAME,
  version: "1.0.0",
});

// Register the tools available for LLMs to use.
registerMessageTool(server, {
  defaultModel: parsed.options.model,
});
registerConfigTools(server);
registerGitTools(server);
registerProgressTool(server);

// Main function to start the server application.
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main();
