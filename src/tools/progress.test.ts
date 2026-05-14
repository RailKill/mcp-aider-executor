import { describe, it, expect, vi, beforeEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/server";
import {
  createDenyOutput,
  createErrorOutput,
  createMockServer,
  type McpFunction,
} from "./test-utils.js";
import { getErrorOutput } from "../utils/executor.js";
import { getValidDirectory } from "../utils/filesystem.js";
import { getDeniedOutput, isAllowed } from "../utils/whitelist.js";
import { registerProgressTool } from "./progress.js";

vi.mock("../utils/executor");
vi.mock("../utils/filesystem");
vi.mock("../utils/whitelist");

describe("progress-check mcp tool", () => {
  let mockServer: McpServer;
  let handlers: Map<string, McpFunction>;
  const directory = "/progress-tool";
  const denyOutput = createDenyOutput();
  const errorOutput = createErrorOutput();

  beforeEach(() => {
    vi.mocked(getValidDirectory).mockResolvedValue(directory);
    vi.mocked(getErrorOutput).mockReturnValue(errorOutput);
    vi.mocked(getDeniedOutput).mockReturnValue(denyOutput);
    const mockResults = createMockServer();
    mockServer = mockResults.mockServer;
    handlers = mockResults.handlers;
    registerProgressTool(mockServer, []);
  });

  describe("aider_check_progress", () => {
    it("checks the whitelist before running", async () => {
      vi.mocked(isAllowed).mockReturnValue(false);
      const handler = handlers.get("aider_check_progress")!;
      const result = await handler({ directory });
      expect(result).toBe(denyOutput);
    });
  });
});
