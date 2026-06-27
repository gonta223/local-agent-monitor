# Local Agent Monitor

Local Agent Monitor is a local-first VS Code sidebar for Claude Code background
agent sessions.

It reads the local Claude Code CLI output from:

```bash
claude agents --json
```

When completed sessions are enabled, it reads:

```bash
claude agents --all --json
```

## Features

- View background agent sessions in the VS Code activity bar.
- Group sessions by needs input, working, other, and completed.
- Refresh manually or on an interval.
- Open the official Claude Agent View in a terminal.
- Resume a session in a VS Code terminal.
- Copy a session ID.
- Open a session folder.

## Privacy

This extension is local-first.

- It does not send session data to any external service.
- It does not include telemetry.
- It does not read project files or Claude transcript logs.
- It only shells out to the configured Claude Code CLI command.

## Requirements

- VS Code 1.90.0 or newer.
- Claude Code CLI available as `claude`, or configured through
  `localAgentMonitor.claudePath`.

## Settings

- `localAgentMonitor.claudePath`: path or command name for the Claude Code CLI.
- `localAgentMonitor.showCompleted`: include completed sessions with `--all`.
- `localAgentMonitor.refreshIntervalMs`: auto-refresh interval in milliseconds.
- `localAgentMonitor.resumeArgs`: optional extra arguments for resume commands.

The default resume command does not add permission bypass flags.

## Local Development

Open this folder in VS Code and run:

```bash
code --extensionDevelopmentPath="$PWD"
```

## Packaging

Package a local VSIX with:

```bash
npx @vscode/vsce package
```
