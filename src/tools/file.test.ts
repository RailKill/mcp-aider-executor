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
  getRawFile,
  getValidDirectory,
  getValidFile,
  listFiles,
} from "../utils/filesystem.js";
import { getDeniedOutput, isAllowed } from "../utils/whitelist.js";
import { registerFileTools } from "./file.js";

vi.mock("../utils/executor");
vi.mock("../utils/filesystem");
vi.mock("../utils/whitelist");

describe("progress-check mcp tool", () => {
  let mockServer: McpServer;
  let handlers: Map<string, McpFunction>;
  const directory = "/file-tool";
  const filePath = "./random.txt";
  const denyOutput = createDenyOutput();
  const errorOutput = createErrorOutput();

  beforeEach(() => {
    vi.mocked(getValidDirectory).mockResolvedValue(directory);
    vi.mocked(getValidFile).mockResolvedValue(filePath);
    vi.mocked(getErrorOutput).mockReturnValue(errorOutput);
    vi.mocked(getDeniedOutput).mockReturnValue(denyOutput);
    const mockResults = createMockServer();
    mockServer = mockResults.mockServer;
    handlers = mockResults.handlers;
    registerFileTools(mockServer, []);
  });

  describe("aider_list_files", () => {
    it("returns a list of files", async () => {
      vi.mocked(isAllowed).mockReturnValue(true);
      vi.mocked(listFiles).mockResolvedValue(["abc", "def"]);
      const handler = handlers.get("aider_list_files")!;
      await handler({ directory });
      expect(getTextOutput).toHaveBeenCalledWith(
        false,
        expect.stringMatching(/\[\s*"abc"\s*,\s*"def"\s*\]/),
      );
    });

    it("returns error output if list operation failed", async () => {
      vi.mocked(isAllowed).mockReturnValue(true);
      vi.mocked(listFiles).mockImplementation(() => {
        throw new Error("list error");
      });
      const handler = handlers.get("aider_list_files")!;
      const result = await handler({ directory });
      expect(result).toBe(errorOutput);
    });

    it("checks the whitelist before running", async () => {
      vi.mocked(isAllowed).mockReturnValue(false);
      const handler = handlers.get("aider_list_files")!;
      const result = await handler({ directory });
      expect(result).toBe(denyOutput);
    });
  });

  describe("aider_read_file_contents", () => {
    it("retrieves file contents", async () => {
      vi.mocked(isAllowed).mockReturnValue(true);
      const fileContents = "some file\n  - contents!";
      vi.mocked(getRawFile).mockReturnValue(fileContents);
      const handler = handlers.get("aider_read_file_contents")!;
      await handler({ filePath });
      expect(getTextOutput).toHaveBeenCalledWith(false, fileContents);
    });

    it("returns error output if read operation failed", async () => {
      vi.mocked(isAllowed).mockReturnValue(true);
      vi.mocked(getRawFile).mockImplementation(() => {
        throw new Error("list error");
      });
      const handler = handlers.get("aider_read_file_contents")!;
      const result = await handler({ filePath });
      expect(result).toBe(errorOutput);
    });

    it("checks the whitelist before running", async () => {
      vi.mocked(isAllowed).mockReturnValue(false);
      const handler = handlers.get("aider_read_file_contents")!;
      const result = await handler({ filePath });
      expect(result).toBe(denyOutput);
    });
  });
});
