# Privacy

Local Agent Monitor is designed to stay local.

## What the extension runs

The extension runs the configured Claude Code CLI command on your machine:

```bash
claude agents --json
claude agents --all --json
```

When you choose to resume a session, it opens a VS Code terminal and sends a
local resume command for the selected session.

## What is not collected

- No telemetry is included.
- No analytics SDK is included.
- No session data is sent to the extension author.
- No project files are uploaded.
- No Claude transcript logs are read by the extension.
- No remote service is called by the extension itself.

## What may be visible locally

The VS Code sidebar can display metadata returned by the Claude Code CLI, such
as session name, state, session ID, working folder, prompt summary, and
timestamps.

That metadata stays inside your local VS Code window unless you copy, share, or
publish it yourself.

## Configuration

The extension only uses VS Code settings under `localAgentMonitor.*`.

If `localAgentMonitor.claudePath` points to a different command, that command is
what the extension will execute locally.

