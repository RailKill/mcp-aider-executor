import { writeFile } from "fs/promises";
import fs from "fs";
import path from "path";
import readline from "readline";

export class DirectoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DirectoryError";
  }
}

export async function createNewFile(path: string, content: string = "") {
  await writeFile(path, content, "utf-8");
}

export async function getValidDirectory(directory: string): Promise<string> {
  const resolvedPath = path.resolve(directory);

  if (!fs.existsSync(resolvedPath)) {
    throw new DirectoryError(`Directory does not exist: ${resolvedPath}`);
  }

  const stats = fs.statSync(resolvedPath);
  if (!stats.isDirectory()) {
    throw new DirectoryError(`Path is not a directory: ${resolvedPath}`);
  }

  return resolvedPath;
}

export async function getFileTail(
  filePath: string,
  lineCount: number
): Promise<string[]> {
  const stream = fs.createReadStream(filePath);
  const readInterface = readline.createInterface({
    input: stream,
    terminal: false,
  });

  const lines: string[] = [];
  for await (const line of readInterface) {
    lines.push(line);
    if (lines.length > lineCount) {
      lines.shift();
    }
  }
  return lines;
}

export function getJSONFile(path: string) {
  try {
    const rawData = fs.readFileSync(path, "utf-8");
    return JSON.parse(rawData);
  } catch {
    return {};
  }
}

export function joinPaths(...paths: string[]): string {
  return path.join(...paths);
}
