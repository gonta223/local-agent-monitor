const cp = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const vscode = require("vscode");

function activate(context) {
  const output = vscode.window.createOutputChannel("Local Agent Monitor");
  const provider = new SessionProvider(output);

  context.subscriptions.push(
    output,
    provider,
    vscode.window.registerTreeDataProvider("localAgentMonitor.sessions", provider),
    vscode.commands.registerCommand("localAgentMonitor.refresh", () => provider.refresh()),
    vscode.commands.registerCommand("localAgentMonitor.openAgentView", () => openAgentView()),
    vscode.commands.registerCommand("localAgentMonitor.resumeSession", (item) => resumeSession(item)),
    vscode.commands.registerCommand("localAgentMonitor.copySessionId", (item) => copySessionId(item)),
    vscode.commands.registerCommand("localAgentMonitor.openSessionFolder", (item) => openSessionFolder(item)),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("localAgentMonitor")) {
        provider.configureTimer();
        provider.refresh({ silent: true });
      }
    })
  );

  provider.configureTimer();
  provider.refresh({ silent: true });
}

function deactivate() {}

class SessionProvider {
  constructor(output) {
    this.output = output;
    this.items = [];
    this.error = "";
    this.loading = false;
    this.timer = undefined;
    this.emitter = new vscode.EventEmitter();
    this.onDidChangeTreeData = this.emitter.event;
  }

  configureTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }

    const interval = config().get("refreshIntervalMs", 10000);
    if (interval > 0) {
      this.timer = setInterval(() => this.refresh({ silent: true }), interval);
    }
  }

  async refresh(options = {}) {
    if (this.loading) {
      return;
    }

    this.loading = true;
    this.error = "";
    this.emitter.fire();

    try {
      const sessions = await fetchSessions();
      this.items = buildTree(sessions);
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error);
      this.output.appendLine(`[refresh failed] ${this.error}`);
      if (!options.silent) {
        vscode.window.showWarningMessage(`Local Agent Monitor refresh failed: ${this.error}`);
      }
    } finally {
      this.loading = false;
      this.emitter.fire();
    }
  }

  getTreeItem(item) {
    return item;
  }

  getChildren(item) {
    if (item) {
      return item.children || [];
    }

    if (this.loading && this.items.length === 0) {
      return [new MessageItem("Loading agent sessions...", "sync~spin")];
    }

    if (this.error) {
      return [
        new MessageItem(this.error, "warning"),
        new MessageItem("Check the Claude Code CLI path in settings.", "info")
      ];
    }

    if (this.items.length === 0) {
      return [new MessageItem("No agent sessions found.", "circle-slash")];
    }

    return this.items;
  }

  dispose() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    this.emitter.dispose();
  }
}

class MessageItem extends vscode.TreeItem {
  constructor(label, icon) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.iconPath = new vscode.ThemeIcon(icon);
  }
}

class GroupItem extends vscode.TreeItem {
  constructor(label, children) {
    super(`${label} (${children.length})`, vscode.TreeItemCollapsibleState.Expanded);
    this.children = children;
    this.iconPath = new vscode.ThemeIcon(iconForGroup(label));
  }
}

class SessionItem extends vscode.TreeItem {
  constructor(session) {
    super(session.name, vscode.TreeItemCollapsibleState.None);
    this.session = session;
    this.contextValue = "agentSession";
    this.description = `${session.state} · ${formatAge(session.updatedAt || session.startedAt)}`;
    this.tooltip = sessionTooltip(session);
    this.iconPath = new vscode.ThemeIcon(iconForState(session.state));
    this.command = {
      command: "localAgentMonitor.resumeSession",
      title: "Resume Session",
      arguments: [this]
    };
  }
}

