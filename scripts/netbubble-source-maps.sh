#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# NetBubble: offline Hermes symbolication — Xcode run-script build phase
# ─────────────────────────────────────────────────────────────────────────────
#
# Composes the Metro packager map and the Hermes compiler map into a single
# source map that translates Hermes bytecode frames back to the original
# TypeScript / JavaScript file:line without a Metro server.
#
# HOW TO ADD THIS PHASE
# ──────────────────────
#  1. In Xcode open your project → select the app target → Build Phases.
#  2. Click + → New Run Script Phase.
#  3. Drag the new phase **after** "Bundle React Native code and images"
#     (that phase produces the maps we need to compose).
#  4. Paste the following as the shell script content:
#
#       "${SRCROOT}/../node_modules/react-native-net-bubble/scripts/netbubble-source-maps.sh"
#
#  5. Optionally rename the phase to "NetBubble: compose source maps".
#  6. Rebuild the app.
#
# PRODUCTION GATING
# ─────────────────
# The script exits 0 immediately for any build configuration named exactly
# "Release" — the assumption being that "Release" → App Store / production.
#
# If your production variant uses a different configuration name (e.g.
# "Prod" or "Production"), update the guard condition at the top of the
# script body below.
#
# ENABLING SOURCE MAPS IN YOUR XCODE PROJECT
# ──────────────────────────────────────────
# RN's "Bundle React Native code and images" phase only writes source maps
# when the SOURCEMAP_FILE build setting is defined. Add it to your scheme:
#
#   Product → Scheme → Edit Scheme → Build → Pre-actions:
#     export SOURCEMAP_FILE="$(dirname "$CONFIGURATION_BUILD_DIR")/sourcemaps/main.jsbundle.packager.js.map"
#
# Or set it directly in the "Bundle React Native code and images" phase's
# environment by appending to the shell script:
#   export SOURCEMAP_FILE=...
#
# REQUIREMENTS
# ────────────
# • React Native 0.73+ (ships compose-source-maps.js).
# • Hermes enabled (the default on RN 0.70+). Without Hermes the script
#   copies the Metro map directly — symbolication still works.
# ─────────────────────────────────────────────────────────────────────────────

set -e

# ── 1. Gate on configuration ─────────────────────────────────────────────────
# Skip real production (App Store) builds.
# Change "Release" to match your production configuration name if it differs.
if [ "$CONFIGURATION" = "Release" ]; then
  echo "[NetBubble] Skipping source map composition for '$CONFIGURATION' configuration."
  exit 0
fi

# ── 2. Resolve paths ─────────────────────────────────────────────────────────
# SRCROOT   = ios/    →    PROJECT_ROOT = <project-root>/
PROJECT_ROOT="${SRCROOT}/.."

# Standard locations where the RN bundle phase writes maps
RESOURCES="${CONFIGURATION_BUILD_DIR}/${UNLOCALIZED_RESOURCES_FOLDER_PATH}"

# The Metro packager source map.
# If you set SOURCEMAP_FILE in your scheme the map ends up at that path
# instead; we check both locations.
PACKAGER_MAP="${RESOURCES}/main.jsbundle.packager.js.map"
if [ -n "${SOURCEMAP_FILE}" ] && [ -f "${SOURCEMAP_FILE}" ]; then
  PACKAGER_MAP="${SOURCEMAP_FILE}"
fi

# The Hermes compiler source map (produced after Hermes compiles the bundle).
HERMES_MAP="${RESOURCES}/main.jsbundle.compiler.js.map"

# compose-source-maps.js ships with react-native
COMPOSE="${PROJECT_ROOT}/node_modules/react-native/scripts/compose-source-maps.js"

# Output goes directly into the app bundle's resources folder so NSBundle
# can locate it by name ("netbubble-source-map", type "json").
OUTPUT="${RESOURCES}/netbubble-source-map.json"

# ── 3. Bail out early if no map to work with ────────────────────────────────
if [ ! -f "$PACKAGER_MAP" ]; then
  echo "[NetBubble] Packager source map not found at:"
  echo "  $PACKAGER_MAP"
  echo "  Enable SOURCEMAP_FILE in your Xcode scheme or the 'Bundle React"
  echo "  Native code and images' build phase to produce maps for non-debug builds."
  exit 0
fi

if [ ! -f "$COMPOSE" ]; then
  echo "[NetBubble] compose-source-maps.js not found at $COMPOSE"
  echo "  Ensure react-native is installed in ${PROJECT_ROOT}/node_modules"
  exit 0
fi

# ── 4. Compose ───────────────────────────────────────────────────────────────
if [ -f "$HERMES_MAP" ]; then
  echo "[NetBubble] Composing Hermes + Metro source maps → $OUTPUT"
  node "$COMPOSE" "$PACKAGER_MAP" "$HERMES_MAP" -o "$OUTPUT"
else
  echo "[NetBubble] Hermes compiler map not found — copying Metro map only → $OUTPUT"
  cp "$PACKAGER_MAP" "$OUTPUT"
fi

SIZE_KB=$(( $(wc -c < "$OUTPUT") / 1024 ))
echo "[NetBubble] Done. Composed source map: ${SIZE_KB} KB"
