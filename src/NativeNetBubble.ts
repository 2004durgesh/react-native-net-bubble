import { TurboModuleRegistry } from 'react-native';
import type { TurboModule, CodegenTypes } from 'react-native';

/**
 * The payload emitted by the native interceptors for every request lifecycle
 * event. Codegen only supports primitive fields in event payloads, so headers
 * and bodies travel as JSON strings / plain strings and are re-hydrated on the
 * JS side (see `store/NetworkStore.ts`).
 *
 * A single request produces two events in the happy path:
 *   1. phase: "request"  — emitted the moment the request leaves the app.
 *   2. phase: "response" — emitted once the response is received.
 * A failed request produces phase: "error" instead of "response".
 */
export type NetworkEventPayload = {
  /** Stable id correlating the "request" and "response"/"error" events. */
  id: string;
  /** "request" | "response" | "error" */
  phase: string;
  method: string;
  url: string;
  /** JSON.stringify of Record<string, string>. */
  requestHeadersJson: string;
  requestBody: string;
  requestBodyTruncated: boolean;
  /** HTTP status code. 0 until the response arrives. */
  status: number;
  statusText: string;
  /** JSON.stringify of Record<string, string>. */
  responseHeadersJson: string;
  responseBody: string;
  responseBodyTruncated: boolean;
  contentType: string;
  /** Epoch milliseconds. */
  startTime: number;
  /** Epoch milliseconds. 0 until the response arrives. */
  endTime: number;
  /** Milliseconds. 0 until the response arrives. */
  duration: number;
  /** Non-empty only for phase: "error". */
  error: string;
  /** "android" | "ios" */
  platform: string;
};

export interface Spec extends TurboModule {
  /** Enable native interception + event emission. Called only in non-prod. */
  start(): void;
  /** Disable native interception + event emission. */
  stop(): void;
  isRunning(): boolean;
  /** Cap the number of body bytes captured per request (default 1 MiB). */
  setMaxBodyBytes(bytes: number): void;

  readonly onNetworkEvent: CodegenTypes.EventEmitter<NetworkEventPayload>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('NetBubble');
