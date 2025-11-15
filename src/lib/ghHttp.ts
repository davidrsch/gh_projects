import { graphql as octoGraphql } from "@octokit/graphql";
import { createCodeError, wrapError } from "./errors";

export async function ghHttpGraphQL(
  query: string,
  variables?: Record<string, any>,
  opts?: { token?: string; timeoutMs?: number },
): Promise<any> {
  const token = opts?.token;
  const timeoutMs = opts?.timeoutMs ?? 30000;
  if (!token) throw createCodeError("No token provided for HTTP GraphQL request", "EINVAL");

  try {
    const client = octoGraphql.defaults({
      headers: {
        authorization: `token ${token}`,
      },
      request: {
        timeout: timeoutMs,
      },
    });
    // octokit/graphql will return the data directly (not wrapped in { data })
    const res = await client(query, variables || {});
    return { data: res };
  } catch (e: any) {
    // Normalize common network errors for callers
    const name = String(e?.name || "").toLowerCase();
    const msg = String(e?.message || e || "");
    if (e && (e.code === "ETIMEDOUT" || /timed out|timeout/i.test(msg) || /timeout/i.test(name))) {
      throw createCodeError(msg || "HTTP GraphQL request timed out", "ETIMEDOUT");
    }
    if (e && ((e.status === 401) || /unauthor/i.test(msg))) {
      throw createCodeError(msg || "Unauthorized HTTP GraphQL request", "EPERM");
    }
    // otherwise wrap for additional context
    throw wrapError(e, "HTTP GraphQL request failed");
  }
}
