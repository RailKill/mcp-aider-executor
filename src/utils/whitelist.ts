import pm from "picomatch";
import { getTextOutput } from "./executor.js";
import { toPosixPath } from "./filesystem.js";

export function isAllowed(path: string, whitelist: string[]) {
  return pm.isMatch(toPosixPath(path), whitelist, { dot: true, unixify: true });
}

export function getDeniedOutput(path: string) {
  return getTextOutput(
    true,
    `Access denied. ${path} is not allowed in the Aider MCP server whitelist.`,
    "Tell the user to add the glob path using the '--whitelist <path>' command line argument " +
      `to the Aider MCP server.`,
    "No Aider operations are allowed until the directory is whitelisted."
  );
}
