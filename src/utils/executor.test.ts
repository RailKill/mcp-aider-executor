import { describe, it, expect, vi } from "vitest";
import { type ChildProcess, spawn } from "child_process";
import {
  executeCommand,
  getErrorOutput,
  getTextOutput,
  runCommandWithStandardizedOutput,
  startBackgroundTask,
} from "./executor.js";
import { Readable } from "stream";
import type { CallToolResult } from "@modelcontextprotocol/server";

// mock spawn so it doesn't actually create processes
vi.mock("child_process", () => ({
  spawn: vi.fn(),
}));

// helper function to create mock child process
export function createMockProcess(overrides: {
  pid?: number;
  code?: number | null;
  stdout?: string;
  stderr?: string;
  isError?: boolean;
}) {
  // use real stream instances for .on() and .push() methods
  const mockStdout = new Readable({ read() {} });
  const mockStderr = new Readable({ read() {} });
  const {
    pid = 123,
    code = 0,
    stdout = "",
    stderr = "",
    isError = false,
  } = overrides;

  const mockProcess = {
    pid,
    stdout: mockStdout,
    stderr: mockStderr,
    unref: vi.fn(),
    on: vi.fn((event: string, callback) => {
      // delay to ensure stdout/stderr data be processed
      if (event === "close" && !isError) {
        setImmediate(() => callback(code));
      }
      if (event === "error" && isError) {
        setImmediate(() => callback(new Error("spawn failed")));
      }
      return mockProcess;
    }),
  } as unknown as ChildProcess;

  // pre-fill the stream with mock data if provided
  if (stdout) {
    mockStdout.push(stdout);
    mockStdout.push(null);
  }
  if (stderr) {
    mockStderr.push(stderr);
    mockStderr.push(null);
  }

  return mockProcess;
}

describe("executeCommand()", () => {
  it("returns stdout on successful execution", async () => {
    const mockProcess = createMockProcess({ stdout: "Working tree clean." });
    vi.mocked(spawn).mockReturnValue(mockProcess);

    const result = await executeCommand("git", ["status"], "~/something");
    expect(spawn).toHaveBeenCalledWith(
      "git",
      ["status"],
      expect.objectContaining({
        cwd: "~/something",
      }),
    );
    expect(result.code).toBe(0);
    expect(result.stdout).toBe("Working tree clean.");
  });

  it("returns stderr on failed execution", async () => {
    const errorMessage = "git: failed to commit";
    const mockProcess = createMockProcess({
      code: 1,
      stderr: errorMessage,
    });
    vi.mocked(spawn).mockReturnValue(mockProcess);

    const result = await executeCommand("git", ["commit", "-m", "wee"], ".");
    expect(spawn).toHaveBeenCalledWith(
      "git",
      ["commit", "-m", "wee"],
      expect.objectContaining({
        cwd: ".",
      }),
    );
    expect(result.code).toBe(1);
    expect(result.stderr).toBe(errorMessage);
  });

  it("rejects with error if failed to start process", async () => {
    const errorMessage = "git command not found.";
    const mockProcess = createMockProcess({
      stderr: errorMessage,
      isError: true,
    });
    vi.mocked(spawn).mockReturnValue(mockProcess);

    await expect(executeCommand("git", ["nonsense"], "/")).rejects.toThrow(
      "spawn failed",
    );
  });

  it("does not spawn a detached process", async () => {
    const mockProcess = createMockProcess({ pid: 555 });
    vi.mocked(spawn).mockReturnValue(mockProcess);

    const result = await executeCommand("git", [], ".");
    expect(spawn).not.toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Array),
      expect.objectContaining({
        detached: expect.any(Boolean),
      }),
    );
    expect(mockProcess.unref).not.toHaveBeenCalled();
    expect(result.code).not.toBe(555);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("");
  });

  it("has the dumb terminal environment variable set", async () => {
    const mockProcess = createMockProcess({});
    vi.mocked(spawn).mockReturnValue(mockProcess);

    await executeCommand("whatever", ["dontcare"], "/wow");
    expect(spawn).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Array),
      expect.objectContaining({
        env: expect.objectContaining({ TERM: "dumb" }),
      }),
    );
  });
});

