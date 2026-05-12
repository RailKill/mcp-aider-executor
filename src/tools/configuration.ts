import type { McpServer } from "@modelcontextprotocol/server";
import z from "zod";
import { getErrorOutput, getTextOutput } from "../utils/executor.js";
import {
  createNewFile,
  getRawFile,
  getValidDirectory,
  joinPaths,
} from "../utils/filesystem.js";
import yaml from "yaml";
import { getDeniedOutput, isAllowed } from "../utils/whitelist.js";

export const AIDER_CONF_FILENAME = ".aider.conf.yml";

// for security purposes, do not include API key settings! use env instead
export type AiderConfiguration = z.infer<typeof AiderConfigurationSchema>;
export const AiderConfigurationSchema = z.object({
  model: z
    .string()
    .optional()
    .describe("Specify the model to use for the main chat."),
  "openai-api-base": z
    .string()
    .optional()
    .describe("Specify the API base URL."),

  // model settings
  "model-settings-file": z
    .string()
    .optional()
    .describe("Specify a file with aider model settings for unknown models."),
  "model-metadata-file": z
    .string()
    .optional()
    .describe(
      "Specify a file with context window and costs for unknown models."
    ),
  alias: z
    .array(z.string())
    .optional()
    .describe(
      "List of shorthand names for models frequently used (e.g. 'fast:gpt-4o-mini')."
    ),
  "reasoning-effort": z
    .string()
    .optional()
    .describe("Set the reasoning_effort API parameter (default: not set)."),
  "thinking-tokens": z
    .number()
    .optional()
    .describe(
      "Set the thinking token budget for models that support it. Use 0 to disable. (default: not set)."
    ),
  "verify-ssl": z
    .boolean()
    .optional()
    .describe("Verify the SSL cert when connecting to models (default: True)."),
  timeout: z
    .number()
    .optional()
    .describe("Timeout in seconds for API calls (default: None)."),
  "edit-format": z
    .string()
    .optional()
    .describe(
      "Specify what edit format the LLM should use (default depends on model)."
    ),
  "weak-model": z
    .string()
    .optional()
    .describe(
      "Specify the model to use for commit messages and chat history summarization (default depends on --model)."
    ),
  "editor-model": z
    .string()
    .optional()
    .describe(
      "Specify the model to use for editor tasks (default depends on --model)."
    ),
  "editor-edit-format": z
    .string()
    .optional()
    .describe(
      "Specify the edit format for the editor model (default: depends on editor model)."
    ),
  "max-chat-history-tokens": z
    .number()
    .optional()
    .describe(
      "Soft limit on tokens for chat history, after which summarization begins. " +
        "If unspecified, defaults to the model's max_chat_history_tokens."
    ),

  // cache settings
  "cache-prompts": z
    .boolean()
    .optional()
    .describe("Enable caching of prompts (default: False)."),
  "cache-keepalive-pings": z
    .number()
    .optional()
    .describe(
      "Number of times to ping at 5min intervals to keep prompt cache warm (default: 0)."
    ),

  // repomap settings
  "map-tokens": z
    .number()
    .optional()
    .describe(
      "Suggested number of tokens to use for repo map, use 0 to disable."
    ),
  "map-refresh": z
    .enum(["auto", "always", "files", "manual"])
    .optional()
    .describe(
      "Control how often the repo map is refreshed. Options: auto, always, files, manual (default: auto)."
    ),
  "map-multiplier-no-files": z
    .number()
    .optional()
    .describe(
      "Multiplier for map tokens when no files are specified (default: 2)."
    ),

  // history settings
  "input-history-file": z
    .string()
    .optional()
    .describe(
      "Specify the chat input history file (default: .aider.input.history)."
    ),
  "chat-history-file": z
    .string()
    .optional()
    .describe(
      "Specify the chat history file (default: .aider.chat.history.md)."
    ),
  "restore-chat-history": z
    .boolean()
    .optional()
    .describe("Restore the previous chat history messages (default: False)."),
  "llm-history-file": z
    .string()
    .optional()
    .describe(
      "Log the conversation with the LLM to this file (for example, .aider.llm.history)."
    ),

  // git settings
  git: z
    .boolean()
    .optional()
    .describe("Enable/disable looking for a git repo (default: True)."),
  gitignore: z
    .boolean()
    .optional()
    .describe("Enable/disable adding .aider* to .gitignore (default: True)."),
  "add-gitignore-files": z
    .boolean()
    .optional()
    .describe(
      "Enable/disable the addition of files listed in .gitignore to Aider's editing scope."
    ),
  aiderignore: z
    .string()
    .optional()
    .describe(
      "Specify the aider ignore file (default: .aiderignore in git root)."
    ),
  "subtree-only": z
    .boolean()
    .optional()
    .describe(
      "Only consider files in the current subtree of the git repository."
    ),
  "auto-commits": z
    .boolean()
    .optional()
    .describe("Enable/disable auto commit of LLM changes (default: True)."),
  "dirty-commits": z
    .boolean()
    .optional()
    .describe(
      "Enable/disable commits when repo is found dirty (default: True)."
    ),
  "attribute-author": z
    .boolean()
    .optional()
    .describe(
      "Attribute aider code changes in the git author name (default: True). " +
        "If explicitly set to True, overrides --attribute-co-authored-by precedence."
    ),
  "attribute-committer": z
    .boolean()
    .optional()
    .describe(
      "Attribute aider commits in the git committer name (default: True). " +
        "If explicitly set to True, overrides --attribute-co-authored-by precedence for aider edits."
    ),
  "attribute-commit-message-author": z
    .boolean()
    .optional()
    .describe(
      "Prefix commit messages with 'aider: ' if aider authored the changes (default: False)."
    ),
  "attribute-commit-message-committer": z
    .boolean()
    .optional()
    .describe("Prefix all commit messages with 'aider: ' (default: False)."),
  "attribute-co-authored-by": z
    .boolean()
    .optional()
    .describe(
      "Attribute aider edits using the Co-authored-by trailer in the commit message (default: True). " +
        "If True, this takes precedence over default --attribute-author and --attribute-committer behavior " +
        "unless they are explicitly set to True."
    ),
  "git-commit-verify": z
    .boolean()
    .optional()
    .describe(
      "Enable/disable git pre-commit hooks with --no-verify (default: False)."
    ),
  "commit-prompt": z
    .string()
    .optional()
    .describe("Specify a custom prompt for generating commit messages."),
  "skip-sanity-check-repo": z
    .boolean()
    .optional()
    .describe("Skip the sanity check for the git repository (default: False)."),

  // fixing and committing
  lint: z
    .boolean()
    .optional()
    .describe("Lint and fix provided files, or dirty files if none provided."),
  "lint-cmd": z
    .array(z.string())
    .optional()
    .describe(
      "Specify lint commands to run for different languages, " +
        "eg: 'python: flake8 --select=...' (can be used multiple times)."
    ),
  "auto-lint": z
    .boolean()
    .optional()
    .describe(
      "Enable/disable automatic linting after changes (default: True)."
    ),
  "test-cmd": z.string().optional().describe("Specify command to run tests."),
  "auto-test": z
    .boolean()
    .optional()
    .describe(
      "Enable/disable automatic testing after changes (default: False)."
    ),

  // other settings
  "disable-playwright": z
    .boolean()
    .optional()
    .describe(
      "Never prompt for or attempt to install Playwright for web scraping (default: False)."
    ),
  "chat-language": z
    .string()
    .optional()
    .describe(
      "Specify the language to use in the chat (default: None, uses system settings)."
    ),
  "commit-language": z
    .string()
    .optional()
    .describe(
      "Specify the language to use in the commit message (default: None, user language)."
    ),
  verbose: z.boolean().optional().describe("Enable verbose output."),
});

