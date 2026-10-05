#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# NetBubble: offline Hermes symbolication — Xcode run-script build phase
# ─────────────────────────────────────────────────────────────────────────────
#
# Copies the source map produced by React Native's "Bundle React Native code
# and images" phase into the app bundle as `netbubble-source-map.json`, where
# `configureAutoSymbolication()` reads it at runtime. With Hermes enabled, RN
# has already composed the Metro and Hermes maps into that file, so it maps
# bytecode frames straight back to your original file:line.
#
# SETUP
# ─────
#  1. Add a User-Defined build setting to your app target (Build Settings →
#     + → Add User-Defined Setting) for every configuration that should get a
#     map:
#
#       SOURCEMAP_FILE = $(DERIVED_FILE_DIR)/main.jsbundle.map
#
#     It must be a build setting (not `.xcode.env` or a scheme pre-action) so
#     both RN's bundle phase and this phase see it. Don't point it into
#     $(CONFIGURATION_BUILD_DIR): RN deletes its intermediate map there.
#
#  2. Add a Run Script phase **after** "Bundle React Native code and images"
#     with this body:
#
#       "${SRCROOT}/../node_modules/react-native-net-bubble/scripts/netbubble-source-maps.sh"
#
# PRODUCTION GATING
# ─────────────────
# Configurations named exactly "Release" are skipped, on the assumption that
# Release is your App Store build. To include the map in Release anyway (e.g.
# for QA builds), also set this build setting for Release:
#
#   NETBUBBLE_SOURCE_MAPS_IN_RELEASE = YES
# ─────────────────────────────────────────────────────────────────────────────

set -e

if [ "$CONFIGURATION" = "Release" ] && [ "$NETBUBBLE_SOURCE_MAPS_IN_RELEASE" != "YES" ]; then
  echo "[NetBubble] Skipping source map for '$CONFIGURATION' (set NETBUBBLE_SOURCE_MAPS_IN_RELEASE=YES to include it)."
  exit 0
fi

if [ -z "$SOURCEMAP_FILE" ] || [ ! -f "$SOURCEMAP_FILE" ]; then
  echo "[NetBubble] No source map at SOURCEMAP_FILE='${SOURCEMAP_FILE}'."
  echo "  Add the SOURCEMAP_FILE build setting to your app target (see this script's header)."
  echo "  Debug simulator builds don't bundle JS, so this is expected there."
  exit 0
fi

OUTPUT="${CONFIGURATION_BUILD_DIR}/${UNLOCALIZED_RESOURCES_FOLDER_PATH}/netbubble-source-map.json"
cp "$SOURCEMAP_FILE" "$OUTPUT"

SIZE_KB=$(( $(wc -c < "$OUTPUT") / 1024 ))
echo "[NetBubble] Source map (${SIZE_KB} KB) → $OUTPUT"
