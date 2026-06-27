# Local Agent Monitor

Local Agent Monitor is a local-first VS Code sidebar for Claude Code background
agent sessions.

## 日本語

Local Agent Monitor は、Claude Code のバックグラウンド agent セッションを
VS Code のサイドバーで確認するためのローカルファーストな拡張機能です。

複数の agent を並行して動かしているときに、どのセッションが作業中か、
入力待ちか、完了済みかを VS Code から素早く確認できます。

この拡張機能は、ローカルの Claude Code CLI が返す次の出力を読み取ります。

```bash
claude agents --json
```

完了済みセッションの表示を有効にしている場合は、次の出力を読み取ります。

```bash
claude agents --all --json
```

### 主な機能

- VS Code のアクティビティバーに agent セッション一覧を表示
- `Needs Input`、`Working`、`Other`、`Completed` に分類
- 手動更新または一定間隔での自動更新
- 公式の Claude Agent View をターミナルで開く
- 選択したセッションを VS Code ターミナルで resume
- セッションIDをコピー
- セッションの作業フォルダを開く

### プライバシー

この拡張機能はローカルファーストです。

- セッション情報を外部サービスへ送信しません。
- テレメトリは含まれていません。
- プロジェクトファイルや Claude の会話ログ本文は読み取りません。
- 設定された Claude Code CLI コマンドをローカルで実行するだけです。

### 必要なもの

- VS Code 1.90.0 以上
- `claude` コマンドとして利用できる Claude Code CLI
  - もしくは `localAgentMonitor.claudePath` でCLIパスを指定してください。

### 使い方

1. Releases から `.vsix` ファイルをダウンロードします。
2. VS Code の `Extensions: Install from VSIX...` からインストールします。
3. VS Code のアクティビティバーに表示される `Agents` ビューを開きます。

### 注意

この拡張機能は Anthropic 公式の拡張機能ではありません。
Claude Code CLI がローカルで利用できる環境向けの補助ツールです。

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
