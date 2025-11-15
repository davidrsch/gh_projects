import { execFile } from "child_process";
import { promisify } from "util";
import type { ExecOptions } from "child_process";
import logger from "./logger";
import messages, {
  formatGhError,
  isGhNotFound,
  isGhPermissionError,
} from "./messages";
import { createCodeError } from "./errors";
import type { GhApiResponse } from "./types";

const execFilePInternal: (
  cmd: string,
  args?: string[],
  opts?: ExecOptions,
) => Promise<{ stdout: string; stderr: string }> = promisify(execFile) as any;

export async function execFileP(
  cmd: string,
  args: string[] = [],
  opts: ExecOptions = {},
): Promise<{ stdout: string; stderr: string }> {
  const merged = Object.assign({ maxBuffer: 10 * 1024 * 1024 }, opts);
  try {
    const res = await execFilePInternal(cmd, args, merged as any);
    if ((res as any).stdout !== undefined && (res as any).stderr !== undefined)
      return res as any;
    return res as any;
  } catch (err: unknown) {
    logger.error(
      `execFileP error: ${String((err as any)?.message || err || "")}`,
    );
    throw err;
  }
}

function truncate(s: string, n = 2000): string {
  return s.length > n ? s.slice(0, n) + "...[truncated]" : s;
}

export async function execGh(
  args: string[],
  opts?: ExecOptions,
): Promise<{ stdout: string; stderr: string }> {
  try {
    return await execFileP("gh", args, opts);
  } catch (err: unknown) {
    const ferr = formatGhError(err);
    if (isGhNotFound(err)) {
      const e = createCodeError(messages.GH_NOT_FOUND, "ENOENT");
      logger.error("gh not found: " + truncate(ferr.message));
      throw e;
    }

    if (isGhPermissionError(err)) {
      const message = `${ferr.message}\n\n${messages.GH_PERMISSION_ERROR_HINT}\n`;
      const e = createCodeError(message, ferr.code);
      logger.error("gh permission error: " + truncate(ferr.message));
      throw e;
    }

    logger.error("gh exec error: " + truncate(ferr.message));
    throw err;
  }
}

export async function ghGraphQLQuery(
  query: string,
  variables?: Record<string, any>,
): Promise<GhApiResponse> {
  const args: string[] = ["api", "graphql", "-f", `query=${query}`];
  if (variables) {
    for (const k of Object.keys(variables)) {
      const raw = variables[k];
      const value =
        typeof raw === "object" && raw !== null
          ? JSON.stringify(raw)
          : String(raw);
      args.push("-F", `${k}=${value}`);
    }
  }

  const res = await execGh(args);
  const stdout = String(res.stdout || "");

  try {
    return JSON.parse(stdout) as GhApiResponse;
  } catch (e) {
    // Best-effort: try to extract a JSON-like substring
    logger.error(
      "ghGraphQLQuery JSON.parse failed, attempting substring parse",
    );
    logger.debug(truncate(stdout, 2000));
    const firstObj = stdout.indexOf("{");
    const lastObj = stdout.lastIndexOf("}");
    const firstArr = stdout.indexOf("[");
    const lastArr = stdout.lastIndexOf("]");
    let candidate = "";
    if (firstObj >= 0 && lastObj > firstObj)
      candidate = stdout.slice(firstObj, lastObj + 1);
    else if (firstArr >= 0 && lastArr > firstArr)
      candidate = stdout.slice(firstArr, lastArr + 1);

    if (candidate) {
      try {
        return JSON.parse(candidate);
      } catch (e2) {
        // fallthrough to throwing original
      }
    }

    const short = truncate(stdout, 2000);
    const errMsg = `gh returned non-JSON. First 2000 chars: ${short}`;
    logger.error(errMsg);
    const err = createCodeError(errMsg);
    (err as any).stdout = stdout;
    throw err;
  }
}

export default { execFileP, execGh, ghGraphQLQuery };
