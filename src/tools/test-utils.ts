import { expect, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/server";
import {
  getErrorOutput,
  runCommandWithStandardizedOutput,
} from "../utils/executor.js";

export type McpFunction = (...args: unknown[]) => unknown;

export function createMockServer() {
  const handlers = new Map<string, McpFunction>();
  const mockServer = {
    registerTool: vi.fn(
      (name: string, _config: unknown, handler: McpFunction) => {
        handlers.set(name, handler);
      }
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

export function expectGenericRunCommandCall(
  command: string,
  args: (string | unknown)[],
  cwd: string,
  hasDefaultSuccessMessage: boolean = false
) {
  const runArguments = [command, args, cwd, expect.stringMatching(/\S+/)];
  if (hasDefaultSuccessMessage) {
    runArguments.push(expect.stringMatching(/\S+/));
  }
  expect(runCommandWithStandardizedOutput).toHaveBeenCalledWith(
    ...runArguments
  );
}

export function expectGenericErrorOutputCall() {
  expect(getErrorOutput).toHaveBeenCalledWith(
    expect.any(Error),
    expect.stringMatching(/failed/i)
  );
}
