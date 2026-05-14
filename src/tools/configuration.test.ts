import { describe, it, expect, vi, beforeEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/server";
import {
  createDenyOutput,
  createErrorOutput,
  createMockServer,
  type McpFunction,
} from "./test-utils.js";
import { getErrorOutput, getTextOutput } from "../utils/executor.js";
import {
  createNewFile,
  getRawFile,
  getValidDirectory,
  joinPaths,
} from "../utils/filesystem.js";
import { getDeniedOutput, isAllowed } from "../utils/whitelist.js";
import { AIDER_CONF_FILENAME, registerConfigTools } from "./configuration.js";
import yaml from "yaml";

vi.mock("../utils/executor");
vi.mock("../utils/filesystem");
vi.mock("../utils/whitelist");

describe("configuration mcp tools", () => {
  let mockServer: McpServer;
  let handlers: Map<string, McpFunction>;
  const directory = "/config-test";
  const denyOutput = createDenyOutput();
  const errorOutput = createErrorOutput();
  const joinedPath = `${directory}/${AIDER_CONF_FILENAME}`;
  const whitelist = ["/abc/*", "/wee/**.js"];

  beforeEach(() => {
    vi.mocked(getValidDirectory).mockResolvedValue(directory);
    vi.mocked(getErrorOutput).mockReturnValue(errorOutput);
    vi.mocked(getDeniedOutput).mockReturnValue(denyOutput);
    vi.mocked(joinPaths).mockReturnValue(joinedPath);
    const mockResults = createMockServer();
    mockServer = mockResults.mockServer;
    handlers = mockResults.handlers;
    registerConfigTools(mockServer, whitelist);
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

      vi.mocked(isAllowed).mockReturnValue(true);

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

    it("returns error output if failed to create file", async () => {
      vi.mocked(isAllowed).mockReturnValue(true);
      vi.mocked(createNewFile).mockImplementation(() => {
        throw new Error("create failed");
      });

      const handler = handlers.get("aider_setup_config_yaml")!;
      const result = await handler({ directory });
      expect(result).toBe(errorOutput);
      expect(createNewFile).toHaveBeenCalledWith(joinedPath, expect.anything());
    });

    it("checks the whitelist before running", async () => {
      vi.mocked(isAllowed).mockReturnValue(false);
      const handler = handlers.get("aider_setup_config_yaml")!;
      const result = await handler({ directory });
      expect(result).toBe(denyOutput);
      expect(createNewFile).not.toHaveBeenCalled();
    });
  });

  describe("aider_read_config_yaml", () => {
    it("calls getRawFile to retrieve YAML contents", async () => {
      vi.mocked(isAllowed).mockReturnValue(true);
      const handler = handlers.get("aider_read_config_yaml")!;
      await handler({ directory });
      expect(getRawFile).toHaveBeenCalledWith(joinedPath);
    });

    it("returns error output if getRawFile fails", async () => {
      vi.mocked(isAllowed).mockReturnValue(true);
      vi.mocked(getRawFile).mockImplementation(() => {
        throw new Error("get file fail");
      });
      const handler = handlers.get("aider_read_config_yaml")!;
      const result = await handler({ directory });
      expect(result).toBe(errorOutput);
    });

    it("checks the whitelist before running", async () => {
      vi.mocked(isAllowed).mockReturnValue(false);
      const handler = handlers.get("aider_read_config_yaml")!;
      const result = await handler({ directory });
      expect(result).toBe(denyOutput);
      expect(getRawFile).not.toHaveBeenCalled();
    });
  });

  describe("aider_mcp_check_whitelist", () => {
    it("returns successful output with whitelist array content", async () => {
      const handler = handlers.get("aider_mcp_check_whitelist")!;
      await handler();
      expect(getTextOutput).toHaveBeenCalledWith(
        false,
        '["/abc/*","/wee/**.js"]'
      );
    });

    it("returns error output if retrieval failed", async () => {
      vi.mocked(getTextOutput).mockImplementation(() => {
        throw new Error("get text fail");
      });
      const handler = handlers.get("aider_mcp_check_whitelist")!;
      const result = await handler();
      expect(result).toBe(errorOutput);
    });
  });
});
