const SENSITIVE_KEY_PATTERN = /(password|secret|token|private[-_]?key|api[-_]?key|credential)/i;

/**
 * Removes any configuration entries whose key looks like it could hold a
 * secret. Used as a defensive filter before server configuration is ever
 * returned to the frontend, even though the simulated adapter does not
 * store secrets today.
 */
export function filterSensitiveValues(values: Record<string, string>): Record<string, string> {
  const filtered: Record<string, string> = {};
  for (const [key, value] of Object.entries(values)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) continue;
    filtered[key] = value;
  }
  return filtered;
}
