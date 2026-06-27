# Security Policy

## Supported versions

The current public release is supported on a best-effort basis.

| Version | Supported |
| --- | --- |
| 0.1.x | Yes |

## Reporting a vulnerability

Please report security issues privately by opening a GitHub security advisory if
available, or by contacting the repository owner through GitHub.

Avoid posting sensitive session IDs, local paths, prompts, logs, screenshots, or
workspace details in a public issue.

## Local execution model

Local Agent Monitor executes the configured Claude Code CLI command on the local
machine. It does not include a server component, telemetry endpoint, or hosted
backend.

The safest configuration is to keep `localAgentMonitor.claudePath` pointed at a
trusted Claude Code CLI binary or command name.

## Scope

Security reports are most useful when they involve:

- unintended network transmission by this extension,
- unsafe command construction by this extension,
- exposure of session metadata beyond the local VS Code window,
- behavior that contradicts the documented local-first model.

