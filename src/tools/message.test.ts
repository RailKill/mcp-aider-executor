import { describe, it, expect, vi, beforeEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/server";
import {
  createDenyOutput,
  createErrorOutput,
  createMockServer,
  type McpFunction,
} from "./test-utils.js";
import {
  getErrorOutput,
  getTextOutput,
  startBackgroundTask,
} from "../utils/executor.js";
import {
  createNewFile,
  getValidDirectory,
  joinPaths,
} from "../utils/filesystem.js";
import { getDeniedOutput, isAllowed } from "../utils/whitelist.js";
import { PROMPT_MESSAGE_FILENAME, registerMessageTool } from "./message.js";
import { getRunDetailsPath } from "./progress.js";

vi.mock("../utils/executor");
vi.mock("../utils/filesystem");
vi.mock("../utils/whitelist");
vi.mock("./progress.js", () => ({
  getRunDetailsPath: vi.fn(),
}));

describe("message mcp tool", () => {
  let mockServer: McpServer;
  let handlers: Map<string, McpFunction>;
  const directory = "/message-tool";
  const defaultModel = "test/main-model";
  const editorModel = "test/editor-model";
  const denyOutput = createDenyOutput();
  const errorOutput = createErrorOutput();
  const joinedPath = `${directory}/${PROMPT_MESSAGE_FILENAME}`;

  beforeEach(() => {
    vi.mocked(getValidDirectory).mockResolvedValue(directory);
    vi.mocked(getErrorOutput).mockReturnValue(errorOutput);
    vi.mocked(getDeniedOutput).mockReturnValue(denyOutput);
    vi.mocked(joinPaths).mockReturnValue(joinedPath);
    const mockResults = createMockServer();
    mockServer = mockResults.mockServer;
    handlers = mockResults.handlers;
    registerMessageTool(mockServer, [], defaultModel, editorModel, true);
  });

  describe("aider_message_prompt", () => {
    it("starts background process", async () => {
      vi.mocked(isAllowed).mockReturnValue(true);
      const mockBackground = vi.mocked(startBackgroundTask);
      const handler = handlers.get("aider_message_prompt")!;
      await handler({ directory });
      const calledArguments = mockBackground.mock.calls[0] as unknown[];
      const messageArguments = calledArguments[1] as string[];
      expect(messageArguments).not.toContain("--architect");
      expect(startBackgroundTask).toHaveBeenCalledWith(
        "aider",
        expect.arrayContaining([
          "--yes",
          "--message-file",
          PROMPT_MESSAGE_FILENAME,
        ]),
        directory
      );
    });

    it("adds the architect option when requested", async () => {
      vi.mocked(isAllowed).mockReturnValue(true);
      const handler = handlers.get("aider_message_prompt")!;
      await handler({ directory, architectMode: true });
      expect(startBackgroundTask).toHaveBeenCalledWith(
        "aider",
        expect.arrayContaining(["--architect"]),
        directory
      );
    });

    it("adds file argument correctly", async () => {
      vi.mocked(isAllowed).mockReturnValue(true);
      const mockBackground = vi.mocked(startBackgroundTask);
      const files = ["single.js"];
      const handler = handlers.get("aider_message_prompt")!;
      await handler({ directory, files });
      const calledArguments = mockBackground.mock.calls[0] as unknown[];
      const messageArguments = calledArguments[1] as string[];
      const index = messageArguments.indexOf("--file");
      expect(messageArguments[index + 1]).toBe("single.js");
    });

    it("adds multiple file arguments correctly", async () => {
      vi.mocked(isAllowed).mockReturnValue(true);
      const mockBackground = vi.mocked(startBackgroundTask);
      const files = ["abc.txt", "r23 4send", ".be_2"];
      const handler = handlers.get("aider_message_prompt")!;
      await handler({ directory, files });
      const calledArguments = mockBackground.mock.calls[0] as unknown[];
      const messageArguments = calledArguments[1] as string[];

      const target = "--file";
      let count = 0;
      let index = messageArguments.indexOf(target);
      while (index !== -1) {
        const next = index + 1;
        expect(messageArguments[next]).toBe(files[count]);
        count++;
        index = messageArguments.indexOf(target, next + 1);
      }
      expect(count).toBe(files.length);
    });

    it("uses main model argument when provided", async () => {
      vi.mocked(isAllowed).mockReturnValue(true);
      const mockBackground = vi.mocked(startBackgroundTask);
      const customModel = "my-custom-model";
      const handler = handlers.get("aider_message_prompt")!;
      await handler({ directory, model: customModel });
      const calledArguments = mockBackground.mock.calls[0] as unknown[];
      const messageArguments = calledArguments[1] as string[];
      const index = messageArguments.indexOf("--model");
      expect(messageArguments[index + 1]).toBe(customModel);
    });

    it("falls back to default main model if no model argument is provided", async () => {
      vi.mocked(isAllowed).mockReturnValue(true);
      const mockBackground = vi.mocked(startBackgroundTask);
      const handler = handlers.get("aider_message_prompt")!;
      await handler({ directory });
      const calledArguments = mockBackground.mock.calls[0] as unknown[];
      const messageArguments = calledArguments[1] as string[];
      const index = messageArguments.indexOf("--model");
      expect(messageArguments[index + 1]).toBe(defaultModel);
    });

    it("uses editor model argument when provided", async () => {
      vi.mocked(isAllowed).mockReturnValue(true);
      const mockBackground = vi.mocked(startBackgroundTask);
      const customModel = "my-edit-model";
      const handler = handlers.get("aider_message_prompt")!;
      await handler({
        directory,
        architectMode: true,
        editorModel: customModel,
      });
      const calledArguments = mockBackground.mock.calls[0] as unknown[];
      const messageArguments = calledArguments[1] as string[];
      const index = messageArguments.indexOf("--editor-model");
      expect(messageArguments[index + 1]).toBe(customModel);
    });

    it("falls back to default editor model if no model argument is provided", async () => {
      vi.mocked(isAllowed).mockReturnValue(true);
      const mockBackground = vi.mocked(startBackgroundTask);
      const handler = handlers.get("aider_message_prompt")!;
      await handler({ directory, architectMode: true });
      const calledArguments = mockBackground.mock.calls[0] as unknown[];
      const messageArguments = calledArguments[1] as string[];
      const index = messageArguments.indexOf("--editor-model");
      expect(messageArguments[index + 1]).toBe(editorModel);
    });

    it("creates a process status file", async () => {
      vi.mocked(isAllowed).mockReturnValue(true);
      const pid = 851;
      const runPath = "test-run-path/unit.json";
      vi.mocked(startBackgroundTask).mockReturnValue(pid);
      vi.mocked(getRunDetailsPath).mockReturnValue(runPath);

      const handler = handlers.get("aider_message_prompt")!;
      await handler({ directory });

      const regex = new RegExp(`"processId":\\s*${pid}`);
      expect(createNewFile).toHaveBeenCalledWith(
        runPath,
        expect.stringMatching(regex)
      );
    });

    it("returns a text output if successful", async () => {
      vi.mocked(isAllowed).mockReturnValue(true);
      const mockTextOutput = vi.mocked(getTextOutput);
      const handler = handlers.get("aider_message_prompt")!;
      await handler({ directory });
      const calledArguments = mockTextOutput.mock.calls[0] as unknown[];
      const isError = calledArguments[0] as boolean;
      expect(isError).toBe(false);

      let index = 1;
      while (index < calledArguments.length) {
        expect(calledArguments[index]).toMatch(/\S+/);
        index++;
      }
    });

    it("returns error output if failed to start process", async () => {
      vi.mocked(isAllowed).mockReturnValue(true);
      vi.mocked(startBackgroundTask).mockImplementation(() => {
        throw new Error("start process failed");
      });
      const handler = handlers.get("aider_message_prompt")!;
      const result = await handler({ directory });
      expect(result).toBe(errorOutput);
    });

    it("checks the whitelist before running", async () => {
      vi.mocked(isAllowed).mockReturnValue(false);
      const handler = handlers.get("aider_message_prompt")!;
      const result = await handler({ directory });
      expect(result).toBe(denyOutput);
    });
  });
});
