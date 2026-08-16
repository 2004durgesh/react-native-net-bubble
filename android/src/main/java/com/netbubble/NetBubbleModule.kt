package com.netbubble

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
