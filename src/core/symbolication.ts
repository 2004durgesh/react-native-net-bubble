import { NativeModules } from 'react-native';
import type { RequestOrigin } from '../types';

export type StackFrame = {
  methodName: string;
  file: string;
  line?: number;
  column?: number;
  raw: string;
};

/**
 * Turn a single app stack frame into a {@link RequestOrigin}. May be async so it
 * can consult a bundled source map (e.g. via `source-map-js`). Returning
 * `undefined` falls back to the built-in resolution.
 */
export type SourceMapResolver = (
  frame: StackFrame
) => RequestOrigin | undefined | Promise<RequestOrigin | undefined>;

let resolver: SourceMapResolver | undefined;

/**
 * Provide your own frame → source resolver. Use this to symbolicate against a
 * source map bundled into your non-prod builds so you get exact
 * `ProfileScreen.tsx:84` origins even without Metro. See the README for a
 * `source-map-js` recipe.
 */
export function configureSymbolication(options: {
  resolveFrame?: SourceMapResolver;
}): void {
  resolver = options.resolveFrame;
}

const INTERNAL_MARKERS = [
  'node_modules',
  'react-native/Libraries',
  '/NetBubble',
  'net-bubble/src',
  'stackRegistry',
  'jsCapture',
  'symbolication',
  'whatwg-fetch',
  'InternalBytecode',
  '[native code]',
  'patchedOpen',
  'captureStack',
  'callFunctionReturnFlushedQueue',
  'MessageQueue',
  'Systrace',
];

function isDev(): boolean {
  return typeof __DEV__ !== 'undefined' ? __DEV__ : false;
}

function isInternalFrame(frame: StackFrame): boolean {
  const haystack = `${frame.methodName} ${frame.file}`;
  return INTERNAL_MARKERS.some((marker) => haystack.includes(marker));
}

export function parseStack(stack: string): StackFrame[] {
  const frames: StackFrame[] = [];
  for (const rawLine of stack.split('\n')) {
    const line = rawLine.trim();
    if (!line || line === 'Error' || line.startsWith('Error:')) {
      continue;
    }

    // V8 / Hermes: "at methodName (file:line:col)"
    let match = /^at\s+(.+?)\s+\((.+?)(?::(\d+):(\d+))?\)$/.exec(line);
    if (match) {
      frames.push({
        methodName: match[1] ?? '',
        file: match[2] ?? '',
        line: match[3] ? Number(match[3]) : undefined,
        column: match[4] ? Number(match[4]) : undefined,
        raw: line,
      });
      continue;
    }

    // V8 anonymous: "at file:line:col"
    match = /^at\s+(.+?)(?::(\d+):(\d+))?$/.exec(line);
    if (match) {
      frames.push({
        methodName: '',
        file: match[1] ?? '',
        line: match[2] ? Number(match[2]) : undefined,
        column: match[3] ? Number(match[3]) : undefined,
        raw: line,
      });
      continue;
    }

    // JSC / Hermes alt: "methodName@file:line:col"
    match = /^(.*?)@(.+?)(?::(\d+):(\d+))?$/.exec(line);
    if (match) {
      frames.push({
        methodName: match[1] ?? '',
        file: match[2] ?? '',
        line: match[3] ? Number(match[3]) : undefined,
        column: match[4] ? Number(match[4]) : undefined,
        raw: line,
      });
      continue;
    }

    frames.push({ methodName: '', file: line, raw: line });
  }
  return frames;
}

function pickAppFrame(frames: StackFrame[]): StackFrame | undefined {
  return frames.find((frame) => !isInternalFrame(frame)) ?? frames[0];
}

