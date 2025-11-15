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
          (args.length ? " " + JSON.stringify(args) : ""),
      );
    } catch {}
  },
  warn(msg: string, ...args: any[]) {
    try {
      getChannel().appendLine(
        formatPrefix("WARN") +
          msg +
          (args.length ? " " + JSON.stringify(args) : ""),
      );
    } catch {}
  },
  error(msg: string, ...args: any[]) {
    try {
      getChannel().appendLine(
        formatPrefix("ERROR") +
          msg +
          (args.length ? " " + JSON.stringify(args) : ""),
      );
    } catch {}
  },
  debug(msg: string, ...args: any[]) {
    try {
      getChannel().appendLine(
        formatPrefix("DEBUG") +
          msg +
          (args.length ? " " + JSON.stringify(args) : ""),
      );
    } catch {}
  },
};
