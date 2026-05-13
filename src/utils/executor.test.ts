import { describe, it, expect, vi } from "vitest";
import { type ChildProcess, spawn } from "child_process";
import { executeCommand, startBackgroundTask } from "./executor.js";
import { Readable } from "stream";

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
  it("should return stdout on successful execution", async () => {
    const mockProcess = createMockProcess({ stdout: "Working tree clean." });
    vi.mocked(spawn).mockReturnValue(mockProcess);

    const result = await executeCommand("git", ["status"], "~/something");
    expect(spawn).toHaveBeenCalledWith(
      "git",
      ["status"],
      expect.objectContaining({
        cwd: "~/something",
      })
    );
    expect(result.code).toBe(0);
    expect(result.stdout).toBe("Working tree clean.");
  });

  it("should return stderr on failed execution", async () => {
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
      })
    );
    expect(result.code).toBe(1);
    expect(result.stderr).toBe(errorMessage);
  });

  it("should reject with error if failed to start process", async () => {
    const errorMessage = "git: 'nonsense' is not a git command.";
    const mockProcess = createMockProcess({
      stderr: errorMessage,
      isError: true,
    });
    vi.mocked(spawn).mockReturnValue(mockProcess);

    await expect(executeCommand("git", ["nonsense"], "/")).rejects.toThrow(
      "spawn failed"
    );
  });

  it("should not spawn a detached process", async () => {
    const mockProcess = createMockProcess({ pid: 555 });
    vi.mocked(spawn).mockReturnValue(mockProcess);

    const result = await executeCommand("git", [], ".");
    expect(spawn).not.toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Array),
      expect.objectContaining({
        detached: expect.any(Boolean),
      })
    );
    expect(mockProcess.unref).not.toHaveBeenCalled();
    expect(result.code).not.toBe(555);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("");
  });

  it("should have the dumb terminal environment variable set", async () => {
    const mockProcess = createMockProcess({});
    vi.mocked(spawn).mockReturnValue(mockProcess);

    await executeCommand("whatever", ["dontcare"], "/wow");
    expect(spawn).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Array),
      expect.objectContaining({
        env: expect.objectContaining({ TERM: "dumb" }),
      })
    );
  });
});

describe("startBackgrondTask()", () => {
  it("should try to spawn child process with detached argument and unref child", () => {
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
      })
    );
  });

  it("should have the dumb terminal environment variable set", async () => {
    const mockProcess = createMockProcess({});
    vi.mocked(spawn).mockReturnValue(mockProcess);

    startBackgroundTask("aider", ["--help"], "~/");
    expect(spawn).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Array),
      expect.objectContaining({
        env: expect.objectContaining({ TERM: "dumb" }),
      })
    );
  });
});
