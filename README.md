# Project Information
stdio MCP server to run [aider](https://aider.chat/) as a detached background process
with basic [git](https://git-scm.com/) tools and status checks. This allows LLMs to start code editing processes
freely and check the `aider` chat history for progress at a later time to allow for agentic swarm behavior.

An `.aider.mcp.details.json` file is created in the same directory with the process ID and starting datetime.
The MCP server provides tools for LLM agents to check if the process is still running,
and to check the `.aider.chat.history.md` for updates.

The original message prompt send via the MCP server to `aider` is also recorded in `.aider.mcp.prompt.txt`.


# Quick Start
You can run the server directly using `npx`, passing in environment variables for the endpoint URL and API keys.
Provide `--whitelist` arguments with a permitted glob path otherwise all operations will be denied by default.

```json
{
  "mcpServers": {
    "mcp-aider-executor": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-aider-executor",
        "--whitelist",
        "/home/user/my-project/**",
        "--whitelist",
        "/local/my-application/**"
      ],
      "env": {
        "AIDER_MODEL": "openai/gemma-4-E4B-it-IQ4_XS",
        "OPENAI_API_BASE": "http://127.0.0.1:1337/v1",
        "OPENAI_API_KEY": "your-key-here"
      }
    }
  }
}
```

## Prompting
You can directly tell your LLM to use Aider by providing them with a directory to work in. For example:
```
Use Aider to create a simple Python hello world console application in "/home/my-project"
```

For extra Aider options, you should set it properly using environment variables (the `env` in MCP settings .json),
or ask your LLM to create the Aider YAML configuration file for you in the project directory. Some git and file
tools can be disabled using the options below if you prefer using another MCP server to handle those functions.

> [!CAUTION]
> 
> For security purposes, the MCP server does not have the functionality to write API keys into the configuration YAML.
> Use `env` instead to provide keys like `OPENAI_API_KEY`. Don't tell your LLM about it.


## Options
You can add these arguments in the `npx` command.

```
-h, --help                     Display this message
--model <model>                Default LLM main model override (i.e. always use this model no matter what)
--edit-format <format>         Main model edit format override, regardless of config or LLM inference
--architect                    Always run in architect mode (--no-architect for never)
--editor-model <model>         Default secondary editor model override for architect mode
--editor-edit-format <format>  Editor model's edit format override
--no-add-message-notes         Disables the adding of aider-specific notes to message prompts
--no-register-git-tools        Disables registration of all git tools for this server
--no-allow-git-edits           Disables only the git tools which modify the repo history
--no-register-file-tools       Disables registration of wide file access tools for this server
--whitelist <path>             Only allow operations within the glob path
```


## Environment Prerequisites
The environment running the MCP server must have the following tools installed and available as executable
commands in the shell:
1. node
2. aider
3. git

> [!WARNING]
>
> You should set the number of parallel requests to 2 if you are using the same local endpoint for `aider`,
> otherwise your chat session and the background `aider` process will be stuck waiting for each other.
> 
> You should also set the `OPENAI_API_KEY` environment variable to a non-empty value if you are using a local 
> OpenAI-compatible endpoint because `aider` requires it even if you don't use an API key.
> 
> You still need the `openai/` prefix when specifying model names for local endpoints in `aider`.


## Available MCP Tools
These are the list of MCP tools available for your LLM to call.

- `aider_check_git_log`: Checks recent commits.
- `aider_check_git_status`: Calls `git status --short` to check the state of the given directory.
- `aider_check_last_prompt`: Returns the original prompt message of the last Aider run.
- `aider_check_progress`: Checks the Aider chat history and background process status.
- `aider_checkout_git_branch`: Switches git branches, creating a new one if it doesn't exist.
- `aider_create_git_stash`: Stashes everything to clear the directory for Aider (`git stash -u`).
- `aider_git_revert`: Reverts changes from a git commit by its hash.
- `aider_list_files`: Lists all files in a given directory.
- `aider_list_git_branches`: Returns a list of git branches in the given directory.
- `aider_mcp_check_whitelist`: Checks what glob paths are whitelisted for this Aider MCP server.
- `aider_message_prompt`: Starts `aider` as a background process with a given message prompt.
- `aider_read_config_yaml`: Returns the full content of the .aider.conf.yml in the directory.
- `aider_read_file_contents`: Reads the contents of a given filepath.
- `aider_setup_config_yaml`: Creates the .aider.conf.yml file in the directory.