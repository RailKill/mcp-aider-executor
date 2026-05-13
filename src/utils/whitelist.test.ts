import { describe, it, expect, vi } from "vitest";
import { isAllowed, getDeniedOutput } from "./whitelist.js";
import { getTextOutput } from "./executor.js";
import { toPosixPath } from "./filesystem.js";

vi.mock("./executor.js", () => ({
  getTextOutput: vi.fn(),
}));

vi.mock("./filesystem.js", () => ({
  toPosixPath: vi.fn((p) => p),
}));

describe("isAllowed()", () => {
  const whitelist = ["/home/**/*.ts", "C:/Users/**/*.js"];

  it("returns true when the POSIX path matches the whitelist", () => {
    const path = "/home/handsome/quality work/best.ts";
    const result = isAllowed(path, whitelist);
    expect(toPosixPath).toHaveBeenCalledWith(path);
    expect(result).toBe(true);
  });

  it("returns true when the Windows path matches the whitelist", () => {
    const path = "C:/Users/Beauty/Awake or Sleep/storybook.js";
    const result = isAllowed(path, whitelist);
    expect(toPosixPath).toHaveBeenCalledWith(path);
    expect(result).toBe(true);
  });

  it("returns false when path does not match the whitelist", () => {
    const result = isAllowed("hello/world.txt", whitelist);
    expect(result).toBe(false);
  });
});

describe("getDeniedOutput()", () => {
  it("returns getTextOutput with error and instruction strings", () => {
    const testPath = "/some/weird/path";
    getDeniedOutput(testPath);
    expect(getTextOutput).toHaveBeenCalledWith(
      true,
      expect.stringContaining(`${testPath}`),
      expect.any(String),
      expect.any(String)
    );
  });
});