function buildTree(rawSessions) {
  const sessions = dedupeSessions(rawSessions).map(normalizeSession).sort(sortSessions);
  const groups = [
    ["Needs Input", sessions.filter((session) => isWaiting(session.state))],
    ["Working", sessions.filter((session) => isWorking(session.state))],
    ["Other", sessions.filter((session) => !isWaiting(session.state) && !isWorking(session.state) && !isDone(session.state))],
    ["Completed", sessions.filter((session) => isDone(session.state))]
  ];

  return groups
    .filter(([, groupSessions]) => groupSessions.length > 0)
    .map(([label, groupSessions]) => new GroupItem(label, groupSessions.map((session) => new SessionItem(session))));
}

function fetchSessions() {
  const claudePath = config().get("claudePath", "claude");
  const args = ["agents"];
  if (config().get("showCompleted", true)) {
    args.push("--all");
  }
  args.push("--json");

  return new Promise((resolve, reject) => {
    cp.execFile(
      claudePath,
      args,
      {
        cwd: workspaceRoot(),
        env: commandEnv(),
        maxBuffer: 20 * 1024 * 1024,
        timeout: 20000
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr ? stderr.trim() : error.message));
          return;
        }

        try {
          const parsed = JSON.parse(stdout || "[]");
          if (Array.isArray(parsed)) {
            resolve(parsed);
            return;
          }
          if (parsed && Array.isArray(parsed.sessions)) {
            resolve(parsed.sessions);
            return;
          }
          resolve([]);
        } catch (parseError) {
          reject(new Error(`Could not parse agent JSON: ${parseError.message}`));
        }
      }
    );
  });
}

function dedupeSessions(sessions) {
  const bySession = new Map();
  const passthrough = [];

  for (const session of sessions) {
    const sessionId = session && session.sessionId;
    if (!sessionId) {
      passthrough.push(session);
      continue;
    }

    const score = [
      Number(session.pid !== undefined),
      Number(session.startedAt || 0),
      Number(session.updatedAt || 0)
    ];
    const previous = bySession.get(sessionId);
    if (!previous || compareScore(score, previous.score) > 0) {
      bySession.set(sessionId, { score, session });
    }
  }

  return [...bySession.values()].map((entry) => entry.session).concat(passthrough);
}

function normalizeSession(raw) {
  const sessionId = raw.sessionId || raw.id || "";
  const cwd = raw.cwd || "";
  const state = stateOf(raw);
  return {
    sessionId,
    id: raw.id || sessionId.slice(0, 8),
    name: clean(raw.name || raw.prompt || sessionId.slice(0, 8) || shortPath(cwd) || "Untitled session"),
    prompt: clean(raw.prompt || ""),
    state,
    cwd,
    startedAt: toMillis(raw.startedAt || raw.createdAt || 0),
    updatedAt: toMillis(raw.updatedAt || raw.lastActivityAt || 0)
  };
}

function stateOf(raw) {
  const state = clean(raw.state || raw.status).toLowerCase();
  if (state) {
    return state;
  }
  if (raw.pid === undefined || raw.pid === null) {
    return "ended";
  }
  return pidExists(raw.pid) ? "idle" : "dead";
}

function sortSessions(a, b) {
  const stateDelta = stateRank(a.state) - stateRank(b.state);
  if (stateDelta !== 0) {
    return stateDelta;
  }
  return (b.updatedAt || b.startedAt || 0) - (a.updatedAt || a.startedAt || 0);
}

function stateRank(state) {
  if (isWaiting(state)) {
    return 0;
  }
  if (isWorking(state)) {
    return 1;
  }
  if (isDone(state)) {
    return 3;
  }
  return 2;
}

function openAgentView() {
  const terminal = vscode.window.createTerminal({
    name: "Claude Agent View",
    cwd: workspaceRoot(),
    env: terminalEnv()
  });
  terminal.show();
  terminal.sendText(`${quoteShell(config().get("claudePath", "claude"))} agents`);
}

