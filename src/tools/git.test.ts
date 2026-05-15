// src/tools/git.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/server";
import { registerGitTools } from "./git.js";
import { getDeniedOutput, isAllowed } from "../utils/whitelist.js";
import { getValidDirectory } from "../utils/filesystem.js";
import {
  getErrorOutput,
  runCommandWithStandardizedOutput,
} from "../utils/executor.js";
import {
  createDenyOutput,
  createErrorOutput,
  createMockServer,
  type McpFunction,
} from "./test-utils.js";

vi.mock("../utils/executor");
vi.mock("../utils/filesystem");
vi.mock("../utils/whitelist");

function expectGenericRunCommandCall(
  command: string,
  args: (string | unknown)[],
  cwd: string,
  hasDefaultSuccessMessage: boolean = false,
) {
  const runArguments = [command, args, cwd, expect.stringMatching(/\S+/)];
  if (hasDefaultSuccessMessage) {
    runArguments.push(expect.stringMatching(/\S+/));
  }
  expect(runCommandWithStandardizedOutput).toHaveBeenCalledWith(
    ...runArguments,
  );
}

function expectGenericErrorOutputCall() {
  expect(getErrorOutput).toHaveBeenCalledWith(
    expect.any(Error),
    expect.stringMatching(/failed/i),
  );
}

