/** Keep useful driver errors in server logs without recording credentials. */
export function describeError(error, env = process.env) {
  const secrets = Object.entries(env)
    .filter(([name, value]) => value && /TOKEN|SECRET|PASSWORD|PRIVATE_KEY|DATABASE_URL|DSN/i.test(name))
    .map(([, value]) => String(value).trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  const redact = (value) => {
    let text = String(value ?? "");
    for (const secret of secrets) text = text.split(secret).join("[redacted]");
    return text
      .replace(/\b(?:https?|libsql):\/\/[^\s\"'<>]+/gi, "[database-url]")
      .replace(/\bBearer\s+[^\s\"',;}]+/gi, "Bearer [redacted]")
      .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[redacted-token]")
      .replace(/((?:auth[_-]?token|password|secret)\s*[=:]\s*)[^\s,;}]+/gi, "$1[redacted]")
      .slice(0, 2000);
  };
  const seen = new Set();
  const describe = (value, depth = 0) => {
    if (depth > 3 || seen.has(value)) return undefined;
    if (value == null || typeof value !== "object") return { message: redact(value) };
    seen.add(value);
    return {
      name: redact(value.name || "Error"),
      code: value.code ? redact(value.code) : undefined,
      stage: value.stage ? redact(value.stage) : undefined,
      message: redact(value.message || "Unknown error"),
      cause: value.cause === undefined ? undefined : describe(value.cause, depth + 1),
    };
  };
  return describe(error);
}
