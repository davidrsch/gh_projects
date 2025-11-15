export type CodeError = Error & { code?: string };

export function createCodeError(message: string, code?: string): CodeError {
  const e = new Error(message) as CodeError;
  if (code) e.code = code;
  return e;
}

export function wrapError(err: any, fallbackMessage?: string): CodeError {
  if (!err) return createCodeError(fallbackMessage || "Unknown error");
  if (err instanceof Error) {
    const e = err as CodeError;
    return e;
  }
  try {
    return createCodeError(String(err.message || err || fallbackMessage || "Unknown error"));
  } catch {
    return createCodeError(fallbackMessage || "Unknown error");
  }
}

export default { createCodeError, wrapError };
