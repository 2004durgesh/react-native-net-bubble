import { TurboModuleRegistry } from 'react-native';
import type { Spec } from './NativeNetBubble';

/**
 * Non-throwing accessor for the native TurboModule.
 *
 * We deliberately use `TurboModuleRegistry.get` (not `getEnforcing`) so that
 * environments where the native side isn't present — react-native-web, Jest,
 * a misconfigured build — degrade gracefully to `null` instead of throwing at
 * import time. The `getEnforcing` call in `./NativeNetBubble.ts` exists only so
 * Codegen can discover the spec; it is never imported at runtime.
 */
export const NativeNetBubble: Spec | null =
  TurboModuleRegistry.get<Spec>('NetBubble') ?? null;

export function requireNativeModule(): Spec | null {
  if (NativeNetBubble == null && __DEV__) {
    console.warn(
      '[NetBubble] Native module "NetBubble" is not available. ' +
        'Make sure the New Architecture is enabled and the app was rebuilt ' +
        'after installing react-native-net-bubble.'
    );
  }
  return NativeNetBubble;
}
