/** Public domain types for the network inspector. */

export type NetworkRequestState = 'pending' | 'success' | 'error';

/**
 * Where in your codebase a request originated, derived from the JS call-site
 * stack captured at request time. Precision depends on symbolication:
 * out of the box you get the function name plus a bundle location; wire up a
 * source map (see `configureSymbolication`) to get `ProfileScreen.tsx:84`.
 */
export type RequestOrigin = {
  /** Best-known source file, e.g. "src/screens/ProfileScreen.tsx". */
  file: string;
  line?: number;
  column?: number;
  /** Enclosing function name if known, e.g. "fetchUser". */
  methodName?: string;
  /** The raw stack frame the origin was derived from. */
  raw: string;
};

/** A single request/response pair, merged from the native lifecycle events. */
export type NetworkRecord = {
  id: string;
  method: string;
  url: string;
  requestHeaders: Record<string, string>;
  requestBody?: string;
  requestBodyTruncated: boolean;
  status?: number;
  statusText?: string;
  responseHeaders?: Record<string, string>;
  responseBody?: string;
  responseBodyTruncated: boolean;
  contentType?: string;
  /** Epoch milliseconds. */
  startTime: number;
  /** Epoch milliseconds. */
  endTime?: number;
  /** Milliseconds. */
  duration?: number;
  error?: string;
  state: NetworkRequestState;
  /** "android" | "ios". */
  platform: string;
  /** Raw JS call-site stack, when it could be correlated. */
  stack?: string;
  /** Resolved origin (filled synchronously with a best guess, upgraded async). */
  origin?: RequestOrigin;
};
