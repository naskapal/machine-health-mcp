#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "machine-health-mcp",
  version: "1.0.0",
});

function execCommand(cmd: string): string {
  try {
    const { execSync } = require("child_process");
    return execSync(cmd, { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 });
  } catch (error: any) {
    if (error.stdout) return error.stdout.toString();
    if (error.stderr) return error.stderr.toString();
    throw new Error(`Command failed: ${error.message}`);
  }
}

server.tool(
  "get_machine_health",
  "Get overall machine health metrics including CPU, memory, disk, network, uptime, and load average",
  {},
  async () => {
    try {
      const cpuInfo = execCommand("grep -c '^processor' /proc/cpuinfo").trim();
      const cpuUsage = execCommand("top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | cut -d'%' -f1").trim();
      const memInfo = execCommand("free -b | grep Mem").trim();
      const [, , totalMem, usedMem, freeMem] = memInfo.split(/\s+/);
      const swapInfo = execCommand("free -b | grep Swap").trim();
      const [, , totalSwap, usedSwap] = swapInfo.split(/\s+/);
      const diskInfo = execCommand("df -B1 | tail -n +2").trim();
      const netInfo = execCommand("cat /proc/net/dev | tail -n +3").trim();
      const uptime = execCommand("cat /proc/uptime").trim().split(" ")[0];
      const loadAvg = execCommand("cat /proc/loadavg").trim().split(" ").slice(0, 3).join(" ");

      const memTotalGB = (parseInt(totalMem) / 1024 / 1024 / 1024).toFixed(2);
      const memUsedGB = (parseInt(usedMem) / 1024 / 1024 / 1024).toFixed(2);
      const memFreeGB = (parseInt(freeMem) / 1024 / 1024 / 1024).toFixed(2);
      const memPercent = ((parseInt(usedMem) / parseInt(totalMem)) * 100).toFixed(2);

      let swapTotalGB = "0.00";
      let swapUsedGB = "0.00";
      let swapPercent = "0.00";
      if (totalSwap && parseInt(totalSwap) > 0) {
        swapTotalGB = (parseInt(totalSwap) / 1024 / 1024 / 1024).toFixed(2);
        swapUsedGB = (parseInt(usedSwap) / 1024 / 1024 / 1024).toFixed(2);
        swapPercent = ((parseInt(usedSwap) / parseInt(totalSwap)) * 100).toFixed(2);
      }

      const uptimeSeconds = parseFloat(uptime);
      const uptimeDays = Math.floor(uptimeSeconds / 86400);
      const uptimeHours = Math.floor((uptimeSeconds % 86400) / 3600);
      const uptimeMinutes = Math.floor((uptimeSeconds % 3600) / 60);

      const diskData: any[] = [];
      diskInfo.split("\n").forEach((line: string) => {
        const parts = line.split(/\s+/);
        if (parts.length >= 6) {
          diskData.push({
            filesystem: parts[0],
            totalGB: (parseInt(parts[1]) / 1024 / 1024 / 1024).toFixed(2),
            usedGB: (parseInt(parts[2]) / 1024 / 1024 / 1024).toFixed(2),
            availableGB: (parseInt(parts[3]) / 1024 / 1024 / 1024).toFixed(2),
            percent: parts[4],
            mountpoint: parts[5],
          });
        }
      });

      const networkData: Record<string, any> = {};
      netInfo.split("\n").forEach((line: string) => {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 10) {
          const interfaceName = parts[0].slice(0, -1);
          (networkData as any)[interfaceName] = {
            rxBytes: parts[1],
            rxPackets: parts[2],
            rxErrors: parts[3],
            txBytes: parts[9],
            txPackets: parts[10],
            txErrors: parts[11],
          };
        }
      });

      const healthReport = {
        timestamp: new Date().toISOString(),
        cpu: {
          cores: parseInt(cpuInfo),
          usagePercent: cpuUsage,
        },
        memory: {
          totalGB: memTotalGB,
          usedGB: memUsedGB,
          freeGB: memFreeGB,
          usagePercent: memPercent,
        },
        swap: {
          totalGB: swapTotalGB,
          usedGB: swapUsedGB,
          usagePercent: swapPercent,
        },
        uptime: {
          seconds: uptimeSeconds.toFixed(0),
          days: uptimeDays,
          hours: uptimeHours,
          minutes: uptimeMinutes,
          formatted: `${uptimeDays}d ${uptimeHours}h ${uptimeMinutes}m`,
        },
        loadAverage: loadAvg,
        disk: diskData,
        network: networkData,
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(healthReport, null, 2),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Error getting machine health: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.tool(
  "get_processes",
  "Get information about running processes with filtering and sorting options",
  {
    limit: z.number().optional().describe("Maximum number of processes to return (default: all)"),
    sortBy: z.enum(["cpu", "memory", "pid", "name"]).optional().describe("Sort by field (default: cpu)"),
    filterBy: z.string().optional().describe("Filter by process name (substring match)"),
    user: z.string().optional().describe("Filter by username"),
  },
  async ({ limit, sortBy = "cpu", filterBy, user }) => {
    try {
      let command = "ps aux --sort=-pcpu";

      if (user) {
        command = `ps -u ${user} --sort=-pcpu`;
      }

      const output = execCommand(command);
      const lines = output.trim().split("\n");
      const processes: any[] = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        const parts = line.trim().split(/\s+/);

        if (parts.length < 11) continue;

        const process = {
          user: parts[0],
          pid: parseInt(parts[1]),
          cpuPercent: parseFloat(parts[2]),
          memPercent: parseFloat(parts[3]),
          vsz: parseInt(parts[4]),
          rss: parseInt(parts[5]),
          tty: parts[6],
          stat: parts[7],
          start: parts[8],
          time: parts[9],
          command: parts.slice(10).join(" "),
        };

        if (filterBy && !process.command.toLowerCase().includes(filterBy.toLowerCase())) {
          continue;
        }

        processes.push(process);
      }

      let sortedProcesses = processes;
      if (sortBy === "memory") {
        sortedProcesses.sort((a, b) => b.memPercent - a.memPercent);
      } else if (sortBy === "pid") {
        sortedProcesses.sort((a, b) => b.pid - a.pid);
      } else if (sortBy === "name") {
        sortedProcesses.sort((a, b) => a.command.localeCompare(b.command));
      }

      if (limit && limit > 0) {
        sortedProcesses = sortedProcesses.slice(0, limit);
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                timestamp: new Date().toISOString(),
                total: processes.length,
                returned: sortedProcesses.length,
                sortBy,
                filter: { by: filterBy, user },
                processes: sortedProcesses,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Error getting processes: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.tool(
  "get_dmesg_logs",
  "Get kernel ring buffer messages from dmesg",
  {
    lines: z.number().default(100).describe("Number of recent lines to retrieve"),
    level: z.enum(["all", "emerg", "alert", "crit", "err", "warning", "notice", "info", "debug"]).default("all").describe("Filter by log level"),
  },
  async ({ lines, level }) => {
    try {
      let command = `dmesg -T --ctime -n ${lines}`;

      if (level !== "all") {
        const levelMap: any = {
          emerg: "0",
          alert: "1",
          crit: "2",
          err: "3",
          warning: "4",
          notice: "5",
          info: "6",
          debug: "7",
        };
        command = `dmesg -T -l ${level} -n ${lines}`;
      }

      const output = execCommand(command);
      const logLines = output.trim().split("\n");

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                timestamp: new Date().toISOString(),
                source: "dmesg",
                level,
                totalLines: logLines.length,
                logs: logLines,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Error getting dmesg logs: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.tool(
  "get_systemctl_logs",
  "Get systemd journal logs from systemctl/journalctl",
  {
    unit: z.string().optional().describe("Specific systemd unit name (optional)"),
    lines: z.number().default(100).describe("Number of lines to retrieve"),
    since: z.string().optional().describe("Show entries since timestamp (e.g., '1 hour ago', '2024-01-01 00:00:00')"),
    level: z.enum(["emerg", "alert", "crit", "err", "warning", "notice", "info", "debug", "all"]).default("all").describe("Filter by log level"),
  },
  async ({ unit, lines, since, level }) => {
    try {
      let command = `journalctl -n ${lines} --no-pager`;

      if (unit) {
        command += ` -u ${unit}`;
      }

      if (since) {
        command += ` --since '${since}'`;
      }

      if (level !== "all") {
        command += ` -p ${level.toUpperCase()}`;
      }

      const output = execCommand(command);
      const logLines = output.trim().split("\n");

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                timestamp: new Date().toISOString(),
                source: "systemd-journal",
                unit,
                level,
                since,
                totalLines: logLines.length,
                logs: logLines,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Error getting systemctl logs: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.tool(
  "get_system_report",
  "Generate comprehensive system health report aggregating all monitoring data",
  {
    includeLogs: z.boolean().default(true).describe("Include log data in report"),
    logLines: z.number().default(50).describe("Number of log lines per source"),
    includeProcesses: z.boolean().default(true).describe("Include process information"),
    processLimit: z.number().default(10).describe("Number of top processes to include"),
  },
  async ({ includeLogs = true, logLines = 50, includeProcesses = true, processLimit = 10 }) => {
    try {
      const report: any = {
        timestamp: new Date().toISOString(),
        hostname: execCommand("hostname").trim(),
        kernel: execCommand("uname -r").trim(),
        os: execCommand("cat /etc/os-release | grep PRETTY_NAME | cut -d'\"' -f2").trim(),
      };

      const cpuInfo = execCommand("grep -c '^processor' /proc/cpuinfo").trim();
      const cpuUsage = execCommand("top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | cut -d'%' -f1").trim();
      report.cpu = {
        cores: parseInt(cpuInfo),
        usagePercent: cpuUsage,
      };

      const memInfo = execCommand("free -b | grep Mem").trim();
      const [, , totalMem, usedMem] = memInfo.split(/\s+/);
      report.memory = {
        totalGB: (parseInt(totalMem) / 1024 / 1024 / 1024).toFixed(2),
        usedGB: (parseInt(usedMem) / 1024 / 1024 / 1024).toFixed(2),
        usagePercent: ((parseInt(usedMem) / parseInt(totalMem)) * 100).toFixed(2),
      };

      const uptime = execCommand("cat /proc/uptime").trim().split(" ")[0];
      const uptimeSeconds = parseFloat(uptime);
      report.uptime = {
        seconds: uptimeSeconds.toFixed(0),
        days: Math.floor(uptimeSeconds / 86400),
        hours: Math.floor((uptimeSeconds % 86400) / 3600),
        minutes: Math.floor((uptimeSeconds % 3600) / 60),
      };

      const loadAvg = execCommand("cat /proc/loadavg").trim().split(" ").slice(0, 3);
      report.loadAverage = {
        "1min": loadAvg[0],
        "5min": loadAvg[1],
        "15min": loadAvg[2],
      };

      const diskInfo = execCommand("df -B1 | tail -n +2").trim();
      report.disk = [];
      diskInfo.split("\n").forEach((line: string) => {
        const parts = line.split(/\s+/);
        if (parts.length >= 6) {
          report.disk.push({
            filesystem: parts[0],
            totalGB: (parseInt(parts[1]) / 1024 / 1024 / 1024).toFixed(2),
            usedGB: (parseInt(parts[2]) / 1024 / 1024 / 1024).toFixed(2),
            percent: parts[4],
            mountpoint: parts[5],
          });
        }
      });

      if (includeProcesses) {
        const psOutput = execCommand("ps aux --sort=-pcpu | head -n " + (processLimit + 1));
        const lines = psOutput.trim().split("\n");
        report.topProcesses = [];
        for (let i = 1; i < lines.length; i++) {
          const parts = lines[i].trim().split(/\s+/);
          if (parts.length >= 11) {
            report.topProcesses.push({
              pid: parseInt(parts[1]),
              cpuPercent: parseFloat(parts[2]),
              memPercent: parseFloat(parts[3]),
              command: parts.slice(10).join(" "),
            });
          }
        }
      }

      if (includeLogs) {
        try {
          const dmesgOutput = execCommand(`dmesg -T -n ${logLines}`);
          report.dmesgLogs = {
            count: dmesgOutput.trim().split("\n").length,
            lines: logLines,
            recentEntries: dmesgOutput.trim().split("\n").slice(-5),
          };
        } catch (e: any) {
          report.dmesgLogs = { error: e.message };
        }

        try {
          const journalOutput = execCommand(`journalctl -n ${logLines} --no-pager`);
          report.systemctlLogs = {
            count: journalOutput.trim().split("\n").length,
            lines: logLines,
            recentEntries: journalOutput.trim().split("\n").slice(-5),
          };
        } catch (e: any) {
          report.systemctlLogs = { error: e.message };
        }
      }

      const healthStatus = [];
      if (parseFloat(report.cpu.usagePercent) > 90) {
        healthStatus.push("WARNING: High CPU usage");
      }
      if (parseFloat(report.memory.usagePercent) > 90) {
        healthStatus.push("WARNING: High memory usage");
      }
      report.disk.forEach((d: any) => {
        if (parseInt(d.percent) > 90) {
          healthStatus.push(`WARNING: Disk ${d.mountpoint} is ${d.percent} full`);
        }
      });

      report.healthStatus = healthStatus.length > 0 ? healthStatus : ["System healthy"];

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(report, null, 2),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Error generating system report: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Machine Health MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
