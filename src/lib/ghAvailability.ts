import { execFile } from "child_process";
import { promisify } from "util";
import logger from "./logger";

const execFileP = promisify(execFile) as unknown as (
  cmd: string,
  args?: string[],
  opts?: any,
) => Promise<{ stdout: string; stderr: string }>;

let checked = false;
let available = false;
let version: string | undefined;

export async function checkGhOnce(): Promise<void> {
  if (checked) return;
  checked = true;
  try {
    const res = await execFileP("gh", ["--version"], { timeout: 5000 });
    const out = String(res.stdout || res.stderr || "").trim();
    version = out.split("\n")[0] || out;
    available = true;
    logger.debug("gh available: " + version);
  } catch (e: any) {
    available = false;
    version = undefined;
    logger.debug(
      "gh availability check failed: " + String(e?.message || e || ""),
    );
  }
}

export async function isGhAvailable(): Promise<boolean> {
  if (!checked) await checkGhOnce();
  return available;
}

export async function getGhVersion(): Promise<string | undefined> {
  if (!checked) await checkGhOnce();
  return version;
}

export default { isGhAvailable, getGhVersion, checkGhOnce };