function resumeSession(item) {
  const session = item && item.session;
  if (!session || !session.sessionId) {
    vscode.window.showWarningMessage("No session selected.");
    return;
  }

  const cwd = session.cwd && fs.existsSync(session.cwd) ? session.cwd : workspaceRoot();
  const resumeArgs = config().get("resumeArgs", "");
  const command = `${quoteShell(config().get("claudePath", "claude"))} --resume ${quoteShell(session.sessionId)} ${resumeArgs}`.trim();
  const terminal = vscode.window.createTerminal({
    name: `Agent ${session.id}`,
    cwd,
    env: terminalEnv()
  });
  terminal.show();
  terminal.sendText(command);
}

async function copySessionId(item) {
  const sessionId = item && item.session && item.session.sessionId;
  if (!sessionId) {
    vscode.window.showWarningMessage("No session selected.");
    return;
  }
  await vscode.env.clipboard.writeText(sessionId);
  vscode.window.setStatusBarMessage("Copied session ID", 2500);
}

async function openSessionFolder(item) {
  const cwd = item && item.session && item.session.cwd;
  if (!cwd || !fs.existsSync(cwd)) {
    vscode.window.showWarningMessage("Session folder was not found.");
    return;
  }
  await vscode.commands.executeCommand("vscode.openFolder", vscode.Uri.file(cwd), { forceNewWindow: true });
}

function sessionTooltip(session) {
  return [
    `Name: ${session.name}`,
    `State: ${session.state}`,
    `Session: ${session.sessionId || "-"}`,
    `Folder: ${session.cwd || "-"}`,
    `Prompt: ${session.prompt || "-"}`,
    `Started: ${formatDate(session.startedAt)}`
  ].join("\n");
}

function config() {
  return vscode.workspace.getConfiguration("localAgentMonitor");
}

function commandEnv() {
  return {
    ...process.env,
    PATH: commandPath()
  };
}

function terminalEnv() {
  return {
    PATH: commandPath()
  };
}

function commandPath() {
  const existingPath = process.env.PATH || process.env.Path || "";
  const localPaths = process.platform === "win32"
    ? []
    : [
        path.join(os.homedir(), ".local/bin"),
        path.join(os.homedir(), "bin"),
        "/opt/homebrew/bin",
        "/usr/local/bin"
      ];

  return localPaths.concat(existingPath).filter(Boolean).join(path.delimiter);
}

function workspaceRoot() {
  const folder = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0];
  return folder ? folder.uri.fsPath : os.homedir();
}

function iconForGroup(label) {
  if (label === "Needs Input") {
    return "warning";
  }
  if (label === "Working") {
    return "sync~spin";
  }
  if (label === "Completed") {
    return "check-all";
  }
  return "list-tree";
}

function iconForState(state) {
  if (isWaiting(state)) {
    return "warning";
  }
  if (isWorking(state)) {
    return "run";
  }
  if (isFailed(state)) {
    return "error";
  }
  if (isDone(state)) {
    return "check";
  }
  return "circle-large-outline";
}

function isWaiting(state) {
  return ["blocked", "waiting", "idle"].includes(state);
}

function isWorking(state) {
  return ["live", "running", "active", "working"].includes(state);
}

function isDone(state) {
  return ["done", "completed", "ended", "dead", "error", "failed", "stopped"].includes(state);
}

function isFailed(state) {
  return ["error", "failed", "stopped", "dead"].includes(state);
}

function pidExists(pid) {
  try {
    process.kill(Number(pid), 0);
    return true;
  } catch {
    return false;
  }
}

function compareScore(left, right) {
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    const delta = (left[i] || 0) - (right[i] || 0);
    if (delta !== 0) {
      return delta;
    }
  }
  return 0;
}

function toMillis(value) {
  const number = Number(value || 0);
  if (!number) {
    return 0;
  }
  return number < 100000000000 ? number * 1000 : number;
}

function formatAge(ms) {
  if (!ms) {
    return "-";
  }
  const seconds = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h`;
  }
  return `${Math.floor(hours / 24)}d`;
}

function formatDate(ms) {
  return ms ? new Date(ms).toLocaleString() : "-";
}

function shortPath(value) {
  return value ? value.replace(os.homedir(), "~") : "";
}

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function quoteShell(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

module.exports = {
  activate,
  deactivate
};
