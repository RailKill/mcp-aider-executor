import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CallToolResult, McpServer } from "@modelcontextprotocol/server";
import { createMockServer, type McpFunction } from "./test-utils.js";
import { getDeniedOutput, isAllowed } from "../utils/whitelist.js";
import {
  createNewFile,
  getValidDirectory,
  joinPaths,
} from "../utils/filesystem.js";
import { AIDER_CONF_FILENAME, registerConfigTools } from "./configuration.js";
import yaml from "yaml";

vi.mock("../utils/executor");
vi.mock("../utils/filesystem");
vi.mock("../utils/whitelist");

describe("configuration mcp tools", () => {
  let mockServer: McpServer;
  let handlers: Map<string, McpFunction>;
  const directory = "/config-test";

  beforeEach(() => {
    vi.mocked(getValidDirectory).mockResolvedValue(directory);
    const mockResults = createMockServer();
    mockServer = mockResults.mockServer;
    handlers = mockResults.handlers;
    registerConfigTools(mockServer, []);
  });

  describe("aider_setup_config_yaml", () => {
    it("calls createNewFile with YAML contents", async () => {
      const mockCreate = vi.mocked(createNewFile);
      const handlerArguments = {
        directory,
        verbose: true,
        "chat-history-file": "config.test",
        "thinking-tokens": 1414,
        alias: ["slow:model1", "med:model2", "fast:model3"],
      };
      const joinedPath = `${directory}/${AIDER_CONF_FILENAME}`;
      vi.mocked(isAllowed).mockReturnValue(true);
      vi.mocked(joinPaths).mockReturnValue(joinedPath);

      const handler = handlers.get("aider_setup_config_yaml")!;
      await handler(handlerArguments);

      const calledArguments = mockCreate.mock.calls[0] as unknown[];
      const yamlArgument = calledArguments[1] as string;
      const yamlObject = yaml.parse(yamlArgument);
      const yamlComparison = Object.fromEntries(
        Object.entries(handlerArguments).filter(([key]) => key !== "directory")
      );
      expect(yamlObject).toEqual(yamlComparison);

      expect(createNewFile).toHaveBeenCalledWith(
        joinedPath,
        expect.stringContaining("med:model2")
      );
    });

    it("checks the whitelist before running", async () => {
      vi.mocked(isAllowed).mockReturnValue(false);
      const denyOutput: CallToolResult = {
        isError: true,
        content: [{ type: "text", text: "config whitelist denied" }],
      };
      vi.mocked(getDeniedOutput).mockReturnValue(denyOutput);

      const handler = handlers.get("aider_setup_config_yaml")!;
      const result = await handler({ directory });
      expect(result).toBe(denyOutput);
      expect(createNewFile).not.toHaveBeenCalled();
    });
  });
});
