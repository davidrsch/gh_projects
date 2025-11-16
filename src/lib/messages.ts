export const GH_NOT_FOUND =
  "GitHub authentication required — sign in to GitHub via VS Code.";
export const GH_PERMISSION_ERROR_HINT =
  'GitHub API permission error — sign in via the extension (run the "Sign in to GitHub" command) or check your account/organization permissions (SAML/SSO).';

function firstNonEmpty(...parts: Array<any>) {
  for (const p of parts) {
    if (p === undefined || p === null) continue;
    const s = String(p).trim();
    if (s) return s;
  }
  return "";
}

function short(s: string, n = 2000) {
  if (!s) return "";
  return s.length > n ? s.slice(0, n) + "...[truncated]" : s;
}

export function formatGhError(err: any): { message: string; code?: string } {
  if (!err) return { message: "Unknown error" };
  const code = err.code || err.status || undefined;
  const stdout = firstNonEmpty(err.stdout, err.output && err.output[1], "");
  const stderr = firstNonEmpty(err.stderr, err.message, "");
  const combined = (stdout || stderr || "").trim();
  const message = short(combined || String(err));
  return { message, code };
}

export function isGhNotFound(err: any): boolean {
  if (!err) return false;
  const code = String(err.code || "").toLowerCase();
  if (code === "enoent") return true;
  const text = (
    String(err?.stdout || "") +
    "\n" +
    String(err?.stderr || "") +
    "\n" +
    String(err?.message || "")
  ).toLowerCase();
  return /enoent|not found|spawn .* enoent/.test(text);
}

export function isGhPermissionError(err: any): boolean {
  if (!err) return false;
  const text = (
    String(err?.stdout || "") +
    "\n" +
    String(err?.stderr || "") +
    "\n" +
    String(err?.message || "")
  ).toLowerCase();
  return /\b(403|permission|access|not authorized|requires)\b/.test(text);
}

export default {
  GH_NOT_FOUND,
  GH_PERMISSION_ERROR_HINT,
  formatGhError,
  isGhNotFound,
  isGhPermissionError,
};
