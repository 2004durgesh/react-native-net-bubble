import { pushPendingStack, clearPendingStacks } from './stackRegistry';

type OpenFn = XMLHttpRequest['open'];

let installed = false;
let originalOpen: OpenFn | undefined;

function captureStack(): string {
  return new Error('[NetBubble] request origin').stack ?? '';
}

/**
 * Patch `XMLHttpRequest.prototype.open` to record the JS call-site stack for
 * every request. React Native implements `fetch()` on top of XHR, so this one
 * patch covers both `fetch()` and direct `XMLHttpRequest` usage. `open()` runs
 * synchronously from the caller, so the captured stack still contains the app
 * frame that initiated the request.
 *
 * We only capture the stack here; the actual request/response data comes from
 * the native interceptors. The two are correlated in `stackRegistry.ts`.
 */
export function installJsCapture(): void {
  if (installed) {
    return;
  }
  if (typeof XMLHttpRequest === 'undefined' || !XMLHttpRequest.prototype) {
    return;
  }

  installed = true;
  originalOpen = XMLHttpRequest.prototype.open;
  const base = originalOpen as (
    this: XMLHttpRequest,
    ...args: unknown[]
  ) => void;

  function patchedOpen(
    this: XMLHttpRequest,
    method: string,
    url: string,
    ...rest: unknown[]
  ): void {
    try {
      pushPendingStack(method, url, captureStack());
    } catch {
      // Instrumentation must never break a real request.
    }
    base.apply(this, [method, url, ...rest]);
  }

  XMLHttpRequest.prototype.open = patchedOpen as OpenFn;
}

export function uninstallJsCapture(): void {
  if (!installed) {
    return;
  }
  if (typeof XMLHttpRequest !== 'undefined' && originalOpen) {
    XMLHttpRequest.prototype.open = originalOpen;
  }
  originalOpen = undefined;
  installed = false;
  clearPendingStacks();
}
