export type GatingOptions = {
  /**
   * Explicit on/off switch. When provided it wins over everything else — this
   * is the recommended knob to wire to your own environment flag, e.g.
   * `enabled={getApiBaseUrl() !== PROD_BASE_URL}`.
   */
  enabled?: boolean;
  /**
   * Convenience: the API base URL the app is currently pointed at. If it equals
   * `prodBaseUrl` the inspector stays off. Reuses the flag you already have for
   * swapping dev/QA/prod endpoints — no extra infrastructure.
   */
  baseUrl?: string;
  prodBaseUrl?: string;
};

/**
 * Decide whether the inspector should mount. Resolution order:
 *   1. `enabled` if it's a boolean.
 *   2. `baseUrl !== prodBaseUrl` if both are provided.
 *   3. `__DEV__`.
 */
export function isInspectorEnabled(options: GatingOptions = {}): boolean {
  if (typeof options.enabled === 'boolean') {
    return options.enabled;
  }
  if (options.baseUrl != null && options.prodBaseUrl != null) {
    return options.baseUrl !== options.prodBaseUrl;
  }
  return typeof __DEV__ !== 'undefined' ? __DEV__ : false;
}
