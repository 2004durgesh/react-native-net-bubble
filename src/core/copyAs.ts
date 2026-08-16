import type { NetworkRecord } from '../types';

// ─── cURL ─────────────────────────────────────────────────────────────────────

/**
 * Builds a copy-pasteable `curl` command for a captured request.
 *
 * Example output:
 *   curl -X POST 'https://api.example.com/v1/users' \
 *     -H 'Content-Type: application/json' \
 *     -H 'Authorization: Bearer token' \
 *     --data-raw '{"name":"John"}'
 */
export function buildCurl(record: NetworkRecord): string {
  const lines: string[] = [
    `curl -X ${record.method.toUpperCase()} '${escapeSingleQuote(record.url)}'`,
  ];

  const headers = record.requestHeaders ?? {};
  for (const [key, value] of Object.entries(headers)) {
    lines.push(`  -H '${escapeSingleQuote(key)}: ${escapeSingleQuote(value)}'`);
  }

  if (record.requestBody) {
    lines.push(`  --data-raw '${escapeSingleQuote(record.requestBody)}'`);
  }

  return lines.join(' \\\n');
}

// ─── fetch ────────────────────────────────────────────────────────────────────

/**
 * Builds a JavaScript `fetch()` snippet for a captured request.
 *
 * Example output:
 *   await fetch('https://api.example.com/v1/users', {
 *     method: 'POST',
 *     headers: {
 *       'Content-Type': 'application/json',
 *     },
 *     body: '{"name":"John"}',
 *   });
 */
export function buildFetch(record: NetworkRecord): string {
  const method = record.method.toUpperCase();
  const headers = record.requestHeaders ?? {};

  const headerLines = Object.entries(headers)
    .map(([k, v]) => `    ${JSON.stringify(k)}: ${JSON.stringify(v)},`)
    .join('\n');

  const bodyLine = record.requestBody
    ? `  body: ${JSON.stringify(record.requestBody)},\n`
    : '';

  return [
    `await fetch(${JSON.stringify(record.url)}, {`,
    `  method: ${JSON.stringify(method)},`,
    `  headers: {`,
    headerLines,
    `  },`,
    bodyLine + `});`,
  ].join('\n');
}

// ─── cURL (Windows CMD) ───────────────────────────────────────────────────────

/**
 * Builds a `curl` command for Windows Command Prompt (cmd.exe).
 *
 * Differences from the bash variant:
 *   - Uses double quotes instead of single quotes.
 *   - Uses `^` for line continuation instead of `\`.
 *   - Escapes inner double quotes as `\"`.
 *
 * Example output:
 *   curl -X POST "https://api.example.com/v1/users" ^
 *     -H "Content-Type: application/json" ^
 *     -H "Authorization: Bearer token" ^
 *     --data-raw "{\"name\":\"John\"}"
 */
export function buildCurlCmd(record: NetworkRecord): string {
  const lines: string[] = [
    `curl -X ${record.method.toUpperCase()} "${escapeDoubleQuote(record.url)}"`,
  ];

  const headers = record.requestHeaders ?? {};
  for (const [key, value] of Object.entries(headers)) {
    lines.push(`  -H "${escapeDoubleQuote(key)}: ${escapeDoubleQuote(value)}"`);
  }

  if (record.requestBody) {
    lines.push(`  --data-raw "${escapeDoubleQuote(record.requestBody)}"`);
  }

  return lines.join(' ^\n');
}

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Escape single quotes for use inside a single-quoted shell string. */
function escapeSingleQuote(s: string): string {
  return s.replace(/'/g, "'\\''");
}

/** Escape double quotes for use inside a double-quoted cmd.exe string. */
function escapeDoubleQuote(s: string): string {
  return s.replace(/"/g, '\\"');
}
