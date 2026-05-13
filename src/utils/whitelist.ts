import pm from "picomatch";
import { getTextOutput } from "./executor.js";
import { APPLICATION_NAME } from "../index.js";
import { toPosixPath } from "./filesystem.js";

export function isAllowed(path: string, whitelist: string[]) {
  return pm.isMatch(toPosixPath(path), whitelist);
}

export function getDeniedOutput(path: string) {
  return getTextOutput(
    true,
    `Access denied. ${path} is not allowed in the ${APPLICATION_NAME} MCP server whitelist.`,
    "Tell the user to add the glob path using the '--whitelist <path>' command line argument " +
      `to the ${APPLICATION_NAME} MCP server.`,
    "No Aider operations are allowed until the directory is whitelisted."
  );
}
