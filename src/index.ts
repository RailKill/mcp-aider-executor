#!/usr/bin/env node
import { McpServer, StdioServerTransport } from "@modelcontextprotocol/server";
import { cac } from "cac";
import { registerMessageTool } from "./tools/message.js";

// Define console arguments.
const APPLICATION_NAME = "aider-executor";
const cli = cac(APPLICATION_NAME);
cli
  .option("--model <model>", "LLM model to use")
  .option("--dir <path>", "Working project directory");
const parsed = cli.parse();

// Create the MCP server instance.
const server = new McpServer({
  name: APPLICATION_NAME,
  version: "1.0.0",
});

// Register the tools available for LLMs to use.
registerMessageTool(server, {
  defaultModel: parsed.options.model,
  defaultDir: parsed.options.dir,
});

// Main function to start the server application.
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main();
