import { vi } from "vitest";
import type { CallToolResult, McpServer } from "@modelcontextprotocol/server";

export type McpFunction = (...args: unknown[]) => unknown;

export function createMockServer() {
  const handlers = new Map<string, McpFunction>();
  const mockServer = {
    registerTool: vi.fn(
      (name: string, _config: unknown, handler: McpFunction) => {
        handlers.set(name, handler);
      },
    ),
    registerResource: vi.fn(),
    server: {
      getClientCapabilities: vi.fn(() => ({})),
      notification: vi.fn(),
    },
    sendLoggingMessage: vi.fn(),
    sendResourceUpdated: vi.fn(),
  } as unknown as McpServer;

  return { mockServer, handlers };
}

export function createDenyOutput(): CallToolResult {
  return {
    isError: true,
    content: [{ type: "text", text: "denied" }],
  };
}

export function createErrorOutput(): CallToolResult {
  return {
    isError: true,
    content: [{ type: "text", text: "error" }],
  };
}
