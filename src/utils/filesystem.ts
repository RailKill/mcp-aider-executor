import fs from "fs";
import path from "path";

export async function getValidDirectory(
  directory?: string,
  defaultDir?: string
): Promise<string> {
  const rawPath = directory || defaultDir || process.cwd();
  const resolvedPath = path.resolve(rawPath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Directory does not exist: ${resolvedPath}`);
  }

  const stats = fs.statSync(resolvedPath);
  if (!stats.isDirectory()) {
    throw new Error(`Path is not a directory: ${resolvedPath}`);
  }

  return resolvedPath;
}
