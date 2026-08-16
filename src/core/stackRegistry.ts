/**
 * A small holding area for JS call-site stacks captured in `jsCapture.ts`.
 *
 * Native interception (OkHttp / NSURLProtocol) sees the request but not the JS
 * stack that triggered it. The JS-side XHR patch sees the stack but not the
 * native request id. We bridge the two here by correlating on method + url +
 * time: the JS side pushes a pending stack, and when the native "request" event
 * arrives the store claims the closest matching stack.
 */

type PendingStack = {
  method: string;
  url: string;
  time: number;
  stack: string;
};

const MAX_PENDING = 256;
const MATCH_WINDOW_MS = 10_000;

let pending: PendingStack[] = [];

export function pushPendingStack(
  method: string,
  url: string,
  stack: string
): void {
  pending.push({ method: method.toUpperCase(), url, time: Date.now(), stack });
  if (pending.length > MAX_PENDING) {
    pending = pending.slice(pending.length - MAX_PENDING);
  }
}

/**
 * Claim (and remove) the pending stack that best matches a native request.
 * Matches on method + exact url, choosing the entry closest in time within
 * `MATCH_WINDOW_MS`.
 */
export function takeMatchingStack(
  method: string,
  url: string,
  time: number
): string | undefined {
  const wanted = method.toUpperCase();
  let bestIdx = -1;
  let bestDelta = MATCH_WINDOW_MS + 1;

  for (let i = 0; i < pending.length; i++) {
    const entry = pending[i];
    if (entry === undefined) {
      continue;
    }
    if (entry.method !== wanted || entry.url !== url) {
      continue;
    }
    const delta = Math.abs(entry.time - time);
    if (delta < bestDelta) {
      bestDelta = delta;
      bestIdx = i;
    }
  }

  if (bestIdx === -1) {
    return undefined;
  }
  const [claimed] = pending.splice(bestIdx, 1);
  return claimed?.stack;
}

export function clearPendingStacks(): void {
  pending = [];
}
