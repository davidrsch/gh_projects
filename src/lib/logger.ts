import * as vscode from "vscode";

const CHANNEL_NAME = "ghProjects";

let channel: vscode.OutputChannel | undefined;

function getChannel(): vscode.OutputChannel {
  if (!channel) channel = vscode.window.createOutputChannel(CHANNEL_NAME);
  return channel;
}

function formatPrefix(level: string) {
  return `[${new Date().toISOString()}] [${level}] `;
}

export default {
  getChannel,
  info(msg: string, ...args: any[]) {
    try {
      getChannel().appendLine(
        formatPrefix("INFO") +
          msg +
          (args.length ? " " + JSON.stringify(args) : "")
      );
      try {
        console.info(formatPrefix("INFO") + msg, ...args);
      } catch {}
    } catch {}
  },
  warn(msg: string, ...args: any[]) {
    try {
      getChannel().appendLine(
        formatPrefix("WARN") +
          msg +
          (args.length ? " " + JSON.stringify(args) : "")
      );
      try {
        console.warn(formatPrefix("WARN") + msg, ...args);
      } catch {}
    } catch {}
  },
  error(msg: string, ...args: any[]) {
    try {
      getChannel().appendLine(
        formatPrefix("ERROR") +
          msg +
          (args.length ? " " + JSON.stringify(args) : "")
      );
      try {
        console.error(formatPrefix("ERROR") + msg, ...args);
      } catch {}
    } catch {}
  },
  debug(msg: string, ...args: any[]) {
    try {
      const cfg = vscode.workspace.getConfiguration("ghProjects");
      const enabled = Boolean(cfg.get("debug", false));
      if (!enabled) return;
      getChannel().appendLine(
        formatPrefix("DEBUG") +
          msg +
          (args.length ? " " + JSON.stringify(args) : "")
      );
      try {
        console.debug(formatPrefix("DEBUG") + msg, ...args);
      } catch {}
    } catch {}
  },
};