describe("getErrorOutput", () => {
  it("outputs the message from an Error object", () => {
    const message = "This is a unit test error message!";
    const error = new Error(message);
    const result: CallToolResult = getErrorOutput(error, "Hello?");
    expect(result.isError).toBe(true);
    expect(result.content[1]).toStrictEqual({
      type: "text",
      text: message,
    });
  });

  it("handles non-Error types", () => {
    const result = getErrorOutput("some string", "who cares");
    expect(result.content[1]).toStrictEqual({
      type: "text",
      text: "some string",
    });
  });
});

describe("getTextOutput", () => {
  it("formats and returns a successful output if not set as error", () => {
    const result = getTextOutput(false, "Success!");
    expect(result).toStrictEqual({
      content: [{ type: "text", text: "Success!" }],
    });
    expect(result.isError).toBeUndefined();
  });

  it("formats and returns an error output if set as error", () => {
    const result = getTextOutput(true, "FAIL");
    expect(result).toStrictEqual({
      isError: true,
      content: [{ type: "text", text: "FAIL" }],
    });
  });

  it("handles multiple text outputs", () => {
    const result = getTextOutput(
      false,
      "number one",
      "some_other info> 123",
      "third time's the #charm",
    );
    expect(result).toStrictEqual({
      content: [
        { type: "text", text: "number one" },
        { type: "text", text: "some_other info> 123" },
        { type: "text", text: "third time's the #charm" },
      ],
    });
  });

  it("returns a default error output if no arguments are provided", () => {
    const result = getTextOutput();
    const output = result.content[0];

    expect(result.isError).toBe(true);
    expect(output).toEqual({
      type: "text",
      text: expect.stringMatching(/error/i),
    });
  });
});

describe("runCommandWithStandardizedOutput", () => {
  it("returns successful output when code is 0", async () => {
    const mockProcess = createMockProcess({
      code: 0,
      stdout: "some standard output",
      stderr: "error error",
    });
    vi.mocked(spawn).mockReturnValue(mockProcess);

    const result = await runCommandWithStandardizedOutput(
      "git",
      ["status"],
      "/home",
      "failure message",
      "default success message",
    );

    expect(result).toEqual({
      content: [{ type: "text", text: "some standard output" }],
    });
  });

  it("returns output with default success message if stdout is empty", async () => {
    const mockProcess = createMockProcess({});
    vi.mocked(spawn).mockReturnValue(mockProcess);

    const successMessage = "Default: Test checkout successful!";
    const result = await runCommandWithStandardizedOutput(
      "git",
      ["checkout"],
      "/yoyo",
      "fail",
      successMessage,
    );

    expect(result).toEqual({
      content: [{ type: "text", text: successMessage }],
    });
  });

  it("returns error output with code and stderr when code is not zero", async () => {
    const commandError = "fatal error: boohoo";
    const mockProcess = createMockProcess({
      code: 1337,
      stderr: commandError,
    });
    vi.mocked(spawn).mockReturnValue(mockProcess);
    const mainError = "Operation failed!";

    const result = await runCommandWithStandardizedOutput(
      "git",
      ["status"],
      "/boom",
      mainError,
    );

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      { type: "text", text: mainError + " (code: 1337)" },
      { type: "text", text: commandError },
    ]);
  });
});

describe("startBackgrondTask()", () => {
  it("spawns a child process with detached argument and unref child", () => {
    const mockProcess = createMockProcess({ pid: 42069 });
    vi.mocked(spawn).mockReturnValue(mockProcess);

    const pid = startBackgroundTask("aider", ["--version"], "/tmp");
    expect(pid).toBe(42069);
    expect(mockProcess.unref).toHaveBeenCalled();
    expect(spawn).toHaveBeenCalledWith(
      "aider",
      ["--version"],
      expect.objectContaining({
        cwd: "/tmp",
        detached: true,
        env: expect.objectContaining({ TERM: "dumb" }),
      }),
    );
  });

  it("has the dumb terminal environment variable set", async () => {
    const mockProcess = createMockProcess({});
    vi.mocked(spawn).mockReturnValue(mockProcess);

    startBackgroundTask("aider", ["--help"], "~/");
    expect(spawn).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Array),
      expect.objectContaining({
        env: expect.objectContaining({ TERM: "dumb" }),
      }),
    );
  });
});
