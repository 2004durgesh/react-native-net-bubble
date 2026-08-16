import type { NetworkEventPayload } from '../NativeNetBubble';
import type { NetworkRecord, NetworkRequestState } from '../types';
import { takeMatchingStack } from '../core/stackRegistry';
import {
  resolveOriginSync,
  symbolicate,
  isSymbolicateUrl,
} from '../core/symbolication';

type Listener = () => void;

function parseHeaders(json: string): Record<string, string> {
  if (!json) {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(json);
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, string>;
    }
  } catch {
    // ignore malformed header json
  }
  return {};
}

function stateFor(payload: NetworkEventPayload): NetworkRequestState {
  if (payload.phase === 'error') {
    return 'error';
  }
  if (payload.status === 0 || payload.status >= 400) {
    return 'error';
  }
  return 'success';
}

/**
 * In-memory, observable ring buffer of network records. Native lifecycle events
 * ("request", then "response"/"error") are merged by id. Updates are coalesced
 * onto a 16ms tick so a burst of requests doesn't thrash React.
 */
class NetworkStore {
  private records = new Map<string, NetworkRecord>();
  private listeners = new Set<Listener>();
  private snapshot: NetworkRecord[] = [];
  private maxRecords = 500;
  private flushScheduled = false;
  private symbolicating = new Set<string>();

  setMaxRecords(value: number): void {
    this.maxRecords = Math.max(1, Math.floor(value));
    this.trim();
    this.scheduleFlush();
  }

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): NetworkRecord[] => this.snapshot;

  clear = (): void => {
    this.records.clear();
    this.symbolicating.clear();
    this.flush();
  };

  ingest = (payload: NetworkEventPayload): void => {
    // Metro's own symbolicate round-trips would otherwise show up as noise.
    if (isSymbolicateUrl(payload.url)) {
      return;
    }

    const existing = this.records.get(payload.id);
    const arrivedAt = payload.startTime || Date.now();

    if (payload.phase === 'request') {
      const stack = takeMatchingStack(payload.method, payload.url, arrivedAt);
      if (existing) {
        this.records.set(payload.id, {
          ...existing,
          requestHeaders: parseHeaders(payload.requestHeadersJson),
          requestBody: payload.requestBody || existing.requestBody,
          requestBodyTruncated:
            payload.requestBodyTruncated || existing.requestBodyTruncated,
          stack: existing.stack ?? stack,
          origin: existing.origin ?? resolveOriginSync(stack),
        });
      } else {
        this.records.set(payload.id, {
          id: payload.id,
          method: payload.method,
          url: payload.url,
          requestHeaders: parseHeaders(payload.requestHeadersJson),
          requestBody: payload.requestBody || undefined,
          requestBodyTruncated: payload.requestBodyTruncated,
          responseBodyTruncated: false,
          startTime: arrivedAt,
          state: 'pending',
          platform: payload.platform,
          stack,
          origin: resolveOriginSync(stack),
        });
        this.trim();
      }
      if (stack) {
        this.upgradeOrigin(payload.id, stack);
      }
    } else {
      const updates: Partial<NetworkRecord> = {
        status: payload.status || undefined,
        statusText: payload.statusText || undefined,
        responseHeaders: parseHeaders(payload.responseHeadersJson),
        responseBody: payload.responseBody || undefined,
        responseBodyTruncated: payload.responseBodyTruncated,
        contentType: payload.contentType || undefined,
        endTime: payload.endTime || Date.now(),
        duration: payload.duration || undefined,
        error: payload.error || undefined,
        state: stateFor(payload),
      };

      if (existing) {
        this.records.set(payload.id, { ...existing, ...updates });
      } else {
        // Response arrived without a preceding "request" event (rare); build a
        // record from what we have.
        const stack = takeMatchingStack(payload.method, payload.url, arrivedAt);
        this.records.set(payload.id, {
          id: payload.id,
          method: payload.method,
          url: payload.url,
          requestHeaders: parseHeaders(payload.requestHeadersJson),
          requestBody: undefined,
          requestBodyTruncated: false,
          responseBodyTruncated: payload.responseBodyTruncated,
          startTime: arrivedAt,
          platform: payload.platform,
          stack,
          origin: resolveOriginSync(stack),
          status: payload.status || undefined,
          statusText: payload.statusText || undefined,
          responseHeaders: parseHeaders(payload.responseHeadersJson),
          responseBody: payload.responseBody || undefined,
          contentType: payload.contentType || undefined,
          endTime: payload.endTime || Date.now(),
          duration: payload.duration || undefined,
          error: payload.error || undefined,
          state: stateFor(payload),
        });
        this.trim();
        if (stack) {
          this.upgradeOrigin(payload.id, stack);
        }
      }
    }

    this.scheduleFlush();
  };

  /** Asynchronously upgrade a record's origin via full symbolication. */
  private upgradeOrigin(id: string, stack: string): void {
    if (this.symbolicating.has(id)) {
      return;
    }
    this.symbolicating.add(id);
    symbolicate(stack)
      .then((origin) => {
        this.symbolicating.delete(id);
        if (!origin) {
          return;
        }
        const record = this.records.get(id);
        if (!record) {
          return;
        }
        this.records.set(id, { ...record, origin });
        this.scheduleFlush();
      })
      .catch(() => {
        this.symbolicating.delete(id);
      });
  }

  private trim(): void {
    while (this.records.size > this.maxRecords) {
      const oldest = this.records.keys().next().value;
      if (oldest === undefined) {
        break;
      }
      this.records.delete(oldest);
    }
  }

  private scheduleFlush(): void {
    if (this.flushScheduled) {
      return;
    }
    this.flushScheduled = true;
    setTimeout(() => {
      this.flushScheduled = false;
      this.flush();
    }, 16);
  }

  private flush(): void {
    this.snapshot = Array.from(this.records.values());
    for (const listener of this.listeners) {
      listener();
    }
  }
}

export const networkStore = new NetworkStore();
