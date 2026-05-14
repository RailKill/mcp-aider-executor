# Project Information
stdio MCP server to run [aider](https://aider.chat/) as a detached background process
with basic git tools and status checks. This allows LLMs to start code editing processes freely and
check the `aider` chat history for progress at a later time to allow for agentic swarm behavior.

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


# Options
```
-h, --help              Display this message
--model <model>         Default LLM main model override
--editor-model <model>  Default secondary editor model override for architect mode
--add-message-notes     Appends aider-specific notes to message prompts (default: True)
--no-add-message-notes  Disables aider-specific notes to message prompts
--whitelist <path>      Only allow operations within the glob path
```


# Environment Prerequisites
The environment running the MCP server must have the following tools installed and available as executable
commands in the shell:
1. node
2. aider
3. git

> [!WARNING]
> You should set the number of parallel requests to 2 if you are using the same local endpoint for `aider`,
> otherwise your chat session and the background `aider` process will be stuck waiting for each other.
> You should also set the `OPENAI_API_KEY` environment variable to a non-empty value if you are using a local 
> OpenAI-compatible endpoint because `aider` requires it even if you don't use an API key.
> You still need the `openai/` prefix when specifying model names for local endpoints in `aider`.


# Available MCP Tools
These are the list of MCP tools available for your LLM to call.
