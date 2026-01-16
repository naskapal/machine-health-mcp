# Machine Health MCP Server

A Model Context Protocol (MCP) server for inspecting overall machine health, process snapshots, dmesg logs, and systemd journal logs. Provides comprehensive system monitoring capabilities.

## Features

- **System Health Metrics**: CPU, memory, disk, network, uptime, and load average
- **Process Monitoring**: List and filter running processes with customizable sorting
- **Kernel Logs**: Retrieve dmesg kernel messages with filtering
- **Systemd Logs**: Access systemctl/journalctl logs with various filters
- **Comprehensive Reports**: Generate detailed system health reports at a glance

## Installation

```bash
npm install
```

## Build

```bash
npm run build
```

## Usage

### Development Mode

```bash
npm run dev
```

### Production Mode

```bash
npm run build
npm start
```

## MCP Configuration

Add this server to your MCP client configuration:

```json
{
  "mcpServers": {
    "machine-health": {
      "command": "node",
      "args": ["/path/to/machine-health-mcp/dist/index.js"]
    }
  }
}
```

## Available Tools

### 1. get_machine_health

Retrieves overall machine health metrics including:
- CPU usage (overall & core count)
- Memory usage (total, used, free, percentage)
- Swap usage
- Disk usage for all mount points
- Network statistics (interfaces, bytes, packets, errors)
- System uptime and formatted duration
- Load averages (1, 5, 15 minutes)

**Parameters**: None

**Example Response**:
```json
{
  "cpu": { "cores": 8, "usagePercent": "45.2" },
  "memory": { "totalGB": "16.00", "usedGB": "8.50", "freeGB": "7.50", "usagePercent": "53.12" },
  "swap": { "totalGB": "8.00", "usedGB": "0.50", "usagePercent": "6.25" },
  "uptime": { "days": 5, "hours": 12, "minutes": 30, "formatted": "5d 12h 30m" },
  "loadAverage": "1.25 1.15 1.05"
}
```

### 2. get_processes

Get information about running processes with filtering and sorting.

**Parameters**:
- `limit` (optional, number): Maximum processes to return (default: all)
- `sortBy` (optional): Sort field - 'cpu' | 'memory' | 'pid' | 'name' (default: 'cpu')
- `filterBy` (optional, string): Filter by process name (substring match)
- `user` (optional, string): Filter by username

**Example Usage**:
- Get top 10 processes by CPU: `limit: 10, sortBy: "cpu"`
- Get processes matching "nginx": `filterBy: "nginx"`
- Get all processes for user "www-data": `user: "www-data"`

### 3. get_dmesg_logs

Retrieve kernel ring buffer messages from dmesg.

**Parameters**:
- `lines` (optional, number): Number of recent lines (default: 100)
- `level` (optional): Filter by log level - 'all' | 'emerg' | 'alert' | 'crit' | 'err' | 'warning' | 'notice' | 'info' | 'debug' (default: 'all')

**Example Usage**:
- Get last 50 kernel messages: `lines: 50`
- Get only error-level messages: `level: "err"`

### 4. get_systemctl_logs

Access systemd journal logs.

**Parameters**:
- `unit` (optional, string): Specific systemd unit name
- `lines` (optional, number): Number of lines (default: 100)
- `since` (optional, string): Timestamp filter (e.g., '1 hour ago', '2024-01-01 00:00:00')
- `level` (optional): Log level - 'emerg' | 'alert' | 'crit' | 'err' | 'warning' | 'notice' | 'info' | 'debug' | 'all' (default: 'all')

**Example Usage**:
- Get last 100 system logs: `lines: 100`
- Get nginx service logs: `unit: "nginx"`
- Get logs from last hour: `since: "1 hour ago"`

### 5. get_system_report

Generate comprehensive system health report aggregating all monitoring data.

**Parameters**:
- `includeLogs` (optional, boolean): Include log data (default: true)
- `logLines` (optional, number): Log lines per source (default: 50)
- `includeProcesses` (optional, boolean): Include process info (default: true)
- `processLimit` (optional, number): Top processes to include (default: 10)

**Example Response**:
```json
{
  "timestamp": "2024-01-16T10:30:00.000Z",
  "hostname": "server01",
  "kernel": "5.15.0-91-generic",
  "os": "Ubuntu 22.04.3 LTS",
  "cpu": { "cores": 8, "usagePercent": "45.2" },
  "memory": { "totalGB": "16.00", "usedGB": "8.50", "usagePercent": "53.12" },
  "uptime": { "days": 5, "hours": 12, "minutes": 30 },
  "loadAverage": { "1min": "1.25", "5min": "1.15", "15min": "1.05" },
  "disk": [...],
  "topProcesses": [...],
  "dmesgLogs": { "count": 50, "recentEntries": [...] },
  "systemctlLogs": { "count": 50, "recentEntries": [...] },
  "healthStatus": ["System healthy"]
}
```

## Permissions

This MCP server requires the following permissions:
- Read access to `/proc` filesystem
- Execution of system commands (`top`, `free`, `df`, `dmesg`, `journalctl`, `ps`, `hostname`, `uname`)
- For `journalctl` access, ensure the user has appropriate permissions (may require sudo for some logs)

## Error Handling

The server includes comprehensive error handling:
- Graceful handling of missing permissions
- Clear error messages for failed commands
- Partial data recovery when some commands fail

## Testing with MCP Inspector

To test the server with the MCP Inspector:

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

## Development

- TypeScript with strict type checking
- Zod schemas for input validation
- Structured JSON responses
- Comprehensive error handling

## License

MIT
