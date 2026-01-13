# safe-shell

An MCP server that exposes a limited set of shell commands as tools.

## Tools

- **git_diff_from_main** - Shows current branch, diff stats from main, and full diff
- **run_tests** - Runs `npm run test`
- **run_lint** - Runs `npm run lint`

## Usage with Continue

```yaml
- name: safe-shell
  command: npx
  args:
    - "github:YourUsername/safe-shell"
```

## Usage with Claude Desktop

```json
{
  "mcpServers": {
    "safe-shell": {
      "command": "npx",
      "args": ["github:YourUsername/safe-shell"]
    }
  }
}
```

## Note

Commands run in the working directory where the MCP client spawns the server process.
