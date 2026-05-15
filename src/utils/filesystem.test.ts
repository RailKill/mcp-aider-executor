import { describe, it, expect, vi } from "vitest";
import fs from "fs";
import { writeFile } from "fs/promises";
import { Readable } from "stream";
import {
  createNewFile,
  getValidDirectory,
  getFileTail,
  getJSONFile,
  getRawFile,
  joinPaths,
  toPosixPath,
  DirectoryError,
} from "./filesystem.js";

vi.mock("fs", () => ({
  default: {
    existsSync: vi.fn(),
    statSync: vi.fn(),
    readFileSync: vi.fn(),
    createReadStream: vi.fn(),
  },
}));

vi.mock("fs/promises", () => ({
  writeFile: vi.fn(),
}));

describe("createNewFile()", () => {
  it("calls writeFile with correct arguments", async () => {
    await createNewFile("test.txt", "hello");
    expect(writeFile).toHaveBeenCalledWith("test.txt", "hello", "utf-8");
  });
});

describe("getValidDirectory()", () => {
  it("throws DirectoryError if path does not exist", async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    await expect(getValidDirectory("/none")).rejects.toThrow(DirectoryError);
  });

  it("returns resolved path if directory exists", async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.statSync).mockReturnValue({
      isDirectory: () => true,
    } as fs.Stats);

    const result = await getValidDirectory("./src");
    expect(result).toContain("/src");
  });

  it("throws DirectoryError if path is a file but not a directory", async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.statSync).mockReturnValue({
      isDirectory: () => false,
    } as fs.Stats);
    await expect(getValidDirectory("./some-file.txt")).rejects.toThrow(
      /not a directory/i,
    );
  });
});

describe("getFileTail()", () => {
  it("returns the last N lines of a file", async () => {
    const mockStream = Readable.from([
      "line1\n",
      "line2\n",
      "line3\n",
      "line4\n",
    ]);
    vi.mocked(fs.createReadStream).mockReturnValue(mockStream as fs.ReadStream);

    const result = await getFileTail("whatever.txt", 2);
    expect(result).toEqual(["line3", "line4"]);
  });
});

describe("getJSONFile()", () => {
  it("parses valid JSON contents into object", () => {
    vi.mocked(fs.readFileSync).mockReturnValue(
      '{"key": "value", "num-key": 88, "boolKey": true }',
    );

    expect(getJSONFile("good.json")).toEqual({
      key: "value",
      "num-key": 88,
      boolKey: true,
    });
  });

  it("returns empty object on error", () => {
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error();
    });

    expect(getJSONFile("bad.json")).toEqual({});
  });
});

describe("getRawFile()", () => {
  it("reads raw file content", () => {
    vi.mocked(fs.readFileSync).mockReturnValue("raw data");
    expect(getRawFile("some-file.txt")).toBe("raw data");
  });
});

describe("joinPaths()", () => {
  it("joins paths using POSIX style", () => {
    const result = joinPaths("folder", "subfolder", "file.txt");
    expect(result).toBe("folder/subfolder/file.txt");
  });

  it("converts Windows paths to POSIX during join", () => {
    const result = joinPaths("C:\\Documents\\", "Home Flow", "big bang.md");
    expect(result).toBe("C:/Documents/Home Flow/big bang.md");
  });
});

describe("toPosixPath()", () => {
  it("converts Windows backslashes to forward slashes", () => {
    expect(toPosixPath("C:\\Users\\Test")).toBe("C:/Users/Test");
  });

  it("converts double backslashes to single forward slashes", () => {
    expect(toPosixPath("C:\\\\Users\\\\Test")).toBe("C:/Users/Test");
  });

  it("leaves forward slash paths unchanged", () => {
    expect(toPosixPath("C:/Users/Test")).toBe("C:/Users/Test");
  });
});