function shortenFile(file: string): string {
  let out = file.replace(/\?.*$/, ''); // strip query string
  out = out.replace(/^https?:\/\/[^/]+\//, ''); // strip host
  out = out.replace(/^webpack:\/\/(_N_E\/)?/, '');
  const srcIdx = out.lastIndexOf('/src/');
  if (srcIdx >= 0) {
    out = out.slice(srcIdx + 1);
  }
  return out;
}

function frameToOrigin(frame: StackFrame): RequestOrigin {
  return {
    file: shortenFile(frame.file),
    line: frame.line,
    column: frame.column,
    methodName: frame.methodName || undefined,
    raw: frame.raw,
  };
}

/** Best-effort, synchronous origin: the top app frame as captured. */
export function resolveOriginSync(
  stack: string | undefined
): RequestOrigin | undefined {
  if (!stack) {
    return undefined;
  }
  const frame = pickAppFrame(parseStack(stack));
  return frame ? frameToOrigin(frame) : undefined;
}

// --- Metro symbolication (dev only, best effort) ----------------------------

let devServerOrigin: string | null | undefined;

function getDevServerOrigin(): string | undefined {
  if (devServerOrigin !== undefined) {
    return devServerOrigin ?? undefined;
  }
  try {
    const sourceCode = NativeModules?.SourceCode as
      | { getConstants?: () => { scriptURL?: string }; scriptURL?: string }
      | undefined;
    const scriptURL =
      sourceCode?.getConstants?.().scriptURL ?? sourceCode?.scriptURL;
    const match = scriptURL ? /^(https?:\/\/[^/]+)\//.exec(scriptURL) : null;
    devServerOrigin = match?.[1] ?? null;
  } catch {
    devServerOrigin = null;
  }
  return devServerOrigin ?? undefined;
}

async function metroSymbolicate(
  stack: string
): Promise<StackFrame[] | undefined> {
  const origin = getDevServerOrigin();
  if (!origin) {
    return undefined;
  }
  try {
    const input = parseStack(stack).map((frame) => ({
      file: frame.file,
      methodName: frame.methodName || null,
      lineNumber: frame.line ?? null,
      column: frame.column ?? null,
    }));
    const response = await fetch(`${origin}/symbolicate`, {
      method: 'POST',
      body: JSON.stringify({ stack: input }),
    });
    const json = (await response.json()) as {
      stack?: Array<{
        methodName?: string;
        file?: string;
        lineNumber?: number;
        column?: number;
      }>;
    };
    if (!Array.isArray(json.stack)) {
      return undefined;
    }
    return json.stack.map((frame) => ({
      methodName: frame.methodName ?? '',
      file: frame.file ?? '',
      line: typeof frame.lineNumber === 'number' ? frame.lineNumber : undefined,
      column: typeof frame.column === 'number' ? frame.column : undefined,
      raw: `${frame.methodName ?? ''} (${frame.file ?? ''}:${frame.lineNumber ?? '?'})`,
    }));
  } catch {
    return undefined;
  }
}

const cache = new Map<string, RequestOrigin | undefined>();

/**
 * Resolve the richest origin we can for a stack:
 *   1. a user-supplied resolver (source map),
 *   2. Metro's /symbolicate endpoint when running against a dev server,
 *   3. the raw top app frame.
 * Results are cached per stack.
 */
export async function symbolicate(
  stack: string | undefined
): Promise<RequestOrigin | undefined> {
  if (!stack) {
    return undefined;
  }
  if (cache.has(stack)) {
    return cache.get(stack);
  }

  const appFrame = pickAppFrame(parseStack(stack));
  let origin: RequestOrigin | undefined;

  if (resolver && appFrame) {
    try {
      origin = await resolver(appFrame);
    } catch {
      // fall through
    }
  }

  if (!origin && isDev()) {
    const symbolicated = await metroSymbolicate(stack);
    const frame = symbolicated ? pickAppFrame(symbolicated) : undefined;
    if (frame) {
      origin = frameToOrigin(frame);
    }
  }

  if (!origin && appFrame) {
    origin = frameToOrigin(appFrame);
  }

  cache.set(stack, origin);
  return origin;
}

export function isSymbolicateUrl(url: string): boolean {
  return url.includes('/symbolicate');
}
