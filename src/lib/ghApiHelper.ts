import { ghHttpGraphQL } from "./ghHttp";
import errors from "./errors";
import * as vscode from "vscode";
import logger from "./logger";
import messages, {
  formatGhError,
  isGhNotFound,
  isGhPermissionError,
} from "./messages";
import type { GhApiResponse } from "./types";

function truncate(s: string, n = 2000): string {
  if (!s) return "";
  return s.length > n ? s.slice(0, n) + "...[truncated]" : s;
}

/**
 * Wrapper around ghRunner.ghGraphQLQuery that normalizes common gh errors,
 * logs them, and throws standardized Error objects with a `code` property.
 *
 * Usage: import { ghQueryWithErrors } from '../lib/ghApiHelper';
 */
export async function ghQueryWithErrors<T = any>(
  query: string,
  variables?: Record<string, any>,
): Promise<T> {
  try {
    // if configured to use HTTP API and token available, use it
    const cfg = vscode.workspace.getConfiguration("ghProjects");
    const useHttp = cfg.get<boolean>("useHttpApi", false);
    const timeoutMs = cfg.get<number>("queryTimeoutMs", 30000);

    // Prefer VS Code Authentication API: obtain GitHub session token via
    // vscode.authentication.getSession without creating a new session
    // (non-interactive). If present, use it for HTTP GraphQL requests.
    // Do NOT fall back to env/config or CLI.
    let sessionToken: string | undefined;
    try {
      if (
        (vscode as any).authentication &&
        typeof (vscode as any).authentication.getSession === "function"
      ) {
        // Use a conservative scope set for repository and org read access.
        const scopes = ["repo", "read:org", "read:user"];
        try {
          const session = await (vscode as any).authentication.getSession(
            "github",
            scopes,
            { createIfNone: false },
          );
          if (session && session.accessToken) sessionToken = String(session.accessToken).trim();
        } catch (e) {
          // If auth lookup fails (e.g., enterprise SAML), continue to other fallbacks.
          logger.debug("authentication.getSession failed: " + String(e));
        }
      }
    } catch (e) {
      logger.debug("vscode.authentication check failed: " + String(e));
    }

    // If we have a session token, use HTTP GraphQL with that token.
    if (sessionToken) {
      const token = sessionToken;
      try {
        return (await ghHttpGraphQL(query, variables, {
          token,
          timeoutMs,
        })) as T;
      } catch (e: any) {
        // Preserve existing error normalization for GitHub/network errors.
        throw e;
      }
    }

    // No session token available — do NOT fall back to env/config/CLI.
    // Show a single non-blocking information message offering to sign in,
    // then throw an auth error that callers can handle.
    try {
      const action = "Sign in to GitHub";
      const choice = await vscode.window.showInformationMessage(
        "ghProjects: sign in to GitHub required",
        action,
      );
      if (choice === action) {
        // Trigger the sign-in command; extension will handle interactive flow.
        try {
          await vscode.commands.executeCommand("ghProjects.signIn");
        } catch (cmdErr) {
          logger.debug("executeCommand ghProjects.signIn failed: " + String(cmdErr));
        }
      }
    } catch (showErr) {
      logger.debug("showInformationMessage failed: " + String(showErr));
    }

    const e = errors.createCodeError(
      "Not authenticated — sign in to GitHub via the Sign in command.",
      "ENOTAUTH",
    );
    throw e;
  } catch (err: unknown) {
    const ferr = formatGhError(err);
    const short = truncate(ferr.message || String(err || ""), 1200);

    if (isGhNotFound(err)) {
      const e = errors.createCodeError(messages.GH_NOT_FOUND, "ENOENT");
      logger.error("ghQueryWithErrors: gh not found: " + short);
      throw e;
    }

    // timeout mapping
    if (String((err as any)?.code || "").toLowerCase() === "etimedout") {
      const e = errors.createCodeError(
        "GitHub query timed out — try again or increase timeout.",
        "ETIMEDOUT",
      );
      logger.error("ghQueryWithErrors: timeout");
      throw e;
    }

    if (isGhPermissionError(err)) {
      const message = `${ferr.message}\n\n${messages.GH_PERMISSION_ERROR_HINT}`;
      const e = errors.createCodeError(message, "EPERM");
      logger.error("ghQueryWithErrors: permission error: " + short);
      throw e;
    }

    logger.error("ghQueryWithErrors: " + short);
    throw err;
  }
}

export default { ghQueryWithErrors };