describe("git mcp tools", () => {
  let mockServer: McpServer;
  let handlers: Map<string, McpFunction>;
  const directory = "/git-tool";
  const denyOutput = createDenyOutput();
  const errorMessage = "unit test simulated error message";
  const errorOutput = createErrorOutput();

  beforeEach(() => {
    vi.mocked(getValidDirectory).mockResolvedValue(directory);
    vi.mocked(getErrorOutput).mockReturnValue(errorOutput);
    vi.mocked(getDeniedOutput).mockReturnValue(denyOutput);
    const mockResults = createMockServer();
    mockServer = mockResults.mockServer;
    handlers = mockResults.handlers;
    registerGitTools(mockServer, [], true);
  });

  describe("aider_check_git_status", () => {
    it("calls the git status command", async () => {
      vi.mocked(isAllowed).mockReturnValue(true);

      const handler = handlers.get("aider_check_git_status")!;
      await handler({ directory });
      expectGenericRunCommandCall(
        "git",
        expect.arrayContaining(["status"]),
        directory,
        true,
      );
      expect(getErrorOutput).not.toHaveBeenCalled();
    });

    it("returns error output if failed to start command", async () => {
      vi.mocked(isAllowed).mockReturnValue(true);
      vi.mocked(runCommandWithStandardizedOutput).mockImplementation(() => {
        throw new Error(errorMessage);
      });

      const handler = handlers.get("aider_check_git_status")!;
      const result = await handler({ directory });
      expectGenericRunCommandCall(
        "git",
        expect.arrayContaining(["status"]),
        directory,
        true,
      );
      expectGenericErrorOutputCall();
      expect(result).toBe(errorOutput);
    });

    it("checks the whitelist before running", async () => {
      vi.mocked(isAllowed).mockReturnValue(false);
      const handler = handlers.get("aider_check_git_status")!;
      const result = await handler({ directory });
      expect(result).toBe(denyOutput);
      expect(runCommandWithStandardizedOutput).not.toHaveBeenCalled();
    });
  });

  describe("aider_checkout_git_branch", () => {
    const branch = "test-branch";

    it("calls the git checkout command when switching branches", async () => {
      vi.mocked(isAllowed).mockReturnValue(true);

      const handler = handlers.get("aider_checkout_git_branch")!;
      await handler({ directory, branch, create: false });
      expectGenericRunCommandCall("git", ["checkout", branch], directory, true);
      expect(getErrorOutput).not.toHaveBeenCalled();
    });

    it("calls git checkout with -b flag when creating a new branch", async () => {
      vi.mocked(isAllowed).mockReturnValue(true);

      const handler = handlers.get("aider_checkout_git_branch")!;
      await handler({ directory, branch, create: true });
      expectGenericRunCommandCall(
        "git",
        ["checkout", "-b", branch],
        directory,
        true,
      );
      expect(getErrorOutput).not.toHaveBeenCalled();
    });

    it("returns error output if failed to start command", async () => {
      vi.mocked(isAllowed).mockReturnValue(true);
      vi.mocked(runCommandWithStandardizedOutput).mockImplementation(() => {
        throw new Error(errorMessage);
      });

      const handler = handlers.get("aider_checkout_git_branch")!;
      const result = await handler({ directory });
      expectGenericRunCommandCall(
        "git",
        expect.arrayContaining(["checkout"]),
        directory,
        true,
      );
      expectGenericErrorOutputCall();
      expect(result).toBe(errorOutput);
    });

    it("checks the whitelist before running", async () => {
      vi.mocked(isAllowed).mockReturnValue(false);
      const handler = handlers.get("aider_checkout_git_branch")!;
      const result = await handler({ directory });
      expect(result).toBe(denyOutput);
      expect(runCommandWithStandardizedOutput).not.toHaveBeenCalled();
    });
  });

  describe("aider_list_git_branches", () => {
    it("calls the git branch command", async () => {
      vi.mocked(isAllowed).mockReturnValue(true);

      const handler = handlers.get("aider_list_git_branches")!;
      await handler({ directory });
      expectGenericRunCommandCall(
        "git",
        expect.arrayContaining(["branch"]),
        directory,
      );
      expect(getErrorOutput).not.toHaveBeenCalled();
    });

    it("returns error output if failed to start command", async () => {
      vi.mocked(isAllowed).mockReturnValue(true);
      vi.mocked(runCommandWithStandardizedOutput).mockImplementation(() => {
        throw new Error(errorMessage);
      });

      const handler = handlers.get("aider_list_git_branches")!;
      const result = await handler({ directory });
      expectGenericRunCommandCall(
        "git",
        expect.arrayContaining(["branch"]),
        directory,
      );
      expectGenericErrorOutputCall();
      expect(result).toBe(errorOutput);
    });

    it("checks the whitelist before running", async () => {
      vi.mocked(isAllowed).mockReturnValue(false);
      const handler = handlers.get("aider_list_git_branches")!;
      const result = await handler({ directory });
      expect(result).toBe(denyOutput);
      expect(runCommandWithStandardizedOutput).not.toHaveBeenCalled();
    });
  });

  describe("aider_create_git_stash", () => {
    it("calls the git stash command", async () => {
      vi.mocked(isAllowed).mockReturnValue(true);

      const handler = handlers.get("aider_create_git_stash")!;
      await handler({ directory });
      expectGenericRunCommandCall("git", ["stash", "-u"], directory);
      expect(getErrorOutput).not.toHaveBeenCalled();
    });

    it("returns error output if failed to start command", async () => {
      vi.mocked(isAllowed).mockReturnValue(true);
      vi.mocked(runCommandWithStandardizedOutput).mockImplementation(() => {
        throw new Error(errorMessage);
      });

      const handler = handlers.get("aider_create_git_stash")!;
      const result = await handler({ directory });
      expectGenericRunCommandCall("git", ["stash", "-u"], directory);
      expectGenericErrorOutputCall();
      expect(result).toBe(errorOutput);
    });

    it("checks the whitelist before running", async () => {
      vi.mocked(isAllowed).mockReturnValue(false);
      const handler = handlers.get("aider_create_git_stash")!;
      const result = await handler({ directory });
      expect(result).toBe(denyOutput);
      expect(runCommandWithStandardizedOutput).not.toHaveBeenCalled();
    });
  });

  describe("aider_check_git_log", () => {
    it("calls the git stash command", async () => {
      vi.mocked(isAllowed).mockReturnValue(true);

      const handler = handlers.get("aider_check_git_log")!;
      await handler({ directory, count: 21 });
      expectGenericRunCommandCall(
        "git",
        expect.arrayContaining(["log", "-n", "21"]),
        directory,
      );
      expect(getErrorOutput).not.toHaveBeenCalled();
    });

    it("returns error output if failed to start command", async () => {
      vi.mocked(isAllowed).mockReturnValue(true);
      vi.mocked(runCommandWithStandardizedOutput).mockImplementation(() => {
        throw new Error(errorMessage);
      });

      const handler = handlers.get("aider_check_git_log")!;
      const result = await handler({ directory, count: 17 });
      expectGenericRunCommandCall(
        "git",
        expect.arrayContaining(["log", "-n", "17"]),
        directory,
      );
      expectGenericErrorOutputCall();
      expect(result).toBe(errorOutput);
    });

    it("checks the whitelist before running", async () => {
      vi.mocked(isAllowed).mockReturnValue(false);
      const handler = handlers.get("aider_check_git_log")!;
      const result = await handler({ directory });
      expect(result).toBe(denyOutput);
      expect(runCommandWithStandardizedOutput).not.toHaveBeenCalled();
    });
  });

  describe("aider_git_revert", () => {
    it("doesn't exist in the tool registry if user disallows edits", async () => {
      handlers.clear();
      registerGitTools(mockServer, [], false);
      expect(handlers.has("aider_git_revert")).toBe(false);
    });

    it("calls git revert on a given commit hash", async () => {
      vi.mocked(isAllowed).mockReturnValue(true);
      const testHash = "dd18e6b922f40d4f5f1fd4d6b0ff8e1db15ab72d";

      const handler = handlers.get("aider_git_revert")!;
      await handler({
        directory,
        commitHash: testHash,
      });
      expectGenericRunCommandCall(
        "git",
        expect.arrayContaining(["revert", testHash, "--no-edit"]),
        directory,
      );
      expect(getErrorOutput).not.toHaveBeenCalled();
    });

    it("returns error output if failed to call command", async () => {
      vi.mocked(isAllowed).mockReturnValue(true);
      vi.mocked(runCommandWithStandardizedOutput).mockImplementation(() => {
        throw new Error(errorMessage);
      });

      const handler = handlers.get("aider_git_revert")!;
      const result = await handler({ directory, commitHash: "HEAD" });
      expectGenericRunCommandCall(
        "git",
        expect.arrayContaining(["revert", "HEAD", "--no-edit"]),
        directory,
      );
      expectGenericErrorOutputCall();
      expect(result).toBe(errorOutput);
    });

    it("checks the whitelist before running", async () => {
      vi.mocked(isAllowed).mockReturnValue(false);
      const handler = handlers.get("aider_git_revert")!;
      const result = await handler({ directory });
      expect(result).toBe(denyOutput);
      expect(runCommandWithStandardizedOutput).not.toHaveBeenCalled();
    });
  });
});
