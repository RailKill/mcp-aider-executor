import { McpServer, StdioServerTransport } from "@modelcontextprotocol/server";
import { z } from "zod";

const server = new McpServer({
  name: "aider-executor",
  version: "1.0.0",
});

server.registerTool(
  "run_aider",
  {
    description:
      "Run the `aider` shell command to perform a specific code edit or refactor." +
      "Aider will automatically apply changes and commit them to git.",
    inputSchema: z.object({
      model: z.string(),
    }),
  },
  async ({ model }) => {
    return {
      content: [{ type: "text", text: `Aider is using: ${model}!` }],
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main();
