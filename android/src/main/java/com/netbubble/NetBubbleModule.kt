package com.netbubble

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableMap

class NetBubbleModule(reactContext: ReactApplicationContext) :
  NativeNetBubbleSpec(reactContext) {

  override fun getName(): String = NAME

  override fun start() {
    NetBubbleEmitter.attach(this)
    NetBubbleInterceptor.enabled = true
  }

  override fun stop() {
    NetBubbleInterceptor.enabled = false
    NetBubbleEmitter.detach(this)
  }

  override fun isRunning(): Boolean = NetBubbleInterceptor.enabled

  override fun setMaxBodyBytes(bytes: Double) {
    NetBubbleInterceptor.maxBodyBytes = bytes.toLong()
  }

  /**
   * Read the composed Hermes+Metro source map that the netbubble-source-maps
   * Gradle script bakes into `src/main/assets/netbubble-source-map.json`.
   * Returns an empty string when the file is absent (debug builds / prod).
   */
  override fun readBundledSourceMap(promise: Promise) {
    try {
      val stream = reactApplicationContext.assets.open("netbubble-source-map.json")
      val text = stream.bufferedReader(Charsets.UTF_8).use { it.readText() }
      promise.resolve(text)
    } catch (_: Throwable) {
      promise.resolve("")
    }
  }

  override fun invalidate() {
    NetBubbleInterceptor.enabled = false
    NetBubbleEmitter.detach(this)
    super.invalidate()
  }

  /**
   * Called by [NetBubbleEmitter] from arbitrary network threads. The Codegen
   * emitter marshals to the JS thread; we still guard against a torn-down bridge
   * during reloads.
   */
  fun dispatchEvent(event: WritableMap) {
    try {
      emitOnNetworkEvent(event)
    } catch (_: Throwable) {
      // Bridge may be mid-teardown; drop the event.
    }
  }

  companion object {
    const val NAME = NativeNetBubbleSpec.NAME
  }
}