export function registerConfigTools(server: McpServer, whitelist: string[]) {
  server.registerTool(
    "aider_setup_config_yaml",
    {
      description:
        `Creates or overwrites the ${AIDER_CONF_FILENAME} file in the directory. ` +
        "Do not fill in  the optional arguments if you intend to use Aider's default settings. " +
        "You cannot add API keys using this tool due to security concerns; " +
        "tell the user to add their keys manually in the environment instead.",
      inputSchema: z
        .object({
          directory: z
            .string()
            .describe("The absolute path to the git repository."),
        })
        .extend(AiderConfigurationSchema.shape),
    },
    async (parameters) => {
      if (!isAllowed(parameters.directory, whitelist)) {
        return getDeniedOutput(parameters.directory);
      }

      try {
        const workingDir = await getValidDirectory(parameters.directory);
        const cleanData: AiderConfiguration =
          AiderConfigurationSchema.parse(parameters);
        const yamlString = yaml.stringify(cleanData, {
          indent: 2,
          aliasDuplicateObjects: false,
        });

        const fullPath = joinPaths(workingDir, AIDER_CONF_FILENAME);
        await createNewFile(fullPath, yamlString);

        return getTextOutput(
          false,
          `Aider configuration successfully set up: ${fullPath}`
        );
      } catch (error) {
        return getErrorOutput(
          error,
          "Failed to setup Aider configuration YAML"
        );
      }
    }
  );

  server.registerTool(
    "aider_read_config_yaml",
    {
      description: `Reads the full contents of the ${AIDER_CONF_FILENAME} file in the directory.`,
      inputSchema: z.object({
        directory: z
          .string()
          .describe("The absolute path to the git repository."),
      }),
    },
    async ({ directory }) => {
      if (!isAllowed(directory, whitelist)) {
        return getDeniedOutput(directory);
      }

      try {
        const workingDir = await getValidDirectory(directory);
        const fullPath = joinPaths(workingDir, AIDER_CONF_FILENAME);
        const configData = getRawFile(fullPath);
        return getTextOutput(
          false,
          `Aider configuration successfully retrived from: ${fullPath}`,
          configData
        );
      } catch (error) {
        return getErrorOutput(
          error,
          "Failed to retrieve Aider configuration YAML"
        );
      }
    }
  );
}
