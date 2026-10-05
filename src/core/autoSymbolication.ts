import type { RequestOrigin } from '../types';
import { NativeNetBubble } from '../nativeModule';
import { configureSymbolication } from './symbolication';
import type { StackFrame } from './symbolication';
import { createSourceMapLookup } from './sourceMap';
import { networkStore } from '../store/NetworkStore';

// Guard: only configure once per JS runtime lifetime.
let initiated = false;

/**
 * One-call setup for release-build symbolication without a Metro server.
 *
 * Under the hood it does three things:
 *   1. Calls the native `readBundledSourceMap()` method to load the
 *      **composed** Hermes-bytecode → Metro-bundle → original-source map that
 *      the build scripts (`scripts/netbubble-source-maps.gradle` /
 *      `scripts/netbubble-source-maps.sh`) bake into the app binary.
 *   2. Builds a source map lookup from the JSON (no extra dependency).
 *   3. Registers a frame resolver via `configureSymbolication` so every
 *      captured request shows the exact `ProfileScreen.tsx:84` that fired it,
 *      even in a Hermes release build with no debugger attached.
 *
 * ### Prerequisites
 *
 * Apply the Android Gradle snippet **and** add the iOS Xcode build phase
 * described in the `scripts/` directory of this package so the binary
 * actually contains the composed map.
 *
 * ### Usage
 *
 * Call this once at startup, before `<NetBubble>` mounts:
 *
 * ```ts
 * import { configureAutoSymbolication } from 'react-native-net-bubble';
 *
 * // top of App.tsx / index.js — outside any component
 * configureAutoSymbolication(); // fire-and-forget; async internally
 * ```
 *
 * In debug builds (where Metro is running) this is a no-op — the existing
 * Metro `/symbolicate` path handles frames automatically.
 *
 * ### What the build scripts produce
 *
 * React Native compiles JS through two stages when Hermes is enabled:
 *
 * ```
 * Metro bundler → main.jsbundle + packager.js.map
 *                                      │
 *             Hermes compiler ──────── ┤
 *                    ↓                 │
 *              bytecode (HBC)   compiler.js.map
 *                                      │
 *          compose-source-maps.js ─────┘
 *                    ↓
 *           netbubble-source-map.json   ← baked into the app binary
 *                                           (Android assets / iOS bundle)
 * ```
 *
 * The composed map translates a Hermes bytecode frame directly to the
 * original TypeScript / JavaScript file and line number.
 */
export async function configureAutoSymbolication(): Promise<void> {
  if (initiated) return;
  initiated = true;

  // In __DEV__ Metro handles symbolication live — nothing to do.
  if (typeof __DEV__ !== 'undefined' && __DEV__) return;

  if (NativeNetBubble == null) return;

  // ── 1. Read the composed map from the app binary ─────────────────────────
  let mapJson: string;
  try {
    mapJson = await NativeNetBubble.readBundledSourceMap();
  } catch {
    return;
  }
  if (!mapJson) return; // map not bundled (prod or scripts not applied)

  // ── 2. Parse the map ─────────────────────────────────────────────────────
  let lookup: ReturnType<typeof createSourceMapLookup>;
  try {
    lookup = createSourceMapLookup(mapJson);
  } catch {
    return;
  }

  // ── 3. Register the resolver and re-process any already-captured records ──
  // configureSymbolication clears the symbolication cache so stale
  // "index.android.bundle" results are evicted. resymbolicateAll() then
  // re-runs upgradeOrigin for every record captured before this resolver was
  // ready, so their .origin fields are upgraded to real file:line values.
  configureSymbolication({
    resolveFrame: (frame: StackFrame): RequestOrigin | undefined => {
      if (frame.line == null) return undefined;

      const pos = lookup(frame.line, frame.column ?? 0);
      if (!pos) return undefined;

      // Trim leading absolute-path noise so paths read like
      // "src/screens/ProfileScreen.tsx" rather than
      // "C:/Users/.../example/src/screens/ProfileScreen.tsx".
      //
      // Strategy (applied in order, first match wins):
      //   1. anything up to and including "/node_modules/" →  "node_modules/…"
      //   2. anything up to and including the last "/src/"  →  "src/…"
      //   3. just take the last two path segments           →  "dir/file.tsx"
      // node_modules goes first so a dependency's own src/ folder keeps its
      // "node_modules/" prefix and is still recognised as non-app code.
      let src = pos.source.replace(/\\/g, '/');
      const nmIdx = src.lastIndexOf('/node_modules/');
      const srcIdx = src.lastIndexOf('/src/');
      if (nmIdx >= 0) {
        src = src.slice(nmIdx + 1); // "node_modules/…"
      } else if (srcIdx >= 0) {
        src = src.slice(srcIdx + 1); // "src/…"
      } else {
        // Fall back: last two segments so it's still readable
        const parts = src.split('/').filter(Boolean);
        src = parts.slice(-2).join('/');
      }
      const file = src;

      return {
        file,
        line: pos.line,
        column: pos.column,
        methodName: pos.name ?? (frame.methodName || undefined),
        raw: frame.raw,
      };
    },
  });

  // Re-symbolicate any records that were captured before the resolver was
  // ready (they cached "index.android.bundle" as the origin).
  networkStore.resymbolicateAll();
}
