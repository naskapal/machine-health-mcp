# Example MCP Client Configuration

## OpenCode

Add to `~/.config/opencode/opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "machine-health": {
      "type": "local",
      "command": ["node", "/home/naskun/machine-health-mcp/dist/index.js"],
      "enabled": true
    }
  }
}
```

To use the tools, add `use machine-health` to your prompts:

```
Get system health metrics. use machine-health
```

See [OpenCode MCP Documentation](https://opencode.ai/docs/mcp-servers/) for more details.

## Claude Desktop / Claude Code

Add to your MCP client configuration file:

```json
{
  "mcpServers": {
    "machine-health": {
      "command": "node",
      "args": ["/home/naskun/machine-health-mcp/dist/index.js"]
    }
  }
}
```

On macOS, config file is at:
`~/Library/Application Support/Claude/claude_desktop_config.json`

On Linux, config file is at:
`~/.config/Claude/claude_desktop_config.json`

## MCP Inspector

To test the server with MCP Inspector:

```bash
cd /home/naskun/machine-health-mcp
npx @modelcontextprotocol/inspector node dist/index.js
```

Or use the dev script:

```bash
npm run dev
```

Then in another terminal:

```bash
npx @modelcontextprotocol/inspector
```

## Available Tools

Once connected, you can use these tools:

1. **get_machine_health** - Get overall system metrics
2. **get_processes** - List and filter running processes
3. **get_dmesg_logs** - Get kernel ring buffer messages
4. **get_systemctl_logs** - Get systemd journal logs
5. **get_system_report** - Generate comprehensive system health report

## Example Usage in OpenCode

```
Get system health metrics. use machine-health
```

```
Show me top 10 processes by CPU usage. use machine-health
```

```
Get last 50 kernel error messages. use machine-health
```

```
Generate a comprehensive system report. use machine-health
```

```
Get nginx service logs from last hour. use machine-health
```

## Example Usage in Claude

```
Get machine health metrics
```

```
Show me top 10 processes by CPU usage
```

```
Get the last 50 kernel error messages
```

```
Generate a comprehensive system report
```

```
Get nginx service logs from the last hour
```
Get the machine health metrics
```

```
Show me the top 10 processes by CPU usage
```

```
Get the last 50 kernel error messages
```

```
Generate a comprehensive system report
```

```
Get nginx service logs from the last hour
```

## Troubleshooting

If you encounter permission errors:

1. Ensure the user running the MCP server has permissions to read /proc
2. For journalctl access, add the user to the systemd-journal group:
   ```bash
   sudo usermod -a -G systemd-journal $USER
   ```
3. Some logs may require sudo; the server will handle this gracefully

## Testing Individual Tools

You can test individual commands without running the full MCP server:

```bash
# Test machine health commands
grep -c '^processor' /proc/cpuinfo
free -h
df -h

# Test dmesg
dmesg -T -n 10

# Test journalctl
journalctl -n 10 --no-pager

# Test processes
ps aux --sort=-pcpu | head -n 10
```
